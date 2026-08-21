from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from src.shared.services.database import get_db
from src.features.auth.services.dependencies import requiere_permiso, obtener_usuario_actual
from .schemas import VentaCreate, VentaEstado, VentaResponse, VentaListResponse, FechaEntregaInput, PagoFinalCreate
from .service import (
    obtener_ventas, obtener_venta, obtener_mi_venta, crear_venta, cambiar_estado,
    obtener_mis_ventas, obtener_mi_credito,
    proponer_fecha, aceptar_fecha, rechazar_fecha,
    registrar_pago_final,
)

router = APIRouter(prefix="/ventas", tags=["Gestión de Ventas"])


@router.get("/mi-credito")
def ver_mi_credito(
    db:     Session = Depends(get_db),
    actual: dict    = Depends(obtener_usuario_actual),
):
    """Retorna el saldo de crédito disponible del cliente autenticado."""
    return obtener_mi_credito(db, actual)


@router.get("/mis-ventas", response_model=VentaListResponse)
def mis_ventas(
    pagina:     int           = Query(1, ge=1),
    por_pagina: int           = Query(10, ge=1, le=100),
    db:         Session       = Depends(get_db),
    actual:     dict          = Depends(obtener_usuario_actual),
):
    """Retorna las ventas del cliente autenticado (todos los estados)."""
    return obtener_mis_ventas(db, actual, pagina, por_pagina)


@router.get("/", response_model=VentaListResponse)
def listar_ventas(
    pagina:      int           = Query(1, ge=1),
    por_pagina:  int           = Query(10, ge=1, le=100),
    busqueda:    Optional[str] = Query(None),
    id_usuario:  Optional[int] = Query(None),
    estado:      Optional[int] = Query(None),
    db:          Session       = Depends(get_db),
    _:           dict          = Depends(requiere_permiso("ver_ventas"))
):
    """Lista paginada de ventas. Filtra por id_usuario, estado o busca por nombre."""
    return obtener_ventas(db, pagina, por_pagina, busqueda, id_usuario, estado)


@router.get("/mis-ventas/{id_venta}", response_model=VentaResponse)
def ver_mi_venta(
    id_venta: int,
    db:       Session = Depends(get_db),
    actual:   dict    = Depends(obtener_usuario_actual),
):
    """Retorna el detalle de una venta propia del cliente autenticado."""
    return obtener_mi_venta(db, id_venta, actual)


@router.get("/{id_venta}", response_model=VentaResponse)
def ver_venta(
    id_venta: int,
    db:       Session = Depends(get_db),
    _:        dict    = Depends(requiere_permiso("ver_ventas"))
):
    """Retorna el detalle completo de una venta con productos, crédito y descuento."""
    return obtener_venta(db, id_venta)


@router.post("/", response_model=VentaResponse, status_code=201)
def registrar_venta(
    datos:  VentaCreate,
    db:     Session = Depends(get_db),
    actual: dict    = Depends(requiere_permiso("crear_ventas"))
):
    """
    Crea una venta aplicando el flujo completo:
    1. Valida stock de productos
    2. Aplica crédito del cliente si usar_credito=true
    3. Aplica descuento si queda saldo
    4. Descuenta stock automáticamente
    5. Crea domicilio si se incluye en el body
    """
    # El cliente NO fija la fecha de entrega en el checkout: la propone el
    # administrador después. Se ignora cualquier fecha enviada por un cliente.
    if actual.get("tipo") == "cliente":
        datos.Fecha_entrega_esperada = None
        if datos.domicilio is not None:
            datos.domicilio.Fecha_entrega = None
    return crear_venta(db, datos)


@router.patch("/{id_venta}/estado", response_model=VentaResponse)
def actualizar_estado(
    id_venta: int,
    datos:    VentaEstado,
    db:       Session = Depends(get_db),
    _:        dict    = Depends(requiere_permiso("editar_ventas"))
):
    """Cambia el estado de la venta."""
    return cambiar_estado(db, id_venta, datos.Estado)


@router.patch("/{id_venta}/proponer-fecha", response_model=VentaResponse)
def proponer_fecha_endpoint(
    id_venta: int,
    datos:    FechaEntregaInput,
    db:       Session = Depends(get_db),
    _:        dict    = Depends(requiere_permiso("editar_ventas")),
):
    """Admin propone una fecha de entrega para un pedido de producción. Pasa el pedido a estado Fecha propuesta (16)."""
    return proponer_fecha(db, id_venta, datos.fecha_entrega)


@router.patch("/{id_venta}/aceptar-fecha", response_model=VentaResponse)
def aceptar_fecha_endpoint(
    id_venta: int,
    db:       Session = Depends(get_db),
    actual:   dict    = Depends(obtener_usuario_actual),
):
    """El cliente acepta la fecha propuesta → pedido pasa a Confirmado (4)."""
    return aceptar_fecha(db, id_venta, actual)


@router.post("/{id_venta}/registrar-pago-final", response_model=VentaResponse)
def registrar_pago_final_endpoint(
    id_venta: int,
    datos:    PagoFinalCreate,
    db:       Session = Depends(get_db),
    _:        dict    = Depends(requiere_permiso("editar_ventas")),
):
    """Registra el pago del saldo restante al momento de entrega. Solo para pedidos con anticipo."""
    return registrar_pago_final(db, id_venta, datos)


@router.patch("/{id_venta}/rechazar-fecha", response_model=VentaResponse)
def rechazar_fecha_endpoint(
    id_venta: int,
    db:       Session = Depends(get_db),
    actual:   dict    = Depends(obtener_usuario_actual),
):
    """El cliente rechaza la fecha propuesta → pedido pasa a Cancelado (5). Devuelve crédito si aplica."""
    return rechazar_fecha(db, id_venta, actual)