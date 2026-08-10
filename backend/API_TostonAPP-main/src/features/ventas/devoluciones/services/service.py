from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal

from src.shared.services.models import (
    Devolucion, DevolucionDetalle, Venta, VentaXProducto, Usuario,
    Producto, CreditoCliente, MovimientoCredito, Domicilio
)
from src.shared.services.notificaciones_utils import notificar, descartar_notificacion
from .schemas import DevolucionCreate, DevolucionResolucion, DevolucionUpdate

_BOGOTA = ZoneInfo("America/Bogota")


def _now():
    """Hora actual en Colombia (naive), consistente con los timestamps de entrega."""
    return datetime.now(_BOGOTA).replace(tzinfo=None)


# Estados globales (tabla Estados)
ESTADO_PENDIENTE = 3
ESTADO_APROBADA  = 6
ESTADO_RECHAZADA = 7

_ESTADO_LABELS = {
    ESTADO_PENDIENTE: "Pendiente",
    ESTADO_APROBADA:  "Aprobada",
    ESTADO_RECHAZADA: "Rechazada",
}

# Estado de venta que permite devolución
VENTA_ENTREGADA = 8

# Plazo máximo para solicitar devolución: 36 horas desde la entrega.
HORAS_LIMITE_DEVOLUCION = 36


def _formato_devolucion(dev: Devolucion, db: Session) -> dict:
    usuario  = db.query(Usuario).filter(Usuario.ID_Usuario == dev.ID_Usuario).first()
    detalles = db.query(DevolucionDetalle).filter(
        DevolucionDetalle.ID_Devolucion == dev.ID_Devolucion
    ).all()

    productos = []
    for d in detalles:
        producto = db.query(Producto).filter(Producto.ID_Producto == d.ID_Producto).first()
        productos.append({
            "ID_Devolucion_Detalle": d.ID_Devolucion_Detalle,
            "ID_Producto":           d.ID_Producto,
            "nombre_producto":       producto.nombre if producto else None,
            "Cantidad":              d.Cantidad,
            "PrecioUnitario":        d.PrecioUnitario,
            "Subtotal":              d.Subtotal,
        })

    return {
        "ID_Devolucion":   dev.ID_Devolucion,
        "ID_Venta":        dev.ID_Venta,
        "ID_Usuario":      dev.ID_Usuario,
        "nombre_cliente":  f"{usuario.Nombre} {usuario.Apellidos}" if usuario else None,
        "ID_DetalleVenta": dev.ID_DetalleVenta,
        "FechaDevolucion": dev.FechaDevolucion,
        "Motivo":          dev.Motivo,
        "Estado":          dev.Estado,
        "estado_label":    _ESTADO_LABELS.get(dev.Estado, "Desconocido"),
        "TotalDevuelto":   dev.TotalDevuelto,
        "FechaAprobacion": dev.FechaAprobacion,
        "FechaReembolso":  dev.FechaReembolso,
        "UsuarioAprueba":  dev.UsuarioAprueba,
        "Comentario":      dev.Comentario,
        "Comprobante_Imagen": dev.Comprobante_Imagen,
        "productos":       productos,
    }


def _recargar_credito(db: Session, id_usuario: int, monto: Decimal, id_devolucion: int):
    """Recarga crédito al cliente cuando se aprueba la devolución."""
    credito = db.query(CreditoCliente).filter(
        CreditoCliente.ID_Usuario == id_usuario
    ).first()

    if not credito:
        credito = CreditoCliente(
            ID_Usuario   = id_usuario,
            Saldo        = Decimal("0"),
            Fecha_Update = datetime.now(),
        )
        db.add(credito)
        db.flush()

    credito.Saldo        += monto
    credito.Fecha_Update  = datetime.now()

    db.add(MovimientoCredito(
        ID_Credito    = credito.ID_Credito,
        ID_Devolucion = id_devolucion,
        ID_Venta      = None,
        Tipo          = "recarga",
        Monto         = monto,
        Fecha         = datetime.now(),
    ))


def obtener_mis_devoluciones(
    db: Session,
    id_usuario: int,
    pagina: int = 1,
    por_pagina: int = 20,
) -> dict:
    """Retorna las devoluciones del cliente autenticado, más recientes primero."""
    query = (
        db.query(Devolucion)
        .filter(Devolucion.ID_Usuario == id_usuario)
        .order_by(Devolucion.FechaDevolucion.desc())
    )
    total        = query.count()
    offset       = (pagina - 1) * por_pagina
    devoluciones = query.offset(offset).limit(por_pagina).all()
    return {
        "total":        total,
        "pagina":       pagina,
        "por_pagina":   por_pagina,
        "devoluciones": [_formato_devolucion(d, db) for d in devoluciones],
    }


