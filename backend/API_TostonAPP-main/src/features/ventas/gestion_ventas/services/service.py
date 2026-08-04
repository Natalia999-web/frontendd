from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

_BOGOTA = ZoneInfo("America/Bogota")


def _now():
    return datetime.now(_BOGOTA).replace(tzinfo=None)

from src.shared.services.models import (
    Venta, VentaXProducto, DetalleVenta, Producto, Usuario,
    Estado, Domicilio, CreditoCliente, MovimientoCredito,
    Descuento, DescuentoXUsuario, DescuentoXVenta, OrdenProduccion, FichaTecnica,
)
from src.shared.services.notificaciones_utils import notificar, descartar_notificacion, notificar_stock_producto
from src.features.ventas.pedidos.services.estados import (
    EstadoPedido, ESTADOS_STOCK_DESCONTADO_PICKUP, validar_transicion,
)
from .schemas import VentaCreate, DomicilioVentaInput

# Costo fijo de domicilio (COP)
COSTO_DOMICILIO = Decimal("5000")


_ESTADO_VENTA_LABEL = {
    1: "Pendiente", 4: "Confirmado", 5: "Cancelado",
    8: "Entregado", 9: "En camino", 10: "Asignado",
    11: "Listo", 13: "En producción", 16: "Fecha propuesta",
}

def _label_estado(db: Session, id_estado: int) -> str:
    if id_estado in _ESTADO_VENTA_LABEL:
        return _ESTADO_VENTA_LABEL[id_estado]
    estado = db.query(Estado).filter(Estado.ID_Estados == id_estado).first()
    return estado.Estado if estado else None


def _actualizar_estado_producto(producto: Producto) -> None:
    stock  = producto.Stock or 0
    minimo = getattr(producto, "Stock_Minimo", 0) or 0
    if stock == 0:
        producto.Estado = 15
    elif stock <= minimo:
        producto.Estado = 14
    else:
        producto.Estado = 1


def _formato_venta(venta: Venta, db: Session) -> dict:
    """Construye la respuesta completa de una venta."""
    usuario = db.query(Usuario).filter(Usuario.ID_Usuario == venta.ID_Usuario).first()

    vxp       = db.query(VentaXProducto).filter(VentaXProducto.ID_Venta == venta.ID_Venta).all()
    productos = []
    requiere_produccion = False
    for v in vxp:
        producto = db.query(Producto).filter(Producto.ID_Producto == v.ID_Producto).first()
        precio   = producto.Precio_venta if producto else Decimal("0")
        if getattr(producto, "Requiere_Produccion", 0):
            requiere_produccion = True
        productos.append({
            "ID_Producto":     v.ID_Producto,
            "nombre_producto": producto.nombre if producto else None,
            "Cantidad":        v.Cantidad,
            "precio_unitario": precio,
            "subtotal":        precio * Decimal(str(v.Cantidad)),
        })

    detalle            = db.query(DetalleVenta).filter(DetalleVenta.ID_Venta == venta.ID_Venta).first()
    credito_aplicado   = detalle.Descuento if detalle else Decimal("0")
    iva                = detalle.IVA if detalle else Decimal("0")

    dxv                = db.query(DescuentoXVenta).filter(DescuentoXVenta.ID_Venta == venta.ID_Venta).first()
    descuento_aplicado = dxv.Monto_Aplicado if dxv else Decimal("0")

    domicilio      = db.query(Domicilio).filter(Domicilio.ID_Venta == venta.ID_Venta).first()
    subtotal_bruto = sum(p["subtotal"] for p in productos)

    domiciliario = None
    if domicilio and domicilio.ID_Empleado:
        emp = db.query(Usuario).filter(Usuario.ID_Usuario == domicilio.ID_Empleado).first()
        if emp:
            domiciliario = f"{emp.Nombre} {emp.Apellidos}"

    ordenes_pendientes = db.query(OrdenProduccion).filter(
        OrdenProduccion.ID_Venta == venta.ID_Venta,
        OrdenProduccion.Estado.notin_([11, 5]),
    ).count()

    return {
        "ID_Venta":           venta.ID_Venta,
        "ID_Usuario":         venta.ID_Usuario,
        "nombre_cliente":     f"{usuario.Nombre} {usuario.Apellidos}" if usuario else None,
        "correo_cliente":     usuario.Correo    if usuario else None,
        "telefono_cliente":   usuario.Telefono  if usuario else None,
        "Total":              venta.Total,
        "subtotal_bruto":     subtotal_bruto,
        "credito_aplicado":   credito_aplicado,
        "descuento_aplicado": descuento_aplicado,
        "Estado":             venta.Estado,
        "estado_label":       _label_estado(db, venta.Estado) if venta.Estado else None,
        "Metodo_Pago":            venta.Metodo_Pago,
        "Fecha_Venta":            venta.Fecha_Venta,
        "Fecha_pedido":           venta.Fecha_pedido,
        "Fecha_entrega_esperada": venta.Fecha_entrega_esperada,
        "productos":              productos,
        "comprobante_pago":             venta.Comprobante_Pago,
        "tiene_domicilio":              domicilio is not None,
        "ID_Domicilio":                 domicilio.ID_Domicilio          if domicilio else None,
        "direccion_entrega":            domicilio.Direccion_entrega      if domicilio else None,
        "municipio_entrega":            domicilio.Municipio_entrega      if domicilio else None,
        "departamento_entrega":         domicilio.Departamento_entrega   if domicilio else None,
        "nombre_domiciliario":          domiciliario,
        "ordenes_produccion_pendientes": ordenes_pendientes,
        "requiere_produccion":           requiere_produccion,
    }


