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
 * ¿Este empleado puede llevar un domicilio?
 *
 * Los paneles armaban su propia lista a mano y metían a los administradores
 * (`idRol === 1`, "admin", "administrador"), así que "Administrador Toston"
 * aparecía como opción al asignar repartidor. Además no coincidían entre sí en
 * el id del rol de reparto: uno usaba 4 y el otro 3, que es otro rol.
 *
 * El 4 es el rol de reparto que trae el sistema, pero se pueden crear otros
 * desde Configuración → Roles, así que también se reconoce por el nombre —
 * misma regla que el backend en domicilios/services/router.py.
 */
export const esEmpleadoRepartidor = (u) =>
  !!u &&
  u.tipo === "empleado" &&
  !!u.estado &&
  (u.idRol === 4 || esRolRepartidor(u.rol));

/**
 * Lo único que un repartidor puede abrir dentro de /admin: su propio panel.
 * Fuera de aquí no tiene nada que ver — ni pedidos ajenos, ni los domicilios
 * de sus compañeros.
 */
/** Adonde cae el repartidor al entrar: sus entregas activas, que es con lo
 *  que arranca el turno. La lista abre filtrada en "Activos". */
export const INICIO_REPARTIDOR = "/admin/mis-entregas";

export const RUTAS_REPARTIDOR = [
  INICIO_REPARTIDOR,
  "/admin/mi-dashboard",
  "/admin/pedido-actual",
  "/admin/historial-entregas",
  "/admin/mis-ganancias",
  "/admin/mis-notificaciones",
  "/admin/mi-perfil-repartidor",
  "/admin/perfil",
];

export const esRutaDeRepartidor = (pathname) =>
  RUTAS_REPARTIDOR.some(r => pathname === r || pathname.startsWith(`${r}/`));
