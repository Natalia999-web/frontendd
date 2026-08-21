import { apiFetch } from "../utils/api";

const adaptCompra = (c) => ({
  id:           c.ID_Compra        || c.id,
  idProveedor:  c.ID_Proveedor     || c.id_proveedor   || null,
  proveedor:    c.nombre_proveedor || c.proveedor       || "",
  metodoPago:   c.Metodo_Pago      || c.metodo_pago     || "",
  total:        c.Total_Pago       || c.Total           || c.total           || 0,
  estado:       (() => {
    const label = c.estado_label;
    if (label) {
      const m = { pendiente: "pendiente", confirmado: "completada", cancelado: "anulada", anulada: "anulada", completada: "completada" };
      return m[label.toLowerCase()] || "pendiente";
    }
    const raw = c.Estado ?? c.estado;
    if (typeof raw === "string") return raw.toLowerCase();
    const m = { 3: "pendiente", 4: "completada", 11: "completada", 5: "anulada", 12: "anulada" };
    return m[raw] || "pendiente";
  })(),
  fecha:        c.Fecha_Compra     || c.fecha_compra    || c.fecha || "",
  fecha_llegada: c.Fecha_Llegada  ? new Date(c.Fecha_Llegada).toISOString().split('T')[0] : null,
  notas:        c.Notas            || c.notas           || "",
  stockAplicado: [4, 11].includes(c.Estado ?? c.estado) || ["confirmado", "completada"].includes((c.estado_label || "").toLowerCase()),
  transporte:         Number(c.Costo_Transporte     ?? c.transporte)          || 0,
  ivaPorcentaje:      Number(c.IVA_Porcentaje       ?? c.iva_porcentaje)      || 0,
  descuentoPorcentaje: Number(c.Descuento_Porcentaje ?? c.descuento_porcentaje) || 0,
  otros:              Number(c.Otros_Costos         ?? c.otros_costos)        || 0,
  items: (c.items || c.detalles || []).map(i => ({
    idDetalle:        i.ID_Detalle        || i.id_detalle        || null,
    idInsumo:         i.ID_Insumo         || i.id_insumo         || null,
    nombre:           i.nombre_insumo     || i.nombre            || "",
    categoria:        i.nombre_categoria  || i.categoria         || "",
    unidad:           i.simbolo_unidad    || i.unidad            || "",
    cantidad:         i.Cantidad          || i.cantidad          || 0,
    precioUnd:        i.Precio_Und        || i.precio_und        || 0,
    subtotal:         i.Subtotal          || i.subtotal          || 0,
    fechaVencimiento: i.Fecha_Vencimiento || i.fecha_vencimiento || null,
  })),
});

export async function getCompras({ pagina = 1, porPagina = 100, busqueda = "", idProveedor = null } = {}) {
  const params = new URLSearchParams({ pagina, por_pagina: porPagina });
  if (busqueda)    params.append("busqueda",     busqueda);
  if (idProveedor) params.append("id_proveedor", idProveedor);
  const data = await apiFetch(`/compras/?${params}`);
  return {
    total:   data.total,
    compras: (data.compras || []).map(adaptCompra),
  };
}

export async function getCompra(id) {
  const data = await apiFetch(`/compras/${id}`);
  return adaptCompra(data);
}

export async function crearCompra(payload) {
  // El backend valida contra {"Efectivo", "Transferencia", "Crédito", "Cheque"} (Primera letra mayúscula)
  const raw = payload.metodoPago || "";
  const metodoPago = raw.charAt(0).toUpperCase() + raw.slice(1);

  const g = payload.gastos || {};
  const body = {
    ID_Proveedor:         Number(payload.idProveedor),
    Metodo_Pago:          metodoPago,
    Fecha_Compra:         payload.fecha || null,
    Notas:                payload.notas || null,
    Costo_Transporte:     Number(g.transporte)     || null,
    IVA_Porcentaje:       Number(g.ivaPorcentaje)  || null,
    Descuento_Porcentaje: Number(g.descPorcentaje) || null,
    Otros_Costos:         Number(g.otros)          || null,
    detalles: (payload.detalles || []).map(i => ({
      ID_Insumo:         Number(i.idInsumo),
      Cantidad:          Number(i.cantidad),
      Precio_Und:        Number(i.precioUnd),
      Notas:             i.notas || null,
      Fecha_Vencimiento: i.fechaVencimiento || null,
    })),
  };
  const data = await apiFetch("/compras/", { method: "POST", body: JSON.stringify(body) });
  return adaptCompra(data);
}

export async function editarCompra(id, payload) {
  const raw = payload.metodoPago || "";
  const metodoPago = raw.charAt(0).toUpperCase() + raw.slice(1);

  const body = {
    Metodo_Pago:   metodoPago || undefined,
    Notas:         payload.notas ?? null,
    Fecha_Llegada: payload.fecha_llegada || null,
  };

  // Solo si la compra está pendiente el proveedor y fecha son editables
  if (payload.idProveedor) body.ID_Proveedor = Number(payload.idProveedor);
  if (payload.fecha)        body.Fecha_Compra = payload.fecha;

  const data = await apiFetch(`/compras/${id}`, {
    method: "PUT",
    body:   JSON.stringify(body),
  });
  return adaptCompra(data);
}

export async function completarCompra(id, fecha = null) {
  const opts = { method: "PATCH" };
  if (fecha) opts.body = JSON.stringify({ Fecha_Llegada: fecha });
  const data = await apiFetch(`/compras/${id}/completar`, opts);
  return adaptCompra(data);
}

export async function anularCompra(id) {
  const data = await apiFetch(`/compras/${id}/anular`, { method: "PATCH" });
  return adaptCompra(data);
}
