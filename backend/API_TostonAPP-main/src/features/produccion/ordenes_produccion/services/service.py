import logging
from sqlalchemy import func, case
from sqlalchemy.orm import Session, selectinload
from fastapi import HTTPException
from decimal import Decimal

logger = logging.getLogger(__name__)

from src.shared.services.models import OrdenProduccion, Producto, Insumo, FichaTecnica, FichaTecnicaInsumo, Estado, Venta, LoteProducto, LoteCompra, UnidadMedida, DetalleCompra
from src.shared.services.notificaciones_utils import notificar_stock_insumo, notificar_stock_producto
from .schemas import OrdenCreate, OrdenUpdate


# ── Conversión de unidades (para validación de stock FEFO) ───────
_CONV = {
    ("ml", "L"):         1 / 1000,
    ("L",  "ml"):        1000,
    ("g",  "kg"):        1 / 1000,
    ("kg", "g"):         1000,
    ("lb", "kg"):        0.453592,
    ("kg", "lb"):        2.20462,
    ("lb", "g"):         453.592,
    ("g",  "lb"):        1 / 453.592,
    # Medidas de cocina → ml
    ("taza",       "ml"): 240,
    ("ml", "taza"):       1 / 240,
    ("cucharada",  "ml"): 15,
    ("ml", "cucharada"):  1 / 15,
    ("cucharadita","ml"): 5,
    ("ml","cucharadita"): 1 / 5,
    # Medidas de cocina → g (aproximado para líquidos con densidad ~1)
    ("taza",       "g"):  240,
    ("g",  "taza"):       1 / 240,
    ("cucharada",  "g"):  15,
    ("g",  "cucharada"):  1 / 15,
    ("cucharadita","g"):  5,
    ("g", "cucharadita"): 1 / 5,
}

def _convertir(cantidad: float, desde: str, hasta: str) -> float:
    """Convierte cantidad entre unidades compatibles. Lanza HTTPException si son incompatibles."""
    desde = (desde or "").strip()
    hasta = (hasta or "").strip()
    if desde == hasta or not desde or not hasta:
        return cantidad
    factor = _CONV.get((desde, hasta))
    if factor is None:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede convertir de '{desde}' a '{hasta}'. Revisa las unidades en la ficha técnica."
        )
    return cantidad * factor


# ── Costo de producción con conversión a unidad base ────────────
# Convención de mercado colombiano: lb = 500 g (NO 453.592)
_FAMILIA: dict[str, str] = {
    "g": "masa", "kg": "masa", "lb": "masa",
    "ml": "volumen", "l": "volumen",
    "unidad": "conteo", "uds": "conteo", "und": "conteo", "u": "conteo", "unidades": "conteo",
}

# Factor para convertir a la unidad base de cada familia (g, ml, unidad)
_FACTOR: dict[str, Decimal] = {
    "g":        Decimal("1"),
    "kg":       Decimal("1000"),
    "lb":       Decimal("500"),
    "ml":       Decimal("1"),
    "l":        Decimal("1000"),
    "unidad":   Decimal("1"),
    "uds":      Decimal("1"),
    "und":      Decimal("1"),
    "u":        Decimal("1"),
    "unidades": Decimal("1"),
}


def _norm(simbolo: str) -> str:
    return (simbolo or "").strip().lower()


def _costo_un_insumo(
    precio: Decimal,
    unidad_insumo: str,
    cantidad_ficha: Decimal,
    unidad_ficha: str,
) -> tuple[Decimal, str | None]:
    """
    Aplica la fórmula de conversión a unidad base:
      valor_base    = precio / factor(unidad_insumo)
      cantidad_base = cantidad_ficha * factor(unidad_ficha)
      costo         = cantidad_base * valor_base

    Devuelve (costo, error). error es None cuando el cálculo es válido.
    """
    ui = _norm(unidad_insumo)
    uf = _norm(unidad_ficha)

    familia_i = _FAMILIA.get(ui)
    familia_f = _FAMILIA.get(uf)

    if not familia_i:
        return Decimal("0"), f"Unidad de compra '{unidad_insumo}' desconocida"
    if not familia_f:
        return Decimal("0"), f"Unidad en ficha '{unidad_ficha}' desconocida"
    if familia_i != familia_f:
        return Decimal("0"), (
            f"Unidades incompatibles: insumo comprado en '{unidad_insumo}' ({familia_i}) "
            f"vs ficha pide '{unidad_ficha}' ({familia_f})"
        )

    valor_base    = precio / _FACTOR[ui]
    cantidad_base = cantidad_ficha * _FACTOR[uf]
    return cantidad_base * valor_base, None


