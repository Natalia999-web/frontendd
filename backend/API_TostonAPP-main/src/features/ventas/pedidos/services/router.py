from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from src.shared.services.database import get_db
from src.features.auth.services.dependencies import requiere_permiso, obtener_usuario_actual
from .schemas import PedidoResponse, PedidoListResponse, PedidoUpdate, RegistroCobro
from .service import (
    obtener_pedidos, obtener_pedido, confirmar_pedido, cancelar_pedido,
    editar_pedido, aprobar_comprobante, rechazar_comprobante, registrar_cobro_pedido,
)
from src.features.ventas.gestion_ventas.services.schemas import RechazoComprobante

router = APIRouter(prefix="/pedidos", tags=["Pedidos"])


@router.get("/", response_model=PedidoListResponse)
def listar_pedidos(
    pagina:     int           = Query(1, ge=1),
    por_pagina: int           = Query(10, ge=1, le=100),
    busqueda:   Optional[str] = Query(None),
    estado:     Optional[int] = Query(None),
    db:         Session       = Depends(get_db),
    _:          dict          = Depends(requiere_permiso("ver_pedidos"))
):
    """Lista pedidos. Sin 'estado' devuelve activos; con 'estado=8' devuelve entregados, etc."""
    return obtener_pedidos(db, pagina, por_pagina, busqueda, estado)


@router.get("/{id_venta}", response_model=PedidoResponse)
def ver_pedido(
    id_venta: int,
    db:       Session = Depends(get_db),
    _:        dict    = Depends(requiere_permiso("ver_pedidos"))
):
    """Retorna el detalle de un pedido pendiente."""
    return obtener_pedido(db, id_venta)


@router.put("/{id_venta}", response_model=PedidoResponse)
def editar(
    id_venta: int,
    datos:    PedidoUpdate,
    db:       Session = Depends(get_db),
    _:        dict    = Depends(requiere_permiso("editar_pedidos")),
):
    """Actualiza campos editables de un pedido Pendiente (metodo_pago, montos, domicilio)."""
    return editar_pedido(db, id_venta, datos.model_dump())


@router.patch("/{id_venta}/confirmar", response_model=PedidoResponse)
def confirmar(
    id_venta: int,
    db:       Session = Depends(get_db),
    _:        dict    = Depends(requiere_permiso("editar_pedidos"))
):
    """Confirma el pedido → estado Confirmado."""
    return confirmar_pedido(db, id_venta)


@router.patch("/{id_venta}/cancelar", response_model=PedidoResponse)
def cancelar(
    id_venta: int,
    db:       Session = Depends(get_db),
    _:        dict    = Depends(requiere_permiso("editar_pedidos"))
):
    """Cancela cualquier pedido pendiente (empleado / admin)."""
    return cancelar_pedido(db, id_venta)


@router.patch("/{id_venta}/cancelar-mi-pedido", response_model=PedidoResponse)
def cancelar_mi_pedido(
    id_venta: int,
    db:       Session = Depends(get_db),
    actual:   dict    = Depends(obtener_usuario_actual),
):
    """El cliente cancela su propio pedido pendiente."""
    return cancelar_pedido(db, id_venta, actual)


@router.patch("/{id_venta}/aprobar-comprobante", response_model=PedidoResponse)
def aprobar_comprobante_endpoint(
    id_venta: int,
    db:       Session = Depends(get_db),
    actual:   dict    = Depends(requiere_permiso("editar_ventas")),
):
    """Admin aprueba el comprobante de transferencia → Estado_Pago='pagado_completo'."""
    return aprobar_comprobante(db, id_venta)


@router.patch("/{id_venta}/rechazar-comprobante", response_model=PedidoResponse)
def rechazar_comprobante_endpoint(
    id_venta: int,
    datos:    RechazoComprobante,
    db:       Session = Depends(get_db),
    actual:   dict    = Depends(requiere_permiso("editar_ventas")),
):
    """Admin rechaza el comprobante → Estado_Pago='comprobante_rechazado'. El motivo queda en notificación."""
    registro = actual["registro"]
    return rechazar_comprobante(db, id_venta, datos.motivo, registro.ID_Usuario)


@router.patch("/{id_venta}/registrar-cobro", response_model=PedidoResponse)
def registrar_cobro_endpoint(
    id_venta: int,
    datos:    RegistroCobro,
    db:       Session = Depends(get_db),
    actual:   dict    = Depends(requiere_permiso("editar_ventas")),
):
    """Admin/empleado registra cobro en efectivo (contra entrega o en tienda) → Estado_Pago='efectivo_recibido'."""
    registro = actual["registro"]
    return registrar_cobro_pedido(db, id_venta, datos, registro.ID_Usuario)