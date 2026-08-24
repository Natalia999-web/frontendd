import secrets
import logging
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from src.shared.services.models import (
    Domicilio, Venta, Usuario, Estado, Producto, ProductoImagen,
    VentaXProducto, Rol, MensajeChat,
)
from src.shared.services.notificaciones_utils import notificar, notificar_stock_producto
from src.features.ventas.gestion_ventas.services.service import _actualizar_estado_producto
from .estados import (
    EstadoDomicilio, ESTADO_DOM_A_VENTA, normalizar_estado, validar_cambio,
)
from .schemas import DomicilioCreate, DomicilioUpdate

logger = logging.getLogger(__name__)

_BOGOTA = ZoneInfo("America/Bogota")


def _now():
    """Hora actual en Colombia (naive), consistente con gestion_ventas."""
    return datetime.now(_BOGOTA).replace(tzinfo=None)


def _imagen_producto(db: Session, id_producto: int) -> str | None:
    """URL de la primera imagen del producto (o None). Reutiliza Producto_Imagenes."""
    img = db.query(ProductoImagen).filter(
        ProductoImagen.ID_Producto == id_producto
    ).first()
    return img.imagen if img else None


def _otp_nuevo() -> str:
    """Genera un código OTP de 6 dígitos criptográficamente seguro."""
    return str(100000 + secrets.randbelow(900000))


def _label_estado(db: Session, id_estado: int) -> str:
    estado = db.query(Estado).filter(Estado.ID_Estados == id_estado).first()
    return estado.Estado if estado else None


def _formato_domicilio(dom: Domicilio, db: Session) -> dict:
    """Construye el dict con cliente, repartidor, estado y datos de la venta."""
    # Obtiene el cliente desde la venta
    venta   = db.query(Venta).filter(Venta.ID_Venta == dom.ID_Venta).first()
    cliente = db.query(Usuario).filter(
        Usuario.ID_Usuario == venta.ID_Usuario
    ).first() if venta else None

    # Obtiene el repartidor (ahora en la tabla Usuarios)
    repartidor = db.query(Usuario).filter(
        Usuario.ID_Usuario == dom.ID_Empleado
    ).first() if dom.ID_Empleado else None

    # Datos de la venta: total, metodo_pago y productos
    total       = float(venta.Total) if venta and venta.Total else 0.0
    metodo_pago = venta.Metodo_Pago or "" if venta else ""
    productos   = []
    if venta:
        items = db.query(VentaXProducto).filter(
            VentaXProducto.ID_Venta == venta.ID_Venta
        ).all()
        for item in items:
            prod   = db.query(Producto).filter(
                Producto.ID_Producto == item.ID_Producto
            ).first()
            precio = float(prod.Precio_venta) if prod and prod.Precio_venta else 0.0
            productos.append({
                "ID_Producto":     item.ID_Producto,
                "nombre_producto": prod.nombre if prod else "",
                "Cantidad":        item.Cantidad,
                "precio_unitario": precio,
                "subtotal":        precio * (item.Cantidad or 0),
                "imagen":          _imagen_producto(db, item.ID_Producto),
            })

    # El estado se normaliza al leer: las filas escritas por versiones viejas de
    # la app móvil traen otra numeración (ver estados.py).
    estado_canonico = normalizar_estado(dom.Estado, tiene_repartidor=bool(dom.ID_Empleado))

    return {
        "ID_Domicilio":         dom.ID_Domicilio,
        "ID_Venta":             dom.ID_Venta,
        "nombre_cliente":       f"{cliente.Nombre} {cliente.Apellidos}" if cliente else None,
        "ID_Empleado":          dom.ID_Empleado,
        "nombre_repartidor":    f"{repartidor.Nombre} {repartidor.Apellidos}" if repartidor else None,
        "Fecha_asignacion":     dom.Fecha_asignacion,
        "Fecha_entrega":        dom.Fecha_entrega,
        "Observaciones":        dom.Observaciones,
        # Indicaciones de entrega tomadas del perfil del cliente (Usuarios.Indicaciones),
        # que es donde el cliente las registra. Separado de Observaciones (nota por-entrega).
        "indicaciones_cliente": cliente.Indicaciones if cliente else None,
        "Estado":               estado_canonico,
        "estado_label":         _label_estado(db, estado_canonico) if estado_canonico else None,
        "venta_estado":         venta.Estado if venta else None,
        "Direccion_entrega":    dom.Direccion_entrega,
        "Municipio_entrega":    dom.Municipio_entrega,
        "Departamento_entrega": dom.Departamento_entrega,
        "total":                total,
        "metodo_pago":          metodo_pago,
        "comprobante_pago":     venta.Comprobante_Pago if venta else None,
        "estado_pago":          venta.Estado_Pago if venta else None,
        "productos":            productos,
        "telefono_cliente":     cliente.Telefono if cliente else "",
        "otp":                  getattr(dom, "OTP", None),
    }


