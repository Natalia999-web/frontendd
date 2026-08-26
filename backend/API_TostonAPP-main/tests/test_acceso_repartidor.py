"""Un repartidor solo alcanza los domicilios que lleva él.

El rol de reparto no siempre es el ID 4: desde Configuración → Roles se puede
crear otro con cualquier nombre. Si el reconocimiento falla, todas las reglas
de "solo lo suyo" dejan de aplicarse sin que nadie se entere.
"""
import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException

from src.features.ventas.domicilios.services.router import (
    _es_repartidor,
    _exigir_domicilio_propio,
)


class FakeRegistro:
    def __init__(self, id_rol, id_usuario=7):
        self.ID_Rol = id_rol
        self.ID_Usuario = id_usuario


class FakeDomicilio:
    def __init__(self, id_empleado):
        self.ID_Empleado = id_empleado


class FakeQuery:
    def __init__(self, dom):
        self.dom = dom

    def filter(self, *_):
        return self

    def first(self):
        return self.dom


class FakeDB:
    def __init__(self, dom):
        self.dom = dom

    def query(self, _modelo):
        return FakeQuery(self.dom)


def actual(rol_nombre=None, id_rol=2, id_usuario=7):
    return {"registro": FakeRegistro(id_rol, id_usuario), "rol": rol_nombre, "tipo": "empleado"}


class EsRepartidorTests(unittest.TestCase):

    def test_el_rol_estandar_por_id(self):
        self.assertTrue(_es_repartidor(actual(id_rol=4)))

    def test_reconoce_el_nombre_escrito_de_varias_formas(self):
        for nombre in ["Domiciliario", "domiciliario", "DOMICILIARIO",
                       "Repartidor", "repartidor", "Domiciliario 2",
                       "Domiciliário"]:
            with self.subTest(nombre=nombre):
                self.assertTrue(_es_repartidor(actual(nombre)))

    def test_otros_roles_no_son_de_reparto(self):
        for nombre in ["Admin", "Empleado", "Cocinero", "Vendedor", None, ""]:
            with self.subTest(nombre=nombre):
                self.assertFalse(_es_repartidor(actual(nombre)))

    def test_sin_nombre_de_rol_cae_al_id(self):
        """Tokens viejos no traen el nombre: el ID 4 sigue alcanzando."""
        self.assertTrue(_es_repartidor(actual(None, id_rol=4)))
        self.assertFalse(_es_repartidor(actual(None, id_rol=2)))


class DomicilioPropioTests(unittest.TestCase):

    def test_el_repartidor_pasa_con_su_domicilio(self):
        db = FakeDB(FakeDomicilio(id_empleado=7))
        _exigir_domicilio_propio(db, actual("Domiciliario"), 1)  # no lanza

    def test_el_repartidor_no_pasa_con_el_de_otro(self):
        db = FakeDB(FakeDomicilio(id_empleado=99))
        with self.assertRaises(HTTPException) as ctx:
            _exigir_domicilio_propio(db, actual("Domiciliario"), 1)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_el_repartidor_no_pasa_si_el_domicilio_no_existe(self):
        db = FakeDB(None)
        with self.assertRaises(HTTPException) as ctx:
            _exigir_domicilio_propio(db, actual("Repartidor"), 1)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_la_gestion_no_queda_encerrada(self):
        """Admin y empleados de gestión siguen viendo cualquier domicilio."""
        db = FakeDB(FakeDomicilio(id_empleado=99))
        _exigir_domicilio_propio(db, actual("Admin", id_rol=1), 1)  # no lanza
        _exigir_domicilio_propio(db, actual("Empleado", id_rol=2), 1)  # no lanza


if __name__ == "__main__":
    unittest.main()
