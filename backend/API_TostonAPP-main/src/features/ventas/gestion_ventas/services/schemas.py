from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


# ── Producto dentro de una venta ──
class ProductoVentaInput(BaseModel):
    ID_Producto: int = Field(..., gt=0)
    Cantidad:    int = Field(..., gt=0)


# ── Domicilio opcional al crear venta ──
class DomicilioVentaInput(BaseModel):
    Direccion_entrega:    str
    Municipio_entrega:    str
    Departamento_entrega: str
    Observaciones:        Optional[str]      = None
    Fecha_entrega:        Optional[datetime] = None
    ID_Empleado:          Optional[int]      = None  # repartidor


# ── Crear venta ──
class VentaCreate(BaseModel):
    ID_Usuario:             int
    Metodo_Pago:            str                              # "Efectivo", "Transferencia", "Contra entrega"
    A_Nombre_De:            Optional[str]       = None
    productos:              list[ProductoVentaInput]
    codigo_descuento:       Optional[str]       = None
    usar_credito:           bool                = False
    domicilio:              Optional[DomicilioVentaInput] = None
    comprobante_pago:       Optional[str]       = None
    Fecha_entrega_esperada: Optional[datetime]  = None      # cuándo quiere recibir/recoger el pedido
    creado_por_admin:       bool                = False     # si True: nace en Confirmado (4) con orden de producción


# ── Cambiar estado de venta ──
class VentaEstado(BaseModel):
    Estado: int


# ── Proponer fecha de entrega ──
class FechaEntregaInput(BaseModel):
    fecha_entrega: datetime


# ── Respuesta de producto en venta ──
class ProductoVentaResponse(BaseModel):
    ID_Producto:     int
    nombre_producto: Optional[str]    = None
    Cantidad:        int
    precio_unitario: Optional[Decimal] = None
    subtotal:        Optional[Decimal] = None
    imagen:          Optional[str]     = None
    # Unidades pedidas por encima del stock (preorden) y stock actual del producto
    cantidad_preorden: int = 0
    stock_disponible:  int = 0


# ── Respuesta de una venta ──
class VentaResponse(BaseModel):
    ID_Venta:               int
    ID_Usuario:             Optional[int]      = None
    nombre_cliente:         Optional[str]      = None
    Total:                  Optional[Decimal]  = None
    subtotal_bruto:         Optional[Decimal]  = None
    credito_aplicado:       Optional[Decimal]  = None
    descuento_aplicado:     Optional[Decimal]  = None
    Estado:                 Optional[int]      = None
    estado_label:           Optional[str]      = None
    Metodo_Pago:            Optional[str]      = None
    Fecha_Venta:            Optional[datetime] = None
    Fecha_pedido:           Optional[datetime] = None
    Fecha_entrega:          Optional[datetime] = None
    Fecha_entrega_esperada: Optional[datetime] = None
    productos:              list[ProductoVentaResponse] = []
    tiene_domicilio:        bool               = False
    ID_Domicilio:           Optional[int]      = None
    comprobante_pago:       Optional[str]      = None
    # Pedido especial por encima del stock: bandera y anticipo del 50%
    sobre_stock:            bool               = False
    anticipo_requerido:     Optional[Decimal]  = None
    anticipo_pagado:        Optional[Decimal]  = None
    # Solo los pedidos sobre stock o de producción necesitan fecha propuesta
    requiere_fecha_propuesta: bool             = False
    requiere_produccion:      bool             = False

    class Config:
        from_attributes = True


# ── Respuesta paginada ──
class VentaListResponse(BaseModel):
    total:      int
    pagina:     int
    por_pagina: int
    ventas:     list[VentaResponse]