"""Reglas de los pedidos por encima del stock (preorden + anticipo del 50%).

Cubren los puntos que NO pueden depender del frontend: el backend calcula el
déficit con el stock real, exige el anticipo sobre el total real y no acepta que
el cliente declare un pago que no hizo.
"""
import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException

from src.features.ventas.gestion_ventas.services.service import (
    PORCENTAJE_ANTICIPO_SOBRE_STOCK,
    _es_transferencia,
    _evaluar_lineas_pedido,
    requiere_fecha_propuesta,
)
from src.shared.services.models import Producto, VentaXProducto


class FakeQuery:
    """Query mínima que respeta el filtro por ID y with_for_update()."""

    def __init__(self, rows):
        self.rows = rows
        self.bloqueado = False

    def filter(self, *criterios):
        # Resuelve comparaciones del tipo Modelo.Columna == <valor> leyendo el
        # nombre de la columna y el valor del lado derecho.
        for criterio in criterios:
            columna = getattr(getattr(criterio, "left", None), "name", None)
            valor = getattr(getattr(criterio, "right", None), "value", None)
            if columna and valor is not None:
                self.rows = [r for r in self.rows
                             if getattr(r, columna, None) == valor]
        return self

    def with_for_update(self):
        self.bloqueado = True
        return self

    def first(self):
        return self.rows[0] if self.rows else None

    def all(self):
        return list(self.rows)


class FakeDB:
    def __init__(self, productos, venta_productos=None):
        self.productos = productos
        self.venta_productos = venta_productos or []
        self.queries = []

    def query(self, model):
        if model is Producto:
            q = FakeQuery(list(self.productos))
        elif model is VentaXProducto:
            q = FakeQuery(list(self.venta_productos))
        else:
            q = FakeQuery([])
        self.queries.append(q)
        return q


def producto(id_producto, stock, precio, requiere_produccion=0, nombre="Tostón"):
    return type("Producto", (), {
        "ID_Producto": id_producto,
        "nombre": nombre,
        "Stock": stock,
        "Precio_venta": Decimal(str(precio)),
        "Requiere_Produccion": requiere_produccion,
    })()


def linea(id_producto, cantidad):
    return type("Linea", (), {"ID_Producto": id_producto, "Cantidad": cantidad})()


class EvaluarLineasTests(unittest.TestCase):
    def test_stock_suficiente_no_genera_preorden(self):
        db = FakeDB([producto(1, stock=20, precio=10000)])

        lineas, subtotal = _evaluar_lineas_pedido(db, [linea(1, 5)])

        self.assertEqual(lineas[0]["preorden"], 0)
        self.assertEqual(lineas[0]["stock"], 20)
        self.assertEqual(subtotal, Decimal("50000"))

    def test_cantidad_exacta_al_stock_no_es_preorden(self):
        db = FakeDB([producto(1, stock=5, precio=10000)])

        lineas, _ = _evaluar_lineas_pedido(db, [linea(1, 5)])

        self.assertEqual(lineas[0]["preorden"], 0)

    def test_pedir_mas_que_el_stock_marca_solo_el_excedente(self):
        db = FakeDB([producto(1, stock=10, precio=10000)])

        lineas, subtotal = _evaluar_lineas_pedido(db, [linea(1, 15)])

        self.assertEqual(lineas[0]["preorden"], 5)
        self.assertEqual(lineas[0]["stock"], 10)
        # El subtotal cobra las 15 unidades, no solo las que hay en stock
        self.assertEqual(subtotal, Decimal("150000"))

    def test_producto_agotado_todo_es_preorden(self):
        db = FakeDB([producto(1, stock=0, precio=8000)])

        lineas, _ = _evaluar_lineas_pedido(db, [linea(1, 3)])

        self.assertEqual(lineas[0]["preorden"], 3)

    def test_producto_por_encargo_no_cuenta_como_preorden(self):
        # Los productos con Requiere_Produccion ya tienen su flujo de orden de
        # producción: el déficit no debe exigir anticipo por sobre stock.
        db = FakeDB([producto(1, stock=0, precio=8000, requiere_produccion=1)])

        lineas, _ = _evaluar_lineas_pedido(db, [linea(1, 4)])

        self.assertEqual(lineas[0]["preorden"], 0)

    def test_bloquea_la_fila_del_producto(self):
        # El bloqueo es lo que evita que dos pedidos simultáneos lean el mismo
        # stock y ambos crean que les alcanza.
        db = FakeDB([producto(1, stock=5, precio=1000)])

        _evaluar_lineas_pedido(db, [linea(1, 2)])

        self.assertTrue(any(q.bloqueado for q in db.queries))

    def test_producto_inexistente_es_404(self):
        db = FakeDB([producto(1, stock=5, precio=1000)])

        with self.assertRaises(HTTPException) as ctx:
            _evaluar_lineas_pedido(db, [linea(99, 1)])

        self.assertEqual(ctx.exception.status_code, 404)