def _calcular_costo_detalle(
    db: Session,
    id_ficha: int,
    cantidad_orden: int,
    *,
    insumos_ficha=None,
    insumo_map=None,
    detalle_map=None,
    unidad_map=None,
) -> list[dict]:
    """
    Desglose de costo por insumo de la ficha.
    Cada entrada: { nombre, costo, error }
    Los kwargs opcionales aceptan datos pre-cargados (caso listado);
    cuando son None, usa db.query() exactamente como antes (caso op. individual).
    """
    if insumos_ficha is None:
        insumos_ficha = db.query(FichaTecnicaInsumo).filter(
            FichaTecnicaInsumo.ID_Ficha == id_ficha
        ).all()

    resultado = []
    for fi in insumos_ficha:
        if insumo_map is not None:
            insumo = insumo_map.get(fi.ID_Insumo)
        else:
            insumo = db.query(Insumo).filter(Insumo.ID_Insumo == fi.ID_Insumo).first()
        nombre = insumo.Nombre if insumo else f"Insumo #{fi.ID_Insumo}"

        if detalle_map is not None:
            detalle_compra = detalle_map.get(fi.ID_Insumo)
        else:
            detalle_compra = (
                db.query(DetalleCompra)
                .filter(DetalleCompra.ID_Insumo == fi.ID_Insumo)
                .order_by(DetalleCompra.ID_Detalle_Compra.desc())
                .first()
            )
        if not detalle_compra or not detalle_compra.Precio_Und:
            resultado.append({"nombre": nombre, "costo": Decimal("0"), "error": "Sin precio de compra registrado"})
            continue

        precio = Decimal(str(detalle_compra.Precio_Und))

        unidad_medida = None
        if insumo and insumo.Unidad_Medida:
            if unidad_map is not None:
                unidad_medida = unidad_map.get(fi.ID_Insumo)
            else:
                unidad_medida = db.query(UnidadMedida).filter(
                    UnidadMedida.ID_Unidad_Medida == insumo.Unidad_Medida
                ).first()
        unidad_insumo = unidad_medida.Simbolo if unidad_medida else ""

        cantidad_total = Decimal(str(fi.Cantidad or 0)) * Decimal(str(cantidad_orden))
        costo, error = _costo_un_insumo(precio, unidad_insumo, cantidad_total, fi.Unidad or "")
        resultado.append({"nombre": nombre, "costo": costo, "error": error})

    return resultado


# ── FEFO: descontar lotes del que vence primero al último ────
def _descontar_fefo(db: Session, id_insumo: int, cantidad: float) -> None:
    """Descuenta `cantidad` del insumo consumiendo los lotes en orden FEFO."""
    lotes = (
        db.query(LoteCompra)
        .filter(
            LoteCompra.ID_Insumo == id_insumo,
            LoteCompra.Cantidad_Actual > 0,
            LoteCompra.Estado == 1,
        )
        .order_by(
            case((LoteCompra.Fecha_Vencimiento.is_(None), 1), else_=0),
            LoteCompra.Fecha_Vencimiento.asc(),
        )
        .all()
    )
    restante = float(cantidad)
    for lote in lotes:
        if restante <= 0:
            break
        disponible = float(lote.Cantidad_Actual or 0)
        tomar = min(disponible, restante)
        lote.Cantidad_Actual = round(disponible - tomar, 4)
        restante -= tomar

    if restante > 0.001:  # tolerancia para errores de punto flotante
        raise HTTPException(
            status_code=409,
            detail=f"Stock en lotes insuficiente para insumo {id_insumo}: "
                   f"faltan {round(restante, 4)} unidades en los lotes activos. "
                   "Verifica el inventario.",
        )


def _restaurar_fefo(db: Session, id_insumo: int, cantidad: float) -> None:
    """Devuelve `cantidad` al insumo en orden FEFO inverso (del último al primero en vencer)."""
    lotes = (
        db.query(LoteCompra)
        .filter(
            LoteCompra.ID_Insumo == id_insumo,
            LoteCompra.Estado == 1,
        )
        .order_by(
            case((LoteCompra.Fecha_Vencimiento.is_(None), 0), else_=1),
            LoteCompra.Fecha_Vencimiento.desc(),
        )
        .all()
    )
    restante = float(cantidad)
    for lote in lotes:
        if restante <= 0:
            break
        inicial   = float(lote.Cantidad_Inicial or 0)
        actual    = float(lote.Cantidad_Actual  or 0)
        espacio   = max(0.0, inicial - actual)
        devolver  = min(espacio, restante)
        lote.Cantidad_Actual = round(actual + devolver, 4)
        restante -= devolver


ESTADO_PENDIENTE  = 1
ESTADO_EN_PROCESO = 13
ESTADO_COMPLETADA = 11
ESTADO_CANCELADA  = 5

# Estados de venta que no se deben tocar (ya terminados)
_ESTADOS_VENTA_FINALES = {5, 8, 9}  # Cancelado, Entregado, En camino

# Estado del PEDIDO cuando su producción termina: Listo para despachar
# (EstadoPedido.LISTO). Coincide con ESTADO_COMPLETADA de las órdenes, pero son
# tablas distintas: se nombra aparte para que quede claro a qué se refiere.
ESTADO_VENTA_LISTO      = 11
ESTADO_VENTA_CONFIRMADO = 4
# Solo se avanza a Listo desde estos: Confirmado (el cliente aceptó) o En
# producción. Un pedido aún Pendiente o esperando fecha no se salta ese paso.
_ESTADOS_VENTA_PRODUCIENDO = {ESTADO_VENTA_CONFIRMADO, ESTADO_EN_PROCESO}


