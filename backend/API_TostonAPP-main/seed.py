"""
seed_permisos.py
Siembra todos los permisos del sistema en la tabla Permisos.
Ejecutar una sola vez (o es idempotente: no duplica si ya existen).

Uso:
    python seed_permisos.py
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.shared.services.database import SessionLocal
from src.shared.services.models import Permiso

PERMISOS = [
    # ── Dashboard ──
    ("ver_dashboard",               "Ver el panel de métricas y estadísticas"),

    # ── Roles ──
    ("ver_roles",                   "Ver listado y detalle de roles"),
    ("crear_roles",                 "Crear nuevos roles"),
    ("editar_roles",                "Editar roles y asignar permisos"),
    ("eliminar_roles",              "Eliminar roles"),

    # ── Usuarios ──
    ("ver_usuarios",                "Ver listado y detalle de usuarios"),
    ("crear_usuarios",              "Crear nuevos usuarios"),
    ("editar_usuarios",             "Editar información de usuarios"),
    ("eliminar_usuarios",           "Eliminar usuarios"),

    # ── Salidas ──
    ("ver_salidas",                 "Ver listado y detalle de salidas de inventario"),
    ("crear_salidas",               "Registrar nuevas salidas"),
    ("editar_salidas",              "Editar salidas registradas"),
    ("eliminar_salidas",            "Eliminar salidas"),

    # ── Categoría Insumos ──
    ("ver_cat_insumos",             "Ver categorías de insumos"),
    ("crear_cat_insumos",           "Crear categorías de insumos"),
    ("editar_cat_insumos",          "Editar categorías de insumos"),
    ("eliminar_cat_insumos",        "Eliminar categorías de insumos"),

    # ── Insumos ──
    ("ver_insumos",                 "Ver listado y detalle de insumos"),
    ("crear_insumos",               "Crear nuevos insumos"),
    ("editar_insumos",              "Editar insumos"),
    ("eliminar_insumos",            "Eliminar insumos"),
    ("generar_salida_insumo",       "Generar una salida directa desde un insumo"),

    # ── Proveedores ──
    ("ver_proveedores",             "Ver listado y detalle de proveedores"),
    ("crear_proveedores",           "Crear nuevos proveedores"),
    ("editar_proveedores",          "Editar proveedores"),
    ("eliminar_proveedores",        "Eliminar proveedores"),

    # ── Compras ──
    ("ver_compras",                 "Ver listado y detalle de compras"),
    ("crear_compras",               "Registrar nuevas compras"),
    ("editar_compras",              "Editar compras"),
    ("anular_compras",              "Anular compras (no elimina, cambia estado)"),

    # ── Categoría Productos ──
    ("ver_cat_productos",           "Ver categorías de productos"),
    ("crear_cat_productos",         "Crear categorías de productos"),
    ("editar_cat_productos",        "Editar categorías de productos"),
    ("eliminar_cat_productos",      "Eliminar categorías de productos"),

    # ── Productos ──
    ("ver_productos",               "Ver listado y detalle de productos"),
    ("crear_productos",             "Crear nuevos productos"),
    ("editar_productos",            "Editar productos"),
    ("eliminar_productos",          "Eliminar productos"),
    ("generar_salida_producto",     "Generar una salida directa desde un producto"),

    # ── Órdenes de Producción ──
    ("ver_ordenes",                 "Ver listado y detalle de órdenes de producción"),
    ("crear_ordenes",               "Crear nuevas órdenes de producción"),
    ("editar_ordenes",              "Editar órdenes de producción"),
    ("eliminar_ordenes",            "Eliminar órdenes de producción"),

    # ── Pedidos ──
    ("ver_pedidos",                 "Ver listado y detalle de pedidos"),
    ("crear_pedidos",               "Crear nuevos pedidos"),
    ("editar_pedidos",              "Editar pedidos"),
    ("eliminar_pedidos",            "Eliminar pedidos"),

    # ── Ventas ──
    ("ver_ventas",                  "Ver listado y detalle de ventas"),
    ("crear_ventas",                "Registrar nuevas ventas"),
    ("editar_ventas",               "Editar ventas"),
    ("eliminar_ventas",             "Eliminar ventas"),

    # ── Devoluciones ──
    ("ver_devoluciones",            "Ver listado y detalle de devoluciones"),
    ("crear_devoluciones",          "Registrar nuevas devoluciones"),
    ("editar_devoluciones",         "Editar devoluciones"),
    ("eliminar_devoluciones",       "Eliminar devoluciones"),
    ("aprobar_devoluciones",        "Aprobar o desaprobar solicitudes de devolución"),

    # ── Domicilios ──
    ("ver_domicilios",              "Ver listado de domicilios"),
    ("ver_detalle_domicilios",      "Ver el detalle completo de un domicilio"),
    ("cambiar_estado_domicilios",   "Cambiar el estado de un domicilio"),

    # ── Landing Page ──
    ("ver_landing_page",            "Ver la landing page pública"),
    ("editar_landing_page",         "Editar el contenido de la landing page"),

    # ── Liquidaciones ──
    ("ver_liquidaciones",           "Ver listado y detalle de liquidaciones"),
    ("crear_liquidaciones",         "Registrar nuevas liquidaciones"),
    ("editar_liquidaciones",        "Editar liquidaciones"),
    ("eliminar_liquidaciones",      "Eliminar liquidaciones"),
    ("anular_liquidaciones",        "Anular liquidaciones"),
]


def sembrar_permisos():
    db = SessionLocal()
    try:
        existentes = {p.Permiso for p in db.query(Permiso).all()}
        nuevos = 0

        for nombre, descripcion in PERMISOS:
            if nombre not in existentes:
                db.add(Permiso(Permiso=nombre, Descripcion=descripcion))
                nuevos += 1

        db.commit()
        print(f"✅ {nuevos} permiso(s) nuevo(s) sembrado(s). {len(existentes)} ya existían.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error al sembrar permisos: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    sembrar_permisos()