def _aplicar_credito(db: Session, id_usuario: int, monto_restante: Decimal, id_venta: int) -> Decimal:
    credito = db.query(CreditoCliente).filter(
        CreditoCliente.ID_Usuario == id_usuario
    ).first()

    if not credito or credito.Saldo <= 0:
        return Decimal("0")

    credito_usado        = min(credito.Saldo, monto_restante)
    credito.Saldo       -= credito_usado
    credito.Fecha_Update = _now()

    db.add(MovimientoCredito(
        ID_Credito    = credito.ID_Credito,
        ID_Devolucion = None,
        ID_Venta      = id_venta,
        Tipo          = "uso",
        Monto         = credito_usado,
        Fecha         = _now(),
    ))
    return credito_usado


def _aplicar_descuento(
    db: Session,
    id_usuario: int,
    codigo: str,
    monto_restante: Decimal,
    id_venta: int
) -> Decimal:
    descuento = None

    if codigo:
        descuento = db.query(Descuento).filter(
            Descuento.Codigo == codigo,
            Descuento.Estado == 1,
        ).first()
        if descuento:
            if descuento.Fecha_Fin and descuento.Fecha_Fin < _now():
                raise HTTPException(status_code=400, detail="El cupón ha vencido")
            if descuento.Usos_Max and descuento.Usos_Actuales >= descuento.Usos_Max:
                raise HTTPException(status_code=400, detail="El cupón ha alcanzado su límite de usos")

    if not descuento:
        asignacion = db.query(DescuentoXUsuario).filter(
            DescuentoXUsuario.ID_Usuario == id_usuario,
            DescuentoXUsuario.Usado      == False,
        ).join(Descuento).filter(Descuento.Estado == 1).first()

        if asignacion:
            descuento = db.query(Descuento).filter(
                Descuento.ID_Descuento == asignacion.ID_Descuento
            ).first()

    if not descuento:
        usuario = db.query(Usuario).filter(Usuario.ID_Usuario == id_usuario).first()
        if usuario and usuario.Fecha_creacion:
            meses     = (_now() - usuario.Fecha_creacion).days // 30
            descuento = (
                db.query(Descuento)
                .filter(
                    Descuento.Tipo          == "antiguedad",
                    Descuento.Meses_Minimos <= meses,
                    Descuento.Estado        == 1,
                )
                .order_by(Descuento.Porcentaje.desc())
                .first()
            )

    if not descuento:
        return Decimal("0")

    monto_descontado = (monto_restante * descuento.Porcentaje / 100).quantize(Decimal("0.01"))

    db.add(DescuentoXVenta(
        ID_Venta       = id_venta,
        ID_Descuento   = descuento.ID_Descuento,
        Monto_Aplicado = monto_descontado,
    ))

    descuento.Usos_Actuales += 1

    if descuento.Tipo == "emision":
        asignacion = db.query(DescuentoXUsuario).filter(
            DescuentoXUsuario.ID_Descuento == descuento.ID_Descuento,
            DescuentoXUsuario.ID_Usuario   == id_usuario,
        ).first()
        if asignacion:
            asignacion.Usado = True

    return monto_descontado


