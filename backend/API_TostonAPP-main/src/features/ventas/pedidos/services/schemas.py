from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal


# ── Respuesta de un pedido (hereda la misma estructura que venta) ──
class PedidoResponse(BaseModel):
    ID_Venta:             int
    ID_Usuario:           Optional[int]     = None
    nombre_cliente:       Optional[str]     = None
    correo_cliente:       Optional[str]     = None
    telefono_cliente:     Optional[str]     = None
    Total:                Optional[Decimal] = None
    subtotal_bruto:       Optional[Decimal] = None
    credito_aplicado:     Optional[Decimal] = None
    descuento_aplicado:   Optional[Decimal] = None
    Estado:               Optional[int]     = None
    estado_label:         Optional[str]     = None
    Metodo_Pago:          Optional[str]     = None
    Fecha_pedido:           Optional[datetime] = None
    Fecha_entrega_esperada: Optional[datetime] = None
    productos:              list               = []
    tiene_domicilio:              bool              = False
    ID_Domicilio:                 Optional[int]     = None
    direccion_entrega:            Optional[str]     = None
    municipio_entrega:            Optional[str]     = None
    departamento_entrega:         Optional[str]     = None
    comprobante_pago:             Optional[str]     = None
    nombre_domiciliario:          Optional[str]     = None
    ordenes_produccion_pendientes: int              = 0
    requiere_produccion:          bool              = False

    class Config:
        from_attributes = True


# ── Actualización parcial de un pedido pendiente ──
class PedidoUpdate(BaseModel):
    Metodo_Pago:          Optional[str]   = None
    Domicilio:            Optional[bool]  = None
    Direccion_Entrega:    Optional[str]   = None
    Municipio_entrega:    Optional[str]   = None
    Departamento_entrega: Optional[str]   = None
    Subtotal:             Optional[float] = None
    Descuento:            Optional[float] = None
    Total:                Optional[float] = None
    Notas:                Optional[str]   = None
    Comprobante_Pago:     Optional[str]   = None


# ── Respuesta paginada ──
class PedidoListResponse(BaseModel):
    total:      int
    pagina:     int
    por_pagina: int
    pedidos:    list[PedidoResponse]