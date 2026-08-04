/**
 * Formatea cualquier fecha ISO ("2026-05-27", "2026-05-27T10:30:00", etc.)
 * al formato colombiano dd/mm/yyyy.
 * Retorna "—" si el valor es nulo o vacío.
 */
export function fmtFecha(iso) {
  if (!iso) return "—";
  const str = String(iso);
  if (str.includes("/")) return str; // ya formateada
  const dateOnly = str.split("T")[0];
  const [y, m, d] = dateOnly.split("-");
  if (!y || !m || !d) return str;
  return `${d}/${m}/${y}`;
}

/**
 * Formatea una fecha ISO incluyendo hora: "27/05/2026, 10:30".
 * Usado en vistas de detalle donde la hora es relevante.
 */
export function fmtFechaHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Intenta extraer una fecha (ISO) de un registro buscando campos comunes.
 * Retorna el valor original o null si no encuentra nada.
 */
export function getRecordDate(rec) {
  if (!rec) return null;
  const candidates = [
    'fecha', 'fecha_pedido', 'Fecha_pedido', 'fecha_compra', 'Fecha_compra', 'fecha_entrega', 'Fecha_entrega',
    'fecha_creacion', 'Fecha_Creacion', 'created_at', 'createdAt', 'fecha_llegada', 'Fecha_Actualizacion', 'fecha_actualizacion',
    'fecha_produccion', 'Fecha_produccion', 'Fecha', 'Fecha_creacion', 'proxVencimiento', 'ultimaActualizacion', 'ultima_actualizacion'
  ];
  for (const k of candidates) {
    if (rec[k]) return String(rec[k]);
  }
  // try nested objects like cliente?.fecha
  for (const v of Object.values(rec)) {
    if (v && typeof v === 'object') {
      for (const k of candidates) if (v[k]) return String(v[k]);
    }
  }
  return null;
}
