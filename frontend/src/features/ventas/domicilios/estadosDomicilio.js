/**
 * Estados del DOMICILIO — fuente única para el panel web.
 *
 * Numeración canónica: los IDs de la tabla global `Estados` del backend, los
 * mismos que valida `domicilios/services/estados.py`. Antes había dos mapas
 * distintos (uno en el service y otro en Gestiondomicilios) y la web enviaba
 * estados del PEDIDO (4 Confirmado, 13 En producción, 11 Listo) al endpoint del
 * domicilio, donde el backend los interpretaba como "Entregado" y descontaba
 * stock. Un domicilio solo pasa por los cinco estados de abajo.
 */

export const ESTADO_DOMICILIO = {
  PENDIENTE: 3,
  CANCELADO: 5,
  ENTREGADO: 8,
  EN_CAMINO: 9,
  ASIGNADO: 10,
};

/** Etiqueta, color y descripción de cada estado. */
export const ESTADO_DOM_CONFIG = {
  3:  { label: "Pendiente", desc: "Sin repartidor asignado", dot: "#f9a825", bg: "#fff8e1", border: "#ffe082" },
  10: { label: "Asignado",  desc: "Repartidor asignado, aún no sale", dot: "#1976d2", bg: "#e3f2fd", border: "#90caf9" },
  9:  { label: "En camino", desc: "En ruta de entrega", dot: "#6a1b9a", bg: "#f3e5f5", border: "#ce93d8" },
  8:  { label: "Entregado", desc: "Entregado al cliente", dot: "#43a047", bg: "#e8f5e9", border: "#a5d6a7" },
  5:  { label: "Cancelado", desc: "Cancelado", dot: "#c62828", bg: "#ffebee", border: "#ef9a9a" },
};

/** Estados que ya no admiten cambios. */
export const ESTADOS_DOM_FINALES = [ESTADO_DOMICILIO.ENTREGADO, ESTADO_DOMICILIO.CANCELADO];

/** Un domicilio está activo mientras no se haya entregado ni cancelado. */
export const esDomicilioActivo = (estadoId) =>
  !ESTADOS_DOM_FINALES.includes(Number(estadoId));

/**
 * Traducción de la numeración vieja de la app móvil (3=En camino, 4=Entregado).
 * El backend ya normaliza, pero la web se protege por si queda una respuesta
 * cacheada o un despliegue desfasado.
 */
const LEGACY_MOVIL = { 1: 3, 2: 3, 4: 8 };

export const normalizarEstadoDom = (valor, tieneRepartidor = false) => {
  const estado = Number(valor);
  if (!Number.isFinite(estado)) return null;
  if (LEGACY_MOVIL[estado] != null) return LEGACY_MOVIL[estado];
  // Un 3 con repartidor viene de la app vieja, donde significaba "En camino".
  if (estado === ESTADO_DOMICILIO.PENDIENTE && tieneRepartidor) {
    return ESTADO_DOMICILIO.EN_CAMINO;
  }
  return estado;
};

export const labelEstadoDom = (estadoId) =>
  ESTADO_DOM_CONFIG[Number(estadoId)]?.label || "Pendiente";

/**
 * Transiciones que el panel ofrece, por rol. Refleja el recorrido real del
 * domicilio y las reglas que ya aplica la app móvil:
 * - gestión (admin/empleado): puede corregir el recorrido completo.
 * - domiciliario: solo avanza a En camino o Entregado.
 * "Asignado" no se elige a mano: se alcanza al asignar repartidor.
 */
const TRANSICIONES_GESTION = {
  3:  [ESTADO_DOMICILIO.EN_CAMINO, ESTADO_DOMICILIO.CANCELADO],
  10: [ESTADO_DOMICILIO.EN_CAMINO, ESTADO_DOMICILIO.CANCELADO],
  9:  [ESTADO_DOMICILIO.ENTREGADO, ESTADO_DOMICILIO.CANCELADO],
  8:  [],
  5:  [],
};

