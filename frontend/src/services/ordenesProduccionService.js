import { apiFetch } from "../utils/api";

// El backend usa Estado=1 ("Activo" en la tabla Estados) para órdenes nuevas/pendientes.
// El frontend las muestra como "Pendiente" para claridad.
const ESTADO_DISPLAY_MAP = {
  "Activo":     "Pendiente",
  "En proceso": "En proceso",
  "Completada": "Completada",
  "Cancelado":  "Cancelada",
};

function adaptarOrden(o) {
  const label = o.estado_label || "";
  return {
    id:             o.ID_Orden_Produccion,
    idVenta:        o.ID_Venta        || o.id_venta        || null,
    idProducto:     o.ID_Producto,
    nombreProducto: o.nombre_producto,
    idInsumo:       o.ID_Insumo,
    nombreInsumo:   o.nombre_insumo,
    stockInsumo:    o.stock_insumo ?? null,
    idFicha:        o.ID_Ficha,
    versionFicha:   o.version_ficha,
    cantidad:       o.Cantidad,
    fechaInicio:    o.Fecha_inicio  ? String(o.Fecha_inicio).split("T")[0]  : null,
    fechaEntrega:   o.Fecha_Entrega ? String(o.Fecha_Entrega).split("T")[0] : null,
    estado:         ESTADO_DISPLAY_MAP[label] || label || "Pendiente",
    costo:          parseFloat(o.Costo ?? 0),
    costoDetalle:   o.costo_detalle || [],
    lote: o.lote ? {
      id:               o.lote.ID_Lote_Producto,
      numeroLote:       o.lote.Numero_Lote,
      fechaProduccion:  o.lote.Fecha_Produccion  ? String(o.lote.Fecha_Produccion).split("T")[0]  : null,
      fechaVencimiento: o.lote.Fecha_Vencimiento ? String(o.lote.Fecha_Vencimiento).split("T")[0] : null,
      cantidad:         o.lote.Cantidad,
    } : null,
  };
}

export async function getOrdenes({ pagina = 1, porPagina = 100, busqueda = "" } = {}) {
  const params = new URLSearchParams({ pagina, por_pagina: porPagina });
  if (busqueda) params.append("busqueda", busqueda);
  const data = await apiFetch(`/ordenes-produccion/?${params}`);
  return (data.ordenes || []).map(adaptarOrden);
}

export async function crearOrden(data) {
  return apiFetch("/ordenes-produccion/", { method: "POST", body: JSON.stringify(data) });
}

export async function editarOrden(id, data) {
  return apiFetch(`/ordenes-produccion/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function eliminarOrden(id) {
  return apiFetch(`/ordenes-produccion/${id}`, { method: "DELETE" });
}

export async function cambiarEstadoOrden(id, estadoNum, loteData = {}) {
  const body = { Estado: estadoNum, ...loteData };
  return apiFetch(`/ordenes-produccion/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify(body),
    timeout: 60000,
  });
}
