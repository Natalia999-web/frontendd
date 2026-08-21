from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func
from src.shared.services.models import Producto, CategoriaProducto, ProductoImagen, FichaTecnica, FichaTecnicaInsumo, Insumo, OrdenProduccion, VentaXProducto, DevolucionDetalle, LoteProducto, Venta, UnidadMedida
from .schemas import ProductoCreate, ProductoUpdate, FichaTecnicaInput


def _calcular_estado(stock: int, stock_minimo: int) -> tuple[int, str]:
    """Retorna el ID de estado y su etiqueta según el stock.
    Reglas: 0 → 15 Agotado, 0 < stock <= minimo → 14 Stock bajo, >minimo → 1 Activo.
    """
    if stock == 0:
        return 15, "Agotado"
    elif stock <= stock_minimo:
        return 14, "Stock bajo"
    else:
        return 1, "Activo"


def _formato_producto(producto: Producto, db: Session) -> dict:
    """Construye el dict de respuesta con categoría, imágenes y ficha técnica."""
    categoria = db.query(CategoriaProducto).filter(
        CategoriaProducto.ID_Categoria == producto.ID_Categoria
    ).first()

    imagenes = db.query(ProductoImagen).filter(
        ProductoImagen.ID_Producto == producto.ID_Producto
    ).all() if hasattr(ProductoImagen, "ID_Producto") else []

    ficha = db.query(FichaTecnica).filter(
        FichaTecnica.ID_Producto == producto.ID_Producto
    ).order_by(FichaTecnica.Fecha_Creacion.desc()).first()

    stock        = producto.Stock or 0
    stock_minimo = getattr(producto, "Stock_Minimo", 0) or 0
    estado_id, estado_label = _calcular_estado(stock, stock_minimo)

    hoy = datetime.utcnow()
    proximo_lote_prod = (
        db.query(LoteProducto)
        .filter(
            LoteProducto.ID_Producto == producto.ID_Producto,
            LoteProducto.Fecha_Vencimiento != None,
            LoteProducto.Estado == 1,
            LoteProducto.Cantidad > 0,
        )
        .order_by(LoteProducto.Fecha_Vencimiento.asc())
        .first()
    )
    proximo_venc_prod = None
    dias_para_vencer_prod = None
    if proximo_lote_prod and proximo_lote_prod.Fecha_Vencimiento:
        proximo_venc_prod = proximo_lote_prod.Fecha_Vencimiento.strftime("%Y-%m-%d")
        dias_para_vencer_prod = (proximo_lote_prod.Fecha_Vencimiento - hoy).days

    return {
        "ID_Producto":      producto.ID_Producto,
        "nombre":           producto.nombre,
        "ID_Categoria":     producto.ID_Categoria,
        "nombre_categoria": categoria.Nombre_Categoria if categoria else None,
        "icono_categoria":  categoria.Icono if categoria else None,
        "Precio_venta":     producto.Precio_venta,
        "Stock":            stock,
        "Stock_Minimo":     stock_minimo,
        "Estado":           estado_id,
        "estado_label":     estado_label,
        "Publicado":           getattr(producto, "Publicado", 0) or 0,
        "Requiere_Produccion": getattr(producto, "Requiere_Produccion", 0) or 0,
        "Descripcion_Corta": getattr(producto, "Descripcion_Corta", None),
        "Descripcion_Larga": getattr(producto, "Descripcion_Larga", None),
        "Fecha_Creacion":    getattr(producto, "Fecha_Creacion", None),
        "proximo_vencimiento": proximo_venc_prod,
        "dias_para_vencer":    dias_para_vencer_prod,
        "imagenes": [
            {"ID_Producto_Img": img.ID_Producto_Img, "url": img.imagen}
            for img in imagenes
        ],
        "ficha_tecnica": {
            "ID_Ficha":       ficha.ID_Ficha,
            "Version":        ficha.Version,
            "Observaciones":  ficha.Observaciones,
            "Procedimiento":  ficha.Procedimiento,
            "Estado":         ficha.Estado,
            "Fecha_Creacion": ficha.Fecha_Creacion,
            "Dias_Vida_Util": getattr(ficha, "Dias_Vida_Util", None),
            "insumos": [
                {
                    "ID_Ficha_Insumo":  fi.ID_Ficha_Insumo,
                    "ID_Insumo":        fi.ID_Insumo,
                    "nombre_insumo":    fi.insumo.Nombre if fi.insumo else None,
                    "ID_Categoria":     fi.insumo.ID_Categoria if fi.insumo else None,
                    "nombre_categoria": (fi.insumo.categoria.Nombre_Categoria if fi.insumo and fi.insumo.categoria else None),
                    "Cantidad":         fi.Cantidad,
                    "Unidad":           fi.Unidad,
                }
                for fi in db.query(FichaTecnicaInsumo).filter(
                    FichaTecnicaInsumo.ID_Ficha == ficha.ID_Ficha
                ).all()
            ],
        } if ficha else None,
    }