const TRANSICIONES_REPARTIDOR = {
  3:  [],
  10: [ESTADO_DOMICILIO.EN_CAMINO],
  // Ya en ruta puede cerrarla como entregada o, si no pudo, cancelarla.
  9:  [ESTADO_DOMICILIO.ENTREGADO, ESTADO_DOMICILIO.CANCELADO],
  8:  [],
  5:  [],
};

/** Opciones de cambio de estado disponibles: [{ id, label }]. */
export const transicionesDom = (estadoId, esRepartidor = false) => {
  const tabla = esRepartidor ? TRANSICIONES_REPARTIDOR : TRANSICIONES_GESTION;
  return (tabla[Number(estadoId)] || []).map((id) => ({
    id,
    label: labelEstadoDom(id),
  }));
};

/** Opciones para el filtro de la tabla. */
export const FILTRO_ESTADOS_DOM = [
  { val: "todos",       label: "Todos",       dot: "#bdbdbd" },
  { val: "activos",     label: "Activos",     dot: "#43a047" },
  { val: ESTADO_DOMICILIO.PENDIENTE, label: "Pendiente", dot: ESTADO_DOM_CONFIG[3].dot },
  { val: ESTADO_DOMICILIO.ASIGNADO,  label: "Asignado",  dot: ESTADO_DOM_CONFIG[10].dot },
  { val: ESTADO_DOMICILIO.EN_CAMINO, label: "En camino", dot: ESTADO_DOM_CONFIG[9].dot },
  { val: ESTADO_DOMICILIO.ENTREGADO, label: "Entregado", dot: ESTADO_DOM_CONFIG[8].dot },
  { val: ESTADO_DOMICILIO.CANCELADO, label: "Cancelado", dot: ESTADO_DOM_CONFIG[5].dot },
  { val: "sin-asignar", label: "Sin asignar", dot: "#e53935" },
];

/**
 * Estados de pago con los que el backend permite marcar la entrega
 * (`_ESTADOS_PAGO_ENTREGA` en domicilios/services/service.py). Se replica aquí
 * solo para avisar ANTES de la llamada; la regla la sigue aplicando el backend.
 */
export const ESTADOS_PAGO_ENTREGA = [
  "efectivo_recibido", "pagado_completo", "anticipo_pagado",
  "no_recibido", "pendiente_validacion",
];

export const ESTADO_PAGO_LABEL = {
  pendiente:             { label: "Pago pendiente",       dot: "#f9a825", bg: "#fff8e1" },
  pendiente_validacion:  { label: "Comprobante por validar", dot: "#1976d2", bg: "#e3f2fd" },
  comprobante_rechazado: { label: "Comprobante rechazado", dot: "#c62828", bg: "#ffebee" },
  efectivo_recibido:     { label: "Efectivo recibido",    dot: "#43a047", bg: "#e8f5e9" },
  anticipo_pagado:       { label: "Anticipo pagado",      dot: "#43a047", bg: "#e8f5e9" },
  pagado_completo:       { label: "Pagado",               dot: "#43a047", bg: "#e8f5e9" },
  no_recibido:           { label: "Cobro no recibido",    dot: "#c62828", bg: "#ffebee" },
};

/** True si el método de pago es transferencia (o equivalente digital). */
export const esPagoTransferencia = (metodo) =>
  /transf|nequi|daviplata|bancol|qr/i.test(metodo || "");

/** True si el método de pago es efectivo / contra entrega. */
export const esPagoEfectivo = (metodo) =>
  /efectiv|contra|cash/i.test(metodo || "");

/**
 * Motivo por el que no se puede marcar entregado, o null si sí se puede.
 * Refleja la regla del backend: hace falta el cobro registrado, y el
 * comprobante solo se exige cuando el pago fue por transferencia (los pedidos
 * en efectivo se cobran en mano).
 */
export const bloqueoEntrega = (dom) => {
  if (!dom) return null;
  const pagoOk = ESTADOS_PAGO_ENTREGA.includes(dom.estado_pago || "");
  if (!pagoOk) {
    return "Falta registrar el cobro de este pedido antes de marcarlo como entregado.";
  }
  if (esPagoTransferencia(dom.metodo_pago) && !dom.comprobante_pago) {
    return "El pago es por transferencia y no tiene comprobante adjunto.";
  }
  return null;
};
