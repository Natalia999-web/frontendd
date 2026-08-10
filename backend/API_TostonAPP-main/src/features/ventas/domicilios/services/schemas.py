from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


# -- Crear domicilio --
class DomicilioCreate(BaseModel):
    ID_Venta:             int
    ID_Empleado:          Optional[int] = None
    Direccion_entrega:    str
    Municipio_entrega:    str
    Departamento_entrega: str
    Observaciones:        Optional[str] = None
    Fecha_entrega:        Optional[datetime] = None


# -- Editar domicilio --
class DomicilioUpdate(BaseModel):
    Direccion_entrega:    Optional[str]      = None
    Municipio_entrega:    Optional[str]      = None
    Departamento_entrega: Optional[str]      = None
    Observaciones:        Optional[str]      = None
    Fecha_entrega:        Optional[datetime] = None


# -- Asignar repartidor --
class AsignarRepartidor(BaseModel):
    ID_Empleado: int


# -- Cambiar estado --
class DomicilioEstado(BaseModel):
    Estado:        int
    Observaciones: Optional[str] = None  # comentario del repartidor al cambiar estado


# -- Respuesta de un domicilio --
class DomicilioResponse(BaseModel):
    ID_Domicilio:         int
    ID_Venta:             Optional[int]      = None
    nombre_cliente:       Optional[str]      = None
    ID_Empleado:          Optional[int]      = None
    nombre_repartidor:    Optional[str]      = None
    Fecha_asignacion:     Optional[datetime] = None
    Fecha_entrega:        Optional[datetime] = None
    Observaciones:        Optional[str]      = None
    indicaciones_cliente: Optional[str]      = None
    Estado:               Optional[int]      = None
    estado_label:         Optional[str]      = None
    Direccion_entrega:    Optional[str]      = None
    Municipio_entrega:    Optional[str]      = None
    Departamento_entrega: Optional[str]      = None
    total:                Optional[float]    = None
    metodo_pago:          Optional[str]      = None
    productos:            Optional[List[Any]] = None
    telefono_cliente:     Optional[str]      = None

    class Config:
        from_attributes = True


# -- Respuesta paginada --
class DomicilioListResponse(BaseModel):
    total:      int
    pagina:     int
    por_pagina: int
    domicilios: list[DomicilioResponse]


# -- OTP --
class OTPVerify(BaseModel):
    codigo: str


# -- Chat --
class MensajeCreate(BaseModel):
    Contenido: str


class MensajeResponse(BaseModel):
    ID_Mensaje:       int
    ID_Domicilio:     int
    Tipo_Remitente:   str
    ID_Remitente:     int
    Nombre_Remitente: Optional[str] = None
    Contenido:        str
    Fecha:            Optional[datetime] = None
