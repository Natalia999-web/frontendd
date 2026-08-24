import { apiFetch } from "../utils/api";
import { fmtFecha } from "../utils/dateUtils.js";

function adaptarUsuario(u) {
  return {
    id:            u.id,
    cedula:        u.Cedula,
    tipoDocumento: u.Tipo_Documento,
    nombre:        u.Nombre,
    apellidos:     u.Apellidos,
    correo:        u.Correo,
    direccion:     u.Direccion,
    municipio:     u.Municipio,
    departamento:  u.Departamento,
    telefono:      u.Telefono,
    idRol:         u.ID_Rol,
    rol:           u.nombre_rol,
    estado:        u.Estado === 1,
    fecha_creacion: u.Fecha_Creacion ?? u.Fecha_creacion,
    fechaCreacion: fmtFecha(u.Fecha_Creacion ?? u.Fecha_creacion),
    tipo:          u.tipo,
    foto:          null,
  };
}

export async function getUsuarios({ pagina = 1, porPagina = 100, busqueda = "" } = {}) {
  const params = new URLSearchParams({ pagina, por_pagina: porPagina });
  if (busqueda) params.append("busqueda", busqueda);
  const data = await apiFetch(`/usuarios/?${params}`);
  return (data.personas || []).map(adaptarUsuario);
}

export async function crearEmpleado(data) {
  return apiFetch("/usuarios/empleado", { method: "POST", body: JSON.stringify(data) });
}

export async function crearCliente(data) {
  return apiFetch("/usuarios/cliente", { method: "POST", body: JSON.stringify(data) });
}

export async function editarUsuario(tipo, id, data) {
  return apiFetch(`/usuarios/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function eliminarUsuario(tipo, id) {
  return apiFetch(`/usuarios/${id}`, { method: "DELETE" });
}

export async function toggleEstadoUsuario(tipo, id, estadoActual) {
  return apiFetch(`/usuarios/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ Estado: estadoActual ? 2 : 1 }),
  });
}