def obtener_ventas(
    db: Session,
    pagina: int = 1,
    por_pagina: int = 10,
    busqueda: str = None,
    id_usuario: int = None,
    estado: int = None,
) -> dict:
    query = db.query(Venta)

    if id_usuario:
        query = query.filter(Venta.ID_Usuario == id_usuario)

    if estado:
        query = query.filter(Venta.Estado == estado)

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

    total  = query.count()
    offset = (pagina - 1) * por_pagina
    ventas = query.order_by(Venta.Fecha_Venta.desc()).offset(offset).limit(por_pagina).all()

    return {
        "total":      total,
        "pagina":     pagina,
        "por_pagina": por_pagina,
        "ventas":     [_formato_venta(v, db) for v in ventas],
    }


def obtener_mis_ventas(
    db: Session,
    actual: dict,
    pagina: int = 1,
    por_pagina: int = 10,
) -> dict:
    """Retorna todas las ventas del cliente autenticado (cualquier estado)."""
    if actual["tipo"] != "cliente":
        raise HTTPException(status_code=403, detail="Solo disponible para clientes")

    id_usuario = actual["registro"].ID_Usuario
    query      = db.query(Venta).filter(Venta.ID_Usuario == id_usuario)
    total      = query.count()
    offset     = (pagina - 1) * por_pagina
    ventas     = query.order_by(Venta.Fecha_pedido.desc()).offset(offset).limit(por_pagina).all()

    return {
        "total":      total,
        "pagina":     pagina,
        "por_pagina": por_pagina,
        "ventas":     [_formato_venta(v, db) for v in ventas],
    }


def obtener_venta(db: Session, id_venta: int) -> dict:
    venta = db.query(Venta).filter(Venta.ID_Venta == id_venta).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return _formato_venta(venta, db)


def obtener_mi_venta(db: Session, id_venta: int, actual: dict) -> dict:
    """Detalle de una venta propia del cliente autenticado."""
    if actual["tipo"] != "cliente":
        raise HTTPException(status_code=403, detail="Solo disponible para clientes")
    id_usuario = actual["registro"].ID_Usuario
    venta = db.query(Venta).filter(
        Venta.ID_Venta   == id_venta,
        Venta.ID_Usuario == id_usuario,
    ).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return _formato_venta(venta, db)


