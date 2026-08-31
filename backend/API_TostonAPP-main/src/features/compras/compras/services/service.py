from sqlalchemy.orm import Session, selectinload
from fastapi import HTTPException
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func
from src.shared.services.models import (
    Compra, DetalleCompra, LoteCompra, Insumo, Proveedor, Estado
)
from src.shared.services.notificaciones_utils import notificar_stock_insumo
from .schemas import CompraCreate


ESTADO_PENDIENTE  = 3
ESTADO_COMPLETADA = 11
ESTADO_ANULADA    = 12


# ─────────────────────────────────────────
# HELPERS DE STOCK
# ─────────────────────────────────────────

def _actualizar_estado_insumo(insumo: Insumo) -> None:
    stock  = insumo.Stock_Actual or 0
    minimo = insumo.Stock_Minimo or 0
    if stock == 0:
        insumo.Estado = 15
    elif stock <= minimo:
        insumo.Estado = 14
    else:
        insumo.Estado = 1


# ─────────────────────────────────────────
# FORMATO DE RESPUESTA
# ─────────────────────────────────────────

def _formato_detalle(detalle: DetalleCompra) -> dict:
    # Usa los relationships: lazy-load en op. individual, eager en listado
    insumo = detalle.insumo
    lote   = detalle.lote_compra
    fecha_venc = lote.Fecha_Vencimiento.strftime("%Y-%m-%d") if lote and lote.Fecha_Vencimiento else None
    return {
        "ID_Detalle_Compra": detalle.ID_Detalle_Compra,
        "ID_Insumo":         detalle.ID_Insumo,
        "nombre_insumo":     insumo.Nombre if insumo else None,
        "ID_Lote_Compra":    detalle.ID_Lote_Compra,
        "Cantidad":          detalle.Cantidad,
        "Precio_Und":        detalle.Precio_Und,
        "Notas":             detalle.Notas,
        "Fecha_Vencimiento": fecha_venc,
    }


def _formato_compra(compra: Compra, db: Session, *, estados_map=None) -> dict:
    # Usa relationships: lazy-load en op. individual, eager en listado
    proveedor = compra.proveedor
    detalles  = compra.detalles

    if estados_map is not None:
        estado_label = estados_map.get(compra.Estado)
    else:
        estado_obj   = db.query(Estado).filter(Estado.ID_Estados == compra.Estado).first()
        estado_label = estado_obj.Estado if estado_obj else None

    return {
        "ID_Compra":            compra.ID_Compra,
        "ID_Proveedor":         compra.ID_Proveedor,
        "nombre_proveedor":     proveedor.Responsable if proveedor else None,
        "Total_Pago":           compra.Total_Pago,
        "Fecha_Compra":         compra.Fecha_Compra,
        "Fecha_Llegada":        getattr(compra, "Fecha_Llegada", None),
        "Estado":               compra.Estado,
        "estado_label":         estado_label,
        "Metodo_Pago":          compra.Metodo_Pago,
        "Notas":                getattr(compra, "Notas", None),
        "Costo_Transporte":     getattr(compra, "Costo_Transporte", None),
        "IVA_Porcentaje":       getattr(compra, "IVA_Porcentaje", None),
        "Descuento_Porcentaje": getattr(compra, "Descuento_Porcentaje", None),
        "Otros_Costos":         getattr(compra, "Otros_Costos", None),
        "detalles":             [_formato_detalle(d) for d in detalles],
    }


# ─────────────────────────────────────────
# CRUD
# ─────────────────────────────────────────

