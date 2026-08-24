"""Estados del DOMICILIO — fuente única de verdad.

Historia del problema que resuelve este módulo
----------------------------------------------
`Domicilios.Estado` llegó a guardar DOS numeraciones distintas:

- Los IDs de la tabla global `Estados` (los que usa el panel web y con los que
  se crea el domicilio): 3=Pendiente, 10=Asignado, 9=En camino, 8=Entregado,
  5=Cancelado.
- Una numeración propia que enviaba la app móvil: 3=En camino, 4=Entregado,
  5=Cancelado.

El 3 significaba cosas opuestas según quién escribiera, y el 4 ("Confirmado" en
la tabla global) no es un estado válido de domicilio. Resultado: marcar
"Confirmado" desde la web entregaba el pedido y descontaba stock.

A partir de aquí la ÚNICA numeración válida es la de la tabla `Estados`. Todo lo
que entra se normaliza antes de guardarse y todo lo que sale se normaliza antes
de responder, así los datos viejos se leen bien sin migrar la tabla.
"""
from enum import IntEnum

from fastapi import HTTPException


class EstadoDomicilio(IntEnum):
    """IDs de la tabla global `Estados` aplicables a un domicilio."""
    PENDIENTE = 3    # creado, sin repartidor asignado
    CANCELADO = 5
    ENTREGADO = 8
    EN_CAMINO = 9
    ASIGNADO  = 10   # tiene repartidor, aún no sale


# Estados finales: no admiten más cambios.
ESTADOS_FINALES = frozenset({EstadoDomicilio.ENTREGADO, EstadoDomicilio.CANCELADO})

# Estados de domicilio que se reflejan en la venta (Ventas.Estado usa los mismos
# IDs de la tabla global). "Asignado" no mueve la venta: el pedido sigue Listo.
ESTADO_DOM_A_VENTA = {
    EstadoDomicilio.EN_CAMINO: 9,
    EstadoDomicilio.ENTREGADO: 8,
    EstadoDomicilio.CANCELADO: 5,
}

# Traducción de la numeración vieja de la app móvil. El 3 se resuelve aparte
# porque es ambiguo (ver normalizar_estado).
_LEGACY_MOVIL = {
    1: EstadoDomicilio.PENDIENTE,   # "pendiente"
    2: EstadoDomicilio.PENDIENTE,   # "asignado" que el móvil mostraba como pendiente
    4: EstadoDomicilio.ENTREGADO,   # "entregado" (4 = Confirmado en la tabla global)
}


def normalizar_estado(valor, tiene_repartidor: bool = False) -> int | None:
    """Devuelve el estado en la numeración canónica.

    [tiene_repartidor] desambigua el 3 en los datos escritos por versiones
    viejas de la app móvil: allí 3 significaba "En camino", y solo se enviaba
    sobre un domicilio que ya tenía repartidor. Un 3 sin repartidor es un
    domicilio recién creado, es decir Pendiente.
    """
    if valor is None:
        return None
    try:
        estado = int(valor)
    except (TypeError, ValueError):
        return None

    if estado in _LEGACY_MOVIL:
        return int(_LEGACY_MOVIL[estado])

    if estado == EstadoDomicilio.PENDIENTE and tiene_repartidor:
        return int(EstadoDomicilio.EN_CAMINO)

    return estado


def validar_cambio(actual, nuevo: int) -> None:
    """Impide mover un domicilio ya entregado o cancelado, y estados inválidos.

    No restringe el resto del recorrido: el administrador puede corregir un
    estado, igual que en la app móvil.
    """
    if nuevo not in {int(e) for e in EstadoDomicilio}:
        raise HTTPException(
            status_code=400,
            detail=f"Estado de domicilio inválido: {nuevo}",
        )
    if actual is not None and int(actual) in ESTADOS_FINALES:
        raise HTTPException(
            status_code=400,
            detail="Un domicilio entregado o cancelado ya no admite cambios de estado",
        )