def _sync_venta_por_ordenes(
    db: Session,
    id_venta: int,
    id_orden_actual: int,
    nuevo_estado_orden: int,
) -> None:
    """
    Mantiene el estado del pedido (Venta) coherente con sus órdenes de producción.

    Reglas:
    - Si TODAS las órdenes vinculadas están Completadas o Canceladas
      → el pedido queda Listo (11): ya está fabricado y es el estado desde el
        que se entrega en tienda o se asigna domiciliario.
    - Si hay alguna orden activa (Pendiente o En proceso)
      → el pedido pasa/permanece en En producción (13).
    - Nunca toca pedidos en estado final (Cancelado/Entregado/En camino).

    Antes, al terminar la producción el pedido volvía a Pendiente (1). Eso
    rompía el flujo de fecha propuesta: el pedido perdía el Confirmado que
    había ganado cuando el cliente aceptó la fecha y, al quedar Pendiente, el
    panel volvía a ofrecer "Proponer fecha" sobre un pedido cuya fecha el
    cliente YA había aceptado.
    """
    venta = db.query(Venta).filter(Venta.ID_Venta == id_venta).first()
    if not venta or venta.Estado in _ESTADOS_VENTA_FINALES:
        return

    otras = db.query(OrdenProduccion).filter(
        OrdenProduccion.ID_Venta == id_venta,
        OrdenProduccion.ID_Orden_Produccion != id_orden_actual,
    ).all()

    # Incluir el estado que tendrá la orden actual tras este cambio
    estados = [o.Estado for o in otras] + [nuevo_estado_orden]
    terminadas = {ESTADO_COMPLETADA, ESTADO_CANCELADA}

    todas_terminadas  = all(e in terminadas for e in estados)
    # Cancelar no es fabricar: si ninguna orden se completó, no hay producto.
    alguna_completada = any(e == ESTADO_COMPLETADA for e in estados)

    if todas_terminadas:
        # Solo se mueve si el pedido ya venía confirmado o en producción: si
        # alguien creó una orden suelta sobre un pedido que aún esperaba
        # confirmación o fecha del cliente, no se salta ese paso.
        if venta.Estado in _ESTADOS_VENTA_PRODUCIENDO:
            # Se fabricó algo → Listo para despachar.
            # Todas canceladas → no se fabricó nada: vuelve a Confirmado para
            # que el admin decida (reprogramar producción, surtir de stock o
            # cancelar). Marcarlo Listo diría que hay producto cuando no lo hay.
            venta.Estado = (
                ESTADO_VENTA_LISTO if alguna_completada else ESTADO_VENTA_CONFIRMADO
            )
    elif venta.Estado not in {ESTADO_EN_PROCESO}:
        # Hay órdenes activas y el pedido aún no refleja "En producción"
        venta.Estado = ESTADO_EN_PROCESO


def _actualizar_estado_insumo(insumo: Insumo) -> None:
    stock  = insumo.Stock_Actual or 0
    minimo = insumo.Stock_Minimo or 0
    if stock == 0:
        insumo.Estado = 15
    elif stock <= minimo:
        insumo.Estado = 14
    else:
        insumo.Estado = 1


def _actualizar_estado_producto(producto: Producto) -> None:
    stock  = producto.Stock or 0
    minimo = getattr(producto, "Stock_Minimo", 0) or 0
    if stock == 0:
        producto.Estado = 15
    elif stock <= minimo:
        producto.Estado = 14
    else:
        producto.Estado = 1


def _label_estado(db: Session, id_estado: int) -> str:
    """Obtiene el nombre del estado desde la tabla Estados."""
    estado = db.query(Estado).filter(Estado.ID_Estados == id_estado).first()
    return estado.Estado if estado else None


def _precio_ultimo_lote(db: Session, id_insumo: int) -> Decimal:
    """Precio unitario del insumo en su compra más reciente."""
    detalle = (
        db.query(DetalleCompra)
        .filter(DetalleCompra.ID_Insumo == id_insumo)
        .order_by(DetalleCompra.ID_Detalle_Compra.desc())
        .first()
    )
    return Decimal(str(detalle.Precio_Und)) if (detalle and detalle.Precio_Und) else Decimal("0")


def _calcular_costo(db: Session, id_ficha, id_insumo, cantidad: int) -> Decimal:
    """
    Costo total: suma los costos válidos del desglose (ignora los que tienen error).
    Sin ficha, usa precio del último lote × cantidad (insumo directo).
    """
    if id_ficha:
        desglose = _calcular_costo_detalle(db, id_ficha, cantidad)
        return sum((d["costo"] for d in desglose if d["error"] is None), Decimal("0"))

    if id_insumo:
        return _precio_ultimo_lote(db, id_insumo) * Decimal(str(cantidad))

    return Decimal("0")


