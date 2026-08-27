import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.features.ventas.gestion_ventas.services.service import _crear_ordenes_produccion_para_venta
from src.shared.services.models import OrdenProduccion, VentaXProducto, Producto


class FakeQuery:
    def __init__(self, rows):
        self.rows = rows

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.rows[0] if self.rows else None

    def order_by(self, *args, **kwargs):
        return self

    def all(self):
        return list(self.rows)

    def count(self):
        return len(self.rows)


class FakeDB:
    def __init__(self, venta_productos, productos, ordenes=None):
        self.venta_productos = venta_productos
        self.productos = productos
        self.ordenes = ordenes or []
        self.added = []

    def query(self, model):
        if model is VentaXProducto:
            return FakeQuery(self.venta_productos)
        if model is Producto:
            return FakeQuery(self.productos)
        if model is OrdenProduccion:
            return FakeQuery(self.ordenes)
        return FakeQuery([])

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        return None

    def refresh(self, obj):
        return None


class OrdenesProduccionTests(unittest.TestCase):
    def test_crea_orden_para_producto_requiere_produccion(self):
        # Cantidad_Preorden es lo que se fabrica (el déficit contra el stock);
        # sin stock coincide con lo pedido. Faltaba en este objeto y el test
        # reventaba con AttributeError contra código que estaba bien.
        venta_producto = type("VentaProducto", (), {
            "ID_Venta": 10, "ID_Producto": 6,
            "Cantidad": 2, "Cantidad_Preorden": 2,
        })()
        producto = type("Producto", (), {"ID_Producto": 6, "Requiere_Produccion": 1, "Stock": 0})()
        db = FakeDB([venta_producto], [producto])

        _crear_ordenes_produccion_para_venta(db, 10, "2026-01-01")

        self.assertEqual(len(db.added), 1)
        orden = db.added[0]
        self.assertEqual(orden.ID_Venta, 10)
        self.assertEqual(orden.ID_Producto, 6)
        self.assertEqual(orden.Cantidad, 2)
        self.assertEqual(orden.Estado, 1)


if __name__ == "__main__":
    unittest.main()