def obtener_productos(
    db: Session,
    pagina:     int = 1,
    por_pagina: int = 10,
    busqueda:   str = None,
    estado:     int = None,
    publicado:  int = None,
) -> dict:
    """Lista paginada con queries en lote. Evita N+1."""
    query = db.query(Producto)

    if estado is not None:
        query = query.filter(Producto.Estado == estado)

    if publicado is not None:
        query = query.filter(Producto.Publicado == publicado)

    if busqueda:
        termino = f"%{busqueda}%"
        query = query.join(
            CategoriaProducto,
            CategoriaProducto.ID_Categoria == Producto.ID_Categoria,
            isouter=True
        ).filter(
            Producto.nombre.ilike(termino) |
            CategoriaProducto.Nombre_Categoria.ilike(termino)
        )

    total     = query.count()
    offset    = (pagina - 1) * por_pagina
    productos = query.offset(offset).limit(por_pagina).all()

    if not productos:
        return {"total": total, "pagina": pagina, "por_pagina": por_pagina, "productos": []}

    prod_ids  = [p.ID_Producto for p in productos]
    cat_ids   = list({p.ID_Categoria for p in productos if p.ID_Categoria})

    # Batch 1: categorías
    categorias = {c.ID_Categoria: c for c in
                  db.query(CategoriaProducto)
                    .filter(CategoriaProducto.ID_Categoria.in_(cat_ids)).all()} if cat_ids else {}

    # Batch 2: imágenes agrupadas por producto
    imagenes_map: dict = {}
    for img in db.query(ProductoImagen).filter(ProductoImagen.ID_Producto.in_(prod_ids)).all():
        imagenes_map.setdefault(img.ID_Producto, []).append(img)

    # Batch 3: fichas técnicas (la más reciente por producto)
    fichas_raw = (
        db.query(FichaTecnica)
        .filter(FichaTecnica.ID_Producto.in_(prod_ids))
        .order_by(FichaTecnica.Fecha_Creacion.desc())
        .all()
    )
    fichas: dict = {}
    for f in fichas_raw:
        if f.ID_Producto not in fichas:
            fichas[f.ID_Producto] = f

    # Batch 4: insumos de fichas
    ficha_ids = [f.ID_Ficha for f in fichas.values()]
    fi_rows: dict = {}   # ficha_id → list[FichaTecnicaInsumo]
    insumo_fi_ids: set = set()
    if ficha_ids:
        for fi in db.query(FichaTecnicaInsumo).filter(FichaTecnicaInsumo.ID_Ficha.in_(ficha_ids)).all():
            fi_rows.setdefault(fi.ID_Ficha, []).append(fi)
            insumo_fi_ids.add(fi.ID_Insumo)

    # Batch 5: insumos para fichas
    insumos_fi: dict = {}
    cat_ins_ids: set = set()
    if insumo_fi_ids:
        for ins in db.query(Insumo).filter(Insumo.ID_Insumo.in_(list(insumo_fi_ids))).all():
            insumos_fi[ins.ID_Insumo] = ins
            if ins.ID_Categoria:
                cat_ins_ids.add(ins.ID_Categoria)

    # Batch 6: categorías de insumos
    from src.shared.services.models import CategoriaInsumo
    cats_insumo: dict = {}
    if cat_ins_ids:
        from src.shared.services.models import CategoriaInsumo as _CI
        cats_insumo = {c.ID_Categoria: c for c in
                       db.query(_CI).filter(_CI.ID_Categoria.in_(list(cat_ins_ids))).all()}

    # Batch 7: primer lote activo con vencimiento por producto
    hoy = datetime.utcnow()
    lotes_raw = (
        db.query(LoteProducto)
        .filter(
            LoteProducto.ID_Producto.in_(prod_ids),
            LoteProducto.Fecha_Vencimiento != None,
            LoteProducto.Estado == 1,
            LoteProducto.Cantidad > 0,
        )
        .order_by(LoteProducto.Fecha_Vencimiento.asc())
        .all()
    )
    primer_lote: dict = {}
    for lote in lotes_raw:
        if lote.ID_Producto not in primer_lote:
            primer_lote[lote.ID_Producto] = lote

    def _build(producto: Producto) -> dict:
        cat   = categorias.get(producto.ID_Categoria)
        ficha = fichas.get(producto.ID_Producto)
        lote  = primer_lote.get(producto.ID_Producto)
        imgs  = imagenes_map.get(producto.ID_Producto, [])

        stock        = producto.Stock or 0
        stock_minimo = getattr(producto, "Stock_Minimo", 0) or 0
        estado_id, estado_label = _calcular_estado(stock, stock_minimo)

        proximo_venc     = None
        dias_para_vencer = None
        if lote and lote.Fecha_Vencimiento:
            proximo_venc     = lote.Fecha_Vencimiento.strftime("%Y-%m-%d")
            dias_para_vencer = (lote.Fecha_Vencimiento - hoy).days

        ficha_dict = None
        if ficha:
            fis = fi_rows.get(ficha.ID_Ficha, [])
            ficha_dict = {
                "ID_Ficha":       ficha.ID_Ficha,
                "Version":        ficha.Version,
                "Observaciones":  ficha.Observaciones,
                "Procedimiento":  ficha.Procedimiento,
                "Estado":         ficha.Estado,
                "Fecha_Creacion": ficha.Fecha_Creacion,
                "Dias_Vida_Util": getattr(ficha, "Dias_Vida_Util", None),
                "insumos": [
                    {
                        "ID_Ficha_Insumo":  fi.ID_Ficha_Insumo,
                        "ID_Insumo":        fi.ID_Insumo,
                        "nombre_insumo":    insumos_fi[fi.ID_Insumo].Nombre if fi.ID_Insumo in insumos_fi else None,
                        "ID_Categoria":     insumos_fi[fi.ID_Insumo].ID_Categoria if fi.ID_Insumo in insumos_fi else None,
                        "nombre_categoria": (cats_insumo[insumos_fi[fi.ID_Insumo].ID_Categoria].Nombre_Categoria
                                             if fi.ID_Insumo in insumos_fi and insumos_fi[fi.ID_Insumo].ID_Categoria in cats_insumo
                                             else None),
                        "Cantidad":         fi.Cantidad,
                        "Unidad":           fi.Unidad,
                    }
                    for fi in fis
                ],
            }

        return {
            "ID_Producto":      producto.ID_Producto,
            "nombre":           producto.nombre,
            "ID_Categoria":     producto.ID_Categoria,
            "nombre_categoria": cat.Nombre_Categoria if cat else None,
            "icono_categoria":  cat.Icono            if cat else None,
            "Precio_venta":     producto.Precio_venta,
            "Stock":            stock,
            "Stock_Minimo":     stock_minimo,
            "Estado":           estado_id,
            "estado_label":     estado_label,
            "Publicado":           getattr(producto, "Publicado",           0) or 0,
            "Requiere_Produccion": getattr(producto, "Requiere_Produccion", 0) or 0,
            "Descripcion_Corta":   getattr(producto, "Descripcion_Corta",  None),
            "Descripcion_Larga":   getattr(producto, "Descripcion_Larga",  None),
            "Fecha_Creacion":      getattr(producto, "Fecha_Creacion",     None),
            "proximo_vencimiento": proximo_venc,
            "dias_para_vencer":    dias_para_vencer,
            "imagenes": [
                {"ID_Producto_Img": img.ID_Producto_Img, "url": img.imagen}
                for img in imgs
            ],
            "ficha_tecnica": ficha_dict,
        }

    return {
        "total":      total,
        "pagina":     pagina,
        "por_pagina": por_pagina,
        "productos":  [_build(p) for p in productos],
    }


