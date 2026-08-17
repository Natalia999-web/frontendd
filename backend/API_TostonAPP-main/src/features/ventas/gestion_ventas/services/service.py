from sqlalchemy.orm import Session, selectinload
from fastapi import HTTPException
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

_BOGOTA = ZoneInfo("America/Bogota")


def _now():
    return datetime.now(_BOGOTA).replace(tzinfo=None)

from sqlalchemy import func
from src.shared.services.models import (
    Venta, VentaXProducto, DetalleVenta, Producto, ProductoImagen, Usuario,
    Estado, Domicilio, CreditoCliente, MovimientoCredito,
    Descuento, DescuentoXUsuario, DescuentoXVenta, OrdenProduccion, FichaTecnica,
)


def _imagen_producto(db: Session, id_producto: int) -> str | None:
    """URL de la primera imagen del producto (o None). Usa Producto_Imagenes."""
    img = db.query(ProductoImagen).filter(
        ProductoImagen.ID_Producto == id_producto
    ).first()
    return img.imagen if img else None
from src.shared.services.notificaciones_utils import notificar, descartar_notificacion, notificar_stock_producto
from src.features.ventas.pedidos.services.estados import (
    EstadoPedido, ESTADOS_STOCK_DESCONTADO_PICKUP, validar_transicion,
)
from .schemas import VentaCreate, DomicilioVentaInput

# Costo fijo de domicilio (COP)
COSTO_DOMICILIO = Decimal("5000")

# Porcentaje del pedido que el cliente debe anticipar cuando pide MÁS unidades de
# las que hay en stock (pedido especial / preorden). Regla de negocio del backend:
# nunca se toma del request, el cliente no puede alterarla.
PORCENTAJE_ANTICIPO_SOBRE_STOCK = Decimal("0.50")


def _es_transferencia(metodo: str | None) -> bool:
    return "transfer" in (metodo or "").strip().lower()


def _evaluar_lineas_pedido(db: Session, productos_input) -> tuple[list[dict], Decimal]:
    """Valida los productos contra el stock REAL y calcula el subtotal.

    Bloquea la fila de cada producto con with_for_update(): dos pedidos
    simultáneos del mismo producto se serializan, así no pueden leer el mismo
    stock y creer ambos que les alcanza (condición de carrera del punto 9).

    Cada línea devuelve cuántas unidades caben en stock y cuántas van por encima
    (preorden). El stock NO se toca aquí: el descuento real sigue ocurriendo al
    confirmar (tienda) o entregar (domicilio), como en el flujo actual.
    """
    lineas: list[dict] = []
    subtotal = Decimal("0")

    for p in productos_input:
        producto = (
            db.query(Producto)
            .filter(Producto.ID_Producto == p.ID_Producto)
            .with_for_update()
            .first()
        )
        if not producto:
            raise HTTPException(status_code=404, detail=f"Producto {p.ID_Producto} no encontrado")

        stock    = producto.Stock or 0
        cantidad = p.Cantidad
        # Los productos por encargo (Requiere_Produccion) ya tienen su propio
        # flujo: el déficit se cubre con una orden de producción, no es preorden.
        requiere_produccion = bool(getattr(producto, "Requiere_Produccion", 0))
        preorden = 0 if requiere_produccion else max(0, cantidad - stock)

        precio    = producto.Precio_venta or Decimal("0")
        subtotal += precio * Decimal(str(cantidad))

        lineas.append({
            "ID_Producto": p.ID_Producto,
            "nombre":      producto.nombre,
            "cantidad":    cantidad,
            "stock":       stock,
            "preorden":    preorden,
        })

    return lineas, subtotal


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


