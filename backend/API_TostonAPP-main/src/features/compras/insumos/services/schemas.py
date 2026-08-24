from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
import re as _re


def _check_insumo_nombre(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    v = v.strip()
    if len(v) < 2:
        raise ValueError("El nombre debe tener al menos 2 caracteres")
    if len(v) > 50:
        raise ValueError("El nombre no puede superar los 50 caracteres")
    s = v.lower().replace(" ", "")
    if len(s) > 2 and len(set(s)) == 1:
        raise ValueError("El nombre no puede ser un carácter repetido")
    letras = _re.sub(r'[^a-záéíóúüñ]', '', s)
    if len(letras) > 8:
        vowels = len(_re.findall(r'[aeiouáéíóúü]', letras))
        if vowels / len(letras) < 0.30:
            raise ValueError("El nombre no parece texto válido en español")
        if _re.search(r'[^aeiouáéíóúü]{5,}', letras):
            raise ValueError("El nombre no parece texto válido en español")
    return v


# ── Lote de compra opcional al crear insumo ──
class LoteCompraInput(BaseModel):
    ID_Lote_Compra:   Optional[str] = None      # ej: "L-001"
    Fecha_Vencimiento: Optional[datetime] = None
    Cantidad_Inicial:  Optional[int] = None


# ── Crear insumo ──
class InsumoCreate(BaseModel):
    Nombre:        str
    ID_Categoria:  int
    Unidad_Medida: int
    Stock_Actual:  int
    Stock_Minimo:  int
    Lote_Compra:   Optional[LoteCompraInput] = None

    @field_validator("Nombre")
    @classmethod
    def val_nombre(cls, v):
        return _check_insumo_nombre(v)


# ── Editar insumo ──
class InsumoUpdate(BaseModel):
    Nombre:        Optional[str] = None
    ID_Categoria:  Optional[int] = None
    Unidad_Medida: Optional[int] = None
    Stock_Actual:  Optional[int] = None
    Stock_Minimo:  Optional[int] = None

    @field_validator("Nombre")
    @classmethod
    def val_nombre(cls, v):
        return _check_insumo_nombre(v)


# ── Cambiar estado ON/OFF ──
class InsumoEstado(BaseModel):
    Estado: int


# ── Respuesta del lote ──
class LoteCompraResponse(BaseModel):
    ID_Lote_Compra:    int
    Fecha_Vencimiento: Optional[datetime] = None
    Cantidad_Inicial:  Optional[int] = None
    Estado:            Optional[int] = None

    class Config:
        from_attributes = True


# ── Respuesta de un insumo ──
class InsumoResponse(BaseModel):
    ID_Insumo:               int
    Nombre:                  str
    ID_Categoria:            Optional[int] = None
    nombre_categoria:        Optional[str] = None
    Unidad_Medida:           Optional[int] = None
    simbolo_unidad:          Optional[str] = None
    Stock_Actual:            Optional[float] = None
    Stock_Minimo:            Optional[int] = None
    Estado:                  Optional[int] = None
    proximo_vencimiento:     Optional[str] = None
    dias_para_vencer:        Optional[int] = None
    lote_id:                 Optional[int] = None
    tiene_ficha_tecnica:     Optional[bool] = None
    tiene_orden_produccion:  Optional[bool] = None
    tiene_compra:            Optional[bool] = None

    class Config:
        from_attributes = True


# ── Resumen para las tarjetas del tope de la página ──
class ResumenInsumos(BaseModel):
    total:       int
    disponibles: int     # stock_actual > stock_minimo
    stock_bajo:  int     # stock_actual <= stock_minimo y > 0
    agotados:    int     # stock_actual == 0


# ── Respuesta paginada ──
class InsumoListResponse(BaseModel):
    resumen:    ResumenInsumos
    total:      int
    pagina:     int
    por_pagina: int
    insumos:    list[InsumoResponse]