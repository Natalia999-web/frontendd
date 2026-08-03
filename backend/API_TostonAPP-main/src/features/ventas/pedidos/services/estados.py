from enum import IntEnum
from fastapi import HTTPException


class EstadoPedido(IntEnum):
    PENDIENTE       = 1   # nuevo pedido del cliente
    CONFIRMADO      = 4   # aceptado por el admin/empleado
    CANCELADO       = 5   # cancelado (estado final)
    ENTREGADO       = 8   # entregado al cliente o recogido en tienda
    EN_CAMINO       = 9   # domicilio en tránsito
    LISTO           = 11  # terminado, esperando entrega o recogida ("Completada" en la BD)
    PREPARANDO      = 13  # en cocina / producción  ("En proceso" en la BD)
    FECHA_PROPUESTA = 16  # admin propuso fecha; cliente debe aceptar o rechazar


ESTADOS_FINALES = frozenset({EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO})

# Estados donde el stock YA fue descontado para pedidos SIN domicilio
# (el descuento ocurre al pasar a CONFIRMADO en pickup orders)
ESTADOS_STOCK_DESCONTADO_PICKUP = frozenset({
    EstadoPedido.CONFIRMADO,
    EstadoPedido.PREPARANDO,
    EstadoPedido.LISTO,
})

# Todos los estados no finales (pedido aún procesable)
ESTADOS_ACTIVOS = frozenset({
    EstadoPedido.PENDIENTE,
    EstadoPedido.CONFIRMADO,
    EstadoPedido.PREPARANDO,
    EstadoPedido.LISTO,
    EstadoPedido.EN_CAMINO,
    EstadoPedido.FECHA_PROPUESTA,
})

TRANSICIONES: dict[int, frozenset[int]] = {
    EstadoPedido.PENDIENTE:       frozenset({EstadoPedido.CONFIRMADO, EstadoPedido.CANCELADO}),
    # confirmado → listo (saltar preparando) es válido si el pedido ya está listo de inmediato
    EstadoPedido.CONFIRMADO:      frozenset({EstadoPedido.PREPARANDO, EstadoPedido.LISTO, EstadoPedido.CANCELADO}),
    EstadoPedido.PREPARANDO:      frozenset({EstadoPedido.LISTO, EstadoPedido.CANCELADO}),
    EstadoPedido.LISTO:           frozenset({EstadoPedido.EN_CAMINO, EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO}),
    EstadoPedido.EN_CAMINO:       frozenset({EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO}),
    EstadoPedido.ENTREGADO:       frozenset(),
    EstadoPedido.CANCELADO:       frozenset(),
    # Fecha propuesta: el cliente acepta (→ Confirmado) o rechaza (→ Cancelado)
    EstadoPedido.FECHA_PROPUESTA: frozenset({EstadoPedido.CONFIRMADO, EstadoPedido.CANCELADO}),
}


def validar_transicion(actual: int, nuevo: int, tiene_domicilio: bool) -> None:
    """
    Lanza HTTPException 400 si la transición no está permitida.
    También valida reglas dependientes del tipo de pedido (domicilio vs recoger).
    """
    try:
        e_actual = EstadoPedido(actual)
    except ValueError:
        raise HTTPException(400, detail=f"Estado actual desconocido: {actual}")

    try:
        e_nuevo = EstadoPedido(nuevo)
    except ValueError:
        raise HTTPException(400, detail=f"Estado destino inválido: {nuevo}")

    permitidos = TRANSICIONES.get(e_actual, frozenset())
    if e_nuevo not in permitidos:
        raise HTTPException(
            400,
            detail=(
                f"No se puede pasar de '{e_actual.name.lower()}' "
                f"a '{e_nuevo.name.lower()}'"
            ),
        )

    # Reglas dependientes del tipo de pedido, solo desde LISTO
    if e_actual == EstadoPedido.LISTO:
        if e_nuevo == EstadoPedido.EN_CAMINO and not tiene_domicilio:
            raise HTTPException(
                400,
                detail="Solo pedidos con domicilio pueden pasar a 'en_camino'",
            )
        if e_nuevo == EstadoPedido.ENTREGADO and tiene_domicilio:
            raise HTTPException(
                400,
                detail="Un pedido con domicilio debe pasar por 'en_camino' antes de entregarse",
            )
