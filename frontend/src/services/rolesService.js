import { apiFetch } from "../utils/api";

// frontend clave → backend integer ID
const PERMISOS_MAP = {
  "LandingPage_ver":                60,
  "LandingPage_editar":             61,
  "Dashboard_ver":                   1,
  "Roles_ver":                       2,
  "Roles_crear":                     3,
  "Roles_editar":                    4,
  "Roles_eliminar":                  5,
  "Usuarios_ver":                    6,
  "Usuarios_crear":                  7,
  "Usuarios_editar":                 8,
  "Usuarios_eliminar":               9,
  "GestionSalidas_ver":             10,
  "GestionSalidas_crear":           11,
  "GestionSalidas_editar":          12,
  "GestionSalidas_eliminar":        13,
  "CategoriaInsumos_ver":           14,
  "CategoriaInsumos_crear":         15,
  "CategoriaInsumos_editar":        16,
  "CategoriaInsumos_eliminar":      17,
  "Insumos_ver":                    18,
  "Insumos_crear":                  19,
  "Insumos_editar":                 20,
  "Insumos_eliminar":               21,
  "Insumos_generar_salida":         22,
  "Proveedores_ver":                23,
  "Proveedores_crear":              24,
  "Proveedores_editar":             25,
  "Proveedores_eliminar":           26,
  "Compras_ver":                    27,
  "Compras_crear":                  28,
  "Compras_editar":                 29,
  "Compras_anular":                 30,
  "CategoriaProductos_ver":         31,
  "CategoriaProductos_crear":       32,
  "CategoriaProductos_editar":      33,
  "CategoriaProductos_eliminar":    34,
  "GestionProductos_ver":           35,
  "GestionProductos_crear":         36,
  "GestionProductos_editar":        37,
  "GestionProductos_eliminar":      38,
  "GestionProductos_generar_salida":39,
  "OrdenesProduccion_ver":          40,
  "OrdenesProduccion_crear":        41,
  "OrdenesProduccion_editar":       42,
  "OrdenesProduccion_cancelar":     43,
  "Pedidos_ver":                    44,
  "Pedidos_crear":                  45,
  "Pedidos_editar":                 46,
  "Pedidos_eliminar":               47,
  "GestionVentas_ver":              48,
  "GestionVentas_crear":            49,
  "GestionVentas_editar":           50,
  "GestionVentas_eliminar":         51,
  "Devoluciones_ver":               52,
  "Devoluciones_crear":             53,
  "Devoluciones_editar":            54,
  "Devoluciones_aprobar":           56,
  "Devoluciones_desaprobar":        56,
  "Domicilios_ver":                 57,
  "Domicilios_ver_detalles":        58,
  "Domicilios_cambiar_estado":      59,
  "Liquidaciones_ver":              62,
  "Liquidaciones_crear":            63,
  "Liquidaciones_editar":           64,
  "Liquidaciones_eliminar":         65,
  "Liquidaciones_anular":           66,
};

// backend Permiso string → frontend clave(s)
const PERMISOS_REVERSE = {
  "ver_landing_page":          "LandingPage_ver",
  "editar_landing_page":       "LandingPage_editar",
  "ver_dashboard":             "Dashboard_ver",
  "ver_roles":                 "Roles_ver",
  "crear_roles":               "Roles_crear",
  "editar_roles":              "Roles_editar",
  "eliminar_roles":            "Roles_eliminar",
  "ver_usuarios":              "Usuarios_ver",
  "crear_usuarios":            "Usuarios_crear",
  "editar_usuarios":           "Usuarios_editar",
  "eliminar_usuarios":         "Usuarios_eliminar",
  "ver_salidas":               "GestionSalidas_ver",
  "crear_salidas":             "GestionSalidas_crear",
  "editar_salidas":            "GestionSalidas_editar",
  "eliminar_salidas":          "GestionSalidas_eliminar",
  "ver_cat_insumos":           "CategoriaInsumos_ver",
  "crear_cat_insumos":         "CategoriaInsumos_crear",
  "editar_cat_insumos":        "CategoriaInsumos_editar",
  "eliminar_cat_insumos":      "CategoriaInsumos_eliminar",
  "ver_insumos":               "Insumos_ver",
  "crear_insumos":             "Insumos_crear",
  "editar_insumos":            "Insumos_editar",
  "eliminar_insumos":          "Insumos_eliminar",
  "generar_salida_insumo":     "Insumos_generar_salida",
  "ver_proveedores":           "Proveedores_ver",
  "crear_proveedores":         "Proveedores_crear",
  "editar_proveedores":        "Proveedores_editar",
  "eliminar_proveedores":      "Proveedores_eliminar",
  "ver_compras":               "Compras_ver",
  "crear_compras":             "Compras_crear",
  "editar_compras":            "Compras_editar",
  "anular_compras":            "Compras_anular",
  "ver_cat_productos":         "CategoriaProductos_ver",
  "crear_cat_productos":       "CategoriaProductos_crear",
  "editar_cat_productos":      "CategoriaProductos_editar",
  "eliminar_cat_productos":    "CategoriaProductos_eliminar",
  "ver_productos":             "GestionProductos_ver",
  "crear_productos":           "GestionProductos_crear",
  "editar_productos":          "GestionProductos_editar",
  "eliminar_productos":        "GestionProductos_eliminar",
  "generar_salida_producto":   "GestionProductos_generar_salida",
  "ver_ordenes":               "OrdenesProduccion_ver",
  "crear_ordenes":             "OrdenesProduccion_crear",
  "editar_ordenes":            "OrdenesProduccion_editar",
  "eliminar_ordenes":          "OrdenesProduccion_cancelar",
  "ver_pedidos":               "Pedidos_ver",
  "crear_pedidos":             "Pedidos_crear",
  "editar_pedidos":            "Pedidos_editar",
  "eliminar_pedidos":          "Pedidos_eliminar",
  "ver_ventas":                "GestionVentas_ver",
  "crear_ventas":              "GestionVentas_crear",
  "editar_ventas":             "GestionVentas_editar",
  "eliminar_ventas":           "GestionVentas_eliminar",
  "ver_devoluciones":          "Devoluciones_ver",
  "crear_devoluciones":        "Devoluciones_crear",
  "editar_devoluciones":       "Devoluciones_editar",
  "eliminar_devoluciones":     null,
  "aprobar_devoluciones":      ["Devoluciones_aprobar", "Devoluciones_desaprobar"],
  "ver_domicilios":            "Domicilios_ver",
  "ver_detalle_domicilios":    "Domicilios_ver_detalles",
  "cambiar_estado_domicilios": "Domicilios_cambiar_estado",
  "ver_liquidaciones":         "Liquidaciones_ver",
  "crear_liquidaciones":       "Liquidaciones_crear",
  "editar_liquidaciones":      "Liquidaciones_editar",
  "eliminar_liquidaciones":    "Liquidaciones_eliminar",
  "anular_liquidaciones":      "Liquidaciones_anular",
};

