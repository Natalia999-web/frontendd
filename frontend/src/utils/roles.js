/**
 * Reconocer el rol de reparto.
 *
 * El nombre del rol no es una constante del sistema: lo escribe quien lo crea
 * en Configuración → Roles, así que llega como "Domiciliario", "domiciliario",
 * "Repartidor"… El panel comparaba con === "Domiciliario" y cualquier otra
 * forma caía al Dashboard general, que el repartidor no tiene permitido: por
 * eso al entrar le salía "sin acceso".
 *
 * Se compara igual que en la app móvil: sin acentos, en minúscula y por
 * contenido (ver session_service.dart, _buildUsuarioDesdeApiData).
 */
const normalizar = (texto) =>
  (texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const esRolRepartidor = (rol) => {
  const r = normalizar(rol);
  return r.includes("domicil") || r.includes("repart");
};

/**
 * Lo único que un repartidor puede abrir dentro de /admin: su propio panel.
 * Fuera de aquí no tiene nada que ver — ni pedidos ajenos, ni los domicilios
 * de sus compañeros.
 */
export const RUTAS_REPARTIDOR = [
  "/admin/mi-dashboard",
  "/admin/pedido-actual",
  "/admin/mis-entregas",
  "/admin/historial-entregas",
  "/admin/mis-ganancias",
  "/admin/mis-notificaciones",
  "/admin/mi-perfil-repartidor",
  "/admin/perfil",
];

export const esRutaDeRepartidor = (pathname) =>
  RUTAS_REPARTIDOR.some(r => pathname === r || pathname.startsWith(`${r}/`));
