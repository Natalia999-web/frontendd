"""Saldo a favor: el cliente elige cuánto gasta, el servidor pone el techo.

El monto que llega del checkout es un tope, nunca un permiso. Lo que se
descuenta sigue saliendo del saldo real y del total real del pedido.
"""
import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.features.ventas.gestion_ventas.services.service import _aplicar_credito
from src.shared.services.models import CreditoCliente


class FakeQuery:
    def __init__(self, filas):
        self.filas = filas
        self.bloqueado = False

    def filter(self, *_criterios):
        return self

    def with_for_update(self):
        self.bloqueado = True
        return self

    def first(self):
        return self.filas[0] if self.filas else None


class FakeDB:
    def __init__(self, credito):
        self.credito = credito
        self.agregados = []
        self.ultima_query = None

    def query(self, _modelo):
        self.ultima_query = FakeQuery([self.credito] if self.credito else [])
        return self.ultima_query

    def add(self, obj):
        self.agregados.append(obj)


def credito(saldo):
    return CreditoCliente(ID_Credito=1, ID_Usuario=7, Saldo=Decimal(str(saldo)))


class AplicarSaldoAFavorTests(unittest.TestCase):

    def test_sin_tope_gasta_todo_lo_que_alcanza(self):
        """Comportamiento de siempre: el checkout que solo dice "sí" no cambia."""
        db = FakeDB(credito(30000))
        usado = _aplicar_credito(db, 7, Decimal("50000"), 1)
        self.assertEqual(usado, Decimal("30000"))
        self.assertEqual(db.credito.Saldo, Decimal("0"))

    def test_el_tope_recorta_lo_que_se_descuenta(self):
        db = FakeDB(credito(30000))
        usado = _aplicar_credito(db, 7, Decimal("50000"), 1, Decimal("12000"))
        self.assertEqual(usado, Decimal("12000"))
        self.assertEqual(db.credito.Saldo, Decimal("18000"))

    def test_el_tope_no_puede_pedir_mas_saldo_del_que_hay(self):
        db = FakeDB(credito(8000))
        usado = _aplicar_credito(db, 7, Decimal("50000"), 1, Decimal("999999"))
        self.assertEqual(usado, Decimal("8000"))

    def test_el_tope_no_puede_pasarse_del_total_del_pedido(self):
        db = FakeDB(credito(90000))
        usado = _aplicar_credito(db, 7, Decimal("20000"), 1, Decimal("90000"))
        self.assertEqual(usado, Decimal("20000"))

    def test_tope_en_cero_no_toca_el_saldo_ni_deja_movimiento(self):
        db = FakeDB(credito(30000))
        usado = _aplicar_credito(db, 7, Decimal("50000"), 1, Decimal("0"))
        self.assertEqual(usado, Decimal("0"))
        self.assertEqual(db.credito.Saldo, Decimal("30000"))
        self.assertEqual(db.agregados, [])

    def test_tope_negativo_se_trata_como_cero(self):
        db = FakeDB(credito(30000))
        usado = _aplicar_credito(db, 7, Decimal("50000"), 1, Decimal("-5000"))
        self.assertEqual(usado, Decimal("0"))
        self.assertEqual(db.credito.Saldo, Decimal("30000"))

    def test_cliente_sin_saldo_no_aplica_nada(self):
        db = FakeDB(None)
        self.assertEqual(_aplicar_credito(db, 7, Decimal("50000"), 1, Decimal("10000")), Decimal("0"))
        self.assertEqual(db.agregados, [])

    def test_lo_usado_queda_registrado_en_el_libro_mayor(self):
        db = FakeDB(credito(30000))
        _aplicar_credito(db, 7, Decimal("50000"), 1, Decimal("12000"))
        self.assertEqual(len(db.agregados), 1)
        mov = db.agregados[0]
        self.assertEqual(mov.Tipo, "uso")
        self.assertEqual(mov.Monto, Decimal("12000"))
        self.assertEqual(mov.ID_Venta, 1)

    def test_la_fila_del_saldo_se_bloquea_para_evitar_gastarlo_dos_veces(self):
        db = FakeDB(credito(30000))
        _aplicar_credito(db, 7, Decimal("50000"), 1, Decimal("12000"))
        self.assertTrue(db.ultima_query.bloqueado)


if __name__ == "__main__":
    unittest.main()