def obtener_producto(db: Session, id_producto: int) -> dict:
    """Retorna un producto por ID o lanza 404."""
    producto = db.query(Producto).filter(Producto.ID_Producto == id_producto).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return _formato_producto(producto, db)


def obtener_lotes_producto(db: Session, id_producto: int) -> dict:
    """Retorna todos los lotes de producción de un producto, separando activos y vencidos."""
    hoy = datetime.utcnow()
    lotes = (
        db.query(LoteProducto)
        .filter(LoteProducto.ID_Producto == id_producto)
        .order_by(LoteProducto.Fecha_Vencimiento.asc().nullslast())
        .all()
    )
    resultado = []
    for l in lotes:
        fv = l.Fecha_Vencimiento
        fp = l.Fecha_Produccion
        vencido = bool(fv and fv < hoy)
        dias = (fv - hoy).days if fv else None
        resultado.append({
            "id":               l.ID_Lote_Producto,
            "numero_lote":      l.Numero_Lote,
            "cantidad":         l.Cantidad,
            "fecha_produccion": fp.strftime("%Y-%m-%d") if fp else None,
            "fecha_vencimiento": fv.strftime("%Y-%m-%d") if fv else None,
            "vencido":          vencido,
            "dias_para_vencer": dias,
            "estado":           l.Estado,
        })
    return {"lotes": resultado, "total": len(resultado)}


