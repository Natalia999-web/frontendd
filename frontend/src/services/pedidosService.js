import { apiFetch } from "../utils/api";

// Estados de VENTA (tabla global Estados). Son los que usa
// pedidos/services/estados.py: EstadoPedido. Los IDs 2 y 3 no se usan para
// ventas, por eso no aparecen aquí.
export const ESTADO_PEDIDO_MAP = {
  1:  "Pendiente",
  4:  "Confirmado",
  5:  "Cancelado",
  8:  "Entregado",
  9:  "En camino",
  10: "Asignado",
  11: "Listo",
  13: "En producción",
  16: "Fecha propuesta",
};

const adaptPedido = (p) => {
  const estado = ESTADO_PEDIDO_MAP[p.Estado] || p.estado_label || "Pendiente";
  return {
    id:               p.ID_Venta          || p.id,
    numero:           p.Numero_Pedido     || p.numero_pedido   || p.numero || `V-${p.ID_Venta || p.id}`,
    estado,
    metodo_pago:      p.Metodo_Pago       || p.metodo_pago     || "",
    // Pago mixto: cuánto va de cada forma (null en el resto de pedidos).
    monto_efectivo:      p.monto_efectivo      ?? null,
    monto_transferencia: p.monto_transferencia ?? null,
    domicilio:        !!(p.tiene_domicilio ?? p.Domicilio ?? p.domicilio),
    id_domicilio:     p.ID_Domicilio || null,
    direccion_entrega: p.direccion_entrega    || "",
    municipio:         p.municipio_entrega    || "",
    departamento:      p.departamento_entrega || "",
    subtotal:         p.subtotal_bruto    || p.Subtotal         || p.subtotal || 0,
    descuento:        p.credito_aplicado  || p.Descuento        || p.descuento || 0,
    total:            p.Total             || p.total            || 0,
    notas:            p.Notas             || p.notas            || "",
    fecha_pedido:     p.Fecha_pedido      || p.Fecha_Pedido     || p.fecha_pedido || "",
    fecha_actualizacion: p.Fecha_Actualizacion || p.fecha_actualizacion || null,
    idCliente:        p.ID_Usuario        || p.ID_Cliente       || p.id_cliente   || null,
    idEmpleado:          p.ID_Empleado          || p.id_empleado         || null,
    nombre_domiciliario: p.nombre_domiciliario  || null,
    orden_produccion:      (p.ordenes_produccion_pendientes > 0) || !!(p.Orden_Produccion ?? p.orden_produccion),
    requiereProduccion:    !!(p.requiere_produccion),
    requiereFechaPropuesta: !!(p.requiere_fecha_propuesta),
    fecha_propuesta:  p.Fecha_Propuesta || p.fecha_propuesta || p.Fecha_entrega_esperada || null,
    fecha_rechazada:  p.fecha_rechazada || null,
    comprobante:             p.comprobante_pago || p.Comprobante || p.comprobante || null,
    observaciones_domicilio: p.observaciones_domicilio || null,
    sobre_stock:      !!(p.sobre_stock),
    anticipo_requerido: p.anticipo_requerido != null ? Number(p.anticipo_requerido) : null,
    anticipo_pagado:    p.anticipo_pagado    != null ? Number(p.anticipo_pagado)    : null,
    anticipo_monto:     p.anticipo_monto     != null ? Number(p.anticipo_monto)     : null,
    anticipo_metodo_pago:    p.anticipo_metodo_pago    || null,
    anticipo_comprobante_url: p.anticipo_comprobante_url || null,
    anticipo_registrado:    !!(p.anticipo_registrado),
    requiere_anticipo:      !!(p.requiere_anticipo),
    pago_final_registrado:     !!(p.pago_final_registrado),
    pago_final_monto:          p.pago_final_monto    != null ? Number(p.pago_final_monto) : null,
    pago_final_metodo_pago:    p.pago_final_metodo_pago    || null,
    pago_final_comprobante_url: p.pago_final_comprobante_url || null,
    pago_final_fecha:          p.pago_final_fecha    || null,
    estado_pago:               p.estado_pago         || null,
    cliente: {
      nombre:   p.nombre_cliente   || "",
      correo:   p.correo_cliente   || "",
      telefono: p.telefono_cliente || "",
    },
    productosItems: (p.productos || p.Productos || []).map(i => ({
      idProducto:       i.ID_Producto    || i.id_producto,
      nombre:           i.nombre_producto || i.Nombre || i.nombre || "",
      precio:           i.precio_unitario || i.Precio_venta || i.precio || 0,
      cantidad:         i.Cantidad        || i.cantidad || 0,
      cantidad_preorden: i.cantidad_preorden || 0,
    })),
  };
};

