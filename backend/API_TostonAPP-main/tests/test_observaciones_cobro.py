"""Las observaciones del cliente no llevan la auditoría del cobro.

El registro del cobro en efectivo se guardaba dentro de Domicilios.Observaciones,
que es el texto donde el cliente escribe cómo llegar. El repartidor abría la
entrega y veía "[COBRO|2026-08-27T15:00:00|usuario:4|recibido:true|monto:22500.0]"
pegado a las indicaciones.
"""
import os
import sys
import unittest
from pathlib import Path

for k, v in [("DB_USER", "u"), ("DB_PASSWORD", "p"), ("DB_HOST", "localhost"),
             ("DB_PORT", "3306"), ("DB_NAME", "test")]:
    os.environ.setdefault(k, v)

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.shared.services.observaciones_utils import observaciones_limpias as _observaciones_limpias

COBRO = "[COBRO|2026-08-27T15:00:00|usuario:4|recibido:true|monto:22500.0]"
NO_COBRO = "[COBRO|2026-08-27T15:00:00|usuario:4|recibido:false|motivo:no estaba]"


class ObservacionesLimpiasTests(unittest.TestCase):

    def test_un_texto_normal_no_se_toca(self):
        self.assertEqual(
            _observaciones_limpias("Dejar en portería, timbre 2"),
            "Dejar en portería, timbre 2",
        )

    def test_saca_la_linea_del_cobro(self):
        self.assertEqual(
            _observaciones_limpias(f"Dejar en portería\n{COBRO}"),
            "Dejar en portería",
        )

    def test_saca_tambien_el_cobro_no_recibido(self):
        self.assertEqual(
            _observaciones_limpias(f"Timbre 2\n{NO_COBRO}"),
            "Timbre 2",
        )

    def test_varias_lineas_de_cobro(self):
        self.assertEqual(
            _observaciones_limpias(f"Timbre 2\n{COBRO}\n{NO_COBRO}\nLlamar antes"),
            "Timbre 2\nLlamar antes",
        )

    def test_solo_auditoria_queda_vacio(self):
        """Sin texto del cliente no hay nada que mostrar."""
        self.assertIsNone(_observaciones_limpias(COBRO))

    def test_no_borra_texto_que_solo_menciona_un_cobro(self):
        """El filtro es para la línea estructurada, no para cualquier palabra."""
        texto = "Cobrar el domingo si no está"
        self.assertEqual(_observaciones_limpias(texto), texto)

    def test_un_corchete_suelto_no_cuenta(self):
        texto = "Casa [azul] con reja"
        self.assertEqual(_observaciones_limpias(texto), texto)

    def test_vacio_y_nulo(self):
        self.assertIsNone(_observaciones_limpias(None))
        self.assertEqual(_observaciones_limpias(""), "")


class TodasLasLecturasFiltranTests(unittest.TestCase):
    """El filtro tiene que estar en TODAS las respuestas que sirven el campo.

    La primera vez se aplicó solo en el módulo de domicilios y el resumen del
    pedido —que arma su propio diccionario en gestion_ventas— siguió mostrando
    la línea. Por eso el helper vive en shared: para que no haya dos copias que
    se puedan desincronizar.
    """

    def test_los_dos_modulos_usan_el_mismo_helper(self):
        from src.features.ventas.domicilios.services import service as dom
        from src.features.ventas.gestion_ventas.services import service as gv

        esperado = "src.shared.services.observaciones_utils"
        self.assertEqual(dom.observaciones_limpias.__module__, esperado)
        self.assertEqual(gv.observaciones_limpias.__module__, esperado)

    def test_el_caso_reportado(self):
        """Lo que se veía en el resumen del pedido."""
        sucio = f"NO olvidar cobrar\n{COBRO}"
        self.assertEqual(_observaciones_limpias(sucio), "NO olvidar cobrar")


if __name__ == "__main__":
    unittest.main()
