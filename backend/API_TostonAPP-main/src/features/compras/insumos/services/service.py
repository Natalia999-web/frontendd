from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime
from src.shared.services.models import Insumo, CategoriaInsumo, UnidadMedida, LoteCompra, FichaTecnicaInsumo, OrdenProduccion, DetalleCompra
from .schemas import InsumoCreate, InsumoUpdate


def _formato_insumo(
    insumo: Insumo,
    db: Session,
    *,
    detalle_map=None,
    ficha_set=None,
    orden_set=None,
) -> dict:
    """Construye el dict de respuesta con categoria, unidad y lote.

    Los kwargs opcionales aceptan datos pre-cargados en el caso de listado;
    cuando son None usa db.query() igual que antes (op. individual sin cambio).
    """
    # categoria y unidad_medida: lazy-load en op. individuales, eager en listado
    categoria = insumo.categoria
    unidad    = insumo.unidad_medida

    hoy = datetime.utcnow()

    # proximo_lote: usa el relationship ya cargado en listado, db.query en individual
    if detalle_map is not None:
        proximo_lote = insumo.lotes_compra[0] if insumo.lotes_compra else None
    else:
        proximo_lote = (
            db.query(LoteCompra)
            .filter(
                LoteCompra.ID_Insumo == insumo.ID_Insumo,
                LoteCompra.Estado == 1,
                LoteCompra.Cantidad_Actual > 0,
            )
            .order_by(LoteCompra.Fecha_Vencimiento.asc())
            .first()
        )

    proximo_venc = None
    dias_para_vencer = None
    if proximo_lote and proximo_lote.Fecha_Vencimiento:
        proximo_venc = proximo_lote.Fecha_Vencimiento.strftime("%Y-%m-%d")
        dias_para_vencer = (proximo_lote.Fecha_Vencimiento - hoy).days

    if detalle_map is not None:
        ultimo_detalle = detalle_map.get(insumo.ID_Insumo)
    else:
        ultimo_detalle = (
            db.query(DetalleCompra)
            .filter(DetalleCompra.ID_Insumo == insumo.ID_Insumo)
            .order_by(DetalleCompra.ID_Detalle_Compra.desc())
            .first()
        )
    precio_unitario = float(ultimo_detalle.Precio_Und) if ultimo_detalle and ultimo_detalle.Precio_Und else 0.0

    if ficha_set is not None:
        en_ficha = insumo.ID_Insumo in ficha_set
    else:
        en_ficha = db.query(FichaTecnicaInsumo).filter(
            FichaTecnicaInsumo.ID_Insumo == insumo.ID_Insumo
        ).first() is not None

    if orden_set is not None:
        en_orden = insumo.ID_Insumo in orden_set
    else:
        fichas_con_insumo = (
            db.query(FichaTecnicaInsumo.ID_Ficha)
            .filter(FichaTecnicaInsumo.ID_Insumo == insumo.ID_Insumo)
            .subquery()
        )
        en_orden = db.query(OrdenProduccion).filter(
            or_(
                OrdenProduccion.ID_Insumo == insumo.ID_Insumo,
                OrdenProduccion.ID_Ficha.in_(fichas_con_insumo),
            ),
            OrdenProduccion.Estado.in_([1, 13]),
        ).first() is not None

    en_compra = db.query(DetalleCompra).filter(
        DetalleCompra.ID_Insumo == insumo.ID_Insumo
    ).first() is not None

    return {
        "ID_Insumo":                insumo.ID_Insumo,
        "Nombre":                   insumo.Nombre,
        "ID_Categoria":             insumo.ID_Categoria,
        "nombre_categoria":         categoria.Nombre_Categoria if categoria else None,
        "Unidad_Medida":            insumo.Unidad_Medida,
        "simbolo_unidad":           unidad.Simbolo if unidad else None,
        "Stock_Actual":             float(insumo.Stock_Actual or 0),
        "Stock_Minimo":             insumo.Stock_Minimo,
        "Estado":                   insumo.Estado,
        "proximo_vencimiento":      proximo_venc,
        "dias_para_vencer":         dias_para_vencer,
        "lote_id":                  proximo_lote.ID_Lote_Compra if proximo_lote else None,
        "precio_unitario":          precio_unitario,
        "tiene_ficha_tecnica":      en_ficha,
        "tiene_orden_produccion":   en_orden,
        "tiene_compra":             en_compra,
    }