def _descontar_stock_venta(db: Session, id_venta: int) -> None:
    """Descuenta del stock lo vendido en la venta, bloqueando cada producto.

    with_for_update() evita que dos pedidos que se confirman/entregan a la vez
    lean el mismo stock y lo descuenten dos veces sobre el mismo valor. El stock
    nunca baja de 0: lo que se pidió por encima quedó registrado como preorden en
    Venta_x_Producto.Cantidad_Preorden.
    """
    items = db.query(VentaXProducto).filter(VentaXProducto.ID_Venta == id_venta).all()
    for item in items:
        producto = (
            db.query(Producto)
            .filter(Producto.ID_Producto == item.ID_Producto)
            .with_for_update()
            .first()
        )
        if not producto:
            continue
        producto.Stock = max(0, (producto.Stock or 0) - (item.Cantidad or 0))
        _actualizar_estado_producto(producto)
        notificar_stock_producto(db, producto)


def _actualizar_estado_producto(producto: Producto) -> None:
    stock  = producto.Stock or 0
    minimo = getattr(producto, "Stock_Minimo", 0) or 0
    if stock == 0:
        producto.Estado = 15
    elif stock <= minimo:
        producto.Estado = 14
    else:
        producto.Estado = 1


def _formato_venta(venta: Venta, db: Session, *, dxv_map=None) -> dict:
    """Construye la respuesta completa de una venta.

    dxv_map: pre-cargado {id_venta: DescuentoXVenta} para el caso de listado;
    cuando es None usa db.query() igual que antes (op. individual sin cambio).
    Los demás sub-datos usan relationships: lazy-load en op. individuales,
    eager-load (selectinload) en listados — resultado idéntico.
    """
    usuario = venta.usuario

    productos = []
    requiere_produccion = False
    for v in venta.productos:
        producto = v.producto
        precio   = producto.Precio_venta if producto else Decimal("0")
        if getattr(producto, "Requiere_Produccion", 0):
            requiere_produccion = True
        imagen = producto.imagenes[0].imagen if (producto and producto.imagenes) else None
        productos.append({
            "ID_Producto":     v.ID_Producto,
            "nombre_producto": producto.nombre if producto else None,
            "Cantidad":        v.Cantidad,
            "precio_unitario": precio,
            "subtotal":        precio * Decimal(str(v.Cantidad)),
            "imagen":          imagen,
            "cantidad_preorden": getattr(v, "Cantidad_Preorden", 0) or 0,
            "stock_disponible":  (producto.Stock or 0) if producto else 0,
        })

    detalle          = venta.detalle[0] if venta.detalle else None
    credito_aplicado = detalle.Descuento if detalle else Decimal("0")
    iva              = detalle.IVA if detalle else Decimal("0")

    if dxv_map is not None:
        dxv = dxv_map.get(venta.ID_Venta)
    else:
        dxv = db.query(DescuentoXVenta).filter(DescuentoXVenta.ID_Venta == venta.ID_Venta).first()
    descuento_aplicado = dxv.Monto_Aplicado if dxv else Decimal("0")

    domicilio      = venta.domicilios[0] if venta.domicilios else None
    subtotal_bruto = sum(p["subtotal"] for p in productos)

    domiciliario = None
    if domicilio and domicilio.ID_Empleado:
        emp = domicilio.empleado
        if emp:
            domiciliario = f"{emp.Nombre} {emp.Apellidos}"

    ordenes_pendientes = sum(
        1 for o in venta.ordenes_produccion
        if o.Estado not in (11, 5)
    )

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
        "Fecha_entrega":          getattr(venta, "Fecha_entrega", None),
        "Fecha_entrega_esperada": venta.Fecha_entrega_esperada,
        "productos":              productos,
        "comprobante_pago":             venta.Comprobante_Pago,
        "tiene_domicilio":              domicilio is not None,
        "ID_Domicilio":                 domicilio.ID_Domicilio          if domicilio else None,
        "direccion_entrega":            domicilio.Direccion_entrega      if domicilio else None,
        "municipio_entrega":            domicilio.Municipio_entrega      if domicilio else None,
        "departamento_entrega":         domicilio.Departamento_entrega   if domicilio else None,
        "nombre_domiciliario":          domiciliario,
        "ID_Empleado":                  domicilio.ID_Empleado if domicilio else None,
        "ordenes_produccion_pendientes": ordenes_pendientes,
        "requiere_produccion":           requiere_produccion,
        # Pedido especial por encima del stock + anticipo del 50% (calculado y
        # verificado en backend al crear la venta).
        "sobre_stock":        bool(getattr(venta, "Sobre_Stock", 0)),
        "anticipo_requerido": getattr(venta, "Anticipo_Requerido", None),
        "anticipo_pagado":    getattr(venta, "Anticipo_Pagado", None),
        # True solo en los pedidos a los que hay que proponerles fecha
        # (sobre stock o producción). Los normales no la necesitan.
        "requiere_fecha_propuesta": requiere_fecha_propuesta(db, venta),
    }


