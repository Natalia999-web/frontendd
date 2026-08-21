import { apiFetch } from "../utils/api";
import { fmtFecha } from "../utils/dateUtils.js";

// Adapta un producto (con ficha_tecnica anidada) al shape que usa la UI
const adaptFicha = (producto) => {
  const f = producto.ficha_tecnica;
  return {
    id:            f.ID_Ficha,
    producto:      producto.nombre,
    productoId:    String(producto.ID_Producto),
    categoria:     producto.nombre_categoria || "",
    version:       f.Version || "v1.0",
    estado:        f.Estado === 1,
    fecha:         fmtFecha(f.Fecha_Creacion),
    fotoPreview:      (producto.imagenes || [])[0]?.url || null,
    procedimiento:    f.Procedimiento || "",
    observaciones:    f.Observaciones || "",
    vidaUtilCantidad: f.Dias_Vida_Util != null ? String(f.Dias_Vida_Util) : "",
    vidaUtilUnidad:   f.Vida_Util_Unidad || "dias",
    insumos: (f.insumos || []).map(i => ({
      id:              i.ID_Ficha_Insumo || (Date.now() + Math.random()),
      idInsumo:        i.ID_Insumo,
      idCategoria:     String(i.ID_Categoria || ""),
      nombreCategoria: i.nombre_categoria || "",
      nombre:          i.nombre_insumo || "",
      cantidad:        String(i.Cantidad || ""),
      unidad:          i.Unidad || "",
    })),
  };
};

const buildInsumos = (insumos) =>
  (insumos || [])
    .filter(i => i.idInsumo && i.cantidad)
    .map(i => ({
      ID_Insumo: Number(i.idInsumo),
      Cantidad:  Number(i.cantidad),
      Unidad:    i.unidad || null,
    }));

export const getFichas = async () => {
  const data = await apiFetch("/productos/?por_pagina=100");
  return (data.productos || [])
    .filter(p => p.ficha_tecnica != null)
    .map(adaptFicha);
};

export const crearFicha = async (payload) => {
  const idProducto = payload.productoId || payload.ID_Producto;
  if (!idProducto) throw new Error("Selecciona un producto para la ficha");
  const data = await apiFetch(`/productos/${idProducto}/ficha`, {
    method: "POST",
    body: JSON.stringify({
      Version:          payload.version       || null,
      Observaciones:    payload.observaciones || null,
      Procedimiento:    payload.procedimiento || null,
      Dias_Vida_Util:   payload.vidaUtilCantidad ? Number(payload.vidaUtilCantidad) : null,
      Vida_Util_Unidad: payload.vidaUtilCantidad ? (payload.vidaUtilUnidad || "dias") : null,
      insumos:          buildInsumos(payload.insumos),
    }),
  });
  return adaptFicha(data);
};

export const editarFicha = async (productoId, payload) => {
  const data = await apiFetch(`/productos/${productoId}/ficha`, {
    method: "PUT",
    body: JSON.stringify({
      Version:          payload.version       || null,
      Observaciones:    payload.observaciones || null,
      Procedimiento:    payload.procedimiento || null,
      Dias_Vida_Util:   payload.vidaUtilCantidad ? Number(payload.vidaUtilCantidad) : null,
      Vida_Util_Unidad: payload.vidaUtilCantidad ? (payload.vidaUtilUnidad || "dias") : null,
      insumos:          buildInsumos(payload.insumos),
    }),
  });
  return adaptFicha(data);
};

export const eliminarFicha = async (productoId) => {
  return apiFetch(`/productos/${productoId}/ficha`, { method: "DELETE" });
};

export const toggleEstadoFicha = async (productoId, estadoActual) => {
  const data = await apiFetch(`/productos/${productoId}/ficha`, {
    method: "PUT",
    body: JSON.stringify({ Estado: estadoActual ? 2 : 1 }),
  });
  return adaptFicha(data);
};
