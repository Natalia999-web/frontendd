from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal


# ── URLs de imágenes desde Cloudinary ──
class ImagenesUrlInput(BaseModel):
    urls: list[str]


# ── Insumo dentro de ficha técnica ──
class FichaTecnicaInsumoInput(BaseModel):
    ID_Insumo: int
    Cantidad:  Optional[Decimal] = None
    Unidad:    Optional[str] = None


class FichaTecnicaInsumoResponse(BaseModel):
    ID_Ficha_Insumo: int
    ID_Insumo:       int
    nombre_insumo:   Optional[str] = None
    ID_Categoria:    Optional[int] = None
    nombre_categoria: Optional[str] = None
    Cantidad:        Optional[Decimal] = None
    Unidad:          Optional[str] = None

    class Config:
        from_attributes = True


# ── Ficha técnica opcional al crear producto ──
class FichaTecnicaInput(BaseModel):
    Version:        Optional[str] = None
    Observaciones:  Optional[str] = None
    Procedimiento:  Optional[str] = None
    Estado:         Optional[int] = None
    Dias_Vida_Util: Optional[int] = None
    insumos:        Optional[list[FichaTecnicaInsumoInput]] = None


# ── Crear producto ──
class ProductoCreate(BaseModel):
    nombre:            str
    ID_Categoria:      int
    Precio_venta:      Decimal
    Stock:             int
    Stock_Minimo:      int
    Publicado:         Optional[int] = 0
    Descripcion_Corta: Optional[str] = None
    Descripcion_Larga: Optional[str] = None
    ficha_tecnica:        Optional[FichaTecnicaInput] = None
    Requiere_Produccion:  Optional[int] = 0


# ── Editar producto ──
class ProductoUpdate(BaseModel):
    nombre:            Optional[str]     = None
    ID_Categoria:      Optional[int]     = None
    Precio_venta:      Optional[Decimal] = None
    Stock:             Optional[int]     = None
    Stock_Minimo:      Optional[int]     = None
    Publicado:         Optional[int]     = None
    Descripcion_Corta:   Optional[str]     = None
    Descripcion_Larga:   Optional[str]     = None
    Requiere_Produccion: Optional[int]     = None


# ── Respuesta de imagen ──
class ImagenResponse(BaseModel):
    ID_Producto_Img: int
    url:             Optional[str] = None   # ruta para acceder a la imagen

    class Config:
        from_attributes = True


# ── Respuesta de ficha técnica resumida ──
class FichaTecnicaResumida(BaseModel):
    ID_Ficha:       int
    Version:        Optional[str] = None
    Observaciones:  Optional[str] = None
    Procedimiento:  Optional[str] = None
    Estado:         Optional[int] = None
    Fecha_Creacion: Optional[datetime] = None
    Dias_Vida_Util: Optional[int] = None
    insumos:        list[FichaTecnicaInsumoResponse] = []

    class Config:
        from_attributes = True


# ── Respuesta de un producto ──
class ProductoResponse(BaseModel):
    ID_Producto:       int
    nombre:            str
    ID_Categoria:      Optional[int]     = None
    nombre_categoria:  Optional[str]     = None
    icono_categoria:   Optional[str]     = None
    Precio_venta:      Optional[Decimal] = None
    Stock:             Optional[int]     = None
    Stock_Minimo:      Optional[int]     = None
    Estado:            Optional[int]     = None
    estado_label:      Optional[str]     = None
    Publicado:         Optional[int]     = 0
    Descripcion_Corta:   Optional[str]     = None
    Descripcion_Larga:   Optional[str]     = None
    Requiere_Produccion: Optional[int]     = 0
    imagenes:            list[ImagenResponse] = []
    ficha_tecnica:     Optional[FichaTecnicaResumida] = None

    class Config:
        from_attributes = True


# ── Respuesta paginada ──
class ProductoListResponse(BaseModel):
    total:      int
    pagina:     int
    por_pagina: int
    productos:  list[ProductoResponse]