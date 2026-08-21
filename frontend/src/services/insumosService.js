import { apiFetch } from "../utils/api";

export async function getInsumos({ pagina = 1, porPagina = 100, busqueda = "" } = {}, options = {}) {
  const q = busqueda ? `&busqueda=${encodeURIComponent(busqueda)}` : "";
  return apiFetch(`/insumos/?pagina=${pagina}&por_pagina=${porPagina}${q}`, options);
}

export async function crearInsumo(data) {
  return apiFetch("/insumos/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function editarInsumo(id, data) {
  return apiFetch(`/insumos/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function eliminarInsumo(id) {
  return apiFetch(`/insumos/${id}`, { method: "DELETE" });
}

export async function toggleEstadoInsumo(id, estadoActual) {
  return apiFetch(`/insumos/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ Estado: estadoActual ? 2 : 1 }),
  });
}

export async function getLotesInsumo(id) {
  return apiFetch(`/insumos/${id}/lotes`);
}