def obtener_devoluciones(
    db: Session,
    pagina: int = 1,
    por_pagina: int = 20,
    busqueda: str = None,
    estado: int = None,
) -> dict:
    """Lista paginada para admin, más recientes primero. Filtra por nombre o estado."""
    query = db.query(Devolucion)

    if estado:
        query = query.filter(Devolucion.Estado == estado)

    if busqueda:
        termino      = f"%{busqueda}%"
        usuarios_ids = (
            db.query(Usuario.ID_Usuario)
            .filter(
                Usuario.Nombre.ilike(termino) |
                Usuario.Apellidos.ilike(termino)
            )
            .subquery()
        )
        query = query.filter(Devolucion.ID_Usuario.in_(usuarios_ids))

    query        = query.order_by(Devolucion.FechaDevolucion.desc())
    total        = query.count()
    offset       = (pagina - 1) * por_pagina
    devoluciones = query.offset(offset).limit(por_pagina).all()

    return {
        "total":        total,
        "pagina":       pagina,
        "por_pagina":   por_pagina,
        "devoluciones": [_formato_devolucion(d, db) for d in devoluciones],
    }


def obtener_devolucion(db: Session, id_devolucion: int) -> dict:
    dev = db.query(Devolucion).filter(
        Devolucion.ID_Devolucion == id_devolucion
    ).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Devolución no encontrada")
    return _formato_devolucion(dev, db)


