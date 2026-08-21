from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime

from src.shared.services.models import CategoriaInsumo, Insumo
from .schemas import CategoriaInsumoCreate, CategoriaInsumoUpdate


def _formato_categoria(categoria: CategoriaInsumo, db: Session) -> dict:
    """Construye el dict con los insumos asociados a la categoría."""
    insumos = db.query(Insumo).filter(
        Insumo.ID_Categoria == categoria.ID_Categoria
    ).all()

    return {
        "ID_Categoria":     categoria.ID_Categoria,
        "Nombre_Categoria": categoria.Nombre_Categoria,
        "Descripcion":      categoria.Descripcion,
        "Icono":            categoria.Icono,
        "Estado":           categoria.Estado,
        "Fecha_creacion":   categoria.Fecha_Creacion,
        "insumos": [
            {"ID_Insumo": i.ID_Insumo, "Nombre": i.Nombre}
            for i in insumos
        ],
        "total_insumos": len(insumos),
    }


def obtener_categorias(
    db: Session,
    pagina: int = 1,
    por_pagina: int = 10,
    busqueda: str = None
) -> dict:
    """Lista paginada. Busca por nombre, descripción o nombre de insumo asociado."""
    query = db.query(CategoriaInsumo)

    if busqueda:
        termino = f"%{busqueda}%"
        # Busca en nombre y descripción de la categoría
        # o en nombre de los insumos que pertenecen a ella
        cats_por_insumo = (
            db.query(Insumo.ID_Categoria)
            .filter(Insumo.Nombre.ilike(termino))
            .subquery()
        )
        query = query.filter(
            CategoriaInsumo.Nombre_Categoria.ilike(termino) |
            CategoriaInsumo.Descripcion.ilike(termino) |
            CategoriaInsumo.ID_Categoria.in_(cats_por_insumo)
        )

    total      = query.count()
    offset     = (pagina - 1) * por_pagina
    categorias = query.offset(offset).limit(por_pagina).all()

    # Batch: cargar insumos de todas las categorías en una sola query
    cat_ids    = [c.ID_Categoria for c in categorias]
    insumos_todos = (
        db.query(Insumo).filter(Insumo.ID_Categoria.in_(cat_ids)).all()
    ) if cat_ids else []
    insumos_by_cat: dict = {}
    for ins in insumos_todos:
        insumos_by_cat.setdefault(ins.ID_Categoria, []).append(ins)

    def _build_cat(cat: CategoriaInsumo) -> dict:
        ins_list = insumos_by_cat.get(cat.ID_Categoria, [])
        return {
            "ID_Categoria":     cat.ID_Categoria,
            "Nombre_Categoria": cat.Nombre_Categoria,
            "Descripcion":      cat.Descripcion,
            "Icono":            cat.Icono,
            "Estado":           cat.Estado,
            "Fecha_creacion":   cat.Fecha_Creacion,
            "insumos":          [{"ID_Insumo": i.ID_Insumo, "Nombre": i.Nombre} for i in ins_list],
            "total_insumos":    len(ins_list),
        }

    return {
        "total":      total,
        "pagina":     pagina,
        "por_pagina": por_pagina,
        "categorias": [_build_cat(c) for c in categorias],
    }


def obtener_categoria(db: Session, id_categoria: int) -> dict:
    """Retorna una categoría por ID o lanza 404."""
    categoria = db.query(CategoriaInsumo).filter(
        CategoriaInsumo.ID_Categoria == id_categoria
    ).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return _formato_categoria(categoria, db)


def crear_categoria(db: Session, datos: CategoriaInsumoCreate) -> dict:
    """Crea una categoría y asocia los insumos enviados."""
    if db.query(CategoriaInsumo).filter(
        CategoriaInsumo.Nombre_Categoria == datos.Nombre_Categoria
    ).first():
        raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")

    nueva = CategoriaInsumo(
        Nombre_Categoria = datos.Nombre_Categoria,
        Descripcion      = datos.Descripcion,
        Icono            = datos.Icono,
        Estado           = 1,
        Fecha_Creacion   = datetime.now(),
    )
    db.add(nueva)
    db.flush()      # obtiene el ID sin hacer commit aún

    # Asocia los insumos enviados a esta categoría
    if datos.insumos_ids:
        for id_insumo in datos.insumos_ids:
            insumo = db.query(Insumo).filter(Insumo.ID_Insumo == id_insumo).first()
            if not insumo:
                raise HTTPException(status_code=404, detail=f"Insumo {id_insumo} no encontrado")
            insumo.ID_Categoria = nueva.ID_Categoria

    db.commit()
    db.refresh(nueva)
    return _formato_categoria(nueva, db)


def editar_categoria(db: Session, id_categoria: int, datos: CategoriaInsumoUpdate) -> dict:
    """Edita la categoría y reemplaza la lista de insumos si se envía."""
    categoria = db.query(CategoriaInsumo).filter(
        CategoriaInsumo.ID_Categoria == id_categoria
    ).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    # Actualiza campos básicos
    for campo, valor in datos.model_dump(exclude_none=True, exclude={"insumos_ids"}).items():
        setattr(categoria, campo, valor)

    # Si viene lista de insumos, desasocia los actuales y asocia los nuevos
    if datos.insumos_ids is not None:
        # Quita la categoría a los insumos que la tenían
        db.query(Insumo).filter(
            Insumo.ID_Categoria == id_categoria
        ).update({"ID_Categoria": None})

        # Asigna la categoría a los nuevos insumos
        for id_insumo in datos.insumos_ids:
            insumo = db.query(Insumo).filter(Insumo.ID_Insumo == id_insumo).first()
            if not insumo:
                raise HTTPException(status_code=404, detail=f"Insumo {id_insumo} no encontrado")
            insumo.ID_Categoria = id_categoria

    db.commit()
    db.refresh(categoria)
    return _formato_categoria(categoria, db)


def cambiar_estado(db: Session, id_categoria: int, nuevo_estado: int) -> dict:
    """Cambia el estado ON/OFF de la categoría y cascada a sus insumos."""
    categoria = db.query(CategoriaInsumo).filter(
        CategoriaInsumo.ID_Categoria == id_categoria
    ).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    categoria.Estado = nuevo_estado

    # Cascada: los insumos de la categoría reciben el mismo estado
    db.query(Insumo).filter(
        Insumo.ID_Categoria == id_categoria
    ).update({"Estado": nuevo_estado})

    db.commit()
    db.refresh(categoria)
    return _formato_categoria(categoria, db)


def eliminar_categoria(db: Session, id_categoria: int) -> dict:
    """Elimina la categoría. Bloquea si tiene insumos asociados."""
    categoria = db.query(CategoriaInsumo).filter(
        CategoriaInsumo.ID_Categoria == id_categoria
    ).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    total_insumos = db.query(Insumo).filter(
        Insumo.ID_Categoria == id_categoria
    ).count()
    if total_insumos > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar: la categoría tiene {total_insumos} insumo(s) asociado(s)"
        )

    db.delete(categoria)
    db.commit()
    return {"mensaje": f"Categoría {id_categoria} eliminada correctamente"}