def _calcular_resumen(db: Session) -> dict:
    """Calcula las 4 tarjetas de resumen."""
    total      = db.query(func.count(Insumo.ID_Insumo)).scalar() or 0
    agotados   = db.query(func.count(Insumo.ID_Insumo)).filter(
        Insumo.Stock_Actual == 0
    ).scalar() or 0
    stock_bajo = db.query(func.count(Insumo.ID_Insumo)).filter(
        Insumo.Stock_Actual > 0,
        Insumo.Stock_Actual <= Insumo.Stock_Minimo
    ).scalar() or 0
    return {
        "total":       total,
        "disponibles": total - agotados - stock_bajo,
        "stock_bajo":  stock_bajo,
        "agotados":    agotados,
    }


def obtener_insumos(
    db: Session,
    pagina: int = 1,
    por_pagina: int = 10,
    busqueda: str = None
) -> dict:
    """Lista paginada con resumen. Usa queries en lote para evitar N+1."""
    query = db.query(Insumo)

    if busqueda:
        termino = f"%{busqueda}%"
        query = query.join(
            CategoriaInsumo,
            CategoriaInsumo.ID_Categoria == Insumo.ID_Categoria,
            isouter=True
        ).filter(
            Insumo.Nombre.ilike(termino) |
            CategoriaInsumo.Nombre_Categoria.ilike(termino)
        )

    total   = query.count()
    offset  = (pagina - 1) * por_pagina
    insumos = query.offset(offset).limit(por_pagina).all()

    if not insumos:
        return {
            "resumen":    _calcular_resumen(db),
            "total":      total,
            "pagina":     pagina,
            "por_pagina": por_pagina,
            "insumos":    [],
        }

    insumo_ids     = [i.ID_Insumo for i in insumos]
    insumo_ids_set = set(insumo_ids)

    # Batch 1: categorías y unidades de medida
    cat_ids    = list({i.ID_Categoria for i in insumos if i.ID_Categoria})
    unidad_ids = list({i.Unidad_Medida for i in insumos if i.Unidad_Medida})
    categorias = {
        c.ID_Categoria: c
        for c in db.query(CategoriaInsumo)
                   .filter(CategoriaInsumo.ID_Categoria.in_(cat_ids)).all()
    } if cat_ids else {}
    unidades = {
        u.ID_Unidad_Medida: u
        for u in db.query(UnidadMedida)
                   .filter(UnidadMedida.ID_Unidad_Medida.in_(unidad_ids)).all()
    } if unidad_ids else {}

    # Batch 2: primer lote activo por insumo (orden ascendente de vencimiento = FEFO)
    lotes_raw: dict[int, LoteCompra] = {}
    for lote in (
        db.query(LoteCompra)
        .filter(
            LoteCompra.ID_Insumo.in_(insumo_ids),
            LoteCompra.Estado == 1,
            LoteCompra.Cantidad_Actual > 0,
        )
        .order_by(LoteCompra.Fecha_Vencimiento.asc())
        .all()
    ):
        if lote.ID_Insumo not in lotes_raw:
            lotes_raw[lote.ID_Insumo] = lote

    # Batch 3: último detalle de compra por insumo (precio)
    subq = (
        db.query(
            DetalleCompra.ID_Insumo,
            func.max(DetalleCompra.ID_Detalle_Compra).label("max_id"),
        )
        .filter(DetalleCompra.ID_Insumo.in_(insumo_ids))
        .group_by(DetalleCompra.ID_Insumo)
        .subquery()
    )
    ultimos_detalles = {
        d.ID_Insumo: d
        for d in db.query(DetalleCompra)
                   .join(subq, DetalleCompra.ID_Detalle_Compra == subq.c.max_id)
                   .all()
    }

    # Batch 4: fichas técnicas
    ficha_rows = (
        db.query(FichaTecnicaInsumo.ID_Insumo, FichaTecnicaInsumo.ID_Ficha)
        .filter(FichaTecnicaInsumo.ID_Insumo.in_(insumo_ids))
        .all()
    )
    fichas_insumos_set = {row.ID_Insumo for row in ficha_rows}
    ficha_ids          = [row.ID_Ficha for row in ficha_rows]
    ficha_to_insumos: dict[int, list] = {}
    for row in ficha_rows:
        ficha_to_insumos.setdefault(row.ID_Ficha, []).append(row.ID_Insumo)

    # Batch 5: órdenes activas (directas o vía ficha)
    orden_filter = [OrdenProduccion.ID_Insumo.in_(insumo_ids)]
    if ficha_ids:
        orden_filter.append(OrdenProduccion.ID_Ficha.in_(ficha_ids))
    active_ordenes = db.query(OrdenProduccion).filter(
        or_(*orden_filter),
        OrdenProduccion.Estado.in_([1, 13]),
    ).all()

    insumos_en_orden: set = set()
    for orden in active_ordenes:
        if orden.ID_Insumo and orden.ID_Insumo in insumo_ids_set:
            insumos_en_orden.add(orden.ID_Insumo)
        if orden.ID_Ficha and orden.ID_Ficha in ficha_to_insumos:
            insumos_en_orden.update(ficha_to_insumos[orden.ID_Ficha])

    # Batch 6: insumos con al menos una compra registrada
    insumos_con_compra: set = {
        row.ID_Insumo
        for row in db.query(DetalleCompra.ID_Insumo)
                     .filter(DetalleCompra.ID_Insumo.in_(insumo_ids))
                     .distinct()
                     .all()
    }

    hoy = datetime.utcnow()

    def _build(insumo: Insumo) -> dict:
        categoria      = categorias.get(insumo.ID_Categoria)
        unidad         = unidades.get(insumo.Unidad_Medida)
        proximo_lote   = lotes_raw.get(insumo.ID_Insumo)
        ultimo_detalle = ultimos_detalles.get(insumo.ID_Insumo)

        proximo_venc     = None
        dias_para_vencer = None
        if proximo_lote and proximo_lote.Fecha_Vencimiento:
            proximo_venc     = proximo_lote.Fecha_Vencimiento.strftime("%Y-%m-%d")
            dias_para_vencer = (proximo_lote.Fecha_Vencimiento - hoy).days

        return {
            "ID_Insumo":              insumo.ID_Insumo,
            "Nombre":                 insumo.Nombre,
            "ID_Categoria":           insumo.ID_Categoria,
            "nombre_categoria":       categoria.Nombre_Categoria if categoria else None,
            "Unidad_Medida":          insumo.Unidad_Medida,
            "simbolo_unidad":         unidad.Simbolo if unidad else None,
            "Stock_Actual":           float(insumo.Stock_Actual or 0),
            "Stock_Minimo":           insumo.Stock_Minimo,
            "Estado":                 insumo.Estado,
            "proximo_vencimiento":    proximo_venc,
            "dias_para_vencer":       dias_para_vencer,
            "lote_id":                proximo_lote.ID_Lote_Compra if proximo_lote else None,
            "precio_unitario":        float(ultimo_detalle.Precio_Und) if ultimo_detalle and ultimo_detalle.Precio_Und else 0.0,
            "tiene_ficha_tecnica":    insumo.ID_Insumo in fichas_insumos_set,
            "tiene_orden_produccion": insumo.ID_Insumo in insumos_en_orden,
            "tiene_compra":           insumo.ID_Insumo in insumos_con_compra,
        }

    return {
        "resumen":    _calcular_resumen(db),
        "total":      total,
        "pagina":     pagina,
        "por_pagina": por_pagina,
        "insumos":    [_build(i) for i in insumos],
    }