def obtener_repartidores(db: Session) -> list:
    """Usuarios cuyo rol contiene 'domiciliario'."""
    repartidores = (
        db.query(Usuario)
        .join(Rol, Usuario.ID_Rol == Rol.ID_Rol)
        .filter(Rol.Rol.ilike("%domiciliario%"))
        .all()
    )
    return [
        {"id": u.ID_Usuario, "nombre": f"{u.Nombre} {u.Apellidos}"}
        for u in repartidores
    ]


def obtener_resumen_dia(db: Session, id_empleado: int) -> dict:
    hoy_inicio = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    hoy_fin    = hoy_inicio + timedelta(days=1)

    base = db.query(Domicilio).filter(Domicilio.ID_Empleado == id_empleado)

    activos        = base.filter(Domicilio.Estado.in_([10, 13, 9])).count()
    entregados_hoy = base.filter(
        Domicilio.Estado == 8,
        Domicilio.Fecha_entrega >= hoy_inicio,
        Domicilio.Fecha_entrega < hoy_fin,
    ).count()
    total_hoy = base.filter(
        Domicilio.Fecha_asignacion >= hoy_inicio,
        Domicilio.Fecha_asignacion < hoy_fin,
    ).count()

    return {"activos": activos, "entregados_hoy": entregados_hoy, "total_hoy": total_hoy}