def _formato_orden(
    orden: OrdenProduccion,
    db: Session,
    *,
    estados_map=None,
    detalle_compra_map=None,
) -> dict:
    """Construye el dict de respuesta con nombres legibles.

    estados_map y detalle_compra_map son opcionales: cuando se pasan (desde
    obtener_ordenes) se usan datos pre-cargados en memoria sin queries adicionales.
    Cuando son None (cambiar_estado, crear_orden, editar_orden, obtener_orden)
    el comportamiento es IDÉNTICO al original: lazy-load de relationships + db.query().
    """
    # Relationship attributes: lazy-load en op. individuales, eager-load en listado
    producto = orden.producto
    insumo   = orden.insumo
    ficha    = orden.ficha if orden.ID_Ficha else None
    lote     = orden.lote

    # Estado label
    if estados_map is not None:
        estado_label = estados_map.get(orden.Estado) if orden.Estado else None
    else:
        estado_label = _label_estado(db, orden.Estado) if orden.Estado else None

    # Cálculo de costo
    if orden.ID_Ficha:
        if detalle_compra_map is not None and ficha:
            insumos_ficha_lista = ficha.insumos_ficha
            insumo_map_local = {fi.ID_Insumo: fi.insumo for fi in insumos_ficha_lista}
            unidad_map_local = {
                fi.ID_Insumo: fi.insumo.unidad_medida
                for fi in insumos_ficha_lista
                if fi.insumo and fi.insumo.Unidad_Medida
            }
            desglose = _calcular_costo_detalle(
                db, orden.ID_Ficha, orden.Cantidad,
                insumos_ficha=insumos_ficha_lista,
                insumo_map=insumo_map_local,
                detalle_map=detalle_compra_map,
                unidad_map=unidad_map_local,
            )
        else:
            desglose = _calcular_costo_detalle(db, orden.ID_Ficha, orden.Cantidad)

        costo_calculado = sum((d["costo"] for d in desglose if d["error"] is None), Decimal("0"))
        costo_detalle = [
            {"nombre": d["nombre"], "costo": float(d["costo"]), "error": d["error"]}
            for d in desglose
        ]
    else:
        costo_calculado = _calcular_costo(db, None, orden.ID_Insumo, orden.Cantidad)
        costo_detalle = []

    costo = costo_calculado if costo_calculado > 0 else (orden.Costo or Decimal("0"))

    return {
        "ID_Orden_Produccion": orden.ID_Orden_Produccion,
        "ID_Venta":            orden.ID_Venta,
        "ID_Producto":         orden.ID_Producto,
        "nombre_producto":     producto.nombre if producto else None,
        "ID_Insumo":           orden.ID_Insumo,
        "nombre_insumo":       insumo.Nombre if insumo else None,
        "stock_insumo":        insumo.Stock_Actual if insumo else None,
        "ID_Ficha":            orden.ID_Ficha,
        "version_ficha":       ficha.Version if ficha else None,
        "Cantidad":            orden.Cantidad,
        "Fecha_inicio":        orden.Fecha_inicio,
        "Fecha_Entrega":       orden.Fecha_Entrega,
        "Fecha_fin":           orden.Fecha_fin,
        "Estado":              orden.Estado,
        "estado_label":        estado_label,
        "Costo":               float(costo),
        "costo_detalle":       costo_detalle,
        "lote": {
            "ID_Lote_Producto":  lote.ID_Lote_Producto,
            "Numero_Lote":       lote.Numero_Lote,
            "Fecha_Produccion":  lote.Fecha_Produccion,
            "Fecha_Vencimiento": lote.Fecha_Vencimiento,
            "Cantidad":          lote.Cantidad,
        } if lote else None,
    }