def obtener_insumo(db: Session, id_insumo: int) -> dict:
    """Retorna un insumo por ID o lanza 404."""
    insumo = db.query(Insumo).filter(Insumo.ID_Insumo == id_insumo).first()
    if not insumo:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")
    return _formato_insumo(insumo, db)


def crear_insumo(db: Session, datos: InsumoCreate) -> dict:
    """
    Crea un insumo y opcionalmente crea su lote de compra.
    Orden correcto: insumo primero → lote con ID_Insumo → actualiza insumo con lote.
    """
    stock  = datos.Stock_Actual or 0
    minimo = datos.Stock_Minimo or 0
    if stock == 0:
        estado_inicial = 15
    elif stock <= minimo:
        estado_inicial = 14
    else:
        estado_inicial = 1

    nuevo = Insumo(
        Nombre         = datos.Nombre,
        ID_Categoria   = datos.ID_Categoria,
        Unidad_Medida  = datos.Unidad_Medida,
        Stock_Actual   = stock,
        Stock_Minimo   = minimo,
        ID_Lote_Compra = None,
        Estado         = estado_inicial,
    )
    db.add(nuevo)
    db.flush()  # obtiene ID_Insumo sin commit

    if datos.Lote_Compra and datos.Lote_Compra.Cantidad_Inicial is not None:
        nuevo_lote = LoteCompra(
            ID_Insumo         = nuevo.ID_Insumo,
            Fecha_Vencimiento = datos.Lote_Compra.Fecha_Vencimiento,
            Cantidad_Inicial  = datos.Lote_Compra.Cantidad_Inicial,
            Cantidad_Actual   = datos.Lote_Compra.Cantidad_Inicial,
            Estado            = 1,
        )
        db.add(nuevo_lote)
        db.flush()
        nuevo.ID_Lote_Compra = nuevo_lote.ID_Lote_Compra

    db.commit()
    db.refresh(nuevo)
    return _formato_insumo(nuevo, db)


