from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NotificacionResponse(BaseModel):
    ID_Notificacion: int
    Tipo:            str
    Titulo:          str
    Mensaje:         Optional[str] = None
    Referencia_ID:   Optional[int] = None
    Ruta:            Optional[str] = None
    Fecha:           datetime
    Leida:           bool

    class Config:
        from_attributes = True


class NotificacionesResponse(BaseModel):
    total:           int
    total_no_leidas: int
    notificaciones:  list[NotificacionResponse]


# ── Notificaciones derivadas para clientes ──────────────────
class NotificacionClienteItem(BaseModel):
    id_ref:        str
    tipo:          str
    titulo:        str
    mensaje:       Optional[str]      = None
    ruta:          Optional[str]      = None
    fecha:         Optional[datetime] = None
    id_venta:      Optional[int]      = None
    fecha_entrega: Optional[str]      = None


class NotificacionesClienteResponse(BaseModel):
    total:          int
    notificaciones: list[NotificacionClienteItem]
