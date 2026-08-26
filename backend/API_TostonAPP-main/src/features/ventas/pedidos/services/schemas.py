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
    # Pago mixto: cuánto se paga de cada forma (null si no es mixto)
    monto_efectivo:       Optional[Decimal] = None
    monto_transferencia:  Optional[Decimal] = None
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
    # Pedido especial por encima del stock: bandera y anticipo del 50%
    sobre_stock:                  bool              = False
    anticipo_requerido:           Optional[Decimal] = None
    anticipo_pagado:              Optional[Decimal] = None
    # Anticipo registrado manualmente por admin (pedidos > $50.000 o preorden)
    requiere_anticipo:            bool              = False
    anticipo_monto:               Optional[Decimal] = None
    anticipo_metodo_pago:         Optional[str]     = None
    anticipo_comprobante_url:     Optional[str]     = None
    anticipo_registrado:          bool              = False
    # Pago final
    pago_final_registrado:        bool              = False
    pago_final_monto:             Optional[Decimal] = None
    pago_final_metodo_pago:       Optional[str]     = None
    pago_final_comprobante_url:   Optional[str]     = None
    pago_final_fecha:             Optional[datetime] = None
    # Estado del pago y metadatos adicionales
    estado_pago:                  Optional[str]     = None
    fecha_rechazada:              Optional[datetime] = None
    ID_Empleado:                  Optional[int]     = None
    observaciones_domicilio:      Optional[str]     = None
    Numero_Pedido:                Optional[str]     = None
    # Solo los pedidos sobre stock o de producción necesitan fecha propuesta
    requiere_fecha_propuesta:     bool              = False

    class Config:
        from_attributes = True


# ── Registrar cobro en efectivo desde el panel admin ──
class RegistroCobro(BaseModel):
    recibido: bool
    monto:    Optional[float] = None
    motivo:   Optional[str]  = None


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