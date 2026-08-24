"""El listado y el detalle de domicilios deben exponer los mismos campos.

Los dos se construyen por separado (`_formato_domicilio` arma uno solo;
`_build_domicilio`, dentro de `obtener_domicilios`, arma cada fila de la lista
con datos precargados para evitar N+1), así que es fácil que se desincronicen.
Ya pasó: el listado se quedó sin `estado_pago` y el panel creía que ningún
domicilio estaba cobrado, por lo que no dejaba marcar la entrega.
"""
import re
import sys
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.append(str(RAIZ))

SERVICE = RAIZ / "src/features/ventas/domicilios/services/service.py"
SCHEMAS = RAIZ / "src/features/ventas/domicilios/services/schemas.py"

CLAVE = re.compile(r'"([a-zA-Z_]+)":\s')


def _claves_entre(fuente, desde, hasta):
    ini = fuente.index(desde)
    fin = fuente.index(hasta, ini + len(desde))
    return set(CLAVE.findall(fuente[ini:fin]))


class RespuestaDomicilioTests(unittest.TestCase):
    def setUp(self):
        self.fuente = SERVICE.read_text(encoding="utf-8")
        self.detalle = _claves_entre(self.fuente, "def _formato_domicilio", "\ndef ")
        # Solo el constructor de cada fila, sin el envoltorio de paginación
        # (ojo: "total" aparece en ambos con significados distintos).
        self.listado = _claves_entre(self.fuente, "def _build_domicilio", "\n    return {")

    def test_el_listado_no_pierde_campos_del_detalle(self):
        faltan = self.detalle - self.listado
        self.assertEqual(
            faltan, set(),
            f"El listado de domicilios no devuelve: {sorted(faltan)}",
        )

    def test_estado_pago_va_en_ambos(self):
        # Sin este campo el panel no puede saber si el cobro está registrado.
        self.assertIn("estado_pago", self.detalle)
        self.assertIn("estado_pago", self.listado)

    def test_los_campos_del_schema_se_construyen(self):
        # Pydantic descarta lo que no declara el schema; al revés, un campo
        # declarado que nadie construye llega siempre nulo.
        schema = SCHEMAS.read_text(encoding="utf-8")
        ini = schema.index("class DomicilioResponse")
        fin = schema.index("class Config", ini)
        declarados = set(re.findall(r"^\s{4}([a-zA-Z_]+):", schema[ini:fin], re.M))
        sin_construir = declarados - self.detalle
        self.assertEqual(
            sin_construir, set(),
            f"DomicilioResponse declara campos que nadie construye: {sorted(sin_construir)}",
        )


if __name__ == "__main__":
    unittest.main()
