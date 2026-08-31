from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal


# ── Detalle de producto a devolver ──
class DevolucionDetalleInput(BaseModel):
    ID_Producto:    int
    Cantidad:       int
    PrecioUnitario: Decimal


# ── Crear devolución (manual o desde venta) ──
class DevolucionCreate(BaseModel):
    ID_Venta:           int
    ID_Usuario:         Optional[int] = None         # inyectado desde el token en el router
    ID_DetalleVenta:    Optional[int] = None
    Motivo:             str
    Comentario:         Optional[str] = None
    Comprobante_Imagen: Optional[str] = None
    productos:          list[DevolucionDetalleInput]


# ── Editar devolución pendiente (admin) ──
class DevolucionUpdate(BaseModel):
    Motivo:     Optional[str] = None
    Comentario: Optional[str] = None


# ── Aprobar o rechazar devolución ──
class DevolucionResolucion(BaseModel):
    Estado:         int         # ID del estado: Aprobada o Rechazada
    Comentario:     Optional[str] = None
    UsuarioAprueba: bool = True


# ── Registrar reembolso (solo si fue aprobada) ──
class DevolucionReembolso(BaseModel):
    FechaReembolso: datetime


# ── Respuesta de un detalle ──
class DevolucionDetalleResponse(BaseModel):
    ID_Devolucion_Detalle: int
    ID_Producto:           int
    nombre_producto:       Optional[str]    = None
    Cantidad:              int
    PrecioUnitario:        Optional[Decimal] = None
    Subtotal:              Optional[Decimal] = None

    class Config:
        from_attributes = True


# ── Respuesta de una devolución ──
class DevolucionResponse(BaseModel):
    ID_Devolucion:   int
    ID_Venta:        Optional[int]      = None
    ID_Usuario:      Optional[int]      = None
    nombre_cliente:  Optional[str]      = None
    ID_DetalleVenta: Optional[int]      = None
    FechaDevolucion: Optional[datetime] = None
    Motivo:          Optional[str]      = None
    Estado:          Optional[int]      = None
    estado_label:    Optional[str]      = None
    TotalDevuelto:   Optional[Decimal]  = None
    FechaAprobacion: Optional[datetime] = None
    FechaReembolso:  Optional[datetime] = None
    UsuarioAprueba:  Optional[bool]     = None
    Comentario:      Optional[str]      = None
    Comprobante_Imagen: Optional[str]   = None
    productos:       list[DevolucionDetalleResponse] = []

    class Config:
        from_attributes = True


# ── Respuesta paginada ──
class DevolucionListResponse(BaseModel):
    total:               int
    pagina:              int
    por_pagina:          int
    devoluciones:        list[DevolucionResponse]
    totales_por_estado:  dict[str, int] = {}