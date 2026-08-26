from sqlalchemy.orm import Session, selectinload
from fastapi import HTTPException

from src.shared.services.models import (
    Venta, Estado, DetalleVenta, Domicilio,
    VentaXProducto, Producto, DescuentoXVenta,
)
from src.features.ventas.gestion_ventas.services.service import _formato_venta, cambiar_estado as _gv_cambiar_estado
from src.features.ventas.pedidos.services.estados import EstadoPedido, ESTADOS_ACTIVOS


def obtener_pedidos(
    db: Session,
    pagina: int = 1,
    por_pagina: int = 10,
    busqueda: str = None,
    estado: int = None,
) -> dict:
    """
    Lista ventas. Sin 'estado' devuelve solo los activos; con 'estado' filtra por ese valor exacto.
    """
    from src.shared.services.models import Usuario

    if estado is not None:
        query = db.query(Venta).filter(Venta.Estado == estado)
    else:
        query = db.query(Venta).filter(Venta.Estado.in_(ESTADOS_ACTIVOS))

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
        query = query.filter(Venta.ID_Usuario.in_(usuarios_ids))

    total   = query.count()
    offset  = (pagina - 1) * por_pagina
    pedidos = (
        query
        .options(
            selectinload(Venta.usuario),
            selectinload(Venta.productos)
                .selectinload(VentaXProducto.producto)
                .selectinload(Producto.imagenes),
            selectinload(Venta.detalle),
            selectinload(Venta.domicilios)
                .selectinload(Domicilio.empleado),
            selectinload(Venta.ordenes_produccion),
        )
        .order_by(Venta.Fecha_pedido.desc())
        .offset(offset)
        .limit(por_pagina)
        .all()
    )

    venta_ids = [p.ID_Venta for p in pedidos]
    dxv_map = {}
    if venta_ids:
        for row in db.query(DescuentoXVenta).filter(
            DescuentoXVenta.ID_Venta.in_(venta_ids)
        ).all():
            dxv_map.setdefault(row.ID_Venta, row)

    return {
        "total":      total,
        "pagina":     pagina,
        "por_pagina": por_pagina,
        "pedidos":    [_formato_venta(p, db, dxv_map=dxv_map) for p in pedidos],
    }


def obtener_pedido(db: Session, id_venta: int) -> dict:
    """Retorna un pedido por ID. Solo si está en estado activo."""
    pedido = db.query(Venta).filter(
        Venta.ID_Venta == id_venta,
        Venta.Estado.in_(ESTADOS_ACTIVOS),
    ).first()
    if not pedido:
        raise HTTPException(
            status_code=404,
            detail="Pedido no encontrado o ya fue procesado"
        )
    return _formato_venta(pedido, db)


def editar_pedido(db: Session, id_venta: int, datos: dict) -> dict:
    """
    Actualiza los campos editables de un pedido Pendiente:
    Metodo_Pago, montos, domicilio y su dirección.
    El cambio de estado se maneja por los endpoints /confirmar y /cancelar.
    """
    pedido = db.query(Venta).filter(
        Venta.ID_Venta == id_venta,
        Venta.Estado.in_(ESTADOS_ACTIVOS),
    ).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado o ya fue procesado")

    if datos.get("Metodo_Pago"):
        pedido.Metodo_Pago = datos["Metodo_Pago"].split(" ")[0].strip()

    if datos.get("Comprobante_Pago") is not None:
        pedido.Comprobante_Pago = datos["Comprobante_Pago"]
        # Si cambia a Transferencia con comprobante y el pago no está ya confirmado,
        # marcar como pendiente de validación para que el admin lo apruebe.
        _metodo_actual = (pedido.Metodo_Pago or datos.get("Metodo_Pago") or "").strip().lower()
        _estado_pago_no_final = (getattr(pedido, "Estado_Pago", None) or "pendiente") not in (
            "pagado_completo", "efectivo_recibido", "anticipo_pagado",
        )
        if "transfer" in _metodo_actual and datos["Comprobante_Pago"] and _estado_pago_no_final:
            pedido.Estado_Pago = "pendiente_validacion"

    if datos.get("Total") is not None:
        pedido.Total = datos["Total"]

    detalle = db.query(DetalleVenta).filter(DetalleVenta.ID_Venta == id_venta).first()
    if detalle:
        if datos.get("Descuento") is not None:
            detalle.Descuento = datos["Descuento"]
        if datos.get("Subtotal") is not None:
            detalle.SubTotal = datos["Subtotal"]

    # Registrar anticipo (cuando el admin confirma que ya recibió el 50%)
    if datos.get("Anticipo_Registrado"):
        pedido.Anticipo_Registrado = 1
        if datos.get("Anticipo_Monto") is not None:
            pedido.Anticipo_Monto = datos["Anticipo_Monto"]
        if datos.get("Anticipo_Metodo_Pago"):
            pedido.Anticipo_Metodo_Pago = datos["Anticipo_Metodo_Pago"]
        if datos.get("Anticipo_Comprobante_Url"):
            pedido.Anticipo_Comprobante_Url = datos["Anticipo_Comprobante_Url"]
        _ep = (getattr(pedido, "Estado_Pago", None) or "pendiente").strip()
        if _ep not in ("pagado_completo", "efectivo_recibido"):
            pedido.Estado_Pago = "anticipo_pagado"

    quiere_domicilio = datos.get("Domicilio")
    domicilio = db.query(Domicilio).filter(Domicilio.ID_Venta == id_venta).first()

    if quiere_domicilio is True:
        if domicilio is None:
            domicilio = Domicilio(ID_Venta=id_venta, Estado=EstadoPedido.PENDIENTE)
            db.add(domicilio)
        if datos.get("Direccion_Entrega") is not None:
            domicilio.Direccion_entrega = datos["Direccion_Entrega"]
        if datos.get("Municipio_entrega") is not None:
            domicilio.Municipio_entrega = datos["Municipio_entrega"]
        if datos.get("Departamento_entrega") is not None:
            domicilio.Departamento_entrega = datos["Departamento_entrega"]
        if datos.get("Notas") is not None:
            domicilio.Observaciones = datos["Notas"]
    elif quiere_domicilio is False and domicilio is not None:
        db.delete(domicilio)

    db.commit()
    db.refresh(pedido)
    return _formato_venta(pedido, db)


