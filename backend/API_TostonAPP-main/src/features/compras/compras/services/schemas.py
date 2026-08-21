from pydantic import BaseModel, model_validator
from typing import Optional
from datetime import datetime
from decimal import Decimal

METODOS_PAGO_COMPRA = {"Efectivo", "Transferencia", "Crédito", "Cheque"}

CANT_MAX   = Decimal("10000")
TOTAL_MIN  = Decimal("1000")
TOTAL_MAX  = Decimal("50000000")


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
    Cantidad:          Decimal   # Decimal para soportar kg, g, L, mL
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
            if d.Cantidad > CANT_MAX:
                raise ValueError(
                    f"La cantidad del insumo {d.ID_Insumo} supera el máximo permitido "
                    f"({int(CANT_MAX):,} unidades por línea)"
                )
            if d.Precio_Und <= 0:
                raise ValueError(f"El precio unitario del insumo {d.ID_Insumo} debe ser mayor a cero")

        # Recalcular total en el backend — no confiar en el valor enviado por el frontend
        subtotal  = sum(d.Cantidad * d.Precio_Und for d in self.detalles)
        transporte = Decimal(str(self.Costo_Transporte or 0))
        iva_val   = subtotal * Decimal(str(self.IVA_Porcentaje or 0)) / 100
        desc_val  = subtotal * Decimal(str(self.Descuento_Porcentaje or 0)) / 100
        otros     = Decimal(str(self.Otros_Costos or 0))
        total     = subtotal + transporte + iva_val - desc_val + otros

        if total < TOTAL_MIN:
            raise ValueError(
                f"El total de la compra (${total:,.0f} COP) debe ser al menos "
                f"${int(TOTAL_MIN):,} COP"
            )
        if total > TOTAL_MAX:
            raise ValueError(
                f"El total de la compra (${total:,.0f} COP) supera el máximo permitido "
                f"(${int(TOTAL_MAX):,} COP)"
            )
        return self


# ── Respuesta de un detalle ──
class DetalleCompraResponse(BaseModel):
    ID_Detalle_Compra: int
    ID_Insumo:         Optional[int]     = None
    nombre_insumo:     Optional[str]     = None
    ID_Lote_Compra:    Optional[int]     = None
    Cantidad:          Optional[Decimal]  = None
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