def crear_devolucion(db: Session, datos: DevolucionCreate) -> dict:
    """
    Crea una solicitud de devolución con las siguientes validaciones:
    1. La venta debe estar en estado Entregado (4).
    2. No debe existir ya una devolución Pendiente o Aprobada para la misma venta.
    3. Los productos a devolver deben pertenecer a la venta.
    4. La cantidad a devolver no puede superar la cantidad comprada.
    5. Se debe devolver al menos un producto.
    """
    # 1. Venta existe y está entregada
    venta = db.query(Venta).filter(Venta.ID_Venta == datos.ID_Venta).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    if venta.Estado != VENTA_ENTREGADA:
        raise HTTPException(
            status_code=400,
            detail="Solo puedes solicitar una devolución para pedidos ya entregados"
        )

    # 1b. Verificar plazo de devolución: 36 horas desde la entrega real.
    # Fuente del timestamp (en orden): domicilio entregado → venta.Fecha_entrega
    # → fallback a Fecha_pedido/Fecha_Venta para pedidos antiguos sin timestamp.
    domicilio = db.query(Domicilio).filter(
        Domicilio.ID_Venta == datos.ID_Venta,
        Domicilio.Estado.in_([8, 4])  # 8=Entregado web, 4=Entregado Flutter
    ).first()
    fecha_ref = (
        (domicilio.Fecha_entrega if domicilio and domicilio.Fecha_entrega else None)
        or getattr(venta, "Fecha_entrega", None)
        or venta.Fecha_pedido
        or venta.Fecha_Venta
    )
    if fecha_ref:
        transcurrido = _now() - fecha_ref
        if transcurrido > timedelta(hours=HORAS_LIMITE_DEVOLUCION):
            horas = int(transcurrido.total_seconds() // 3600)
            raise HTTPException(
                status_code=400,
                detail=(
                    f"El plazo para solicitar una devolución ha vencido. Las devoluciones "
                    f"pueden solicitarse hasta {HORAS_LIMITE_DEVOLUCION} horas después de la "
                    f"entrega (han pasado {horas} horas)."
                )
            )

    # 2. Un pedido solo puede tener UNA solicitud de devolución, sin importar su
    #    estado (Pendiente, Aprobada o Rechazada). No se permite crear otra.
    existente = db.query(Devolucion).filter(
        Devolucion.ID_Venta == datos.ID_Venta
    ).first()
    if existente:
        raise HTTPException(
            status_code=400,
            detail="Ya existe una solicitud de devolución para este pedido"
        )

    # 3. Cliente existe
    if not db.query(Usuario).filter(Usuario.ID_Usuario == datos.ID_Usuario).first():
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # 4. Validar productos: deben estar en la venta y la cantidad no debe superarse
    if not datos.productos:
        raise HTTPException(status_code=400, detail="Debes seleccionar al menos un producto")

    for p in datos.productos:
        vxp = db.query(VentaXProducto).filter(
            VentaXProducto.ID_Venta    == datos.ID_Venta,
            VentaXProducto.ID_Producto == p.ID_Producto
        ).first()
        if not vxp:
            producto = db.query(Producto).filter(
                Producto.ID_Producto == p.ID_Producto
            ).first()
            nombre = producto.nombre if producto else str(p.ID_Producto)
            raise HTTPException(
                status_code=400,
                detail=f"El producto '{nombre}' no pertenece a este pedido"
            )
        if p.Cantidad > vxp.Cantidad:
            producto = db.query(Producto).filter(
                Producto.ID_Producto == p.ID_Producto
            ).first()
            nombre = producto.nombre if producto else str(p.ID_Producto)
            raise HTTPException(
                status_code=400,
                detail=f"No puedes devolver más unidades de '{nombre}' de las que compraste ({vxp.Cantidad})"
            )

    # 5. Calcular total
    total = sum(
        Decimal(str(p.PrecioUnitario)) * Decimal(str(p.Cantidad))
        for p in datos.productos
    )

    nueva = Devolucion(
        ID_Venta           = datos.ID_Venta,
        ID_Usuario         = datos.ID_Usuario,
        ID_DetalleVenta    = datos.ID_DetalleVenta,
        Motivo             = datos.Motivo,
        Comprobante_Imagen = datos.Comprobante_Imagen,
        Estado             = ESTADO_PENDIENTE,
        TotalDevuelto      = total,
        FechaDevolucion    = datetime.now(),
    )
    db.add(nueva)
    db.flush()

    for p in datos.productos:
        subtotal = Decimal(str(p.PrecioUnitario)) * Decimal(str(p.Cantidad))
        db.add(DevolucionDetalle(
            ID_Devolucion  = nueva.ID_Devolucion,
            ID_Producto    = p.ID_Producto,
            Cantidad       = p.Cantidad,
            PrecioUnitario = p.PrecioUnitario,
            Subtotal       = subtotal,
        ))

    notificar(
        db, "devolucion_pendiente", "Devolución pendiente",
        f"La devolución #{nueva.ID_Devolucion} requiere revisión",
        nueva.ID_Devolucion, f"/ventas/devoluciones/{nueva.ID_Devolucion}",
    )
    db.commit()
    db.refresh(nueva)
    return _formato_devolucion(nueva, db)


def editar_devolucion(db: Session, id_devolucion: int, datos: DevolucionUpdate) -> dict:
    """
    Permite al admin editar el motivo o agregar un comentario interno
    mientras la devolución esté Pendiente.
    """
    dev = db.query(Devolucion).filter(
        Devolucion.ID_Devolucion == id_devolucion
    ).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Devolución no encontrada")

    if dev.Estado != ESTADO_PENDIENTE:
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden editar devoluciones en estado Pendiente"
        )

    if datos.Motivo is not None:
        datos_motivo = datos.Motivo.strip()
        if not datos_motivo:
            raise HTTPException(status_code=400, detail="El motivo no puede estar vacío")
        dev.Motivo = datos_motivo

    if datos.Comentario is not None:
        dev.Comentario = datos.Comentario.strip() or None

    db.commit()
    db.refresh(dev)
    return _formato_devolucion(dev, db)


def resolver_devolucion(db: Session, id_devolucion: int, datos: DevolucionResolucion) -> dict:
    """
    Aprueba (Estado=2) o rechaza (Estado=3) una devolución pendiente.
    Al aprobar, recarga automáticamente el crédito del cliente.
    """
    if datos.Estado not in {ESTADO_APROBADA, ESTADO_RECHAZADA}:
        raise HTTPException(
            status_code=400,
            detail="Estado inválido. Use 6 (Aprobada) o 7 (Rechazada)"
        )

    dev = db.query(Devolucion).filter(
        Devolucion.ID_Devolucion == id_devolucion
    ).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Devolución no encontrada")

    if dev.Estado != ESTADO_PENDIENTE:
        raise HTTPException(
            status_code=400,
            detail="Esta devolución ya fue resuelta"
        )

    dev.Estado          = datos.Estado
    dev.Comentario      = datos.Comentario
    dev.UsuarioAprueba  = datos.UsuarioAprueba
    dev.FechaAprobacion = datetime.now()

    if datos.Estado == ESTADO_APROBADA:
        _recargar_credito(
            db            = db,
            id_usuario    = dev.ID_Usuario,
            monto         = Decimal(str(dev.TotalDevuelto)),
            id_devolucion = dev.ID_Devolucion,
        )
        dev.FechaReembolso = datetime.now()

    descartar_notificacion(db, "devolucion_pendiente", id_devolucion)
    db.commit()
    db.refresh(dev)
    return _formato_devolucion(dev, db)
