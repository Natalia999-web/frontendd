"""Pago mixto: una parte en efectivo y otra por transferencia.

El cliente propone la proporción; los montos los calcula el servidor sobre el
total real. Lo que se cobra en mano al entregar es solo la parte en efectivo.
"""
import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.features.ventas.gestion_ventas.services.service import (
    _es_mixto,
    _es_transferencia,
    _partir_pago_mixto,
)


class EsMixtoTests(unittest.TestCase):

    def test_reconoce_el_metodo(self):
        for metodo in ["Mixto", "mixto", "  MIXTO  "]:
            with self.subTest(metodo=metodo):
                self.assertTrue(_es_mixto(metodo))

    def test_los_otros_metodos_no_son_mixtos(self):
        for metodo in ["Efectivo", "Transferencia", "Contra entrega", None, ""]:
            with self.subTest(metodo=metodo):
                self.assertFalse(_es_mixto(metodo))

    def test_mixto_no_se_confunde_con_transferencia(self):
        """Son reglas distintas: la de transferencia sigue mirando su palabra."""
        self.assertFalse(_es_transferencia("Mixto"))


class PartirPagoMixtoTests(unittest.TestCase):

    def test_mitad_y_mitad(self):
        efectivo, transferencia = _partir_pago_mixto(Decimal("100000"), 50)
        self.assertEqual(efectivo, Decimal("50000.00"))
        self.assertEqual(transferencia, Decimal("50000.00"))

    def test_diez_y_noventa(self):
        efectivo, transferencia = _partir_pago_mixto(Decimal("100000"), 10)
        self.assertEqual(efectivo, Decimal("10000.00"))
        self.assertEqual(transferencia, Decimal("90000.00"))

    def test_las_dos_partes_siempre_suman_el_total(self):
        """El redondeo se le carga a la transferencia: no queda un peso suelto."""
        for total in ["33333.33", "77777", "1", "0.05", "199999.99"]:
            for pct in [0, 5, 33, 50, 66, 95, 100]:
                with self.subTest(total=total, pct=pct):
                    t = Decimal(total)
                    efectivo, transferencia = _partir_pago_mixto(t, pct)
                    self.assertEqual(efectivo + transferencia, t)
                    self.assertGreaterEqual(efectivo, Decimal("0"))
                    self.assertGreaterEqual(transferencia, Decimal("0"))

    def test_todo_en_efectivo(self):
        efectivo, transferencia = _partir_pago_mixto(Decimal("80000"), 100)
        self.assertEqual(efectivo, Decimal("80000.00"))
        self.assertEqual(transferencia, Decimal("0.00"))

    def test_todo_por_transferencia(self):
        efectivo, transferencia = _partir_pago_mixto(Decimal("80000"), 0)
        self.assertEqual(efectivo, Decimal("0.00"))
        self.assertEqual(transferencia, Decimal("80000"))

    def test_un_porcentaje_fuera_de_rango_se_recorta(self):
        """Nadie se lleva más de lo que hay ni pone montos negativos."""
        self.assertEqual(_partir_pago_mixto(Decimal("50000"), 999)[0], Decimal("50000.00"))
        self.assertEqual(_partir_pago_mixto(Decimal("50000"), -40)[0], Decimal("0.00"))

    def test_sin_porcentaje_no_reparte_nada_al_efectivo(self):
        efectivo, transferencia = _partir_pago_mixto(Decimal("50000"), None)
        self.assertEqual(efectivo, Decimal("0.00"))
        self.assertEqual(transferencia, Decimal("50000"))


if __name__ == "__main__":
    unittest.main()
