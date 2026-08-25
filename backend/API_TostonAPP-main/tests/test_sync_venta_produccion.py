"""Estado del pedido cuando termina su producción.

Antes, al completarse todas las órdenes el pedido volvía a Pendiente (1). Eso
rompía el flujo de fecha propuesta: el pedido perdía el Confirmado que ganó
cuando el cliente aceptó la fecha y el panel volvía a pedir una fecha que el
cliente ya había aceptado.
"""
import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.features.produccion.ordenes_produccion.services.service import (
    ESTADO_CANCELADA,
    ESTADO_COMPLETADA,
    ESTADO_EN_PROCESO,
    ESTADO_VENTA_CONFIRMADO,
    ESTADO_VENTA_LISTO,
    _sync_venta_por_ordenes,
)
from src.shared.services.models import OrdenProduccion, Venta

ESTADO_PENDIENTE      = 1
ESTADO_CONFIRMADO     = 4
ESTADO_FECHA_PROPUEST = 16
ESTADO_ENTREGADO      = 8


class FakeQuery:
    def __init__(self, rows):
        self.rows = rows

    def filter(self, *_):
        return self

    def first(self):
        return self.rows[0] if self.rows else None

    def all(self):
        return list(self.rows)


class FakeDB:
    def __init__(self, venta, otras_ordenes=None):
        self.venta = venta
        self.otras = otras_ordenes or []

    def query(self, modelo):
        if modelo is Venta:
            return FakeQuery([self.venta])
        if modelo is OrdenProduccion:
            return FakeQuery(self.otras)
        return FakeQuery([])


def venta(estado):
    return type("Venta", (), {"ID_Venta": 1, "Estado": estado})()


def orden(estado):
    return type("Orden", (), {"ID_Orden_Produccion": 99, "Estado": estado})()


class SyncVentaPorOrdenesTests(unittest.TestCase):
    def test_produccion_terminada_deja_el_pedido_listo(self):
        v = venta(ESTADO_EN_PROCESO)
        _sync_venta_por_ordenes(FakeDB(v), 1, 10, ESTADO_COMPLETADA)
        self.assertEqual(v.Estado, ESTADO_VENTA_LISTO)

    def test_desde_confirmado_tambien_pasa_a_listo(self):
        v = venta(ESTADO_CONFIRMADO)
        _sync_venta_por_ordenes(FakeDB(v), 1, 10, ESTADO_COMPLETADA)
        self.assertEqual(v.Estado, ESTADO_VENTA_LISTO)

    def test_no_vuelve_a_pendiente(self):
        # Regresión: volver a Pendiente hacía que el panel pidiera de nuevo la
        # fecha de un pedido cuya fecha el cliente ya había aceptado.
        v = venta(ESTADO_EN_PROCESO)
        _sync_venta_por_ordenes(FakeDB(v), 1, 10, ESTADO_COMPLETADA)
        self.assertNotEqual(v.Estado, ESTADO_PENDIENTE)

    def test_cancelar_la_unica_orden_no_deja_el_pedido_listo(self):
        # Cancelar no es fabricar: no hay producto que despachar. El pedido
        # vuelve a Confirmado para que el admin decida qué hacer.
        v = venta(ESTADO_EN_PROCESO)
        _sync_venta_por_ordenes(FakeDB(v), 1, 10, ESTADO_CANCELADA)
        self.assertEqual(v.Estado, ESTADO_VENTA_CONFIRMADO)

    def test_si_una_se_completo_y_otra_se_cancelo_queda_listo(self):
        v = venta(ESTADO_EN_PROCESO)
        db = FakeDB(v, otras_ordenes=[orden(ESTADO_COMPLETADA)])
        _sync_venta_por_ordenes(db, 1, 10, ESTADO_CANCELADA)
        self.assertEqual(v.Estado, ESTADO_VENTA_LISTO)

    def test_pedido_aun_pendiente_no_salta_la_confirmacion(self):
        # Orden creada a mano sobre un pedido sin confirmar: no debe quedar
        # Listo saltándose la confirmación del cliente.
        v = venta(ESTADO_PENDIENTE)
        _sync_venta_por_ordenes(FakeDB(v), 1, 10, ESTADO_COMPLETADA)
        self.assertEqual(v.Estado, ESTADO_PENDIENTE)

    def test_pedido_esperando_fecha_no_salta_la_aceptacion(self):
        v = venta(ESTADO_FECHA_PROPUEST)
        _sync_venta_por_ordenes(FakeDB(v), 1, 10, ESTADO_COMPLETADA)
        self.assertEqual(v.Estado, ESTADO_FECHA_PROPUEST)

    def test_con_ordenes_activas_el_pedido_va_a_produccion(self):
        v = venta(ESTADO_CONFIRMADO)
        db = FakeDB(v, otras_ordenes=[orden(ESTADO_EN_PROCESO)])
        _sync_venta_por_ordenes(db, 1, 10, ESTADO_COMPLETADA)
        self.assertEqual(v.Estado, ESTADO_EN_PROCESO)

    def test_no_toca_pedidos_ya_finalizados(self):
        v = venta(ESTADO_ENTREGADO)
        _sync_venta_por_ordenes(FakeDB(v), 1, 10, ESTADO_COMPLETADA)
        self.assertEqual(v.Estado, ESTADO_ENTREGADO)


if __name__ == "__main__":
    unittest.main()