def confirmar_pedido(db: Session, id_venta: int) -> dict:
    """
    Confirma el pedido → cambia estado a Confirmado (ID=4).
    Solo se puede confirmar desde Pendiente (1).
    Un pedido En producción (13) debe esperar a que las órdenes de producción
    se completen — el sistema lo devuelve automáticamente a Pendiente cuando terminan.
    """
    pedido = db.query(Venta).filter(
        Venta.ID_Venta == id_venta,
        Venta.Estado   == EstadoPedido.PENDIENTE,
    ).first()
    if not pedido:
        raise HTTPException(
            status_code=400,
            detail="Solo se puede confirmar un pedido en estado Pendiente. "
                   "Si el pedido está En producción, espera a que se completen las órdenes de producción."
        )

    return _gv_cambiar_estado(db, id_venta, EstadoPedido.CONFIRMADO)


def cancelar_pedido(db: Session, id_venta: int, actual: dict = None) -> dict:
    """
    Cancela el pedido. Delega en cambiar_estado() que:
    - Valida la transición con la máquina de estados
    - Restaura stock si el pedido pickup ya lo tenía descontado (desde CONFIRMADO en adelante)
    - Devuelve crédito si se usó al crear el pedido
    Si actual es un cliente, solo puede cancelar su propio pedido.
    """
    pedido = db.query(Venta).filter(
        Venta.ID_Venta == id_venta,
        Venta.Estado.in_(ESTADOS_ACTIVOS),
    ).first()
    if not pedido:
        raise HTTPException(
            status_code=404,
            detail="Pedido no encontrado o ya fue procesado"
        )

    if actual and actual.get("tipo") == "cliente":
        id_usuario = actual["registro"].ID_Usuario
        if pedido.ID_Usuario != id_usuario:
            raise HTTPException(status_code=403, detail="No puedes cancelar pedidos de otros clientes")

    return _gv_cambiar_estado(db, id_venta, EstadoPedido.CANCELADO)


_ESTADOS_PAGO_YA_COBRADO = {"efectivo_recibido", "pagado_completo", "anticipo_pagado"}


def _es_mixto(metodo: str | None) -> bool:
    """Pedido repartido entre efectivo y transferencia."""
    return "mixto" in (metodo or "").strip().lower()


def _lleva_transferencia(metodo: str | None) -> bool:
    """¿Hay un comprobante que revisar? Transferencia pura o mixto."""
    _m = (metodo or "").strip().lower()
    return "transfer" in _m or "mixto" in _m


# El mixto se cobra en dos pasos —el comprobante de la parte transferida y la
# plata en mano— y cada uno puede caer primero. Estos son los estados desde los
# que todavía falta el otro paso.
_ESTADOS_MIXTO_A_MEDIAS = {"pendiente", "pendiente_validacion", "comprobante_rechazado"}