def verificar_puede_eliminar_producto(db: Session, id_producto: int) -> dict:
    """Verifica si el producto puede eliminarse revisando registros dependientes."""
    ordenes = db.query(OrdenProduccion).filter(
        OrdenProduccion.ID_Producto == id_producto
    ).count()
    if ordenes > 0:
        return {
            "ok": False,
            "razon": f"Este producto tiene {ordenes} orden(es) de producción asociada(s). Elimínalas primero desde Gestión de Órdenes.",
        }

    # Solo bloquear si hay pedidos ACTIVOS (pendiente, en proceso, confirmado, en camino)
    # Los pedidos completados o cancelados no impiden eliminar el producto
    ESTADOS_ACTIVOS_VENTA = (1, 4, 9, 13)
    ventas_activas = (
        db.query(VentaXProducto)
        .join(Venta, Venta.ID_Venta == VentaXProducto.ID_Venta)
        .filter(
            VentaXProducto.ID_Producto == id_producto,
            Venta.Estado.in_(ESTADOS_ACTIVOS_VENTA),
        )
        .count()
    )
    if ventas_activas > 0:
        return {
            "ok": False,
            "razon": f"Este producto está en {ventas_activas} pedido(s) activo(s) y no puede eliminarse.",
        }

    devoluciones = db.query(DevolucionDetalle).filter(
        DevolucionDetalle.ID_Producto == id_producto
    ).count()
    if devoluciones > 0:
        return {
            "ok": False,
            "razon": f"Este producto tiene {devoluciones} devolución(es) asociada(s) y no puede eliminarse.",
        }

    return {"ok": True}


def crear_producto(db: Session, datos: ProductoCreate) -> dict:
    """Crea el producto, calcula estado automático y crea ficha técnica si viene."""
    duplicado = db.query(Producto).filter(
        Producto.nombre == datos.nombre,
        Producto.ID_Categoria == datos.ID_Categoria,
    ).first()
    if duplicado:
        raise HTTPException(
            status_code=400,
            detail="Ya existe un producto con ese nombre en esta categoría.",
        )

    estado_id, _ = _calcular_estado(datos.Stock, datos.Stock_Minimo)

    nuevo = Producto(
        nombre            = datos.nombre,
        ID_Categoria      = datos.ID_Categoria,
        Precio_venta      = datos.Precio_venta,
        Stock             = datos.Stock,
        Stock_Minimo      = datos.Stock_Minimo,
        Estado            = estado_id,
        Publicado         = datos.Publicado or 0,
        Descripcion_Corta = datos.Descripcion_Corta,
        Descripcion_Larga = datos.Descripcion_Larga,
        Fecha_Creacion    = datetime.now(),
    )
    db.add(nuevo)
    db.flush()  # obtiene el ID sin hacer commit aún

    # Crea la ficha técnica si viene en el body
    if datos.ficha_tecnica:
        ficha = FichaTecnica(
            ID_Producto    = nuevo.ID_Producto,
            ID_Categoria   = datos.ID_Categoria,
            Version        = datos.ficha_tecnica.Version or "1.0",
            Observaciones  = datos.ficha_tecnica.Observaciones,
            Procedimiento  = datos.ficha_tecnica.Procedimiento,
            Estado         = estado_id,
            Fecha_Creacion = datetime.now(),
        )
        db.add(ficha)

    db.commit()
    db.refresh(nuevo)
    return _formato_producto(nuevo, db)


def editar_producto(db: Session, id_producto: int, datos: ProductoUpdate) -> dict:
    """Edita solo los campos enviados y recalcula el estado."""
    producto = db.query(Producto).filter(Producto.ID_Producto == id_producto).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    nombre_nuevo    = datos.nombre        if datos.nombre        is not None else producto.nombre
    categoria_nueva = datos.ID_Categoria  if datos.ID_Categoria  is not None else producto.ID_Categoria
    if nombre_nuevo != producto.nombre or categoria_nueva != producto.ID_Categoria:
        dup = db.query(Producto).filter(
            Producto.nombre       == nombre_nuevo,
            Producto.ID_Categoria == categoria_nueva,
            Producto.ID_Producto  != id_producto,
        ).first()
        if dup:
            raise HTTPException(
                status_code=400,
                detail="Ya existe un producto con ese nombre en esta categoría.",
            )

    for campo, valor in datos.model_dump(exclude_none=True).items():
        setattr(producto, campo, valor)

    # Recalcula estado automáticamente
    stock        = producto.Stock or 0
    stock_minimo = getattr(producto, "Stock_Minimo", 0) or 0
    producto.Estado, _ = _calcular_estado(stock, stock_minimo)

    db.commit()
    db.refresh(producto)
    return _formato_producto(producto, db)


