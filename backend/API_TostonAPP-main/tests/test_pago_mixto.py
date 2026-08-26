"""Pago mixto: una parte en efectivo y otra por transferencia.

El cliente dice cuánta plata pone en efectivo; el servidor la recorta contra
el total real y manda el resto a transferencia. Lo que se cobra en mano al
entregar es solo esa parte.
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

    def test_el_monto_que_pide_el_cliente_se_respeta(self):
        """El caso que motivó el cambio: $3.500 sueltos de un pedido de $22.500."""
        efectivo, transferencia = _partir_pago_mixto(Decimal("22500"), Decimal("3500"))
        self.assertEqual(efectivo, Decimal("3500.00"))
        self.assertEqual(transferencia, Decimal("19000.00"))

    def test_mitad_y_mitad(self):
        efectivo, transferencia = _partir_pago_mixto(Decimal("100000"), Decimal("50000"))
        self.assertEqual(efectivo, Decimal("50000.00"))
        self.assertEqual(transferencia, Decimal("50000.00"))

    def test_las_dos_partes_siempre_suman_el_total(self):
        for total in ["33333.33", "77777", "1", "0.05", "199999.99", "22500"]:
            for pedido in ["0", "1", "3500", "0.01", "12345.67", "99999999"]:
                with self.subTest(total=total, pedido=pedido):
                    t = Decimal(total)
                    efectivo, transferencia = _partir_pago_mixto(t, Decimal(pedido))
                    self.assertEqual(efectivo + transferencia, t)
                    self.assertGreaterEqual(efectivo, Decimal("0"))
                    self.assertGreaterEqual(transferencia, Decimal("0"))

    def test_no_se_puede_poner_en_efectivo_mas_de_lo_que_vale(self):
        """Se recorta al total: el pedido no puede quedar pagado de más."""
        efectivo, transferencia = _partir_pago_mixto(Decimal("50000"), Decimal("90000"))
        self.assertEqual(efectivo, Decimal("50000.00"))
        self.assertEqual(transferencia, Decimal("0.00"))

    def test_un_monto_negativo_se_trata_como_cero(self):
        efectivo, transferencia = _partir_pago_mixto(Decimal("50000"), Decimal("-4000"))
        self.assertEqual(efectivo, Decimal("0.00"))
        self.assertEqual(transferencia, Decimal("50000.00"))

    def test_sin_monto_no_va_nada_en_efectivo(self):
        efectivo, transferencia = _partir_pago_mixto(Decimal("50000"), None)
        self.assertEqual(efectivo, Decimal("0.00"))
        self.assertEqual(transferencia, Decimal("50000.00"))

    def test_acepta_el_monto_como_texto_o_float(self):
        """Del request llega como venga; no debe romperse por el tipo."""
        self.assertEqual(_partir_pago_mixto(Decimal("22500"), "3500")[0], Decimal("3500.00"))
        self.assertEqual(_partir_pago_mixto(Decimal("22500"), 3500.0)[0], Decimal("3500.00"))

    def test_los_centavos_no_se_pierden(self):
        efectivo, transferencia = _partir_pago_mixto(Decimal("22500.75"), Decimal("3500.25"))
        self.assertEqual(efectivo, Decimal("3500.25"))
        self.assertEqual(transferencia, Decimal("19000.50"))


if __name__ == "__main__":
    unittest.main()