def crear_venta(db: Session, datos: VentaCreate) -> dict:
    """
    Flujo completo de creación de venta:
    1. Valida cliente y productos
    2. Si hay domicilio → verifica que el cliente tenga teléfono registrado
    3. Calcula subtotal bruto
    4. Aplica crédito si el cliente lo desea
    5. Aplica descuento si queda saldo pendiente
    6. Descuenta stock de productos
    7. Crea domicilio si se solicitó
    """
    # Verifica cliente
    usuario = db.query(Usuario).filter(Usuario.ID_Usuario == datos.ID_Usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Si el pedido incluye domicilio, el cliente debe tener teléfono registrado
    if datos.domicilio and not usuario.Telefono:
        raise HTTPException(
            status_code=400,
            detail="Debes registrar tu número de teléfono en tu perfil antes de solicitar un domicilio"
        )

    # Valida productos, stock (para los que NO requieren producción) y calcula subtotal
    subtotal_bruto = Decimal("0")
    for p in datos.productos:
        producto = db.query(Producto).filter(Producto.ID_Producto == p.ID_Producto).first()
        if not producto:
            raise HTTPException(status_code=404, detail=f"Producto {p.ID_Producto} no encontrado")
        if not getattr(producto, "Requiere_Produccion", 0) and (producto.Stock or 0) < p.Cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para '{producto.nombre}' (disponible: {producto.Stock or 0})",
            )
        subtotal_bruto += producto.Precio_venta * Decimal(str(p.Cantidad))

    ESTADO_PENDIENTE = 1

    nueva_venta = Venta(
        ID_Usuario             = datos.ID_Usuario,
        Total                  = subtotal_bruto,
        Estado                 = ESTADO_PENDIENTE,
        Metodo_Pago            = datos.Metodo_Pago,
        Fecha_Venta            = _now(),
        Fecha_pedido           = _now(),
        Fecha_entrega_esperada = datos.Fecha_entrega_esperada,
        Comprobante_Pago       = datos.comprobante_pago,
    )
    db.add(nueva_venta)
    db.flush()

    notificar(
        db, "pedido_nuevo", "Nuevo pedido recibido",
        f"El pedido #{nueva_venta.ID_Venta} está esperando ser procesado",
        nueva_venta.ID_Venta, "/ventas/pedidos",
    )

    for p in datos.productos:
        db.add(VentaXProducto(
            ID_Venta    = nueva_venta.ID_Venta,
            ID_Producto = p.ID_Producto,
            Cantidad    = p.Cantidad,
        ))

    # Detectar productos de producción con déficit (la orden se crea cuando el cliente acepta la fecha)
    necesita_produccion = False
    for p in datos.productos:
        prod = db.query(Producto).filter(Producto.ID_Producto == p.ID_Producto).first()
        if getattr(prod, "Requiere_Produccion", 0) and p.Cantidad > (prod.Stock or 0):
            necesita_produccion = True
            break

    if necesita_produccion:
        notificar(
            db, "produccion_requerida", "Pedido requiere producción",
            f"El pedido #{nueva_venta.ID_Venta} incluye productos por encargo. Revisá y proponé una fecha de entrega.",
            nueva_venta.ID_Venta, "/ventas/pedidos",
        )

    monto_restante   = subtotal_bruto
    credito_aplicado = Decimal("0")

    if datos.usar_credito:
        credito_aplicado = _aplicar_credito(db, datos.ID_Usuario, monto_restante, nueva_venta.ID_Venta)
        monto_restante  -= credito_aplicado

    descuento_aplicado = Decimal("0")
    if monto_restante > 0:
        descuento_aplicado = _aplicar_descuento(
            db, datos.ID_Usuario, datos.codigo_descuento, monto_restante, nueva_venta.ID_Venta
        )
        monto_restante -= descuento_aplicado

    nueva_venta.Total = max(monto_restante, Decimal("0"))

    # Costo fijo de domicilio: se suma al total cuando el pedido es a domicilio
    if datos.domicilio:
        nueva_venta.Total += COSTO_DOMICILIO

    db.add(DetalleVenta(
        ID_Venta    = nueva_venta.ID_Venta,
        A_Nombre_De = datos.A_Nombre_De,
        IVA         = Decimal("0"),
        Descuento   = credito_aplicado,
        SubTotal    = subtotal_bruto,
    ))

    # Cuando el admin crea el pedido directamente: nace en Confirmado (4).
    # Para pickup (sin domicilio): descuenta stock de los productos que NO requieren producción.
    # Los productos de producción se saltan (sin stock que descontar; la orden cubre el déficit).
    # Para domicilio: el stock se descuenta en ENTREGADO, igual que el flujo normal.
    if datos.creado_por_admin:
        nueva_venta.Estado = EstadoPedido.CONFIRMADO
        if not datos.domicilio:
            items_flush = db.query(VentaXProducto).filter(
                VentaXProducto.ID_Venta == nueva_venta.ID_Venta
            ).all()
            for item in items_flush:
                prod = db.query(Producto).filter(Producto.ID_Producto == item.ID_Producto).first()
                if not prod or getattr(prod, "Requiere_Produccion", 0):
                    continue
                prod.Stock = max(0, (prod.Stock or 0) - (item.Cantidad or 0))
                _actualizar_estado_producto(prod)
                notificar_stock_producto(db, prod)
        # Estas notificaciones ya no aplican: el admin las gestiona en el mismo acto
        descartar_notificacion(db, "pedido_nuevo",        nueva_venta.ID_Venta)
        descartar_notificacion(db, "produccion_requerida", nueva_venta.ID_Venta)

    if datos.domicilio:
        ESTADO_ASIGNADO = 10
        ESTADO_DOM_PENDIENTE = 3
        estado_dom = ESTADO_ASIGNADO if datos.domicilio.ID_Empleado else ESTADO_DOM_PENDIENTE
        # Si el domicilio no trae su propia fecha, usa la fecha_entrega_esperada del pedido
        fecha_dom = datos.domicilio.Fecha_entrega or datos.Fecha_entrega_esperada
        import secrets as _secrets
        db.add(Domicilio(
            ID_Venta             = nueva_venta.ID_Venta,
            ID_Empleado          = datos.domicilio.ID_Empleado,
            Fecha_asignacion     = _now(),
            Fecha_entrega        = fecha_dom,
            Observaciones        = datos.domicilio.Observaciones,
            Estado               = estado_dom,
            Direccion_entrega    = datos.domicilio.Direccion_entrega,
            Municipio_entrega    = datos.domicilio.Municipio_entrega,
            Departamento_entrega = datos.domicilio.Departamento_entrega,
            OTP                  = str(100000 + _secrets.randbelow(900000)),
        ))
        if not datos.domicilio.ID_Empleado:
            notificar(
                db, "domicilio_pendiente", "Domicilio sin repartidor",
                f"El pedido #{nueva_venta.ID_Venta} tiene domicilio sin repartidor asignado",
                nueva_venta.ID_Venta, "/ventas/domicilios",
            )

    db.commit()
    db.refresh(nueva_venta)

    # Crear órdenes de producción cuando el admin confirma directamente
    if datos.creado_por_admin:
        _crear_ordenes_produccion_para_venta(
            db, nueva_venta.ID_Venta, nueva_venta.Fecha_entrega_esperada
        )
        db.commit()

    # Push FCM a admins — sin bloqueo si Firebase no está configurado
    try:
        from src.shared.services.fcm_service import notificar_nuevo_pedido_push
        admin_ids = [
            row.ID_Usuario
            for row in db.query(Usuario.ID_Usuario).filter(Usuario.ID_Rol == 1).all()
        ]
        notificar_nuevo_pedido_push(
            id_venta       = nueva_venta.ID_Venta,
            nombre_cliente = f"{usuario.Nombre} {usuario.Apellidos}",
            total          = float(nueva_venta.Total or 0),
            admin_ids      = admin_ids,
            db             = db,
        )
    except Exception:
        pass

    return _formato_venta(nueva_venta, db)