def agregar_imagenes(db: Session, id_producto: int, urls: list[str]) -> dict:
    """Recibe URLs de Cloudinary y las asocia al producto."""
    producto = db.query(Producto).filter(Producto.ID_Producto == id_producto).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    for url in urls:
        db.add(ProductoImagen(ID_Producto=id_producto, imagen=url))

    db.commit()
    return _formato_producto(producto, db)


def eliminar_imagen(db: Session, id_imagen: int) -> dict:
    """Elimina una imagen por su ID."""
    imagen = db.query(ProductoImagen).filter(
        ProductoImagen.ID_Producto_Img == id_imagen
    ).first()
    if not imagen:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    db.delete(imagen)
    db.commit()
    return {"mensaje": f"Imagen {id_imagen} eliminada"}


def gestionar_ficha(db: Session, id_producto: int, datos: FichaTecnicaInput) -> dict:
    """Upsert de ficha técnica: crea si no existe, edita si ya existe. Reemplaza insumos."""
    producto = db.query(Producto).filter(Producto.ID_Producto == id_producto).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    ficha = db.query(FichaTecnica).filter(
        FichaTecnica.ID_Producto == id_producto
    ).order_by(FichaTecnica.Fecha_Creacion.desc()).first()

    campos = datos.model_dump(exclude_none=True, exclude={"insumos"})

    if ficha:
        for campo, valor in campos.items():
            setattr(ficha, campo, valor)
    else:
        ficha = FichaTecnica(
            ID_Producto    = id_producto,
            ID_Categoria   = producto.ID_Categoria,
            Version        = datos.Version or "1.0",
            Observaciones  = datos.Observaciones,
            Procedimiento  = datos.Procedimiento,
            Estado         = 1,
            Fecha_Creacion = datetime.now(),
        )
        db.add(ficha)
        db.flush()

    if datos.insumos is not None:
        db.query(FichaTecnicaInsumo).filter(
            FichaTecnicaInsumo.ID_Ficha == ficha.ID_Ficha
        ).delete(synchronize_session=False)
        for ins in datos.insumos:
            db.add(FichaTecnicaInsumo(
                ID_Ficha  = ficha.ID_Ficha,
                ID_Insumo = ins.ID_Insumo,
                Cantidad  = ins.Cantidad,
                Unidad    = ins.Unidad,
            ))

    db.commit()
    db.refresh(producto)
    return _formato_producto(producto, db)


def eliminar_ficha(db: Session, id_producto: int) -> dict:
    """Elimina la ficha técnica y sus insumos de un producto."""
    ficha = db.query(FichaTecnica).filter(
        FichaTecnica.ID_Producto == id_producto
    ).first()
    if not ficha:
        raise HTTPException(status_code=404, detail="Ficha técnica no encontrada")
    db.query(FichaTecnicaInsumo).filter(
        FichaTecnicaInsumo.ID_Ficha == ficha.ID_Ficha
    ).delete(synchronize_session=False)
    db.delete(ficha)
    db.commit()
    return {"mensaje": "Ficha técnica eliminada"}


def eliminar_producto(db: Session, id_producto: int) -> dict:
    """Elimina el producto, sus imágenes y su ficha técnica."""
    producto = db.query(Producto).filter(Producto.ID_Producto == id_producto).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    check = verificar_puede_eliminar_producto(db, id_producto)
    if not check["ok"]:
        raise HTTPException(status_code=400, detail=check["razon"])

    db.query(ProductoImagen).filter(ProductoImagen.ID_Producto == id_producto).delete()
    fichas = db.query(FichaTecnica).filter(FichaTecnica.ID_Producto == id_producto).all()
    for f in fichas:
        db.query(FichaTecnicaInsumo).filter(FichaTecnicaInsumo.ID_Ficha == f.ID_Ficha).delete(synchronize_session=False)
        db.delete(f)

    db.delete(producto)
    db.commit()
    return {"mensaje": f"Producto {id_producto} eliminado correctamente"}