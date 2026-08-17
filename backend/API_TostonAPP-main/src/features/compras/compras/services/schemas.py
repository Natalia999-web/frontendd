from pydantic import BaseModel, model_validator
from typing import Optional
from datetime import datetime
from decimal import Decimal

METODOS_PAGO_COMPRA = {"Efectivo", "Transferencia", "Crédito", "Cheque"}


# ── Completar compra (body opcional) ──
class CompletarCompraInput(BaseModel):
    Fecha_Llegada: Optional[datetime] = None


# ── Editar compra ──
class CompraUpdate(BaseModel):
    ID_Proveedor:  Optional[int]      = None
    Metodo_Pago:   Optional[str]      = None
    Fecha_Compra:  Optional[datetime] = None
    Notas:         Optional[str]      = None
    Departamento:  Optional[str]      = None
    Municipio:     Optional[str]      = None
    Fecha_Llegada: Optional[datetime] = None

    @model_validator(mode="after")
    def validar_metodo(self):
        if self.Metodo_Pago and self.Metodo_Pago not in METODOS_PAGO_COMPRA:
            raise ValueError(f"Método de pago inválido. Opciones: {', '.join(sorted(METODOS_PAGO_COMPRA))}")
        return self


# ── Detalle de un ítem dentro de la compra ──
class DetalleCompraInput(BaseModel):
    ID_Insumo:         int
    Cantidad:          int
    Precio_Und:        Decimal
    Notas:             Optional[str] = None
    Fecha_Vencimiento: Optional[datetime] = None  # para crear el LoteCompra


# ── Crear compra ──
class CompraCreate(BaseModel):
    ID_Proveedor:         int
    Metodo_Pago:          str                       # ver METODOS_PAGO_COMPRA
    Fecha_Compra:         Optional[datetime] = None # si no se envía, se usa datetime.now()
    Notas:                Optional[str]     = None
    Costo_Transporte:     Optional[Decimal] = None
    IVA_Porcentaje:       Optional[Decimal] = None
    Descuento_Porcentaje: Optional[Decimal] = None
    Otros_Costos:         Optional[Decimal] = None
    detalles:             list[DetalleCompraInput]

    @model_validator(mode="after")
    def validar_campos(self):
        if self.Metodo_Pago not in METODOS_PAGO_COMPRA:
            opciones = ", ".join(sorted(METODOS_PAGO_COMPRA))
            raise ValueError(f"Método de pago inválido. Opciones: {opciones}")
        if not self.detalles:
            raise ValueError("La compra debe tener al menos un ítem en detalles")
        for d in self.detalles:
            if d.Cantidad <= 0:
                raise ValueError(f"La cantidad del insumo {d.ID_Insumo} debe ser mayor a cero")
            # Techo 100 000 unidades: una mipyme no compra más que esto en un pedido
            if d.Cantidad > 100_000:
                raise ValueError(f"La cantidad del insumo {d.ID_Insumo} supera el máximo permitido (100 000)")
            if d.Precio_Und <= 0:
                raise ValueError(f"El precio unitario del insumo {d.ID_Insumo} debe ser mayor a cero")
            # Piso $50 COP: cualquier insumo cuesta al menos esto en Colombia
            if d.Precio_Und < Decimal("50"):
                raise ValueError(f"El precio unitario del insumo {d.ID_Insumo} debe ser al menos $50 COP")
            # Techo $10 000 000 COP/unit: superar esto es un error de digitación
            if d.Precio_Und > Decimal("10000000"):
                raise ValueError(f"El precio unitario del insumo {d.ID_Insumo} supera el máximo permitido ($10 000 000 COP)")
        return self


# ── Respuesta de un detalle ──
class DetalleCompraResponse(BaseModel):
    ID_Detalle_Compra: int
    ID_Insumo:         Optional[int]     = None
    nombre_insumo:     Optional[str]     = None
    ID_Lote_Compra:    Optional[int]     = None
    Cantidad:          Optional[int]     = None
    Precio_Und:        Optional[Decimal] = None
    Notas:             Optional[str]     = None
    Fecha_Vencimiento: Optional[str]     = None

    class Config:
        from_attributes = True


# ── Respuesta de una compra ──
class CompraResponse(BaseModel):
    ID_Compra:            int
    ID_Proveedor:         Optional[int]      = None
    nombre_proveedor:     Optional[str]      = None
    Total_Pago:           Optional[Decimal]  = None
    Fecha_Compra:         Optional[datetime] = None
    Fecha_Llegada:        Optional[datetime] = None
    Estado:               Optional[int]      = None
    estado_label:         Optional[str]      = None
    Metodo_Pago:          Optional[str]      = None
    Notas:                Optional[str]      = None
    Costo_Transporte:     Optional[Decimal]  = None
    IVA_Porcentaje:       Optional[Decimal]  = None
    Descuento_Porcentaje: Optional[Decimal]  = None
    Otros_Costos:         Optional[Decimal]  = None
    detalles:             list[DetalleCompraResponse] = []

    class Config:
        from_attributes = True


# ── Respuesta paginada ──
class CompraListResponse(BaseModel):
    total:      int
    pagina:     int
    por_pagina: int
    compras:    list[CompraResponse]