def cambiar_estado(db: Session, id_venta: int, nuevo_estado: int) -> dict:
    venta = db.query(Venta).filter(Venta.ID_Venta == id_venta).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    tiene_domicilio = db.query(Domicilio).filter(Domicilio.ID_Venta == id_venta).first() is not None

    # Valida que la transición esté permitida por la máquina de estados
    validar_transicion(venta.Estado, nuevo_estado, tiene_domicilio)

    # Comprobante obligatorio para marcar como entregado
    if nuevo_estado == EstadoPedido.ENTREGADO and not venta.Comprobante_Pago:
        raise HTTPException(
            status_code=400,
            detail="Se requiere comprobante de pago para marcar el pedido como entregado",
        )

    # Al confirmar un pedido SIN domicilio (recoger en tienda): descontar stock
    if nuevo_estado == EstadoPedido.CONFIRMADO and not tiene_domicilio:
        items = db.query(VentaXProducto).filter(VentaXProducto.ID_Venta == id_venta).all()
        for item in items:
            producto = db.query(Producto).filter(Producto.ID_Producto == item.ID_Producto).first()
            if not producto:
                continue
            producto.Stock = max(0, (producto.Stock or 0) - (item.Cantidad or 0))
            _actualizar_estado_producto(producto)
            notificar_stock_producto(db, producto)

    # Al entregar un pedido CON domicilio: descontar stock
    if nuevo_estado == EstadoPedido.ENTREGADO and tiene_domicilio:
        items = db.query(VentaXProducto).filter(VentaXProducto.ID_Venta == id_venta).all()
        for item in items:
            producto = db.query(Producto).filter(Producto.ID_Producto == item.ID_Producto).first()
            if not producto:
                continue
            producto.Stock = max(0, (producto.Stock or 0) - (item.Cantidad or 0))
            _actualizar_estado_producto(producto)
            notificar_stock_producto(db, producto)

    # Al cancelar: restaurar stock si ya fue descontado
    # - pickup: stock se descuenta en CONFIRMADO; se restaura desde confirmado/preparando/listo
    # - domicilio: stock se descuenta en ENTREGADO; no aplica al cancelar (nunca llegó)
    if nuevo_estado == EstadoPedido.CANCELADO:
        stock_descontado = (
            not tiene_domicilio and venta.Estado in ESTADOS_STOCK_DESCONTADO_PICKUP
        )
        if stock_descontado:
            items = db.query(VentaXProducto).filter(VentaXProducto.ID_Venta == id_venta).all()
            for item in items:
                producto = db.query(Producto).filter(Producto.ID_Producto == item.ID_Producto).first()
                if producto:
                    producto.Stock = (producto.Stock or 0) + (item.Cantidad or 0)
                    _actualizar_estado_producto(producto)
                    notificar_stock_producto(db, producto)

        # Devolver crédito si se usó al crear el pedido
        detalle = db.query(DetalleVenta).filter(DetalleVenta.ID_Venta == id_venta).first()
        if detalle and detalle.Descuento and detalle.Descuento > 0:
            credito = db.query(CreditoCliente).filter(
                CreditoCliente.ID_Usuario == venta.ID_Usuario
            ).first()
            if credito:
                credito.Saldo        += detalle.Descuento
                credito.Fecha_Update  = _now()
                db.add(MovimientoCredito(
                    ID_Credito    = credito.ID_Credito,
                    ID_Devolucion = None,
                    ID_Venta      = id_venta,
                    Tipo          = "recarga",
                    Monto         = detalle.Descuento,
                    Fecha         = _now(),
                ))

    if venta.Estado == EstadoPedido.PENDIENTE:
        descartar_notificacion(db, "pedido_nuevo", id_venta)
    if nuevo_estado == EstadoPedido.CANCELADO:
        descartar_notificacion(db, "domicilio_pendiente", id_venta)
        # Cerrar el domicilio pendiente si la venta se cancela
        domicilio_abierto = db.query(Domicilio).filter(
            Domicilio.ID_Venta == id_venta,
            Domicilio.Estado.notin_([8, 5]),  # 8=Entregado, 5=Cancelado (ya finales)
        ).first()
        if domicilio_abierto:
            domicilio_abierto.Estado = 5  # Cancelado

    venta.Estado = nuevo_estado
    db.commit()
    db.refresh(venta)
    try:
        from src.shared.services.fcm_service import notificar_cambio_pedido_push
        notificar_cambio_pedido_push(
            id_usuario_cliente=venta.ID_Usuario,
            id_venta=id_venta,
            nuevo_estado=nuevo_estado,
            db=db,
        )
    except Exception:
        pass
    return _formato_venta(venta, db)