def obtener_compras(
    db: Session,
    pagina: int = 1,
    por_pagina: int = 10,
    busqueda: str = None,
    id_proveedor: int = None,
) -> dict:
    query = db.query(Compra)

    if id_proveedor:
        query = query.filter(Compra.ID_Proveedor == id_proveedor)

    if busqueda:
        termino        = f"%{busqueda}%"
        proveedor_ids  = (
            db.query(Proveedor.ID_Proveedor)
            .filter(Proveedor.Nombre.ilike(termino))
            .subquery()
        )
        query = query.filter(
            Compra.Metodo_Pago.ilike(termino) |
            Compra.ID_Proveedor.in_(proveedor_ids)
        )

    total   = query.count()
    offset  = (pagina - 1) * por_pagina
    compras = (
        query
        .options(
            selectinload(Compra.proveedor),
            selectinload(Compra.detalles).selectinload(DetalleCompra.insumo),
            selectinload(Compra.detalles).selectinload(DetalleCompra.lote_compra),
        )
        .order_by(Compra.Fecha_Compra.desc())
        .offset(offset)
        .limit(por_pagina)
        .all()
    )

    estados_map = {e.ID_Estados: e.Estado for e in db.query(Estado).all()}

    if not compras:
        return {"total": total, "pagina": pagina, "por_pagina": por_pagina, "compras": []}

    compra_ids   = [c.ID_Compra   for c in compras]
    prov_ids     = list({c.ID_Proveedor for c in compras if c.ID_Proveedor})
    estado_ids   = list({c.Estado       for c in compras if c.Estado})

    # Batch 1: proveedores y estados
    proveedores = {p.ID_Proveedor: p for p in
                   db.query(Proveedor).filter(Proveedor.ID_Proveedor.in_(prov_ids)).all()} if prov_ids else {}
    estados     = {e.ID_Estados: e for e in
                   db.query(Estado).filter(Estado.ID_Estados.in_(estado_ids)).all()} if estado_ids else {}

    # Batch 2: detalles agrupados por compra
    detalles_all = db.query(DetalleCompra).filter(DetalleCompra.ID_Compra.in_(compra_ids)).all()
    detalles_por_compra: dict = {}
    insumo_ids: set = set()
    lote_ids:   set = set()
    for d in detalles_all:
        detalles_por_compra.setdefault(d.ID_Compra, []).append(d)
        if d.ID_Insumo:
            insumo_ids.add(d.ID_Insumo)
        if d.ID_Lote_Compra:
            lote_ids.add(d.ID_Lote_Compra)

    # Batch 3: insumos y lotes
    insumos = {i.ID_Insumo: i for i in
               db.query(Insumo).filter(Insumo.ID_Insumo.in_(list(insumo_ids))).all()} if insumo_ids else {}
    lotes   = {l.ID_Lote_Compra: l for l in
               db.query(LoteCompra).filter(LoteCompra.ID_Lote_Compra.in_(list(lote_ids))).all()} if lote_ids else {}

    def _build_detalle(d: DetalleCompra) -> dict:
        ins  = insumos.get(d.ID_Insumo)
        lote = lotes.get(d.ID_Lote_Compra) if d.ID_Lote_Compra else None
        fv   = lote.Fecha_Vencimiento.strftime("%Y-%m-%d") if lote and lote.Fecha_Vencimiento else None
        return {
            "ID_Detalle_Compra": d.ID_Detalle_Compra,
            "ID_Insumo":         d.ID_Insumo,
            "nombre_insumo":     ins.Nombre if ins else None,
            "ID_Lote_Compra":    d.ID_Lote_Compra,
            "Cantidad":          d.Cantidad,
            "Precio_Und":        d.Precio_Und,
            "Notas":             d.Notas,
            "Fecha_Vencimiento": fv,
        }

    def _build_compra(c: Compra) -> dict:
        prov   = proveedores.get(c.ID_Proveedor)
        estado = estados.get(c.Estado)
        return {
            "ID_Compra":            c.ID_Compra,
            "ID_Proveedor":         c.ID_Proveedor,
            "nombre_proveedor":     prov.Responsable if prov else None,
            "Total_Pago":           c.Total_Pago,
            "Fecha_Compra":         c.Fecha_Compra,
            "Fecha_Llegada":        getattr(c, "Fecha_Llegada", None),
            "Estado":               c.Estado,
            "estado_label":         estado.Estado if estado else None,
            "Metodo_Pago":          c.Metodo_Pago,
            "Notas":                getattr(c, "Notas", None),
            "Costo_Transporte":     getattr(c, "Costo_Transporte", None),
            "IVA_Porcentaje":       getattr(c, "IVA_Porcentaje", None),
            "Descuento_Porcentaje": getattr(c, "Descuento_Porcentaje", None),
            "Otros_Costos":         getattr(c, "Otros_Costos", None),
            "detalles":             [_build_detalle(d) for d in detalles_por_compra.get(c.ID_Compra, [])],
        }

    return {
        "total":      total,
        "pagina":     pagina,
        "por_pagina": por_pagina,
        "compras":    [_build_compra(c) for c in compras],
    }


def obtener_compra(db: Session, id_compra: int) -> dict:
    compra = db.query(Compra).filter(Compra.ID_Compra == id_compra).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return _formato_compra(compra, db)


