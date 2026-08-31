from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from src.shared.services.database import get_db
from src.shared.services.models import Venta
from src.features.auth.services.dependencies import requiere_permiso, obtener_usuario_actual
from .schemas import (
    DevolucionCreate, DevolucionResolucion, DevolucionUpdate,
    DevolucionResponse, DevolucionListResponse
)
from .service import (
    obtener_devoluciones, obtener_mis_devoluciones, obtener_devolucion,
    crear_devolucion, editar_devolucion, resolver_devolucion
)

router = APIRouter(prefix="/devoluciones", tags=["Devoluciones"])


@router.get("/mis-devoluciones", response_model=DevolucionListResponse)
def mis_devoluciones(
    pagina:     int     = Query(1, ge=1),
    por_pagina: int     = Query(10, ge=1, le=100),
    db:         Session = Depends(get_db),
    actual:     dict    = Depends(obtener_usuario_actual),
):
    """Retorna solo las devoluciones del cliente autenticado."""
    if actual["tipo"] != "cliente":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Solo disponible para clientes")
    id_usuario = actual["registro"].ID_Usuario
    return obtener_mis_devoluciones(db, id_usuario, pagina, por_pagina)


@router.get("/", response_model=DevolucionListResponse)
def listar_devoluciones(
    pagina:      int           = Query(1, ge=1),
    por_pagina:  int           = Query(20, ge=1, le=100),
    busqueda:    Optional[str] = Query(None),
    estado:      Optional[int] = Query(None),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    db:          Session       = Depends(get_db),
    _:           dict          = Depends(requiere_permiso("ver_devoluciones"))
):
    """Lista paginada de devoluciones (admin). Filtra por estado, fecha y busca por nombre."""
    return obtener_devoluciones(db, pagina, por_pagina, busqueda, estado, fecha_desde, fecha_hasta)


@router.get("/{id_devolucion}", response_model=DevolucionResponse)
def ver_devolucion(
    id_devolucion: int,
    db:            Session = Depends(get_db),
    _:             dict    = Depends(requiere_permiso("ver_devoluciones"))
):
    """Retorna el detalle de una devolución con sus productos."""
    return obtener_devolucion(db, id_devolucion)


@router.post("/", response_model=DevolucionResponse, status_code=201)
def registrar_devolucion(
    datos:  DevolucionCreate,
    db:     Session = Depends(get_db),
    actual: dict    = Depends(obtener_usuario_actual),
):
    """
    Registra una devolución.
    - Clientes: ID_Usuario se fuerza desde el token; solo pueden devolver sus propias ventas.
    - Empleados/Admin: ID_Usuario se deriva de la venta si no se envía.
    """
    registro = actual["registro"]

    if actual["tipo"] == "cliente":
        venta = db.query(Venta).filter(Venta.ID_Venta == datos.ID_Venta).first()
        if not venta or venta.ID_Usuario != registro.ID_Usuario:
            raise HTTPException(status_code=403, detail="Solo puedes devolver tus propias ventas")
        datos = datos.model_copy(update={"ID_Usuario": registro.ID_Usuario})
    else:
        # Admin/empleado: si no envió ID_Usuario, lo derivamos de la venta
        if datos.ID_Usuario is None:
            venta = db.query(Venta).filter(Venta.ID_Venta == datos.ID_Venta).first()
            if not venta:
                raise HTTPException(status_code=404, detail="Venta no encontrada")
            datos = datos.model_copy(update={"ID_Usuario": venta.ID_Usuario})

    return crear_devolucion(db, datos)


@router.patch("/{id_devolucion}", response_model=DevolucionResponse)
def editar_dev(
    id_devolucion: int,
    datos:         DevolucionUpdate,
    db:            Session = Depends(get_db),
    _:             dict    = Depends(requiere_permiso("editar_devoluciones"))
):
    """Edita motivo o comentario interno de una devolución pendiente."""
    return editar_devolucion(db, id_devolucion, datos)


@router.patch("/{id_devolucion}/resolver", response_model=DevolucionResponse)
def aprobar_rechazar(
    id_devolucion: int,
    datos:         DevolucionResolucion,
    db:            Session = Depends(get_db),
    _:             dict    = Depends(requiere_permiso("editar_devoluciones"))
):
    """Aprueba o rechaza la devolución. Si se aprueba → recarga crédito automáticamente."""
    return resolver_devolucion(db, id_devolucion, datos)