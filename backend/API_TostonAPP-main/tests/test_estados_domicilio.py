"""Normalización de los estados de domicilio (numeración canónica).

Cubre el bug que motivó estados.py: `Domicilios.Estado` guardaba dos
numeraciones distintas y el 3/4 significaban cosas opuestas según el cliente
que escribiera.
"""
import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException

from src.features.ventas.domicilios.services.estados import (
    ESTADO_DOM_A_VENTA,
    EstadoDomicilio,
    normalizar_estado,
    puede_reasignarse,
    validar_cambio,
)


class NormalizarEstadoTests(unittest.TestCase):
    def test_estados_canonicos_no_cambian(self):
        for estado in (3, 5, 8, 9, 10):
            self.assertEqual(normalizar_estado(estado), estado)

    def test_legacy_movil_4_es_entregado(self):
        # 4 en la tabla global es "Confirmado": como estado de domicilio solo
        # puede venir de la app vieja, donde significaba Entregado.
        self.assertEqual(normalizar_estado(4), EstadoDomicilio.ENTREGADO)

    def test_legacy_movil_1_y_2_son_pendiente(self):
        self.assertEqual(normalizar_estado(1), EstadoDomicilio.PENDIENTE)
        self.assertEqual(normalizar_estado(2), EstadoDomicilio.PENDIENTE)

    def test_tres_sin_repartidor_es_pendiente(self):
        self.assertEqual(
            normalizar_estado(3, tiene_repartidor=False), EstadoDomicilio.PENDIENTE
        )

    def test_tres_con_repartidor_es_en_camino(self):
        # Dato viejo de la app móvil: solo enviaba 3 ("en camino") sobre
        # domicilios ya asignados.
        self.assertEqual(
            normalizar_estado(3, tiene_repartidor=True), EstadoDomicilio.EN_CAMINO
        )

    def test_valores_invalidos_devuelven_none(self):
        self.assertIsNone(normalizar_estado(None))
        self.assertIsNone(normalizar_estado("abc"))


class PropagacionVentaTests(unittest.TestCase):
    def test_solo_en_camino_entregado_y_cancelado_mueven_la_venta(self):
        self.assertEqual(sorted(ESTADO_DOM_A_VENTA), [5, 8, 9])

    def test_entregado_pone_la_venta_en_entregado(self):
        # Antes el 8 no propagaba y la venta se quedaba "En camino".
        self.assertEqual(ESTADO_DOM_A_VENTA[EstadoDomicilio.ENTREGADO], 8)

    def test_en_camino_pone_la_venta_en_camino(self):
        self.assertEqual(ESTADO_DOM_A_VENTA[EstadoDomicilio.EN_CAMINO], 9)

    def test_asignado_no_mueve_la_venta(self):
        self.assertNotIn(EstadoDomicilio.ASIGNADO, ESTADO_DOM_A_VENTA)


class ValidarCambioTests(unittest.TestCase):
    def test_permite_avanzar(self):
        validar_cambio(EstadoDomicilio.ASIGNADO, EstadoDomicilio.EN_CAMINO)

    def test_rechaza_estado_que_no_es_de_domicilio(self):
        # 4 = "Confirmado" del pedido: ya normalizado nunca debería llegar, pero
        # un 13 ("En producción") sí es un estado de pedido, no de domicilio.
        with self.assertRaises(HTTPException) as ctx:
            validar_cambio(EstadoDomicilio.PENDIENTE, 13)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_rechaza_cambios_sobre_entregado(self):
        with self.assertRaises(HTTPException):
            validar_cambio(EstadoDomicilio.ENTREGADO, EstadoDomicilio.EN_CAMINO)

    def test_rechaza_cambios_sobre_cancelado(self):
        with self.assertRaises(HTTPException):
            validar_cambio(EstadoDomicilio.CANCELADO, EstadoDomicilio.EN_CAMINO)


class PuedeReasignarseTests(unittest.TestCase):
    """Cambiar de domiciliario solo antes de que el pedido salga a la calle."""

    def test_pendiente_y_asignado_se_pueden_reasignar(self):
        self.assertTrue(puede_reasignarse(EstadoDomicilio.PENDIENTE))
        self.assertTrue(puede_reasignarse(EstadoDomicilio.ASIGNADO))

    def test_en_camino_no_se_reasigna(self):
        # El repartidor ya salió con el pedido encima.
        self.assertFalse(puede_reasignarse(EstadoDomicilio.EN_CAMINO))

    def test_estados_finales_no_se_reasignan(self):
        self.assertFalse(puede_reasignarse(EstadoDomicilio.ENTREGADO))
        self.assertFalse(puede_reasignarse(EstadoDomicilio.CANCELADO))


if __name__ == "__main__":
    unittest.main()