def crear_compra(db: Session, datos: CompraCreate) -> dict:
    """
    Registra una compra en estado Pendiente (3).
    El stock NO se aplica al crear — solo al confirmar con completar_compra().
    """
    proveedor = db.query(Proveedor).filter(
        Proveedor.ID_Proveedor == datos.ID_Proveedor
    ).first()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    subtotal = sum(
        Decimal(str(d.Precio_Und)) * d.Cantidad
        for d in datos.detalles
    )
    transporte = Decimal(str(datos.Costo_Transporte or 0))
    iva_val    = subtotal * Decimal(str(datos.IVA_Porcentaje or 0)) / 100
    desc_val   = subtotal * Decimal(str(datos.Descuento_Porcentaje or 0)) / 100
    otros      = Decimal(str(datos.Otros_Costos or 0))
    total_pago = subtotal + transporte + iva_val - desc_val + otros

    nueva_compra = Compra(
        ID_Proveedor         = datos.ID_Proveedor,
        Total_Pago           = total_pago,
        Fecha_Compra         = datos.Fecha_Compra or datetime.now(),
        Estado               = ESTADO_PENDIENTE,
        Metodo_Pago          = datos.Metodo_Pago,
        Notas                = datos.Notas,
        Costo_Transporte     = datos.Costo_Transporte,
        IVA_Porcentaje       = datos.IVA_Porcentaje,
        Descuento_Porcentaje = datos.Descuento_Porcentaje,
        Otros_Costos         = datos.Otros_Costos,
    )
    db.add(nueva_compra)
    db.flush()

    for item in datos.detalles:
        insumo = db.query(Insumo).filter(Insumo.ID_Insumo == item.ID_Insumo).first()
        if not insumo:
            db.rollback()
            raise HTTPException(
                status_code=404,
                detail=f"Insumo con ID {item.ID_Insumo} no encontrado"
            )

        lote = LoteCompra(
            ID_Insumo         = item.ID_Insumo,
            Fecha_Vencimiento = item.Fecha_Vencimiento,
            Cantidad_Inicial  = item.Cantidad,
            Cantidad_Actual   = item.Cantidad,  # FEFO: se actualiza al descontar
            Estado            = 3,  # Pendiente — se activa al confirmar llegada
        )
        db.add(lote)
        db.flush()

        detalle = DetalleCompra(
            ID_Compra      = nueva_compra.ID_Compra,
            ID_Insumo      = item.ID_Insumo,
            ID_Lote_Compra = lote.ID_Lote_Compra,
            Cantidad       = item.Cantidad,
            Precio_Und     = item.Precio_Und,
            Notas          = item.Notas,
        )
        db.add(detalle)

    db.commit()
    db.refresh(nueva_compra)
    return _formato_compra(nueva_compra, db)


def editar_compra(db: Session, id_compra: int, datos) -> dict:
    """
    Edita los campos básicos de una compra.
    - Pendiente: proveedor, método, fecha, notas, departamento, municipio.
    - Completada: solo método, notas y fecha_llegada.
    """
    compra = db.query(Compra).filter(Compra.ID_Compra == id_compra).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    if compra.Estado == ESTADO_ANULADA:
        raise HTTPException(status_code=400, detail="No se puede editar una compra anulada")

    if datos.Metodo_Pago is not None:
        compra.Metodo_Pago = datos.Metodo_Pago
    if datos.Notas is not None:
        compra.Notas = datos.Notas
    if datos.Fecha_Llegada is not None:
        compra.Fecha_Llegada = datos.Fecha_Llegada

    # Campos solo editables cuando está pendiente
    if compra.Estado == ESTADO_PENDIENTE:
        if datos.ID_Proveedor is not None:
            proveedor = db.query(Proveedor).filter(Proveedor.ID_Proveedor == datos.ID_Proveedor).first()
            if not proveedor:
                raise HTTPException(status_code=404, detail="Proveedor no encontrado")
            compra.ID_Proveedor = datos.ID_Proveedor
        if datos.Fecha_Compra is not None:
            compra.Fecha_Compra = datos.Fecha_Compra

    db.commit()
    db.refresh(compra)
    return _formato_compra(compra, db)