def obtener_mi_credito(db: Session, usuario_actual: dict) -> dict:
    """Retorna el saldo de crédito disponible del cliente autenticado."""
    registro   = usuario_actual.get("registro")
    id_usuario = registro.ID_Usuario if registro else None
    credito = db.query(CreditoCliente).filter(
        CreditoCliente.ID_Usuario == id_usuario
    ).first()
    saldo = float(credito.Saldo) if credito and credito.Saldo else 0.0
    return {"saldo": saldo, "id_usuario": id_usuario}


# ── Feature "Fecha propuesta" ──────────────────────────────────────────────

def proponer_fecha(db: Session, id_venta: int, fecha_entrega) -> dict:
    """Admin propone una fecha de entrega. Solo válido en ventas Pendientes o con Fecha propuesta."""
    venta = db.query(Venta).filter(Venta.ID_Venta == id_venta).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if venta.Estado not in (EstadoPedido.PENDIENTE, EstadoPedido.FECHA_PROPUESTA):
        raise HTTPException(
            status_code=400,
            detail="Solo se puede proponer fecha en ventas Pendientes o en estado Fecha propuesta",
        )
    descartar_notificacion(db, "produccion_requerida", id_venta)
    venta.Estado = EstadoPedido.FECHA_PROPUESTA
    venta.Fecha_entrega_esperada = fecha_entrega
    db.commit()
    db.refresh(venta)
    return _formato_venta(venta, db)


def _crear_ordenes_produccion_para_venta(db: Session, id_venta: int, fecha_entrega) -> None:
    """Crea órdenes de producción para los productos que requieren producción."""
    items_venta = db.query(VentaXProducto).filter(VentaXProducto.ID_Venta == id_venta).all()
    for item in items_venta:
        prod = db.query(Producto).filter(Producto.ID_Producto == item.ID_Producto).first()
        if not prod or not getattr(prod, "Requiere_Produccion", 0):
            continue

        cantidad = (item.Cantidad or 0)
        if cantidad <= 0:
            continue

        ficha = (
            db.query(FichaTecnica)
            .filter(FichaTecnica.ID_Producto == item.ID_Producto, FichaTecnica.Estado == 1)
            .order_by(FichaTecnica.ID_Ficha.desc())
            .first()
        )
        template = (
            db.query(OrdenProduccion)
            .filter(
                OrdenProduccion.ID_Producto == item.ID_Producto,
                OrdenProduccion.ID_Insumo   != None,
                OrdenProduccion.Estado      != 5,
            )
            .order_by(OrdenProduccion.ID_Orden_Produccion.desc())
            .first()
        )
        id_ficha  = ficha.ID_Ficha     if ficha    else (template.ID_Ficha  if template else None)
        id_insumo = template.ID_Insumo if template else None

        db.add(OrdenProduccion(
            ID_Venta      = id_venta,
            ID_Producto   = item.ID_Producto,
            ID_Insumo     = id_insumo,
            ID_Ficha      = id_ficha,
            Cantidad      = cantidad,
            Fecha_inicio  = _now(),
            Fecha_Entrega = fecha_entrega or _now(),
            Estado        = 1,
            Costo         = Decimal("0"),
        ))