def obtener_ordenes(
    db: Session,
    pagina: int = 1,
    por_pagina: int = 10,
    busqueda: str = None
) -> dict:
    """Lista paginada con queries en lote. Evita N+1."""
    query = db.query(OrdenProduccion)

    if busqueda:
        termino = f"%{busqueda}%"
        productos_ids = (
            db.query(Producto.ID_Producto)
            .filter(Producto.nombre.ilike(termino))
            .subquery()
        )
        query = query.filter(OrdenProduccion.ID_Producto.in_(productos_ids))

    total  = query.count()
    offset = (pagina - 1) * por_pagina
    ordenes = (
        query
        .options(
            selectinload(OrdenProduccion.producto),
            selectinload(OrdenProduccion.insumo),
            selectinload(OrdenProduccion.ficha)
                .selectinload(FichaTecnica.insumos_ficha)
                .selectinload(FichaTecnicaInsumo.insumo)
                .selectinload(Insumo.unidad_medida),
            selectinload(OrdenProduccion.lote),
        )
        .offset(offset)
        .limit(por_pagina)
        .all()
    )

    # Pre-batch: todos los estados en una sola query (label → string)
    estados_map = {e.ID_Estados: e.Estado for e in db.query(Estado).all()}

    # Pre-batch: DetalleCompra más reciente por insumo (para cálculo de costo)
    all_insumo_ids = set()
    for o in ordenes:
        if o.ficha:
            for fi in o.ficha.insumos_ficha:
                all_insumo_ids.add(fi.ID_Insumo)

    detalle_compra_map = {}
    if all_insumo_ids:
        subq = (
            db.query(
                DetalleCompra.ID_Insumo,
                func.max(DetalleCompra.ID_Detalle_Compra).label("max_id"),
            )
            .filter(DetalleCompra.ID_Insumo.in_(all_insumo_ids))
            .group_by(DetalleCompra.ID_Insumo)
            .subquery()
        )
        detalles = (
            db.query(DetalleCompra)
            .join(subq, DetalleCompra.ID_Detalle_Compra == subq.c.max_id)
            .all()
        )
        detalle_compra_map = {d.ID_Insumo: d for d in detalles}

    if not ordenes:
        return {"total": total, "pagina": pagina, "por_pagina": por_pagina, "ordenes": []}

    orden_ids   = [o.ID_Orden_Produccion for o in ordenes]
    prod_ids    = list({o.ID_Producto for o in ordenes if o.ID_Producto})
    insumo_ids  = list({o.ID_Insumo   for o in ordenes if o.ID_Insumo})
    ficha_ids   = list({o.ID_Ficha    for o in ordenes if o.ID_Ficha})
    estado_ids  = list({o.Estado      for o in ordenes if o.Estado})

    # Batch 1: productos, insumos, fichas, estados, lotes
    productos_map = {p.ID_Producto: p for p in
                     db.query(Producto).filter(Producto.ID_Producto.in_(prod_ids)).all()} if prod_ids else {}
    insumos_map   = {i.ID_Insumo: i for i in
                     db.query(Insumo).filter(Insumo.ID_Insumo.in_(insumo_ids)).all()} if insumo_ids else {}
    fichas_map    = {f.ID_Ficha: f for f in
                     db.query(FichaTecnica).filter(FichaTecnica.ID_Ficha.in_(ficha_ids)).all()} if ficha_ids else {}
    _estados_obj_map   = {e.ID_Estados: e for e in
                          db.query(Estado).filter(Estado.ID_Estados.in_(estado_ids)).all()} if estado_ids else {}
    lotes_map     = {l.ID_Orden_Produccion: l for l in
                     db.query(LoteProducto)
                       .filter(LoteProducto.ID_Orden_Produccion.in_(orden_ids)).all()}

    def _build(orden: OrdenProduccion) -> dict:
        producto = productos_map.get(orden.ID_Producto)
        insumo   = insumos_map.get(orden.ID_Insumo)
        ficha    = fichas_map.get(orden.ID_Ficha) if orden.ID_Ficha else None
        lote     = lotes_map.get(orden.ID_Orden_Produccion)
        estado   = _estados_obj_map.get(orden.Estado)

        if orden.ID_Ficha and ficha:
            desglose        = _calcular_costo_detalle(db, ficha.ID_Ficha, orden.Cantidad)
            costo_calculado = sum((d["costo"] for d in desglose if d["error"] is None), Decimal("0"))
            costo_detalle   = [{"nombre": d["nombre"], "costo": float(d["costo"]), "error": d["error"]} for d in desglose]
        else:
            costo_calculado = _calcular_costo(db, None, orden.ID_Insumo, orden.Cantidad)
            costo_detalle   = []

        costo = costo_calculado if costo_calculado > 0 else (orden.Costo or Decimal("0"))

        return {
            "ID_Orden_Produccion": orden.ID_Orden_Produccion,
            "ID_Venta":            orden.ID_Venta,
            "ID_Producto":         orden.ID_Producto,
            "nombre_producto":     producto.nombre if producto else None,
            "ID_Insumo":           orden.ID_Insumo,
            "nombre_insumo":       insumo.Nombre   if insumo   else None,
            "stock_insumo":        insumo.Stock_Actual if insumo else None,
            "ID_Ficha":            orden.ID_Ficha,
            "version_ficha":       ficha.Version   if ficha    else None,
            "Cantidad":            orden.Cantidad,
            "Fecha_inicio":        orden.Fecha_inicio,
            "Fecha_Entrega":       orden.Fecha_Entrega,
            "Fecha_fin":           orden.Fecha_fin,
            "Estado":              orden.Estado,
            "estado_label":        estado.Estado   if estado   else None,
            "Costo":               float(costo),
            "costo_detalle":       costo_detalle,
            "lote": {
                "ID_Lote_Producto":  lote.ID_Lote_Producto,
                "Numero_Lote":       lote.Numero_Lote,
                "Fecha_Produccion":  lote.Fecha_Produccion,
                "Fecha_Vencimiento": lote.Fecha_Vencimiento,
                "Cantidad":          lote.Cantidad,
            } if lote else None,
        }

    return {
        "total":      total,
        "pagina":     pagina,
        "por_pagina": por_pagina,
        "ordenes":    [
            _formato_orden(o, db, estados_map=estados_map, detalle_compra_map=detalle_compra_map)
            for o in ordenes
        ],
    }


def obtener_orden(db: Session, id_orden: int) -> dict:
    """Retorna una orden por ID o lanza 404."""
    orden = db.query(OrdenProduccion).filter(
        OrdenProduccion.ID_Orden_Produccion == id_orden
    ).first()
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return _formato_orden(orden, db)