def obtener_domicilios(
    db: Session,
    pagina: int = 1,
    por_pagina: int = 10,
    busqueda: str = None,
    estado: int = None,
    id_empleado: int = None,
    fecha_inicio: datetime = None,
    fecha_fin: datetime = None,
) -> dict:
    """Lista paginada. Busca por nombre de cliente o repartidor. Filtra por estado o empleado asignado."""
    query = db.query(Domicilio)

    if id_empleado:
        query = query.filter(Domicilio.ID_Empleado == id_empleado)

    if estado:
        query = query.filter(Domicilio.Estado == estado)

    if fecha_inicio:
        query = query.filter(Domicilio.Fecha_asignacion >= fecha_inicio)

    if fecha_fin:
        query = query.filter(Domicilio.Fecha_asignacion < fecha_fin)

    if busqueda:
        termino = f"%{busqueda}%"

        # IDs de clientes que coinciden
        clientes_ids = (
            db.query(Venta.ID_Venta)
            .join(Usuario, Usuario.ID_Usuario == Venta.ID_Usuario)
            .filter(
                Usuario.Nombre.ilike(termino) |
                Usuario.Apellidos.ilike(termino)
            )
            .subquery()
        )

        # IDs de repartidores que coinciden (en Usuarios)
        repartidores_ids = (
            db.query(Usuario.ID_Usuario)
            .filter(
                Usuario.Nombre.ilike(termino) |
                Usuario.Apellidos.ilike(termino)
            )
            .subquery()
        )

        query = query.filter(
            Domicilio.ID_Venta.in_(clientes_ids) |
            Domicilio.ID_Empleado.in_(repartidores_ids) |
            Domicilio.Direccion_entrega.ilike(termino)
        )

    total      = query.count()
    offset     = (pagina - 1) * por_pagina
    domicilios = query.order_by(Domicilio.Fecha_asignacion.desc()).offset(offset).limit(por_pagina).all()

    if not domicilios:
        return {"total": total, "pagina": pagina, "por_pagina": por_pagina, "domicilios": []}

    venta_ids = list({d.ID_Venta for d in domicilios if d.ID_Venta})
    emp_ids   = list({d.ID_Empleado for d in domicilios if d.ID_Empleado})

    # Batch 1: ventas
    ventas_map = {v.ID_Venta: v for v in
                  db.query(Venta).filter(Venta.ID_Venta.in_(venta_ids)).all()} if venta_ids else {}

    # Batch 2: clientes (desde las ventas)
    cli_ids  = list({v.ID_Usuario for v in ventas_map.values() if v.ID_Usuario})
    todos_emp_ids = list(set(cli_ids) | set(emp_ids))
    usuarios_map = {u.ID_Usuario: u for u in
                    db.query(Usuario).filter(Usuario.ID_Usuario.in_(todos_emp_ids)).all()} if todos_emp_ids else {}

    # Batch 3: Estados
    estado_ids = list({d.Estado for d in domicilios if d.Estado})
    estados_map = {e.ID_Estados: e for e in
                   db.query(Estado).filter(Estado.ID_Estados.in_(estado_ids)).all()} if estado_ids else {}

    # Batch 4: VentaXProducto agrupado por venta
    vxp_all = db.query(VentaXProducto).filter(VentaXProducto.ID_Venta.in_(venta_ids)).all() if venta_ids else []
    vxp_by_venta: dict = {}
    prod_ids: set = set()
    for vxp in vxp_all:
        vxp_by_venta.setdefault(vxp.ID_Venta, []).append(vxp)
        if vxp.ID_Producto:
            prod_ids.add(vxp.ID_Producto)

    # Batch 5: productos e imágenes
    productos_map: dict = {}
    imagenes_map:  dict = {}
    if prod_ids:
        for p in db.query(Producto).filter(Producto.ID_Producto.in_(list(prod_ids))).all():
            productos_map[p.ID_Producto] = p
        for img in db.query(ProductoImagen).filter(ProductoImagen.ID_Producto.in_(list(prod_ids))).all():
            if img.ID_Producto not in imagenes_map:
                imagenes_map[img.ID_Producto] = img.imagen

    def _build_domicilio(dom: Domicilio) -> dict:
        venta      = ventas_map.get(dom.ID_Venta)
        cliente    = usuarios_map.get(venta.ID_Usuario) if venta else None
        repartidor = usuarios_map.get(dom.ID_Empleado)  if dom.ID_Empleado else None
        # Igual que en _formato_domicilio: se normaliza el estado leído.
        estado_canonico = normalizar_estado(
            dom.Estado, tiene_repartidor=bool(dom.ID_Empleado)
        )
        estado_obj = estados_map.get(estado_canonico)

        total_v    = float(venta.Total) if venta and venta.Total else 0.0
        metodo     = venta.Metodo_Pago or "" if venta else ""

        prods = []
        if venta:
            for item in vxp_by_venta.get(venta.ID_Venta, []):
                prod   = productos_map.get(item.ID_Producto)
                precio = float(prod.Precio_venta) if prod and prod.Precio_venta else 0.0
                prods.append({
                    "ID_Producto":     item.ID_Producto,
                    "nombre_producto": prod.nombre if prod else "",
                    "Cantidad":        item.Cantidad,
                    "precio_unitario": precio,
                    "subtotal":        precio * (item.Cantidad or 0),
                    "imagen":          imagenes_map.get(item.ID_Producto),
                })

        return {
            "ID_Domicilio":         dom.ID_Domicilio,
            "ID_Venta":             dom.ID_Venta,
            "nombre_cliente":       f"{cliente.Nombre} {cliente.Apellidos}" if cliente else None,
            "ID_Empleado":          dom.ID_Empleado,
            "nombre_repartidor":    f"{repartidor.Nombre} {repartidor.Apellidos}" if repartidor else None,
            "Fecha_asignacion":     dom.Fecha_asignacion,
            "Fecha_entrega":        dom.Fecha_entrega,
            "Observaciones":        dom.Observaciones,
            "indicaciones_cliente": cliente.Indicaciones if cliente else None,
            "Estado":               estado_canonico,
            "estado_label":         estado_obj.Estado if estado_obj else None,
            "venta_estado":         venta.Estado if venta else None,
            "Direccion_entrega":    dom.Direccion_entrega,
            "Municipio_entrega":    dom.Municipio_entrega,
            "Departamento_entrega": dom.Departamento_entrega,
            "total":                total_v,
            "metodo_pago":          metodo,
            # El listado se había quedado sin estado_pago mientras el detalle sí
            # lo devolvía: la tabla de Gestión de domicilios lo leía como
            # "sin cobrar" aunque el cobro estuviera registrado, así que no
            # dejaba marcar la entrega.
            "estado_pago":          venta.Estado_Pago if venta else None,
            "comprobante_pago":     venta.Comprobante_Pago if venta else None,
            "productos":            prods,
            "telefono_cliente":     cliente.Telefono if cliente else "",
            "otp":                  getattr(dom, "OTP", None),
        }

    return {
        "total":      total,
        "pagina":     pagina,
        "por_pagina": por_pagina,
        "domicilios": [_build_domicilio(d) for d in domicilios],
    }


