import { apiFetch } from "../utils/api";
import { labelEstadoDom, normalizarEstadoDom } from "../features/ventas/domicilios/estadosDomicilio";

const adaptDomicilio = (d) => {
  // El estado se normaliza a la numeración canónica (ver estadosDomicilio.js) y
  // la etiqueta se deriva de ahí, para no depender de dos mapas distintos.
  const estadoId = normalizarEstadoDom(d.Estado, Boolean(d.ID_Empleado));
  return {
    id:                 d.ID_Domicilio,
    idVenta:            d.ID_Venta            || null,
    numero:             `DOM-${d.ID_Domicilio}`,
    estadoId,
    estado:             labelEstadoDom(estadoId),
    idEmpleado:         d.ID_Empleado         || null,
    nombre_repartidor:  d.nombre_repartidor   || "",
    direccion_entrega:  d.Direccion_entrega   || "",
    municipio_entrega:  d.Municipio_entrega   || "",
    departamento_entrega: d.Departamento_entrega || "",
    // Observaciones = nota de esta entrega; indicaciones = referencia que el
    // cliente guardó en su perfil. El backend las envía separadas.
    obs_domicilio:      d.Observaciones       || "",
    indicaciones_cliente: d.indicaciones_cliente || "",
    fecha_pedido:       d.Fecha_asignacion    || "",
    fecha_entrega_real: d.Fecha_entrega       || null,
    total:              d.total               || 0,
    metodo_pago:        d.metodo_pago         || "",
    // Pago mixto: lo que hay que cobrar en mano (null en el resto de pedidos).
    monto_efectivo:     d.monto_efectivo ?? null,
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
  fechaInicio = null, fechaFin = null, busqueda = null,
} = {}) => {
  const params = new URLSearchParams({ pagina, por_pagina: porPagina });
  if (estado)      params.append("estado",       encodeURIComponent(estado));
  if (idEmpleado)  params.append("id_empleado",  idEmpleado);
  if (fechaInicio) params.append("fecha_inicio",  fechaInicio);
  if (fechaFin)    params.append("fecha_fin",     fechaFin);
  if (busqueda)    params.append("busqueda",      encodeURIComponent(busqueda));
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

export const registrarPagoEfectivo = async (id, { recibido, monto = null, motivo = null }) => {
  return apiFetch(`/domicilios/${id}/registrar-pago-efectivo`, {
    method: "PATCH",
    body: JSON.stringify({ recibido, monto, motivo }),
  });
};
