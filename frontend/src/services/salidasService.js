import { apiFetch } from "../utils/api";

export async function registrarSalida({ tipo, idInsumo, idProducto, cantidad, motivo }) {
  return apiFetch("/salidas/", {
    method: "POST",
    timeout: 150000,
    body: JSON.stringify({
      Tipo:        tipo,
      ID_Insumo:   idInsumo   != null ? Number(idInsumo)   : null,
      ID_Producto: idProducto != null ? Number(idProducto) : null,
      Cantidad:    Number(cantidad),
      Motivo:      motivo     ?? null,
    }),
  });
}

export async function getSalidas({ pagina = 1, porPagina = 100, tipo, idInsumo, idProducto } = {}) {
  const params = new URLSearchParams({ pagina, por_pagina: porPagina });
  if (tipo)       params.append("tipo",        tipo);
  if (idInsumo)   params.append("id_insumo",   idInsumo);
  if (idProducto) params.append("id_producto", idProducto);
  return apiFetch(`/salidas/?${params}`, { timeout: 60000 });
}

export async function anularSalida(id) {
  return apiFetch(`/salidas/${id}/anular`, { method: "PATCH" });
}

export async function procesarVencidos() {
  return apiFetch("/salidas/procesar-vencidos", { method: "POST" });
}
