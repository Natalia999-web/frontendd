from datetime import datetime
from sqlalchemy.orm import Session

from src.shared.services.models import Notificacion


def notificar(
    db: Session,
    tipo: str,
    titulo: str,
    mensaje: str,
    referencia_id: int,
    ruta: str = None,
) -> None:
    """Inserta una notificación solo si no existe ya una sin leer del mismo tipo y referencia.

    Además envía un push al celular de los administradores: toda notificación
    que aparece en el panel se avisa en tiempo real, sin repetir la lógica en
    cada módulo. Es best-effort (no rompe la operación si Firebase falla) y solo
    se envía cuando la notificación es nueva, para no repetir avisos.
    """
    existe = db.query(Notificacion).filter(
        Notificacion.Tipo          == tipo,
        Notificacion.Referencia_ID == referencia_id,
        Notificacion.Leida         == False,
    ).first()
    if not existe:
        db.add(Notificacion(
            Tipo          = tipo,
            Titulo        = titulo,
            Mensaje       = mensaje,
            Referencia_ID = referencia_id,
            Ruta          = ruta,
            Fecha         = datetime.now(),
            Leida         = False,
        ))
        try:
            from src.shared.services.fcm_service import notificar_admins_push
            notificar_admins_push(titulo, mensaje, db=db, tipo=tipo,
                                  referencia_id=referencia_id)
        except Exception:
            pass


def descartar_notificacion(db: Session, tipo: str, referencia_id: int) -> None:
    """Marca como leída la notificación no leída de ese tipo+referencia (auto-dismiss)."""
    db.query(Notificacion).filter(
        Notificacion.Tipo          == tipo,
        Notificacion.Referencia_ID == referencia_id,
        Notificacion.Leida         == False,
    ).update({"Leida": True})


def notificar_stock_insumo(db: Session, insumo) -> None:
    """Crea o descarta notificación de stock según el estado actual del insumo."""
    if insumo.Estado == 15:
        notificar(
            db, "stock_agotado_insumo", "Insumo agotado",
            f"El insumo '{insumo.Nombre}' se ha agotado",
            insumo.ID_Insumo, f"/compras/insumos/{insumo.ID_Insumo}",
        )
    elif insumo.Estado == 14:
        notificar(
            db, "stock_minimo_insumo", "Stock mínimo de insumo",
            f"El insumo '{insumo.Nombre}' tiene stock bajo ({insumo.Stock_Actual or 0} unidades)",
            insumo.ID_Insumo, f"/compras/insumos/{insumo.ID_Insumo}",
        )
    elif insumo.Estado == 1:
        descartar_notificacion(db, "stock_minimo_insumo",  insumo.ID_Insumo)
        descartar_notificacion(db, "stock_agotado_insumo", insumo.ID_Insumo)


def notificar_stock_producto(db: Session, producto) -> None:
    """Crea o descarta notificación de stock según el estado actual del producto."""
    if producto.Estado == 15:
        notificar(
            db, "stock_agotado_producto", "Producto agotado",
            f"El producto '{producto.nombre}' se ha agotado",
            producto.ID_Producto, f"/produccion/productos/{producto.ID_Producto}",
        )
    elif producto.Estado == 14:
        notificar(
            db, "stock_minimo_producto", "Stock mínimo de producto",
            f"El producto '{producto.nombre}' tiene stock bajo ({producto.Stock or 0} unidades)",
            producto.ID_Producto, f"/produccion/productos/{producto.ID_Producto}",
        )
    elif producto.Estado == 1:
        descartar_notificacion(db, "stock_minimo_producto",  producto.ID_Producto)
        descartar_notificacion(db, "stock_agotado_producto", producto.ID_Producto)
