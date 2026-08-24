import { apiFetch } from "../utils/api";

export const getNotificacionesAdmin = () =>
  apiFetch("/notificaciones/", { timeout: 60000 });

export const marcarLeidaAPI = (id) =>
  apiFetch(`/notificaciones/${id}/leer`, { method: "PATCH" });

export const eliminarNotificacionAPI = (id) =>
  apiFetch(`/notificaciones/${id}`, { method: "DELETE" });

export const limpiarLeidasAPI = () =>
  apiFetch("/notificaciones/limpiar", { method: "DELETE" });

export const getMisNotificacionesCliente = () =>
  apiFetch("/notificaciones/mis-notificaciones");

export const crearNotificacionCliente = (idUsuario, tipo, titulo, mensaje) =>
  apiFetch("/notificaciones/", {
    method: "POST",
    body: JSON.stringify({ ID_Usuario: idUsuario, tipo, Titulo: titulo, Mensaje: mensaje }),
  });

export const getNotificacionesCocina = () =>
  apiFetch("/notificaciones/cocina");

export const getNotificacionesDomiciliario = () =>
  apiFetch("/notificaciones/domiciliario");