def aceptar_fecha(db: Session, id_venta: int, actual: dict) -> dict:
    """El cliente acepta la fecha propuesta → Estado Confirmado (4)."""
    if actual["tipo"] != "cliente":
        raise HTTPException(status_code=403, detail="Solo disponible para clientes")
    id_usuario = actual["registro"].ID_Usuario

    venta = db.query(Venta).filter(Venta.ID_Venta == id_venta).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if venta.ID_Usuario != id_usuario:
        raise HTTPException(status_code=403, detail="No puedes aceptar pedidos de otros clientes")
    if venta.Estado != EstadoPedido.FECHA_PROPUESTA:
        raise HTTPException(status_code=400, detail="El pedido no está en estado 'Fecha propuesta'")

    venta.Estado = EstadoPedido.CONFIRMADO

    _crear_ordenes_produccion_para_venta(db, id_venta, venta.Fecha_entrega_esperada)

    notificar(
        db, "fecha_aceptada", "Fecha aceptada por el cliente",
        f"El cliente aceptó la fecha propuesta para el pedido #{id_venta}",
        id_venta, "/ventas/pedidos",
    )
    db.commit()
    db.refresh(venta)
    try:
        from src.shared.services.fcm_service import notificar_cambio_pedido_push
        notificar_cambio_pedido_push(
            id_usuario_cliente=venta.ID_Usuario,
            id_venta=id_venta,
            nuevo_estado=EstadoPedido.CONFIRMADO,
            db=db,
        )
    except Exception:
        pass
    return _formato_venta(venta, db)


def rechazar_fecha(db: Session, id_venta: int, actual: dict) -> dict:
    """El cliente rechaza la fecha propuesta → Estado Cancelado (5). Devuelve crédito si aplica."""
    if actual["tipo"] != "cliente":
        raise HTTPException(status_code=403, detail="Solo disponible para clientes")
    id_usuario = actual["registro"].ID_Usuario

    venta = db.query(Venta).filter(Venta.ID_Venta == id_venta).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if venta.ID_Usuario != id_usuario:
        raise HTTPException(status_code=403, detail="No puedes rechazar pedidos de otros clientes")
    if venta.Estado != EstadoPedido.FECHA_PROPUESTA:
        raise HTTPException(status_code=400, detail="El pedido no está en estado 'Fecha propuesta'")

    venta.Estado = EstadoPedido.CANCELADO
    notificar(
        db, "fecha_rechazada", "Fecha rechazada por el cliente",
        f"El cliente rechazó la fecha propuesta para el pedido #{id_venta}",
        id_venta, "/ventas/pedidos",
    )
    descartar_notificacion(db, "produccion_requerida", id_venta)

    # Devolver crédito si se usó al crear el pedido
    detalle = db.query(DetalleVenta).filter(DetalleVenta.ID_Venta == id_venta).first()
    if detalle and detalle.Descuento and detalle.Descuento > 0:
        credito = db.query(CreditoCliente).filter(
            CreditoCliente.ID_Usuario == venta.ID_Usuario
        ).first()
        if credito:
            credito.Saldo        += detalle.Descuento
            credito.Fecha_Update  = _now()
            db.add(MovimientoCredito(
                ID_Credito    = credito.ID_Credito,
                ID_Devolucion = None,
                ID_Venta      = id_venta,
                Tipo          = "recarga",
                Monto         = detalle.Descuento,
                Fecha         = _now(),
            ))

    db.commit()
    db.refresh(venta)
    return _formato_venta(venta, db)