def obtener_domicilio(db: Session, id_domicilio: int) -> dict:
    dom = db.query(Domicilio).filter(Domicilio.ID_Domicilio == id_domicilio).first()
    if not dom:
        raise HTTPException(status_code=404, detail="Domicilio no encontrado")
    return _formato_domicilio(dom, db)


def _avisar_asignacion(db: Session, dom: Domicilio) -> None:
    """Avisa la asignación de un domicilio a su repartidor.

    - Push en tiempo real al celular del domiciliario. Es la ÚNICA notificación
      push que recibe: no le llegan las del panel (stock, pedidos nuevos,
      devoluciones...).
    - Notificación en el panel para que quede registrada la asignación (el
      repartidor solo ve en su lista las de sus propios domicilios).

    Best-effort: si Firebase falla, la asignación igual queda hecha."""
    try:
        from src.shared.services.fcm_service import notificar_asignacion_domicilio_push
        direccion = ", ".join(
            p for p in [dom.Direccion_entrega, dom.Municipio_entrega] if p
        )
        notificar_asignacion_domicilio_push(
            id_empleado = dom.ID_Empleado,
            id_venta    = dom.ID_Venta,
            direccion   = direccion,
            db          = db,
        )

        repartidor = db.query(Usuario).filter(
            Usuario.ID_Usuario == dom.ID_Empleado
        ).first()
        nombre = f"{repartidor.Nombre} {repartidor.Apellidos}" if repartidor else "un repartidor"
        notificar(
            db, "domicilio_asignado", "Domicilio asignado",
            f"El pedido #{dom.ID_Venta} fue asignado a {nombre}",
            dom.ID_Venta, "/ventas/domicilios",
        )
        db.commit()
    except Exception as e:
        logger.error(f"FCM: no se pudo avisar la asignación del domicilio {dom.ID_Domicilio}: {e}")


