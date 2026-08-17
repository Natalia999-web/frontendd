from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
import re


# ── Helpers de validación de texto ────────────────────────────────────────────

def _es_basura(letras: str) -> bool:
    """
    True si la cadena (solo letras, lowercase, sin espacios) parece mashing.
    Umbral 30 %: "transportes y distribuciones" (~35 %) pasa; mashing (~10 %) no.
    'y' no cuenta como vocal.
    """
    if len(letras) <= 8:
        return False
    # < 30 % de vocales reales (a,e,i,o,u + tildadas; sin 'y')
    vowels = len(re.findall(r'[aeiouáéíóúü]', letras))
    if vowels / len(letras) < 0.30:
        return True
    # 5 o más consonantes seguidas
    if re.search(r'[^aeiouáéíóúü]{5,}', letras):
        return True
    return False


def _check_nombre(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    v = v.strip()
    if len(v) < 2:
        raise ValueError("El nombre debe tener al menos 2 caracteres")
    if len(v) > 50:
        raise ValueError("El nombre no puede superar los 50 caracteres")
    s = v.lower().replace(" ", "")
    # Un solo carácter repetido
    if len(s) > 2 and len(set(s)) == 1:
        raise ValueError("El nombre no puede ser un carácter repetido")
    # Solo letras para análisis de ratio y runs
    letras = re.sub(r'[^a-záéíóúüñ]', '', s)
    if _es_basura(letras):
        raise ValueError("El nombre no parece texto válido en español")
    return v


def _check_descripcion(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    v = v.strip()
    if len(v) < 5:
        raise ValueError("La descripción debe tener al menos 5 caracteres")
    if len(v) > 200:
        raise ValueError("La descripción no puede superar los 200 caracteres")
    s = v.lower().replace(" ", "")
    if len(s) > 2 and len(set(s)) == 1:
        raise ValueError("La descripción no puede ser un carácter repetido")
    letras = re.sub(r'[^a-záéíóúüñ]', '', s)
    if _es_basura(letras):
        raise ValueError("La descripción no parece texto válido en español")
    return v


# ── Crear categoría ──
class CategoriaInsumoCreate(BaseModel):
    Nombre_Categoria: str
    Descripcion:      Optional[str] = None
    Icono:            Optional[str] = None      # URL, ruta o emoji
    insumos_ids:      Optional[list[int]] = []  # IDs de insumos a asociar

    @field_validator("Nombre_Categoria")
    @classmethod
    def val_nombre(cls, v):
        return _check_nombre(v)

    @field_validator("Descripcion")
    @classmethod
    def val_descripcion(cls, v):
        return _check_descripcion(v)


# ── Editar categoría ──
class CategoriaInsumoUpdate(BaseModel):
    Nombre_Categoria: Optional[str] = None
    Descripcion:      Optional[str] = None
    Icono:            Optional[str] = None
    insumos_ids:      Optional[list[int]] = None

    @field_validator("Nombre_Categoria")
    @classmethod
    def val_nombre(cls, v):
        return _check_nombre(v)

    @field_validator("Descripcion")
    @classmethod
    def val_descripcion(cls, v):
        return _check_descripcion(v)


# ── Cambiar estado ON/OFF ──
class CategoriaInsumoEstado(BaseModel):
    Estado: int


# ── Insumo resumido para mostrar dentro de la categoría ──
class InsumoResumido(BaseModel):
    ID_Insumo: int
    Nombre:    str

    class Config:
        from_attributes = True


# ── Respuesta de una categoría ──
class CategoriaInsumoResponse(BaseModel):
    ID_Categoria:     int
    Nombre_Categoria: str
    Descripcion:      Optional[str] = None
    Icono:            Optional[str] = None
    Estado:           Optional[int] = None
    Fecha_creacion:   Optional[datetime] = None
    insumos:          list[InsumoResumido] = []
    total_insumos:    int = 0

    class Config:
        from_attributes = True


# ── Respuesta paginada ──
class CategoriaInsumoListResponse(BaseModel):
    total:      int
    pagina:     int
    por_pagina: int
    categorias: list[CategoriaInsumoResponse]