def _aplicar_credito(db: Session, id_usuario: int, monto_restante: Decimal, id_venta: int) -> Decimal:
    # with_for_update() bloquea la fila de crédito hasta el commit de crear_venta:
    # evita que dos compras simultáneas gasten el mismo saldo (condición de carrera).
    credito = db.query(CreditoCliente).filter(
        CreditoCliente.ID_Usuario == id_usuario
    ).with_for_update().first()

    if not credito or credito.Saldo <= 0:
        return Decimal("0")

    # El monto usado se recalcula 100% en backend: min(saldo real, total real del
    # pedido). El cliente no puede manipular cuánto crédito se descuenta.
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


def _batch_ventas(ventas: list, db: Session) -> list:
    """Formatea una lista de ventas con queries en lote. Evita N+1."""
    if not ventas:
        return []

    venta_ids   = [v.ID_Venta   for v in ventas]
    usuario_ids = list({v.ID_Usuario for v in ventas if v.ID_Usuario})

    # Batch 1: clientes
    usuarios = {u.ID_Usuario: u for u in
                db.query(Usuario).filter(Usuario.ID_Usuario.in_(usuario_ids)).all()} if usuario_ids else {}

    # Batch 2: VentaXProducto
    vxp_all = db.query(VentaXProducto).filter(VentaXProducto.ID_Venta.in_(venta_ids)).all()
    vxp_by_venta: dict = {}
    for vxp in vxp_all:
        vxp_by_venta.setdefault(vxp.ID_Venta, []).append(vxp)

    # Batch 3: productos
    prod_ids = list({v.ID_Producto for v in vxp_all if v.ID_Producto})
    productos = {p.ID_Producto: p for p in
                 db.query(Producto).filter(Producto.ID_Producto.in_(prod_ids)).all()} if prod_ids else {}

    # Batch 4: primera imagen por producto
    imagenes_map: dict = {}
    if prod_ids:
        for img in db.query(ProductoImagen).filter(ProductoImagen.ID_Producto.in_(prod_ids)).all():
            if img.ID_Producto not in imagenes_map:
                imagenes_map[img.ID_Producto] = img.imagen

    # Batch 5: detalles de venta
    detalles = {d.ID_Venta: d for d in
                db.query(DetalleVenta).filter(DetalleVenta.ID_Venta.in_(venta_ids)).all()}

    # Batch 6: descuentos por venta
    dxvs = {d.ID_Venta: d for d in
            db.query(DescuentoXVenta).filter(DescuentoXVenta.ID_Venta.in_(venta_ids)).all()}

    # Batch 7: domicilios
    domicilios = {d.ID_Venta: d for d in
                  db.query(Domicilio).filter(Domicilio.ID_Venta.in_(venta_ids)).all()}

    # Batch 8: repartidores
    emp_ids = list({d.ID_Empleado for d in domicilios.values() if d.ID_Empleado})
    repartidores = {u.ID_Usuario: u for u in
                    db.query(Usuario).filter(Usuario.ID_Usuario.in_(emp_ids)).all()} if emp_ids else {}

    # Batch 9: órdenes pendientes por venta (COUNT)
    ordenes_rows = (
        db.query(OrdenProduccion.ID_Venta,
                 func.count(OrdenProduccion.ID_Orden_Produccion).label("cnt"))
        .filter(OrdenProduccion.ID_Venta.in_(venta_ids),
                OrdenProduccion.Estado.notin_([11, 5]))
        .group_by(OrdenProduccion.ID_Venta)
        .all()
    )
    ordenes_counts = {row.ID_Venta: row.cnt for row in ordenes_rows}

    result = []
    for venta in ventas:
        usuario    = usuarios.get(venta.ID_Usuario)
        vxp_list   = vxp_by_venta.get(venta.ID_Venta, [])
        detalle    = detalles.get(venta.ID_Venta)
        dxv        = dxvs.get(venta.ID_Venta)
        dom        = domicilios.get(venta.ID_Venta)
        repartidor = repartidores.get(dom.ID_Empleado) if dom and dom.ID_Empleado else None

        prods_list          = []
        requiere_produccion = False
        for v in vxp_list:
            prod  = productos.get(v.ID_Producto)
            precio = prod.Precio_venta if prod else Decimal("0")
            if getattr(prod, "Requiere_Produccion", 0):
                requiere_produccion = True
            prods_list.append({
                "ID_Producto":       v.ID_Producto,
                "nombre_producto":   prod.nombre if prod else None,
                "Cantidad":          v.Cantidad,
                "precio_unitario":   precio,
                "subtotal":          precio * Decimal(str(v.Cantidad)),
                "imagen":            imagenes_map.get(v.ID_Producto),
                "cantidad_preorden": getattr(v, "Cantidad_Preorden", 0) or 0,
                "stock_disponible":  (prod.Stock or 0) if prod else 0,
            })

        credito_aplicado   = detalle.Descuento        if detalle else Decimal("0")
        descuento_aplicado = dxv.Monto_Aplicado       if dxv     else Decimal("0")
        subtotal_bruto     = sum(p["subtotal"] for p in prods_list)
        domiciliario       = (f"{repartidor.Nombre} {repartidor.Apellidos}"
                              if repartidor else None)

        # requiere_fecha_propuesta desde datos en memoria
        rfp = bool(getattr(venta, "Sobre_Stock", 0))
        if not rfp:
            for vxp in vxp_list:
                prod = productos.get(vxp.ID_Producto)
                if prod and getattr(prod, "Requiere_Produccion", 0) and (vxp.Cantidad or 0) > (prod.Stock or 0):
                    rfp = True
                    break

        result.append({
            "ID_Venta":           venta.ID_Venta,
            "ID_Usuario":         venta.ID_Usuario,
            "nombre_cliente":     f"{usuario.Nombre} {usuario.Apellidos}" if usuario else None,
            "correo_cliente":     usuario.Correo   if usuario else None,
            "telefono_cliente":   usuario.Telefono if usuario else None,
            "Total":              venta.Total,
            "subtotal_bruto":     subtotal_bruto,
            "credito_aplicado":   credito_aplicado,
            "descuento_aplicado": descuento_aplicado,
            "Estado":             venta.Estado,
            "estado_label":       _label_estado(db, venta.Estado) if venta.Estado else None,
            "Metodo_Pago":            venta.Metodo_Pago,
            "Fecha_Venta":            venta.Fecha_Venta,
            "Fecha_pedido":           venta.Fecha_pedido,
            "Fecha_entrega":          getattr(venta, "Fecha_entrega", None),
            "Fecha_entrega_esperada": venta.Fecha_entrega_esperada,
            "productos":              prods_list,
            "comprobante_pago":             venta.Comprobante_Pago,
            "tiene_domicilio":              dom is not None,
            "ID_Domicilio":                 dom.ID_Domicilio        if dom else None,
            "direccion_entrega":            dom.Direccion_entrega   if dom else None,
            "municipio_entrega":            dom.Municipio_entrega   if dom else None,
            "departamento_entrega":         dom.Departamento_entrega if dom else None,
            "nombre_domiciliario":          domiciliario,
            "ID_Empleado":                  dom.ID_Empleado if dom else None,
            "ordenes_produccion_pendientes": ordenes_counts.get(venta.ID_Venta, 0),
            "requiere_produccion":           requiere_produccion,
            "sobre_stock":        bool(getattr(venta, "Sobre_Stock", 0)),
            "anticipo_requerido": getattr(venta, "Anticipo_Requerido", None),
            "anticipo_pagado":    getattr(venta, "Anticipo_Pagado", None),
            "requiere_fecha_propuesta": rfp,
        })

    return result


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
    ventas = (
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
        .order_by(Venta.Fecha_Venta.desc())
        .offset(offset)
        .limit(por_pagina)
        .all()
    )

    venta_ids = [v.ID_Venta for v in ventas]
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
        "ventas":     [_formato_venta(v, db, dxv_map=dxv_map) for v in ventas],
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
    total  = query.count()
    offset = (pagina - 1) * por_pagina
    ventas = (
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

    venta_ids = [v.ID_Venta for v in ventas]
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
        "ventas":     [_formato_venta(v, db, dxv_map=dxv_map) for v in ventas],
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

    # Valida productos contra el stock real (con bloqueo de fila) y calcula subtotal.
    # Pedir por encima del stock ya no se rechaza: se marca como preorden y más
    # abajo se le exige el anticipo del 50%.
    lineas, subtotal_bruto = _evaluar_lineas_pedido(db, datos.productos)
    preorden_por_producto = {l["ID_Producto"]: l["preorden"] for l in lineas}
    sobre_stock = any(l["preorden"] > 0 for l in lineas)

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
            ID_Venta          = nueva_venta.ID_Venta,
            ID_Producto       = p.ID_Producto,
            Cantidad          = p.Cantidad,
            Cantidad_Preorden = preorden_por_producto.get(p.ID_Producto, 0),
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
    costo_domicilio = COSTO_DOMICILIO if datos.domicilio else Decimal("0")
    nueva_venta.Total += costo_domicilio

    # ── Pedido por encima del stock: anticipo obligatorio del 50% ──────────────
    # TODO lo que se evalúa aquí sale de la BD (stock real, precios reales, crédito
    # realmente descontado). El request del cliente no puede declarar que ya pagó.
    if sobre_stock:
        # Valor real del pedido antes de aplicar créditos (lo que cuesta).
        total_pedido       = subtotal_bruto - descuento_aplicado + costo_domicilio
        anticipo_requerido = (total_pedido * PORCENTAJE_ANTICIPO_SOBRE_STOCK).quantize(Decimal("0.01"))
        # Solo cuenta como pagado lo verificable en el servidor: el crédito
        # efectivamente descontado del libro mayor del cliente.
        anticipo_pagado    = credito_aplicado
        # La transferencia no se puede verificar automáticamente, pero exige un
        # comprobante adjunto que el administrador valida antes de confirmar.
        tiene_soporte      = _es_transferencia(datos.Metodo_Pago) and bool(
            (datos.comprobante_pago or "").strip()
        )

        # El pedido creado por el personal en el mostrador se cobra en el acto:
        # queda marcado como sobre stock, pero no se le exige el anticipo online.
        if not datos.creado_por_admin and anticipo_pagado < anticipo_requerido and not tiene_soporte:
            faltante = anticipo_requerido - anticipo_pagado
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Este pedido supera el stock disponible, por lo que requiere un anticipo "
                    f"del 50% (${anticipo_requerido:,.0f}). Te faltan ${faltante:,.0f}: págalo "
                    f"con tus créditos o por transferencia adjuntando el comprobante."
                ),
            )

        nueva_venta.Sobre_Stock        = 1
        nueva_venta.Anticipo_Requerido = anticipo_requerido
        nueva_venta.Anticipo_Pagado    = anticipo_pagado

        detalle_preorden = ", ".join(
            f"{l['nombre']}: {l['cantidad']} pedidas / {l['stock']} en stock"
            for l in lineas if l["preorden"] > 0
        )
        notificar(
            db, "pedido_sobre_stock", "Pedido por encima del stock",
            f"El pedido #{nueva_venta.ID_Venta} supera el stock ({detalle_preorden}). "
            f"Anticipo requerido: ${anticipo_requerido:,.0f}. Revisá y proponé una fecha de entrega.",
            nueva_venta.ID_Venta, "/ventas/pedidos",
        )
    else:
        nueva_venta.Sobre_Stock = 0

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

    # El push a los administradores lo dispara notificar() al crear la
    # notificación del panel: así todas las alertas llegan por el mismo camino.

    # Si el pedido nació con repartidor asignado, avisarle en su celular.
    if datos.domicilio and datos.domicilio.ID_Empleado:
        try:
            from src.features.ventas.domicilios.services.service import _avisar_asignacion
            dom_creado = db.query(Domicilio).filter(
                Domicilio.ID_Venta == nueva_venta.ID_Venta
            ).first()
            if dom_creado:
                _avisar_asignacion(db, dom_creado)
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

    # Bloquear paso a LISTO si hay órdenes de producción sin completar
    if nuevo_estado == EstadoPedido.LISTO:
        ordenes_incompletas = db.query(OrdenProduccion).filter(
            OrdenProduccion.ID_Venta == id_venta,
            OrdenProduccion.Estado.notin_([11, 5]),
        ).count()
        if ordenes_incompletas > 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No se puede marcar como Listo: la producción de este pedido aún no está "
                    "completada. Completá la orden de producción primero."
                ),
            )

    # Comprobante obligatorio para marcar como entregado SOLO si el pago fue por
    # transferencia. Los pedidos en efectivo se cobran en mano y no tienen soporte.
    _metodo = (venta.Metodo_Pago or "").strip().lower()
    if nuevo_estado == EstadoPedido.ENTREGADO and "transfer" in _metodo and not venta.Comprobante_Pago:
        raise HTTPException(
            status_code=400,
            detail="Se requiere comprobante de pago para marcar el pedido como entregado",
        )

    # Registrar el timestamp real de entrega (fuente para el plazo de devoluciones,
    # también en pedidos de recoger en tienda que no tienen domicilio).
    if nuevo_estado == EstadoPedido.ENTREGADO and not getattr(venta, "Fecha_entrega", None):
        venta.Fecha_entrega = _now()

    # Al confirmar un pedido SIN domicilio (recoger en tienda): descontar stock
    if nuevo_estado == EstadoPedido.CONFIRMADO and not tiene_domicilio:
        _descontar_stock_venta(db, id_venta)

    # Al entregar un pedido CON domicilio: descontar stock
    if nuevo_estado == EstadoPedido.ENTREGADO and tiene_domicilio:
        _descontar_stock_venta(db, id_venta)

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
                producto = (
                    db.query(Producto)
                    .filter(Producto.ID_Producto == item.ID_Producto)
                    .with_for_update()
                    .first()
                )
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
    """
    Retorna el saldo de crédito disponible del cliente autenticado.

    El saldo se recalcula desde el libro mayor de movimientos (recargas − usos),
    que es la fuente de verdad. Si el campo CreditoCliente.Saldo quedó
    desincronizado (p. ej. una recarga por devolución que no se reflejó en el
    campo), se corrige y persiste aquí para que tanto la app como el checkout
    usen el valor correcto.
    """
    registro   = usuario_actual.get("registro")
    id_usuario = registro.ID_Usuario if registro else None
    credito = db.query(CreditoCliente).filter(
        CreditoCliente.ID_Usuario == id_usuario
    ).first()

    if not credito:
        return {"saldo": 0.0, "id_usuario": id_usuario}

    # Balance real desde los movimientos (append-only = fuente de verdad).
    movs = db.query(MovimientoCredito).filter(
        MovimientoCredito.ID_Credito == credito.ID_Credito
    ).all()
    balance = Decimal("0")
    for m in movs:
        monto = Decimal(str(m.Monto or 0))
        tipo  = (m.Tipo or "").lower()
        if tipo == "recarga":
            balance += monto
        elif tipo == "uso":
            balance -= monto
    if balance < 0:
        balance = Decimal("0")

    saldo_guardado = credito.Saldo or Decimal("0")

    # Autocorrección: si hay movimientos y el campo Saldo quedó desfasado, se
    # alinea al balance del libro mayor y se persiste (idempotente).
    if movs and abs(Decimal(str(saldo_guardado)) - balance) > Decimal("0.01"):
        credito.Saldo        = balance
        credito.Fecha_Update = _now()
        db.commit()
        saldo_guardado = balance

    # Con movimientos usamos el balance recalculado; sin movimientos, el campo.
    saldo = float(balance) if movs else float(saldo_guardado)
    return {"saldo": saldo, "id_usuario": id_usuario}