def crear_domicilio(db: Session, datos: DomicilioCreate) -> dict:
    """Crea un domicilio. Si viene ID_Empleado el estado es Asignado, si no Pendiente."""
    venta = db.query(Venta).filter(Venta.ID_Venta == datos.ID_Venta).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    cliente = db.query(Usuario).filter(Usuario.ID_Usuario == venta.ID_Usuario).first()
    if not cliente or not cliente.Telefono:
        raise HTTPException(
            status_code=400,
            detail="El cliente debe tener un número de teléfono registrado para recibir domicilios"
        )

    if datos.ID_Empleado:
        if not db.query(Usuario).filter(Usuario.ID_Usuario == datos.ID_Empleado).first():
            raise HTTPException(status_code=404, detail="Repartidor no encontrado")

    # Estado inicial según si viene repartidor o no (numeración canónica)
    estado_inicial = (
        EstadoDomicilio.ASIGNADO if datos.ID_Empleado else EstadoDomicilio.PENDIENTE
    )

    nuevo = Domicilio(
        ID_Venta             = datos.ID_Venta,
        ID_Empleado          = datos.ID_Empleado,
        Fecha_asignacion     = datetime.now(),
        Fecha_entrega        = datos.Fecha_entrega,
        Observaciones        = datos.Observaciones,
        Estado               = estado_inicial,
        Direccion_entrega    = datos.Direccion_entrega,
        Municipio_entrega    = datos.Municipio_entrega,
        Departamento_entrega = datos.Departamento_entrega,
        OTP                  = _otp_nuevo(),
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    # Si nace con repartidor, avisarle al instante en su celular.
    if nuevo.ID_Empleado:
        _avisar_asignacion(db, nuevo)
    return _formato_domicilio(nuevo, db)


def editar_domicilio(db: Session, id_domicilio: int, datos: DomicilioUpdate) -> dict:
    dom = db.query(Domicilio).filter(Domicilio.ID_Domicilio == id_domicilio).first()
    if not dom:
        raise HTTPException(status_code=404, detail="Domicilio no encontrado")

    for campo, valor in datos.model_dump(exclude_none=True).items():
        setattr(dom, campo, valor)

    db.commit()
    db.refresh(dom)
    return _formato_domicilio(dom, db)


def asignar_repartidor(db: Session, id_domicilio: int, id_empleado: int) -> dict:
    """
    Asigna un repartidor al domicilio.
    Si estaba Pendiente, cambia automáticamente a Asignado.
    """
    dom = db.query(Domicilio).filter(Domicilio.ID_Domicilio == id_domicilio).first()
    if not dom:
        raise HTTPException(status_code=404, detail="Domicilio no encontrado")

    if not db.query(Usuario).filter(Usuario.ID_Usuario == id_empleado).first():
        raise HTTPException(status_code=404, detail="Repartidor no encontrado")

    cambia_repartidor = dom.ID_Empleado != id_empleado
    # Un domicilio pendiente pasa a Asignado al recibir repartidor. Si ya venía
    # en camino o entregado, la reasignación no lo hace retroceder.
    estado_previo = normalizar_estado(dom.Estado, tiene_repartidor=bool(dom.ID_Empleado))

    try:
        dom.ID_Empleado = id_empleado
        if estado_previo == EstadoDomicilio.PENDIENTE:
            dom.Estado = int(EstadoDomicilio.ASIGNADO)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error asignando repartidor a domicilio {id_domicilio}: {e}")
        raise HTTPException(status_code=500, detail="Error al asignar el repartidor")

    # Aviso al celular del repartidor solo cuando la asignación es nueva.
    if cambia_repartidor:
        _avisar_asignacion(db, dom)

    try:
        db.refresh(dom)
        return _formato_domicilio(dom, db)
    except Exception as e:
        logger.error(f"Error formateando domicilio {id_domicilio} tras asignación: {e}")
        raise HTTPException(status_code=500, detail="Error al procesar la respuesta")


def verificar_otp(db: Session, id_domicilio: int, codigo: str) -> bool:
    """Verifica el OTP contra el valor almacenado en BD. Sin expiración fija."""
    dom = db.query(Domicilio).filter(Domicilio.ID_Domicilio == id_domicilio).first()
    if not dom:
        return False
    otp_db = getattr(dom, "OTP", None)
    if not otp_db:
        return False
    return codigo.strip() == otp_db


def obtener_mensajes(db: Session, id_domicilio: int) -> list:
    """Lee el historial de chat desde BD."""
    msgs = (
        db.query(MensajeChat)
        .filter(MensajeChat.ID_Domicilio == id_domicilio)
        .order_by(MensajeChat.Fecha)
        .all()
    )
    return [
        {
            "ID_Mensaje":       m.ID_Mensaje,
            "ID_Domicilio":     m.ID_Domicilio,
            "Tipo_Remitente":   m.Tipo_Remitente,
            "ID_Remitente":     m.ID_Remitente,
            "Nombre_Remitente": m.Nombre_Remitente,
            "Contenido":        m.Contenido,
            "Fecha":            m.Fecha,
        }
        for m in msgs
    ]


def enviar_mensaje(
    db: Session,
    id_domicilio: int,
    contenido: str,
    tipo_remitente: str,
    id_remitente: int,
    nombre_remitente: str = None,
) -> dict:
    if not db.query(Domicilio).filter(Domicilio.ID_Domicilio == id_domicilio).first():
        raise HTTPException(status_code=404, detail="Domicilio no encontrado")

    nuevo = MensajeChat(
        ID_Domicilio     = id_domicilio,
        Tipo_Remitente   = tipo_remitente,
        ID_Remitente     = id_remitente,
        Nombre_Remitente = nombre_remitente,
        Contenido        = contenido.strip(),
        Fecha            = datetime.now(),
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return {
        "ID_Mensaje":       nuevo.ID_Mensaje,
        "ID_Domicilio":     nuevo.ID_Domicilio,
        "Tipo_Remitente":   nuevo.Tipo_Remitente,
        "ID_Remitente":     nuevo.ID_Remitente,
        "Nombre_Remitente": nuevo.Nombre_Remitente,
        "Contenido":        nuevo.Contenido,
        "Fecha":            nuevo.Fecha,
    }


def cambiar_estado(db: Session, id_domicilio: int, nuevo_estado: int, observaciones: str = None) -> dict:
    """Cambia el estado del domicilio y lo refleja en la venta.

    El estado que llega se normaliza a la numeración canónica de la tabla
    `Estados` (ver estados.py), de modo que web y app móvil —incluidas versiones
    viejas que aún envían su propio numerado— acaben escribiendo lo mismo.
    """
    dom = db.query(Domicilio).filter(Domicilio.ID_Domicilio == id_domicilio).first()
    if not dom:
        raise HTTPException(status_code=404, detail="Domicilio no encontrado")

    tiene_repartidor = bool(dom.ID_Empleado)
    estado_actual = normalizar_estado(dom.Estado, tiene_repartidor=tiene_repartidor)
    # Al cambiar de estado, un 3 entrante significa "En camino" solo si venía de
    # una app vieja; con la numeración canónica 3 es Pendiente. Se resuelve con
    # el mismo criterio de lectura: si ya hay repartidor, es En camino.
    nuevo_estado = normalizar_estado(nuevo_estado, tiene_repartidor=tiene_repartidor)
    validar_cambio(estado_actual, nuevo_estado)

    _ESTADOS_PAGO_ENTREGA = {
        "efectivo_recibido", "pagado_completo", "anticipo_pagado",
        "no_recibido", "pendiente_validacion",
    }

    if nuevo_estado == EstadoDomicilio.ENTREGADO and dom.ID_Venta:
        venta_check = db.query(Venta).filter(Venta.ID_Venta == dom.ID_Venta).first()
        if venta_check:
            estado_pago = (getattr(venta_check, "Estado_Pago", None) or "pendiente").strip()
            if estado_pago not in _ESTADOS_PAGO_ENTREGA:
                raise HTTPException(
                    status_code=400,
                    detail="Debes registrar el cobro antes de marcar el pedido como entregado",
                )

    if nuevo_estado == EstadoDomicilio.ENTREGADO:
        entregado_en = _now()
        dom.Fecha_entrega = entregado_en
        # Espeja el timestamp de entrega en la venta (fuente única para el plazo
        # de devoluciones, también en pedidos de recoger en tienda).
        if dom.ID_Venta:
            _venta_fe = db.query(Venta).filter(Venta.ID_Venta == dom.ID_Venta).first()
            if _venta_fe and not _venta_fe.Fecha_entrega:
                _venta_fe.Fecha_entrega = entregado_en

    # Propagar a la Venta. "Asignado" no la mueve: el pedido sigue Listo.
    if nuevo_estado in ESTADO_DOM_A_VENTA and dom.ID_Venta:
        venta = db.query(Venta).filter(Venta.ID_Venta == dom.ID_Venta).first()
        if venta:
            nuevo_estado_venta = ESTADO_DOM_A_VENTA[nuevo_estado]
            # Al entregar: descontar stock si aún no se había entregado
            if nuevo_estado_venta == 8 and venta.Estado != 8:
                items = db.query(VentaXProducto).filter(
                    VentaXProducto.ID_Venta == dom.ID_Venta
                ).all()
                for item in items:
                    producto = db.query(Producto).filter(
                        Producto.ID_Producto == item.ID_Producto
                    ).first()
                    if producto:
                        producto.Stock = max(0, (producto.Stock or 0) - (item.Cantidad or 0))
                        _actualizar_estado_producto(producto)
                        notificar_stock_producto(db, producto)
            venta.Estado = nuevo_estado_venta

    dom.Estado = nuevo_estado

    if observaciones is not None:
        dom.Observaciones = observaciones

    db.commit()
    db.refresh(dom)
    try:
        from src.shared.services.fcm_service import notificar_cambio_pedido_push
        if dom.ID_Venta:
            venta_dom = db.query(Venta).filter(Venta.ID_Venta == dom.ID_Venta).first()
            if venta_dom:
                db_estado = ESTADO_DOM_A_VENTA.get(nuevo_estado, nuevo_estado)
                notificar_cambio_pedido_push(
                    id_usuario_cliente=venta_dom.ID_Usuario,
                    id_venta=dom.ID_Venta,
                    nuevo_estado=db_estado,
                    db=db,
                )
    except Exception:
        pass
    return _formato_domicilio(dom, db)


def registrar_pago_efectivo(
    db: Session,
    id_domicilio: int,
    datos,          # RegistroPagoEfectivo
    id_usuario_actual: int,
) -> dict:
    """
    Registra el cobro en efectivo hecho por el domiciliario.
    - recibido=True: monto obligatorio, debe coincidir exactamente con el total de la venta.
    - recibido=False: motivo obligatorio (≥10 chars). Estado_Pago → 'no_recibido'.
    - Idempotencia: si ya está 'efectivo_recibido' o 'no_recibido' → 409.
    - Auditoría: línea estructurada en Domicilio.Observaciones.
    """
    dom = db.query(Domicilio).filter(Domicilio.ID_Domicilio == id_domicilio).first()
    if not dom:
        raise HTTPException(status_code=404, detail="Domicilio no encontrado")

    if not dom.ID_Venta:
        raise HTTPException(status_code=400, detail="Este domicilio no tiene venta asociada")

    venta = db.query(Venta).filter(Venta.ID_Venta == dom.ID_Venta).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta asociada no encontrada")

    _metodo = (venta.Metodo_Pago or "").strip().lower()
    if "efectivo" not in _metodo and "contra entrega" not in _metodo:
        raise HTTPException(
            status_code=400,
            detail="Este endpoint solo aplica a pedidos con método de pago Efectivo o Contra entrega",
        )

    estado_pago_actual = (getattr(venta, "Estado_Pago", None) or "pendiente").strip()
    if estado_pago_actual in ("efectivo_recibido", "no_recibido"):
        raise HTTPException(
            status_code=409,
            detail=f"El cobro ya fue registrado (estado_pago='{estado_pago_actual}')",
        )

    if datos.recibido:
        if datos.monto is None:
            raise HTTPException(status_code=422, detail="El monto es obligatorio cuando recibido=true")
        total_venta = float(venta.Total or 0)
        if round(datos.monto, 2) != round(total_venta, 2):
            raise HTTPException(
                status_code=400,
                detail=f"El monto recibido ({datos.monto}) no coincide con el total del pedido ({total_venta})",
            )
        venta.Estado_Pago = "efectivo_recibido"
        audit_value = f"monto:{datos.monto}"
    else:
        if not datos.motivo or len(datos.motivo.strip()) < 10:
            raise HTTPException(
                status_code=422,
                detail="El motivo es obligatorio y debe tener al menos 10 caracteres cuando recibido=false",
            )
        venta.Estado_Pago = "no_recibido"
        audit_value = f"motivo:{datos.motivo.strip()}"

    ts = _now().strftime("%Y-%m-%dT%H:%M:%S")
    audit_line = (
        f"[COBRO|{ts}|usuario:{id_usuario_actual}"
        f"|recibido:{str(datos.recibido).lower()}|{audit_value}]"
    )
    obs_actual = dom.Observaciones or ""
    dom.Observaciones = f"{obs_actual}\n{audit_line}".strip()

    db.commit()
    db.refresh(dom)
    return _formato_domicilio(dom, db)