def completar_compra(db: Session, id_compra: int, fecha_llegada=None) -> dict:
    """
    Confirma la llegada de la compra: aplica el stock de cada insumo y pasa a Completada (4).
    Solo puede completarse desde Pendiente (3).
    """
    compra = db.query(Compra).filter(Compra.ID_Compra == id_compra).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    if compra.Estado != ESTADO_PENDIENTE:
        raise HTTPException(
            status_code=400,
            detail="Solo se puede completar una compra en estado Pendiente"
        )

    detalles = db.query(DetalleCompra).filter(DetalleCompra.ID_Compra == id_compra).all()

    # Batch: precargar insumos y lotes en 2 queries
    insumo_ids_d = [d.ID_Insumo      for d in detalles if d.ID_Insumo]
    lote_ids_d   = [d.ID_Lote_Compra for d in detalles if d.ID_Lote_Compra]
    insumos_map  = {i.ID_Insumo: i for i in db.query(Insumo).filter(Insumo.ID_Insumo.in_(insumo_ids_d)).all()} if insumo_ids_d else {}
    lotes_map    = {l.ID_Lote_Compra: l for l in db.query(LoteCompra).filter(LoteCompra.ID_Lote_Compra.in_(lote_ids_d)).all()} if lote_ids_d else {}

    for detalle in detalles:
        insumo = insumos_map.get(detalle.ID_Insumo)
        if insumo:
            insumo.Stock_Actual = (insumo.Stock_Actual or 0) + detalle.Cantidad
            insumo.ID_Lote_Compra = detalle.ID_Lote_Compra
            _actualizar_estado_insumo(insumo)
        lote = lotes_map.get(detalle.ID_Lote_Compra) if detalle.ID_Lote_Compra else None
        if lote:
            lote.Estado = 1
            if lote.Cantidad_Actual is None:
                lote.Cantidad_Actual = lote.Cantidad_Inicial

    compra.Estado = ESTADO_COMPLETADA
    if fecha_llegada:
        compra.Fecha_Llegada = fecha_llegada
    else:
        from datetime import datetime as _dt
        compra.Fecha_Llegada = _dt.now()
    db.commit()
    db.refresh(compra)

    for detalle in detalles:
        insumo = insumos_map.get(detalle.ID_Insumo)
        if insumo:
            notificar_stock_insumo(db, insumo)
    db.commit()

    return _formato_compra(compra, db)


def anular_compra(db: Session, id_compra: int) -> dict:
    """
    Anula la compra.
    - Desde Pendiente (3): marca los lotes como Anulados (12), sin afectar stock.
    - Desde Completada (11): revierte el stock de cada insumo y marca los lotes como Anulados.
    """
    compra = db.query(Compra).filter(Compra.ID_Compra == id_compra).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    if compra.Estado not in {ESTADO_PENDIENTE, ESTADO_COMPLETADA}:
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden anular compras en estado Pendiente o Completada"
        )

    detalles = db.query(DetalleCompra).filter(DetalleCompra.ID_Compra == id_compra).all()

    # Batch: precargar insumos y lotes en 2 queries
    insumo_ids_a = [d.ID_Insumo      for d in detalles if d.ID_Insumo]
    lote_ids_a   = [d.ID_Lote_Compra for d in detalles if d.ID_Lote_Compra]
    insumos_map  = {i.ID_Insumo: i for i in db.query(Insumo).filter(Insumo.ID_Insumo.in_(insumo_ids_a)).all()} if insumo_ids_a else {}
    lotes_map    = {l.ID_Lote_Compra: l for l in db.query(LoteCompra).filter(LoteCompra.ID_Lote_Compra.in_(lote_ids_a)).all()} if lote_ids_a else {}

    if compra.Estado == ESTADO_COMPLETADA:
        # Verificar que ningún insumo haya sido consumido en producción antes de revertir
        for detalle in detalles:
            insumo = insumos_map.get(detalle.ID_Insumo)
            if insumo and (insumo.Stock_Actual or 0) < detalle.Cantidad:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"No se puede anular: '{insumo.Nombre}' tiene "
                        f"{insumo.Stock_Actual or 0} unidades disponibles, pero esta compra "
                        f"ingresó {detalle.Cantidad}. Es probable que hayan sido consumidas "
                        f"en producción."
                    )
                )

        for detalle in detalles:
            insumo = insumos_map.get(detalle.ID_Insumo)
            if insumo:
                insumo.Stock_Actual = max(0, (insumo.Stock_Actual or 0) - detalle.Cantidad)
                _actualizar_estado_insumo(insumo)
            lote = lotes_map.get(detalle.ID_Lote_Compra) if detalle.ID_Lote_Compra else None
            if lote:
                lote.Estado = 12  # Anulada

        for detalle in detalles:
            insumo = insumos_map.get(detalle.ID_Insumo)
            if insumo:
                notificar_stock_insumo(db, insumo)

    elif compra.Estado == ESTADO_PENDIENTE:
        # Marcar lotes pendientes como anulados
        for detalle in detalles:
            lote = lotes_map.get(detalle.ID_Lote_Compra) if detalle.ID_Lote_Compra else None
            if lote and lote.Estado == 3:
                lote.Estado = 12  # Anulada

    compra.Estado = ESTADO_ANULADA
    db.commit()
    db.refresh(compra)
    return _formato_compra(compra, db)
