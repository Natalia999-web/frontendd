import { apiFetch } from "../utils/api";

const ESTADO_DOM_MAP = {
  3:  "Pendiente",
  5:  "Cancelado",
  8:  "Entregado",
  9:  "En camino",
  10: "Asignado",
  13: "En proceso",
};

const adaptDomicilio = (d) => {
  const estadoRaw = d.estado_label || d.Estado || d.estado;
  const estado = typeof estadoRaw === "number"
    ? (ESTADO_DOM_MAP[estadoRaw] || "Pendiente")
    : (estadoRaw || "Pendiente");
  return {
    id:                 d.ID_Domicilio,
    numero:             `DOM-${d.ID_Domicilio}`,
    estadoId:           d.Estado || null,
    estado,
    idEmpleado:         d.ID_Empleado         || null,
    nombre_repartidor:  d.nombre_repartidor   || "",
    direccion_entrega:  d.Direccion_entrega   || "",
    municipio_entrega:  d.Municipio_entrega   || "",
    obs_domicilio:      d.Observaciones       || "",
    fecha_pedido:       d.Fecha_asignacion    || "",
    fecha_entrega_real: d.Fecha_entrega       || null,
    total:              d.total               || 0,
    metodo_pago:        d.metodo_pago         || "",
    comprobante_pago:   d.comprobante_pago    || null,
    productos:          d.productos           || [],
    estado_pago:        d.estado_pago        || null,
    domicilio:          true,
    venta_estado_id:    d.venta_estado ?? null,
    cliente: {
      nombre:   d.nombre_cliente   || "",
      correo:   "",
      telefono: d.telefono_cliente || "",
    },
  };
};

export const getDomicilios = async ({
  pagina = 1, porPagina = 100, estado = "", idEmpleado = null,
  fechaInicio = null, fechaFin = null,
} = {}) => {
  const params = new URLSearchParams({ pagina, por_pagina: porPagina });
  if (estado)      params.append("estado",       encodeURIComponent(estado));
  if (idEmpleado)  params.append("id_empleado",  idEmpleado);
  if (fechaInicio) params.append("fecha_inicio",  fechaInicio);
  if (fechaFin)    params.append("fecha_fin",     fechaFin);
  const data = await apiFetch(`/domicilios/?${params}`);
  return {
    total:      data.total,
    pagina:     data.pagina,
    por_pagina: data.por_pagina,
    domicilios: (data.domicilios || []).map(adaptDomicilio),
  };
};

export const getDomicilio = async (id) => {
  const data = await apiFetch(`/domicilios/${id}`);
  return adaptDomicilio(data);
};

export const getResumenDia = async () => {
  return apiFetch("/domicilios/resumen");
};

export const asignarRepartidor = async (id, idEmpleado) => {
  return apiFetch(`/domicilios/${id}/repartidor`, {
    method: "PATCH",
    body: JSON.stringify({ ID_Empleado: idEmpleado }),
  });
};

export const cambiarEstadoDomicilio = async (id, estado, observaciones = null) => {
  const body = { Estado: estado };
  if (observaciones !== null) body.Observaciones = observaciones;
  return apiFetch(`/domicilios/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
};

export const actualizarDomicilio = async (id, data) => {
  return apiFetch(`/domicilios/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

// OTP — código determinístico (igual fórmula que el backend)
export const computarOTP = (idDomicilio) =>
  String((idDomicilio * 7331 + 4729) % 9000 + 1000);

export const verificarOTP = async (id, codigo) => {
  return apiFetch(`/domicilios/${id}/verificar-otp`, {
    method: "POST",
    body: JSON.stringify({ codigo }),
  });
};

export const registrarPagoEfectivo = async (id, { recibido, monto = null, motivo = null }) => {
  return apiFetch(`/domicilios/${id}/registrar-pago-efectivo`, {
    method: "PATCH",
    body: JSON.stringify({ recibido, monto, motivo }),
  });
};

// Chat
export const getMensajes = async (id) => {
  return apiFetch(`/domicilios/${id}/mensajes`);
};

export const enviarMensaje = async (id, contenido) => {
  return apiFetch(`/domicilios/${id}/mensajes`, {
    method: "POST",
    body: JSON.stringify({ Contenido: contenido }),
  });
};