def editar_insumo(db: Session, id_insumo: int, datos: InsumoUpdate) -> dict:
    """Edita solo los campos enviados y recalcula el Estado si cambia el stock."""
    insumo = db.query(Insumo).filter(Insumo.ID_Insumo == id_insumo).first()
    if not insumo:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")

    for campo, valor in datos.model_dump(exclude_none=True).items():
        setattr(insumo, campo, valor)

    stock  = insumo.Stock_Actual or 0
    minimo = insumo.Stock_Minimo or 0
    if stock == 0:
        insumo.Estado = 15
    elif stock <= minimo:
        insumo.Estado = 14
    else:
        insumo.Estado = 1

    db.commit()
    db.refresh(insumo)
    return _formato_insumo(insumo, db)


def _tiene_ficha_tecnica(db: Session, id_insumo: int) -> bool:
    return db.query(FichaTecnicaInsumo).filter(
        FichaTecnicaInsumo.ID_Insumo == id_insumo
    ).first() is not None


def cambiar_estado(db: Session, id_insumo: int, nuevo_estado: int) -> dict:
    """Cambia el estado ON/OFF del insumo."""
    insumo = db.query(Insumo).filter(Insumo.ID_Insumo == id_insumo).first()
    if not insumo:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")

    if nuevo_estado == 2 and _tiene_ficha_tecnica(db, id_insumo):
        raise HTTPException(
            status_code=400,
            detail="No se puede desactivar un insumo asociado a una ficha técnica de producción"
        )

    insumo.Estado = nuevo_estado
    db.commit()
    db.refresh(insumo)
    return _formato_insumo(insumo, db)


def obtener_lotes_insumo(db: Session, id_insumo: int) -> dict:
    """Retorna todos los lotes de compra de un insumo, separando activos y vencidos."""
    hoy = datetime.utcnow()
    lotes = (
        db.query(LoteCompra)
        .filter(LoteCompra.ID_Insumo == id_insumo)
        .order_by(LoteCompra.Fecha_Vencimiento.asc())
        .all()
    )
    resultado = []
    for l in lotes:
        fv = l.Fecha_Vencimiento
        vencido = bool(fv and fv < hoy)
        dias = None
        if fv:
            dias = (fv - hoy).days
        cantidad_actual = l.Cantidad_Actual if l.Cantidad_Actual is not None else l.Cantidad_Inicial
        resultado.append({
            "id":               l.ID_Lote_Compra,
            "cantidad_inicial": float(l.Cantidad_Inicial or 0),
            "cantidad":         float(cantidad_actual or 0),
            "fecha_vencimiento": fv.strftime("%Y-%m-%d") if fv else None,
            "vencido":          vencido,
            "dias_para_vencer": dias,
            "estado":           l.Estado,
            "pendiente":        l.Estado == 3,
        })
    return {"lotes": resultado, "total": len(resultado)}


def _tiene_orden_activa(db: Session, id_insumo: int) -> bool:
    fichas = (
        db.query(FichaTecnicaInsumo.ID_Ficha)
        .filter(FichaTecnicaInsumo.ID_Insumo == id_insumo)
        .subquery()
    )
    return db.query(OrdenProduccion).filter(
        or_(
            OrdenProduccion.ID_Insumo == id_insumo,
            OrdenProduccion.ID_Ficha.in_(fichas),
        ),
        OrdenProduccion.Estado.in_([1, 13]),
    ).first() is not None


def eliminar_insumo(db: Session, id_insumo: int) -> dict:
    """Elimina un insumo y sus lotes asociados si no está en uso."""
    insumo = db.query(Insumo).filter(Insumo.ID_Insumo == id_insumo).first()
    if not insumo:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")

    if _tiene_ficha_tecnica(db, id_insumo):
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar un insumo asociado a una ficha técnica de producción"
        )

    if _tiene_orden_activa(db, id_insumo):
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar un insumo que está en una orden de producción activa"
        )

    if db.query(DetalleCompra).filter(DetalleCompra.ID_Insumo == id_insumo).first():
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar un insumo que está asociado a registros de compra"
        )

    # Elimina todos los lotes asociados al insumo
    db.query(LoteCompra).filter(LoteCompra.ID_Insumo == id_insumo).delete()

    db.delete(insumo)
    db.commit()
    return {"mensaje": f"Insumo {id_insumo} eliminado correctamente"}