def crear_orden(db: Session, datos: OrdenCreate) -> dict:
    """Crea la orden y calcula el costo automáticamente."""

    # Verifica que el producto existe
    if not db.query(Producto).filter(Producto.ID_Producto == datos.ID_Producto).first():
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    # Verifica insumo solo si viene explícito
    if datos.ID_Insumo and not db.query(Insumo).filter(Insumo.ID_Insumo == datos.ID_Insumo).first():
        raise HTTPException(status_code=404, detail="Insumo no encontrado")

    costo = _calcular_costo(db, datos.ID_Ficha, datos.ID_Insumo, datos.Cantidad)

    nueva = OrdenProduccion(
        ID_Producto   = datos.ID_Producto,
        ID_Insumo     = datos.ID_Insumo,
        ID_Ficha      = datos.ID_Ficha,
        Cantidad      = datos.Cantidad,
        Fecha_inicio  = datos.Fecha_inicio,
        Fecha_Entrega = datos.Fecha_Entrega,
        Estado        = ESTADO_PENDIENTE,
        Costo         = costo,
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return _formato_orden(nueva, db)


def editar_orden(db: Session, id_orden: int, datos: OrdenUpdate) -> dict:
    """Edita la orden y recalcula el costo si cambia cantidad o insumo."""
    orden = db.query(OrdenProduccion).filter(
        OrdenProduccion.ID_Orden_Produccion == id_orden
    ).first()
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    if datos.Fecha_inicio is not None and orden.Fecha_inicio is not None:
        if datos.Fecha_inicio.date() < orden.Fecha_inicio.date():
            raise HTTPException(
                status_code=400,
                detail="La fecha de inicio no puede ser anterior a la fecha de inicio original de la orden"
            )

    for campo, valor in datos.model_dump(exclude_none=True).items():
        setattr(orden, campo, valor)

    # Recalcula costo si cambió cantidad, insumo o ficha
    if datos.Cantidad or datos.ID_Insumo or datos.ID_Ficha:
        orden.Costo = _calcular_costo(db, orden.ID_Ficha, orden.ID_Insumo, orden.Cantidad)

    db.commit()
    db.refresh(orden)
    return _formato_orden(orden, db)


def cambiar_estado(db: Session, id_orden: int, datos) -> dict:
    """datos puede ser int o un objeto con atributos: Estado, Numero_Lote, Fecha_Vencimiento"""
    import time
    _t0 = time.time()
    # compat: si pasaron solo un int
    if isinstance(datos, int):
        nuevo_estado = datos
        lote_info = {}
    else:
        nuevo_estado = datos.Estado
        lote_info = { 'Numero_Lote': getattr(datos, 'Numero_Lote', None), 'Fecha_Vencimiento': getattr(datos, 'Fecha_Vencimiento', None) }
    logger.debug(f"[1] cambiar_estado START id={id_orden} nuevo_estado={nuevo_estado}")
    try:
        logger.debug(f"[2] query OrdenProduccion | +{time.time()-_t0:.3f}s")
        orden = db.query(OrdenProduccion).filter(
            OrdenProduccion.ID_Orden_Produccion == id_orden
        ).with_for_update().first()
        logger.debug(f"[3] orden found={orden is not None} estado_actual={getattr(orden,'Estado',None)} | +{time.time()-_t0:.3f}s")
        if not orden:
            raise HTTPException(status_code=404, detail="Orden no encontrada")

        if orden.Estado == nuevo_estado:
            return _formato_orden(orden, db)

        # Mapa de transiciones válidas — cualquier otra combinación es un error
        _TRANSICIONES_VALIDAS = {
            ESTADO_PENDIENTE:  {ESTADO_EN_PROCESO, ESTADO_CANCELADA},
            ESTADO_EN_PROCESO: {ESTADO_COMPLETADA, ESTADO_CANCELADA},
            ESTADO_COMPLETADA: set(),
            ESTADO_CANCELADA:  set(),
        }
        if nuevo_estado not in _TRANSICIONES_VALIDAS.get(orden.Estado, set()):
            raise HTTPException(
                status_code=400,
                detail=f"Transición no permitida: estado actual {orden.Estado} → {nuevo_estado}",
            )

        # Al iniciar (13=En proceso): validar ficha, descontar todos los insumos de la receta
        if nuevo_estado == ESTADO_EN_PROCESO and orden.Estado == ESTADO_PENDIENTE:
            # Si la orden se creó sin ficha (p.ej. auto-generada), resolver la ficha actual del producto
            if not orden.ID_Ficha and orden.ID_Producto:
                ficha_auto = (
                    db.query(FichaTecnica)
                    .filter(FichaTecnica.ID_Producto == orden.ID_Producto)
                    .order_by(FichaTecnica.ID_Ficha.desc())
                    .first()
                )
                if ficha_auto:
                    orden.ID_Ficha = ficha_auto.ID_Ficha

            if not orden.ID_Ficha:
                raise HTTPException(
                    status_code=400,
                    detail="El producto debe tener una ficha técnica asignada antes de iniciar la producción"
                )
            logger.debug(f"[4] query FichaTecnicaInsumo id_ficha={orden.ID_Ficha} | +{time.time()-_t0:.3f}s")
            insumos_ficha = db.query(FichaTecnicaInsumo).filter(
                FichaTecnicaInsumo.ID_Ficha == orden.ID_Ficha
            ).all()
            logger.debug(f"[5] insumos_ficha count={len(insumos_ficha)} | +{time.time()-_t0:.3f}s")
            if not insumos_ficha:
                raise HTTPException(
                    status_code=400,
                    detail="La ficha técnica no tiene insumos registrados. Agrégalos antes de iniciar producción."
                )
            # Batch-load: 2 queries en lugar de 4N (N insumos × 2 loops × 2 tablas)
            ids_insumo = [fi.ID_Insumo for fi in insumos_ficha]
            logger.debug(f"[6] batch query Insumo IN {ids_insumo} | +{time.time()-_t0:.3f}s")
            insumos_map = {
                i.ID_Insumo: i
                for i in db.query(Insumo).filter(Insumo.ID_Insumo.in_(ids_insumo)).all()
            }
            unidad_ids = {i.Unidad_Medida for i in insumos_map.values() if i.Unidad_Medida}
            logger.debug(f"[7] batch query UnidadMedida IN {unidad_ids} | +{time.time()-_t0:.3f}s")
            unidades_map = (
                {
                    u.ID_Unidad_Medida: u
                    for u in db.query(UnidadMedida).filter(
                        UnidadMedida.ID_Unidad_Medida.in_(unidad_ids)
                    ).all()
                }
                if unidad_ids else {}
            )
            logger.debug(f"[8] batch done, validando stock | +{time.time()-_t0:.3f}s")

            # Validar stock (en memoria, sin queries adicionales a BD)
            ficha_plan = []
            for fi in insumos_ficha:
                insumo = insumos_map.get(fi.ID_Insumo)
                if not insumo:
                    raise HTTPException(status_code=404, detail=f"Insumo ID {fi.ID_Insumo} no encontrado")
                unidad_ins = unidades_map.get(insumo.Unidad_Medida)
                simbolo_ins = unidad_ins.Simbolo if unidad_ins else None
                necesario = _convertir(
                    float(fi.Cantidad or 0) * orden.Cantidad,
                    fi.Unidad or simbolo_ins,
                    simbolo_ins,
                )
                if float(insumo.Stock_Actual or 0) < necesario:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Stock insuficiente de '{insumo.Nombre}': necesario {necesario:.4g} {simbolo_ins}, disponible {float(insumo.Stock_Actual or 0):.4g} {simbolo_ins}"
                    )
                ficha_plan.append((insumo, necesario))

            logger.debug(f"[9] validacion OK {len(ficha_plan)} insumos, iniciando FEFO | +{time.time()-_t0:.3f}s")
            # Descontar FEFO (todos los stocks validados → descuento atómico)
            for _i, (insumo, necesario) in enumerate(ficha_plan):
                logger.debug(f"[10a] _descontar_fefo insumo={insumo.ID_Insumo} necesario={necesario} | +{time.time()-_t0:.3f}s")
                _descontar_fefo(db, insumo.ID_Insumo, necesario)
                insumo.Stock_Actual = round(max(0.0, float(insumo.Stock_Actual or 0) - necesario), 4)
                _actualizar_estado_insumo(insumo)
                logger.debug(f"[10b] notificar_stock_insumo insumo={insumo.ID_Insumo} | +{time.time()-_t0:.3f}s")
                notificar_stock_insumo(db, insumo)
                logger.debug(f"[10c] insumo {_i+1}/{len(ficha_plan)} completo | +{time.time()-_t0:.3f}s")

            logger.debug(f"[11] FEFO done, ID_Venta={orden.ID_Venta} | +{time.time()-_t0:.3f}s")
            if orden.ID_Venta:
                logger.debug(f"[11a] _sync_venta START | +{time.time()-_t0:.3f}s")
                _sync_venta_por_ordenes(db, orden.ID_Venta, orden.ID_Orden_Produccion, ESTADO_EN_PROCESO)
                logger.debug(f"[11b] _sync_venta END | +{time.time()-_t0:.3f}s")

        # Al completar (11=Completada): incrementar stock del producto y crear lote
        elif nuevo_estado == ESTADO_COMPLETADA and orden.Estado == ESTADO_EN_PROCESO:
            from datetime import datetime, timedelta, timezone
            from dateutil.relativedelta import relativedelta

            producto = db.query(Producto).filter(Producto.ID_Producto == orden.ID_Producto).first()
            if not producto:
                raise HTTPException(status_code=404, detail="Producto no encontrado")
            producto.Stock = (producto.Stock or 0) + orden.Cantidad
            _actualizar_estado_producto(producto)
            notificar_stock_producto(db, producto)

            # Crear lote de producto
            _TZ_LOCAL = timezone(timedelta(hours=-5))
            hoy = datetime.now(_TZ_LOCAL).replace(tzinfo=None)
            orden.Fecha_fin = hoy

            ficha = db.query(FichaTecnica).filter(
                FichaTecnica.ID_Ficha == orden.ID_Ficha
            ).first() if orden.ID_Ficha else None

            cantidad_vida = ficha.Dias_Vida_Util       if ficha and ficha.Dias_Vida_Util else None
            unidad_vida   = (ficha.Vida_Util_Unidad or 'dias') if ficha else 'dias'
            if cantidad_vida:
                if unidad_vida == 'meses':
                    fecha_vencimiento = hoy + relativedelta(months=cantidad_vida)
                elif unidad_vida == 'semanas':
                    fecha_vencimiento = hoy + timedelta(weeks=cantidad_vida)
                else:
                    fecha_vencimiento = hoy + timedelta(days=cantidad_vida)
            else:
                fecha_vencimiento = None

            numero_lote = lote_info.get('Numero_Lote') or f"LP-{orden.ID_Orden_Produccion}-{hoy.strftime('%Y%m%d')}"
            fecha_venc = lote_info.get('Fecha_Vencimiento') or fecha_vencimiento

            db.add(LoteProducto(
                ID_Orden_Produccion = orden.ID_Orden_Produccion,
                ID_Producto         = orden.ID_Producto,
                Numero_Lote         = numero_lote,
                Fecha_Produccion    = hoy,
                Fecha_Vencimiento   = fecha_venc,
                Cantidad            = orden.Cantidad,
                Estado              = 1,
            ))

            if orden.ID_Venta:
                _sync_venta_por_ordenes(db, orden.ID_Venta, orden.ID_Orden_Produccion, ESTADO_COMPLETADA)

        # Al cancelar (5): restaurar insumos si la orden estaba en proceso
        elif nuevo_estado == ESTADO_CANCELADA and orden.Estado == ESTADO_EN_PROCESO:
            if orden.ID_Ficha:
                insumos_ficha = db.query(FichaTecnicaInsumo).filter(
                    FichaTecnicaInsumo.ID_Ficha == orden.ID_Ficha
                ).all()
                # Batch: precargar insumos y unidades en 2 queries
                fi_insumo_ids = [fi.ID_Insumo for fi in insumos_ficha if fi.ID_Insumo]
                fi_insumos_map = {i.ID_Insumo: i for i in db.query(Insumo).filter(Insumo.ID_Insumo.in_(fi_insumo_ids)).all()} if fi_insumo_ids else {}
                unidad_ids_fi  = list({i.Unidad_Medida for i in fi_insumos_map.values() if i.Unidad_Medida})
                unidades_fi    = {u.ID_Unidad_Medida: u for u in db.query(UnidadMedida).filter(UnidadMedida.ID_Unidad_Medida.in_(unidad_ids_fi)).all()} if unidad_ids_fi else {}
                for fi in insumos_ficha:
                    insumo = fi_insumos_map.get(fi.ID_Insumo)
                    if insumo:
                        unidad_ins  = unidades_fi.get(insumo.Unidad_Medida)
                        simbolo_ins = unidad_ins.Simbolo if unidad_ins else None
                        devolver = _convertir(
                            float(fi.Cantidad or 0) * orden.Cantidad,
                            fi.Unidad or simbolo_ins,
                            simbolo_ins,
                        )
                        _restaurar_fefo(db, insumo.ID_Insumo, devolver)
                        insumo.Stock_Actual = round(float(insumo.Stock_Actual or 0) + devolver, 4)
                        _actualizar_estado_insumo(insumo)
                        notificar_stock_insumo(db, insumo)
            elif orden.ID_Insumo:
                insumo = db.query(Insumo).filter(Insumo.ID_Insumo == orden.ID_Insumo).first()
                if insumo:
                    devolver = float(orden.Cantidad)
                    _restaurar_fefo(db, insumo.ID_Insumo, devolver)
                    insumo.Stock_Actual = round(float(insumo.Stock_Actual or 0) + devolver, 4)
                    _actualizar_estado_insumo(insumo)
                    notificar_stock_insumo(db, insumo)

            if orden.ID_Venta:
                _sync_venta_por_ordenes(db, orden.ID_Venta, orden.ID_Orden_Produccion, ESTADO_CANCELADA)

        logger.debug(f"[12] SET estado={nuevo_estado}, COMMIT | +{time.time()-_t0:.3f}s")
        orden.Estado = nuevo_estado
        db.commit()
        logger.debug(f"[13] COMMIT done | +{time.time()-_t0:.3f}s")
        db.refresh(orden)
        logger.debug(f"[14] _formato_orden START | +{time.time()-_t0:.3f}s")
        result = _formato_orden(orden, db)
        logger.debug(f"[15] _formato_orden DONE, total={time.time()-_t0:.3f}s")
        return result

    except Exception as e:
        logger.exception("Error en cambiar_estado id=%s nuevo_estado=%s (+%.3fs)", id_orden, nuevo_estado, time.time()-_t0)
        raise


def eliminar_orden(db: Session, id_orden: int) -> dict:
    """Elimina una orden de producción."""
    orden = db.query(OrdenProduccion).filter(
        OrdenProduccion.ID_Orden_Produccion == id_orden
    ).first()
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    if orden.Estado in (ESTADO_EN_PROCESO, ESTADO_COMPLETADA):
        etiqueta = "en proceso" if orden.Estado == ESTADO_EN_PROCESO else "completada"
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar una orden {etiqueta}. Cancélala primero.",
        )

    db.delete(orden)
    db.commit()
    return {"mensaje": f"Orden {id_orden} eliminada correctamente"}