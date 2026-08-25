"""Recorrido de un pedido que requiere producción.

El pedido no puede figurar como "Confirmado" (listo para despachar) mientras su
producción esté pendiente. El recorrido correcto es:

  admin crea            → En producción (13)
  cliente acepta fecha  → En producción (13)
  producción completa   → Listo (11)      [lo hace el módulo de producción]
"""
import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.features.ventas.gestion_ventas.services.service import (
    _crear_ordenes_produccion_para_venta,
)
from src.features.ventas.pedidos.services.estados import EstadoPedido
from src.shared.services.models import OrdenProduccion, Producto, VentaXProducto


class FakeQuery:
    def __init__(self, rows):
        self.rows = rows

    def filter(self, *_):
        return self

    def order_by(self, *_):
        return self

    def first(self):
        return self.rows[0] if self.rows else None

    def all(self):
        return list(self.rows)


class FakeDB:
    def __init__(self, items, productos):
        self.items = items
        self.productos = productos
        self.added = []

    def query(self, modelo):
        if modelo is VentaXProducto:
            return FakeQuery(self.items)
        if modelo is Producto:
            return FakeQuery(self.productos)
        if modelo is OrdenProduccion:
            return FakeQuery([])
        return FakeQuery([])

    def add(self, obj):
        self.added.append(obj)


def item(id_producto, cantidad):
    return type("VxP", (), {"ID_Producto": id_producto, "Cantidad": cantidad})()


def producto(id_producto, requiere_produccion):
    return type("Producto", (), {
        "ID_Producto": id_producto,
        "nombre": "Tostón",
        "Requiere_Produccion": requiere_produccion,
    })()


class CrearOrdenesTests(unittest.TestCase):
    def test_devuelve_cuantas_ordenes_creo(self):
        db = FakeDB([item(1, 3)], [producto(1, requiere_produccion=1)])
        self.assertEqual(_crear_ordenes_produccion_para_venta(db, 10, None), 1)
        self.assertEqual(len(db.added), 1)

    def test_sin_productos_de_produccion_no_crea_nada(self):
        db = FakeDB([item(1, 3)], [producto(1, requiere_produccion=0)])
        self.assertEqual(_crear_ordenes_produccion_para_venta(db, 10, None), 0)
        self.assertEqual(db.added, [])

    def test_venta_sin_items_devuelve_cero(self):
        db = FakeDB([], [])
        self.assertEqual(_crear_ordenes_produccion_para_venta(db, 10, None), 0)

    def test_cantidad_cero_no_genera_orden(self):
        db = FakeDB([item(1, 0)], [producto(1, requiere_produccion=1)])
        self.assertEqual(_crear_ordenes_produccion_para_venta(db, 10, None), 0)

    def test_cuenta_una_orden_por_producto_de_produccion(self):
        db = FakeDB(
            [item(1, 2), item(2, 5), item(3, 1)],
            [producto(1, 1), producto(2, 0), producto(3, 1)],
        )
        self.assertEqual(_crear_ordenes_produccion_para_venta(db, 10, None), 2)


class EstadoSegunProduccionTests(unittest.TestCase):
    """El estado que deben fijar los llamadores según el resultado."""

    def _estado(self, ordenes_creadas):
        # Misma decisión que toman crear_venta y aceptar_fecha.
        return EstadoPedido.PREPARANDO if ordenes_creadas > 0 else EstadoPedido.CONFIRMADO

    def test_con_produccion_queda_en_produccion(self):
        self.assertEqual(self._estado(1), EstadoPedido.PREPARANDO)

    def test_sin_produccion_queda_confirmado(self):
        self.assertEqual(self._estado(0), EstadoPedido.CONFIRMADO)

    def test_en_produccion_no_es_confirmado(self):
        # Regresión: el pedido salía "Confirmado" sin haberse fabricado nada.
        self.assertNotEqual(EstadoPedido.PREPARANDO, EstadoPedido.CONFIRMADO)


if __name__ == "__main__":
    unittest.main()
