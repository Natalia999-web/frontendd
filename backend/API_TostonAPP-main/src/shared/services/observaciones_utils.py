"""Las observaciones de una entrega, sin la auditoría del cobro.

Hasta hace poco, registrar el cobro en efectivo escribía una línea
`[COBRO|fecha|usuario:4|recibido:true|monto:22500.0]` dentro de
`Domicilios.Observaciones`, que es el texto donde se anota lo de la entrega
("NO olvidar cobrar", "dejar en portería"). El cliente y el repartidor lo veían
pegado a sus propias notas.

Los registros nuevos ya escriben en `Domicilios.Cobro_Auditoria`. Esto limpia lo
que quedó guardado antes, al leerlo.

Vive en `shared` porque lo necesitan dos módulos que no se pueden importar entre
sí: `domicilios` ya importa de `gestion_ventas`, así que al revés sería un
import circular. Tenerlo acá también evita lo que pasó la primera vez, cuando el
filtro se aplicó solo en uno de los dos y el resumen del pedido siguió mostrando
la línea.
"""
import re

# La línea de auditoría ocupa su propio renglón: se escribe con "\n" delante.
_LINEA_COBRO = re.compile(r"^\s*\[COBRO\|.*?\]\s*$", re.MULTILINE)


def observaciones_limpias(texto: str | None) -> str | None:
    """Devuelve el texto sin las líneas de auditoría del cobro.

    Conserva `None` y la cadena vacía tal cual para no cambiar cómo se
    distinguen "sin observaciones" de "observaciones vacías" en las respuestas.
    """
    if not texto:
        return texto
    limpio = _LINEA_COBRO.sub("", texto)
    # Sacar la línea deja un renglón vacío en medio del texto del cliente.
    limpio = re.sub(r"\n{2,}", "\n", limpio).strip()
    return limpio or None
