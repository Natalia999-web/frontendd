import { apiFetch } from "../utils/api";

// Estado numérico → label string (coincide con _ESTADO_LABELS del backend)
const ESTADO_LABELS = {
  3: "Pendiente",
  6: "Reembolsada",
  7: "Rechazada",
};

const fmtFecha = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
};

const adaptDevolucion = (d) => {
  const estadoId  = d.Estado ?? null;
  const estado    = d.estado_label || ESTADO_LABELS[estadoId] || "Pendiente";
  return {
    id:              d.ID_Devolucion,
    numero:          `DEV-${d.ID_Devolucion}`,
    numeroPedido:    d.ID_Venta ? `#${d.ID_Venta}` : "",
    idVenta:         d.ID_Venta         ?? null,
    idCliente:       d.ID_Usuario       ?? null,
    estadoId,
    estado,
    motivo:          d.Motivo           || "",
    comentario:      (estadoId !== 7 ? d.Comentario : "") || "",
    fechaSolicitud:  fmtFecha(d.FechaDevolucion)  || "",
    fechaAprobacion: fmtFecha(d.FechaAprobacion) || null,
    fechaReembolso:  fmtFecha(d.FechaReembolso)  || null,
    totalDevuelto:   parseFloat(d.TotalDevuelto || 0),
    // Al rechazar, el admin pone el motivo en Comentario
    motivoRechazo:   (estadoId === 7 && d.Comentario) ? d.Comentario : "",
    cliente: {
      nombre:   d.nombre_cliente || "",
      correo:   "",
      telefono: "",
    },
    productos: (d.productos || []).map(p => ({
      idProducto:     p.ID_Producto,
      nombre:         p.nombre_producto || "",
      cantidad:       p.Cantidad        || 0,
      precioUnitario: parseFloat(p.PrecioUnitario || 0),
      subtotal:       parseFloat(p.Subtotal       || 0),
    })),
    evidencia: (() => {
      const raw = d.Comprobante_Imagen;
      if (!raw) return null;
      const lc = raw.toLowerCase();
      let tipo = "image/jpeg";
      if (lc.match(/\.(mp4|webm|mov|avi)($|\?)/)) tipo = "video/mp4";
      else if (lc.match(/\.pdf($|\?)/))           tipo = "application/pdf";
      return { url: raw, nombre: "comprobante", tipo };
    })(),
  };
};

// Admin: lista todas las devoluciones (paginación server-side)
export const getDevoluciones = async ({
  pagina = 1, porPagina = 20, busqueda = "", estadoId = null,
  fechaDesde = "", fechaHasta = "",
} = {}) => {
  const params = new URLSearchParams({ pagina, por_pagina: porPagina });
  if (busqueda)   params.set("busqueda",    busqueda);
  if (estadoId != null) params.set("estado", estadoId);
  if (fechaDesde) params.set("fecha_desde", fechaDesde);
  if (fechaHasta) params.set("fecha_hasta", fechaHasta);
  const data = await apiFetch(`/devoluciones/?${params}`);
  return {
    total:             data.total,
    pagina:            data.pagina,
    devoluciones:      (data.devoluciones || []).map(adaptDevolucion),
    totalesPorEstado:  data.totales_por_estado || {},
  };
};

// Cliente: solo sus propias devoluciones
export const getMisDevoluciones = async ({ pagina = 1, porPagina = 20 } = {}) => {
  const data = await apiFetch(`/devoluciones/mis-devoluciones?pagina=${pagina}&por_pagina=${porPagina}`);
  return {
    total:        data.total,
    pagina:       data.pagina,
    por_pagina:   data.por_pagina,
    devoluciones: (data.devoluciones || []).map(adaptDevolucion),
  };
};

// Crear devolución (cliente o admin)
// Para clientes: no enviar idCliente (el backend lo extrae del token)
// Para admins: enviar idCliente (ID_Usuario del cliente)
export const crearDevolucion = async (payload) => {
  const body = {
    ID_Venta: Number(payload.idPedido),
    Motivo:   payload.motivo,
    productos: (payload.productos || []).map(p => ({
      ID_Producto:    Number(p.idProducto),
      Cantidad:       Number(p.cantidad),
      PrecioUnitario: Number(p.precioUnitario),
    })),
  };
  if (payload.comentario)        body.Comentario = payload.comentario;
  if (payload.idCliente != null) body.ID_Usuario = Number(payload.idCliente);
  if (payload.evidencia) body.Comprobante_Imagen = payload.evidencia?.url ?? payload.evidencia;
  const data = await apiFetch("/devoluciones/", { method: "POST", body: JSON.stringify(body) });
  return adaptDevolucion(data);
};

// Admin: saldo de crédito de un cliente
export const getCreditoCliente = async (idCliente) => {
  const data = await apiFetch(`/ventas/credito-cliente/${idCliente}`);
  return data.saldo ?? 0;
};

// Admin: aprobar o rechazar
// decision: "aprobar" → Estado 6 | "rechazar" → Estado 7
export const resolverDevolucion = async (id, decision, motivoRechazo = "") => {
  const aprobando = decision === "aprobar";
  const body = {
    Estado:         aprobando ? 6 : 7,
    Comentario:     motivoRechazo || (aprobando ? null : ""),
    UsuarioAprueba: aprobando,
  };
  const data = await apiFetch(`/devoluciones/${id}/resolver`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return adaptDevolucion(data);
};