# ── Feature "Fecha propuesta" ──────────────────────────────────────────────

def requiere_fecha_propuesta(db: Session, venta: Venta) -> bool:
    """True si el pedido necesita que el admin proponga una fecha de entrega.

    Solo los pedidos que NO se pueden entregar de una:
    - sobre stock (preorden): se pidieron más unidades de las que hay;
    - producción: incluye productos por encargo cuyo stock no alcanza.

    Los pedidos normales (con o sin domicilio) se confirman directamente.
    """
    if bool(getattr(venta, "Sobre_Stock", 0)):
        return True

    items = db.query(VentaXProducto).filter(
        VentaXProducto.ID_Venta == venta.ID_Venta
    ).all()
    for item in items:
        prod = db.query(Producto).filter(
            Producto.ID_Producto == item.ID_Producto
        ).first()
        if not prod or not getattr(prod, "Requiere_Produccion", 0):
            continue
        if (item.Cantidad or 0) > (prod.Stock or 0):
            return True
    return False


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
    # La fecha propuesta es SOLO para los pedidos que no se pueden entregar de
    # inmediato: los que superan el stock disponible (preorden) y los que
    # incluyen productos por encargo con déficit. Un pedido normal —haya o no
    # domicilio— se confirma directamente, sin proponer fecha.
    if not requiere_fecha_propuesta(db, venta):
        raise HTTPException(
            status_code=400,
            detail=(
                "Solo se propone fecha en pedidos que superan el stock disponible "
                "o que requieren producción"
            ),
        )
    descartar_notificacion(db, "produccion_requerida", id_venta)
    descartar_notificacion(db, "pedido_sobre_stock",   id_venta)
    venta.Estado = EstadoPedido.FECHA_PROPUESTA
    venta.Fecha_entrega_esperada = fecha_entrega
    notificar(
        db, "fecha_propuesta", "Fecha de entrega propuesta",
        f"El administrador propuso una fecha de entrega para tu pedido #{id_venta}",
        id_venta, "/ventas/pedidos",
    )
    db.commit()
    db.refresh(venta)
    # Aviso push al cliente para que la revise (aceptar/rechazar).
    try:
        from src.shared.services.fcm_service import notificar_cambio_pedido_push
        notificar_cambio_pedido_push(
            id_usuario_cliente=venta.ID_Usuario,
            id_venta=id_venta,
            nuevo_estado=EstadoPedido.FECHA_PROPUESTA,
            db=db,
        )
    except Exception:
        pass
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

    # Pedidos con DOMICILIO: el pedido sigue vivo. Vuelve a Pendiente para que el
    # administrador pueda proponer OTRA fecha (no se cancela ni se devuelve crédito).
    tiene_domicilio = db.query(Domicilio).filter(
        Domicilio.ID_Venta == id_venta
    ).first() is not None
    if tiene_domicilio:
        venta.Estado = EstadoPedido.PENDIENTE
        venta.Fecha_entrega_esperada = None
        notificar(
            db, "fecha_rechazada", "Fecha rechazada por el cliente",
            f"El cliente rechazó la fecha del pedido #{id_venta}. Propone una nueva fecha.",
            id_venta, "/ventas/pedidos",
        )
        db.commit()
        db.refresh(venta)
        return _formato_venta(venta, db)

    # Pedidos de producción (sin domicilio): flujo existente → se cancela y se
    # devuelve el crédito usado.
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
