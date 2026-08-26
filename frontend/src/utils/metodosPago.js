/**
 * Cómo se paga un pedido (Ventas.Metodo_Pago).
 *
 * Vivían dentro del módulo de domicilios, pero son del pedido: la pantalla de
 * gestión de pedidos preguntaba por su cuenta con `.includes("transfer")` y
 * `.includes("efectivo")`, y por eso un pedido mixto se quedaba sin el botón
 * de revisar comprobante y sin el de registrar el cobro — no coincidía con
 * ninguna de las dos.
 */

/**
 * Pago mixto: el pedido se reparte entre efectivo y transferencia. Lleva las
 * dos cargas a la vez —comprobante por lo transferido, cobro en mano por lo
 * demás—, así que las dos preguntas de abajo le dicen que sí.
 */
export const esPagoMixto = (metodo) => /mixto/i.test(metodo || "");

/** ¿Hay un comprobante que revisar? */
export const esPagoTransferencia = (metodo) =>
  /transf|nequi|daviplata|bancol|qr/i.test(metodo || "") || esPagoMixto(metodo);

/** ¿Hay plata que cobrar en mano? */
export const esPagoEfectivo = (metodo) =>
  /efectiv|contra|cash/i.test(metodo || "") || esPagoMixto(metodo);

/**
 * Cuánto hay que cobrar en mano. En un pedido mixto no es el total: la parte
 * transferida ya entró al hacer el pedido.
 */
export const montoACobrar = (pedido) =>
  (pedido?.monto_efectivo ?? null) !== null
    ? Number(pedido.monto_efectivo)
    : Number(pedido?.total || 0);

/** Cuánto entró (o va a entrar) por transferencia. */
export const montoTransferido = (pedido) =>
  (pedido?.monto_transferencia ?? null) !== null
    ? Number(pedido.monto_transferencia)
    : Math.max(0, Number(pedido?.total || 0) - montoACobrar(pedido));
