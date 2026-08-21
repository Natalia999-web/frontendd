from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime

from src.shared.services.models import Notificacion, Venta, Devolucion


def _sincronizar_stock(db: Session) -> None:
    """Genera notifs para insumos/productos con stock bajo que aún no tienen una notif activa."""
    from src.shared.services.models import Insumo, Producto
    from src.shared.services.notificaciones_utils import notificar_stock_insumo, notificar_stock_producto

    for insumo in db.query(Insumo).filter(Insumo.Estado.in_([14, 15])).all():
        notificar_stock_insumo(db, insumo)
    for producto in db.query(Producto).filter(Producto.Estado.in_([14, 15])).all():
        notificar_stock_producto(db, producto)
    db.flush()


def obtener_notificaciones(db: Session) -> dict:
    _sincronizar_stock(db)
    notificaciones = (
        db.query(Notificacion)
        .order_by(Notificacion.Leida.asc(), Notificacion.Fecha.desc())
        .all()
    )
    total_no_leidas = sum(1 for n in notificaciones if not n.Leida)
    return {
        "total":           len(notificaciones),
        "total_no_leidas": total_no_leidas,
        "notificaciones":  notificaciones,
    }


def marcar_leida(db: Session, id_notificacion: int):
    notif = db.query(Notificacion).filter(
        Notificacion.ID_Notificacion == id_notificacion
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    notif.Leida = True
    db.commit()
    db.refresh(notif)
    return notif


def eliminar_notificacion(db: Session, id_notificacion: int) -> dict:
    notif = db.query(Notificacion).filter(
        Notificacion.ID_Notificacion == id_notificacion
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    db.delete(notif)
    db.commit()
    return {"mensaje": f"Notificación {id_notificacion} eliminada"}


def limpiar_leidas(db: Session) -> dict:
    eliminadas = db.query(Notificacion).filter(Notificacion.Leida == True).delete()
    db.commit()
    return {"mensaje": f"{eliminadas} notificaciones eliminadas"}


# ── Estado de venta → (tipo_notif, titulo, mensaje) ──────────
_VENTA_NOTIF = {
    4:  ("pedido_confirmado", "Pedido confirmado",
         "Tu pedido fue confirmado y está siendo preparado."),
    5:  ("pedido_cancelado",  "Pedido cancelado",
         "Tu pedido fue cancelado. Contáctanos si tienes dudas."),
    8:  ("pedido_entregado",  "Pedido entregado",
         "Tu pedido fue entregado exitosamente. ¡Gracias por tu compra!"),
    16: ("fecha_propuesta",   "Fecha de entrega propuesta", None),
}

_DEVOLUCION_NOTIF = {
    6: ("devolucion_aprobada",  "Devolución aprobada",
        "Tu solicitud de devolución fue aprobada. El crédito fue acreditado a tu cuenta."),
    7: ("devolucion_rechazada", "Devolución rechazada",
        "Tu solicitud de devolución fue rechazada. Revisa los detalles en tu historial."),
}


def obtener_notificaciones_cliente(db: Session, id_usuario: int) -> dict:
    """Genera notificaciones derivadas para un cliente basándose en sus ventas y devoluciones."""
    notifs = []

    ventas = (
        db.query(Venta)
        .filter(Venta.ID_Usuario == id_usuario, Venta.Estado.in_([4, 5, 8, 16]))
        .order_by(Venta.Fecha_Venta.desc())
        .limit(15)
        .all()
    )
    for v in ventas:
        if v.Estado in _VENTA_NOTIF:
            tipo, titulo, mensaje_base = _VENTA_NOTIF[v.Estado]
            fecha_entrega_iso = None
            if v.Estado == 16 and v.Fecha_entrega_esperada:
                fecha_entrega_iso = v.Fecha_entrega_esperada.isoformat()
                fecha_fmt = v.Fecha_entrega_esperada.strftime("%d/%m/%Y")
                mensaje = f"Fecha propuesta: {fecha_fmt}. Acéptala o recházala desde tus pedidos."
            else:
                mensaje = mensaje_base or ""
            notifs.append({
                "id_ref":         f"venta_{v.ID_Venta}_{v.Estado}",
                "tipo":           tipo,
                "titulo":         f"{titulo} — Pedido #{v.ID_Venta}",
                "mensaje":        mensaje,
                "id_venta":       v.ID_Venta,
                "fecha_entrega":  fecha_entrega_iso,
                "ruta":           "/cliente/pedidos",
                "fecha":          v.Fecha_Venta,
            })

    devs = (
        db.query(Devolucion)
        .filter(Devolucion.ID_Usuario == id_usuario, Devolucion.Estado.in_([6, 7]))
        .order_by(Devolucion.FechaAprobacion.desc())
        .limit(5)
        .all()
    )
    for d in devs:
        if d.Estado in _DEVOLUCION_NOTIF:
            tipo, titulo, mensaje = _DEVOLUCION_NOTIF[d.Estado]
            notifs.append({
                "id_ref":  f"dev_{d.ID_Devolucion}_{d.Estado}",
                "tipo":    tipo,
                "titulo":  titulo,
                "mensaje": mensaje,
                "ruta":    "/cliente/devoluciones",
                "fecha":   d.FechaAprobacion or d.FechaDevolucion,
            })

    notifs.sort(key=lambda x: x["fecha"] or datetime.min, reverse=True)
    return {"total": len(notifs), "notificaciones": notifs}