const DEFAULT_EMOJI_MAP = [
  [["admin", "administrador", "gerente", "director"],              "👑"],
  [["domiciliario", "repartidor", "delivery", "mensajero"],        "🛵"],
  [["vendedor", "venta", "ventas", "comercial", "asesor"],         "🛒"],
  [["produccion", "producción", "chef", "cocina", "cocinero"],     "🧑‍🍳"],
  [["bodega", "almacen", "almacén", "inventario", "logistica"],    "📦"],
  [["contador", "contabilidad", "finanzas", "tesorero"],           "📊"],
  [["sistemas", "soporte", "tecnico", "técnico", "informatica"],   "🧑‍💻"],
  [["supervisor", "coordinador", "jefe"],                          "🔍"],
  [["cajero", "caja", "cobrador"],                                 "💵"],
  [["seguridad", "vigilante", "portero"],                          "🛡️"],
  [["rrhh", "recursos", "talento", "personal"],                    "🤝"],
  [["marketing", "publicidad", "community"],                       "📢"],
  [["cliente", "comprador"],                                       "🧑"],
];

function getDefaultEmoji(nombre) {
  const lower = (nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  for (const [keys, emoji] of DEFAULT_EMOJI_MAP) {
    if (keys.some(k => lower.includes(k))) return emoji;
  }
  return "👤";
}

function adaptarRol(r) {
  const isUrl = typeof r.Icono === "string" && r.Icono.startsWith("http");

  // Convert API permisos [{ID_Permiso, Permiso, Descripcion}] → frontend clave strings
  const claves = [];
  (r.permisos || []).forEach(p => {
    const permiso = p.Permiso || p.permiso;
    if (!permiso) return;
    const mapped = PERMISOS_REVERSE[permiso];
    if (!mapped) return;
    if (Array.isArray(mapped)) {
      mapped.forEach(c => { if (!claves.includes(c)) claves.push(c); });
    } else {
      if (!claves.includes(mapped)) claves.push(mapped);
    }
  });

  return {
    id:            r.ID_Rol,
    nombre:        r.Rol,
    icono:         isUrl ? getDefaultEmoji(r.Rol) : (r.Icono || getDefaultEmoji(r.Rol)),
    iconoPreview:  isUrl ? r.Icono : null,
    estado:        r.Estado === 1,
    totalUsuarios: r.total_usuarios ?? 0,
    esAdmin:       r.protegido ?? false,
    permisos:      claves,
    fecha:         null,
  };
}

export async function getRoles({ busqueda = "" } = {}) {
  const params = new URLSearchParams({ por_pagina: 100 });
  if (busqueda) params.append("busqueda", busqueda);
  const data = await apiFetch(`/roles/?${params}`);
  return (data.roles || []).map(adaptarRol);
}

export async function crearRol(data) {
  return apiFetch("/roles/", { method: "POST", body: JSON.stringify(data) });
}

export async function editarRol(id, data) {
  return apiFetch(`/roles/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function eliminarRol(id) {
  return apiFetch(`/roles/${id}`, { method: "DELETE" });
}

export async function toggleEstadoRol(id, estadoActual) {
  return apiFetch(`/roles/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ Estado: estadoActual ? 2 : 1 }),
  });
}

export async function gestionarPermisos(id, clavas) {
  // clavas = frontend clave strings like "Dashboard_ver", deduplicate integer IDs
  const seen = new Set();
  const permisos_ids = [];
  clavas.forEach(c => {
    const intId = PERMISOS_MAP[c];
    if (intId != null && !seen.has(intId)) {
      seen.add(intId);
      permisos_ids.push(intId);
    }
  });
  return apiFetch(`/roles/${id}/permisos`, {
    method: "PUT",
    body: JSON.stringify({ permisos_ids }),
  });
}

// Calls /auth/mis-permisos (no special permission required, just a valid token)
// and maps backend permission names to frontend clave strings.
export async function getMisPermisos() {
  const data = await apiFetch("/auth/mis-permisos");
  const nombres = data.permisos || [];
  const claves = [];
  nombres.forEach(nombre => {
    const mapped = PERMISOS_REVERSE[nombre];
    if (!mapped) return;
    if (Array.isArray(mapped)) {
      mapped.forEach(c => { if (!claves.includes(c)) claves.push(c); });
    } else {
      if (!claves.includes(mapped)) claves.push(mapped);
    }
  });
  return claves;
}