def registrar_cobro_pedido(db: Session, id_venta: int, datos, id_usuario_actual: int) -> dict:
    """
    Admin/empleado registra cobro en efectivo para un pedido (contra entrega o en tienda).
    Estado_Pago → 'efectivo_recibido' o 'no_recibido'.
    """
    from datetime import datetime, timezone

    venta = db.query(Venta).filter(Venta.ID_Venta == id_venta).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    estado_pago = (getattr(venta, "Estado_Pago", None) or "pendiente").strip()
    mixto       = _es_mixto(venta.Metodo_Pago)
    # En un mixto, "anticipo_pagado" solo dice que UNA de las dos mitades entró.
    # El efectivo se puede seguir cobrando mientras no esté marcado su registro.
    efectivo_ya_registrado = bool(getattr(venta, "Pago_Final_Registrado", 0))
    if estado_pago in _ESTADOS_PAGO_YA_COBRADO and not (mixto and not efectivo_ya_registrado):
        raise HTTPException(status_code=409, detail="El cobro ya fue registrado para este pedido")

    if not datos.recibido:
        venta.Estado_Pago = "no_recibido"
    elif mixto:
        # La plata en mano se marca en su propio registro, para saber cuál de
        # las dos mitades entró y no tener que adivinarlo desde el estado.
        venta.Pago_Final_Registrado  = 1
        venta.Pago_Final_Monto       = venta.Monto_Efectivo
        venta.Pago_Final_Metodo_Pago = "Efectivo"
        venta.Pago_Final_Fecha       = datetime.now(timezone.utc).replace(tzinfo=None)
        # Queda saldado solo si el comprobante de la transferencia ya se aprobó.
        venta.Estado_Pago = (
            "anticipo_pagado" if estado_pago in _ESTADOS_MIXTO_A_MEDIAS
            else "pagado_completo"
        )
    else:
        venta.Estado_Pago = "efectivo_recibido"
    db.commit()
    db.refresh(venta)
    return _formato_venta(venta, db)


def aprobar_comprobante(db: Session, id_venta: int) -> dict:
    """
    Admin aprueba el comprobante de transferencia.
    Estado_Pago: 'pendiente_validacion' → 'pagado_completo'.
    Solo aplica si el método de pago es Transferencia.
    """
    pedido = db.query(Venta).filter(Venta.ID_Venta == id_venta).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    # El mixto también trae comprobante: es el de su parte transferida. Antes
    # esta puerta solo dejaba pasar "Transferencia" y el admin no podía
    # aprobar ni rechazar el soporte de un pedido mixto.
    if not _lleva_transferencia(pedido.Metodo_Pago):
        raise HTTPException(status_code=400, detail="Este pedido no tiene pago por transferencia")

    if not pedido.Comprobante_Pago:
        raise HTTPException(status_code=400, detail="El pedido no tiene comprobante adjunto")

    estado_pago = (getattr(pedido, "Estado_Pago", None) or "pendiente").strip()
    if estado_pago == "pagado_completo":
        raise HTTPException(status_code=409, detail="El comprobante ya fue aprobado")

    # En un mixto aprobar el comprobante salda solo la mitad transferida: falta
    # el efectivo, salvo que ya lo hayan cobrado.
    if _es_mixto(pedido.Metodo_Pago) and estado_pago in _ESTADOS_MIXTO_A_MEDIAS:
        pedido.Estado_Pago = "anticipo_pagado"
    else:
        pedido.Estado_Pago = "pagado_completo"
    db.commit()
    db.refresh(pedido)
    return _formato_venta(pedido, db)


def rechazar_comprobante(db: Session, id_venta: int, motivo: str, id_usuario_actual: int) -> dict:
    """
    Admin rechaza el comprobante de transferencia.
    Estado_Pago → 'comprobante_rechazado'. El comprobante NO se elimina.
    El motivo se notifica al cliente; no se guarda en columna nueva.
    """
    from src.shared.services.notificaciones_utils import notificar

    pedido = db.query(Venta).filter(Venta.ID_Venta == id_venta).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    if not _lleva_transferencia(pedido.Metodo_Pago):
        raise HTTPException(status_code=400, detail="Este pedido no tiene pago por transferencia")

    if not pedido.Comprobante_Pago:
        raise HTTPException(status_code=400, detail="El pedido no tiene comprobante adjunto")

    estado_pago = (getattr(pedido, "Estado_Pago", None) or "pendiente").strip()
    if estado_pago == "comprobante_rechazado":
        raise HTTPException(status_code=409, detail="El comprobante ya fue rechazado")

    pedido.Estado_Pago = "comprobante_rechazado"

    notificar(
        db,
        "comprobante_rechazado",
        f"Comprobante rechazado — Pedido #{id_venta}",
        f"Motivo: {motivo}",
        id_venta,
        "/ventas/pedidos",
    )

    db.commit()
    db.refresh(pedido)
    return _formato_venta(pedido, db)