export const getPedidos = async ({ pagina = 1, porPagina = 100, estado = null, timeout } = {}) => {
  let url = `/pedidos/?pagina=${pagina}&por_pagina=${porPagina}`;
  if (estado != null) url += `&estado=${estado}`;
  const data = await apiFetch(url, timeout ? { timeout } : {});
  return {
    total:     data.total,
    pagina:    data.pagina,
    por_pagina:data.por_pagina,
    pedidos:   (data.pedidos || []).map(adaptPedido),
  };
};

export const getHistorialPedidos = async ({ pagina = 1, porPagina = 100 } = {}) => {
  const data = await apiFetch(`/ventas/?pagina=${pagina}&por_pagina=${porPagina}`);
  if (!data) return { total: 0, pedidos: [] };
  return {
    total:   data.total,
    pedidos: (data.pedidos || data.ventas || [])
      .map(adaptPedido)
      .filter(p => ["Entregado", "Cancelado"].includes(p.estado)),
  };
};

export const getPedido = async (id) => {
  const data = await apiFetch(`/pedidos/${id}`);
  return adaptPedido(data);
};

export const confirmarPedido = async (id) => {
  return apiFetch(`/pedidos/${id}/confirmar`, { method: "PATCH" });
};

export const cancelarPedido = async (id, motivo = null) => {
  const options = { method: "PATCH" };
  if (motivo) options.body = JSON.stringify({ Motivo: motivo });
  return apiFetch(`/pedidos/${id}/cancelar`, options);
};

export const crearPedido = async (data) => {
  return apiFetch("/ventas/", { method: "POST", body: JSON.stringify(data) });
};

export const editarPedido = async (id, data) => {
  return apiFetch(`/pedidos/${id}`, { method: "PUT", body: JSON.stringify(data) });
};

export const eliminarPedido = async (id) => {
  return apiFetch(`/pedidos/${id}`, { method: "DELETE" });
};

export const registrarPagoFinal = async (id, { monto, metodo_pago, comprobante_url }) => {
  const data = await apiFetch(`/ventas/${id}/registrar-pago-final`, {
    method: "POST",
    body: JSON.stringify({ monto, metodo_pago, comprobante_url: comprobante_url ?? null }),
  });
  return adaptPedido(data);
};

export const cambiarEstadoVenta = async (id, estadoId) => {
  return apiFetch(`/ventas/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ Estado: estadoId }),
  });
};

export const getMiCredito = async () => {
  return apiFetch("/ventas/mi-credito");
};

export const getMisVentas = async ({ pagina = 1, porPagina = 100 } = {}) => {
  const data = await apiFetch(`/ventas/mis-ventas?pagina=${pagina}&por_pagina=${porPagina}`);
  return {
    total:   data.total,
    pedidos: (data.pedidos || data.ventas || []).map(adaptPedido),
  };
};

export const cancelarMiPedido = async (id) =>
  apiFetch(`/pedidos/${id}/cancelar-mi-pedido`, { method: "PATCH" });

export const proponerFechaProduccion = async (id, fecha) =>
  apiFetch(`/ventas/${id}/proponer-fecha`, {
    method: "PATCH",
    body: JSON.stringify({ fecha_entrega: fecha }),
  });

export const aceptarFechaProduccion = async (id) =>
  apiFetch(`/ventas/${id}/aceptar-fecha`, { method: "PATCH" });

export const rechazarFechaProduccion = async (id) =>
  apiFetch(`/ventas/${id}/rechazar-fecha`, { method: "PATCH" });

export const aprobarComprobante = async (id) =>
  apiFetch(`/pedidos/${id}/aprobar-comprobante`, { method: "PATCH" });

export const rechazarComprobante = async (id, motivo) =>
  apiFetch(`/pedidos/${id}/rechazar-comprobante`, {
    method: "PATCH",
    body: JSON.stringify({ motivo }),
  });

export const registrarCobroPedido = async (id, { recibido, monto = null, motivo = null }) =>
  apiFetch(`/pedidos/${id}/registrar-cobro`, {
    method: "PATCH",
    body: JSON.stringify({ recibido, monto, motivo }),
  });