class AnticipoTests(unittest.TestCase):
    """El anticipo se calcula sobre el total REAL calculado por el backend."""

    def anticipo(self, total):
        return (Decimal(str(total)) * PORCENTAJE_ANTICIPO_SOBRE_STOCK).quantize(Decimal("0.01"))

    def test_anticipo_es_la_mitad_del_total(self):
        self.assertEqual(self.anticipo(100000), Decimal("50000.00"))

    def test_anticipo_sobre_total_con_domicilio(self):
        # 150.000 en productos + 5.000 de domicilio
        self.assertEqual(self.anticipo(155000), Decimal("77500.00"))

    def test_credito_que_cubre_el_anticipo_es_suficiente(self):
        credito_aplicado = Decimal("50000")
        self.assertGreaterEqual(credito_aplicado, self.anticipo(100000))

    def test_credito_parcial_no_alcanza_el_anticipo(self):
        credito_aplicado = Decimal("25000")
        self.assertLess(credito_aplicado, self.anticipo(100000))

    def test_metodo_transferencia_detectado(self):
        self.assertTrue(_es_transferencia("Transferencia"))
        self.assertTrue(_es_transferencia("  transferencia bancaria "))
        self.assertFalse(_es_transferencia("Efectivo"))
        self.assertFalse(_es_transferencia(None))


def venta(id_venta=1, sobre_stock=0):
    return type("Venta", (), {"ID_Venta": id_venta, "Sobre_Stock": sobre_stock})()


def item_venta(id_venta, id_producto, cantidad):
    return type("VxP", (), {
        "ID_Venta": id_venta,
        "ID_Producto": id_producto,
        "Cantidad": cantidad,
    })()


class RequiereFechaPropuestaTests(unittest.TestCase):
    """Solo los pedidos que no se pueden entregar de una llevan fecha propuesta."""

    def test_pedido_normal_no_requiere_fecha(self):
        db = FakeDB(
            [producto(1, stock=20, precio=10000)],
            [item_venta(1, 1, 5)],
        )
        self.assertFalse(requiere_fecha_propuesta(db, venta()))

    def test_pedido_sobre_stock_requiere_fecha(self):
        db = FakeDB(
            [producto(1, stock=10, precio=10000)],
            [item_venta(1, 1, 15)],
        )
        self.assertTrue(requiere_fecha_propuesta(db, venta(sobre_stock=1)))

    def test_producto_por_encargo_con_deficit_requiere_fecha(self):
        db = FakeDB(
            [producto(1, stock=0, precio=10000, requiere_produccion=1)],
            [item_venta(1, 1, 4)],
        )
        self.assertTrue(requiere_fecha_propuesta(db, venta()))

    def test_producto_por_encargo_con_stock_no_requiere_fecha(self):
        db = FakeDB(
            [producto(1, stock=10, precio=10000, requiere_produccion=1)],
            [item_venta(1, 1, 4)],
        )
        self.assertFalse(requiere_fecha_propuesta(db, venta()))


if __name__ == "__main__":
    unittest.main()
