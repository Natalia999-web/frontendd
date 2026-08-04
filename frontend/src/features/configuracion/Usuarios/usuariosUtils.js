// ─── COLORS ───────────────────────────────────────────────
export const G     = "#3a8f2a";
export const GD    = "#2d7020";
export const GL    = "#e8f5e2";
export const GB    = "#5ab535";
export const GGLOW = "rgba(90,181,53,0.18)";

// ─── ROL_STYLES base (solo para los 3 roles iniciales) ────
// Los roles dinámicos generan su estilo en getRolStyle()
export const ROL_STYLES = {
  Admin:    { bg: "#d4edda", color: "#1a6b2a", border: "#5ab535" },
  Empleado: { bg: "#fff3cd", color: "#856404", border: "#ffc107" },
  Cliente:  { bg: "#e3eeff", color: "#1a4db5", border: "#6b9ef5" },
};

// Paleta de colores para roles creados dinámicamente
const PALETA = [
  { bg: "#f3e8ff", color: "#6b21a8", border: "#c084fc" },
  { bg: "#fce7f3", color: "#9d174d", border: "#f472b6" },
  { bg: "#ffedd5", color: "#9a3412", border: "#fb923c" },
  { bg: "#e0f2fe", color: "#075985", border: "#38bdf8" },
  { bg: "#dcfce7", color: "#166534", border: "#4ade80" },
  { bg: "#fef9c3", color: "#854d0e", border: "#facc15" },
];

// Genera o devuelve el estilo de un rol por nombre
export function getRolStyle(nombre) {
  if (!nombre) return PALETA[0];
  if (ROL_STYLES[nombre]) return ROL_STYLES[nombre];
  // Hash simple del nombre para elegir color consistente
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash += nombre.charCodeAt(i);
  return PALETA[hash % PALETA.length];
}

// ─── Validación de contraseña ──────────────────────────
export function validatePassword(password, confirm) {
  const errors = [];
  if (!password) {
    errors.push("Campo obligatorio");
  } else {
    if (password.length < 8) errors.push("Mínimo 8 caracteres");
    if (!/[A-Z]/.test(password)) errors.push("Al menos una mayúscula");
    if (!/[a-z]/.test(password)) errors.push("Al menos una minúscula");
    if (!/\d/.test(password))           errors.push("Al menos un número");
    if (!/[^A-Za-z0-9]/.test(password)) errors.push("Al menos un carácter especial (!@#...)");
  }
  if (confirm !== undefined && password !== confirm) {
    errors.push("Las contraseñas no coinciden");
  }
  return errors.length ? errors.join(", ") : null;
}

// ─── Validación de cédula ────────────────────────────
export function validateCedula(cedula, tipoDocumento) {
  if (!cedula || !cedula.trim()) {
    return "La cédula es obligatoria";
  }
  
  const cedulaLimpia = cedula.replace(/\D/g, "");
  
  // Validar que solo tenga dígitos
  if (!cedulaLimpia) {
    return "La cédula debe contener solo números";
  }
  
  // Validar rango de dígitos según tipo de documento
  const minDigitos = tipoDocumento === "NIT" ? 9 : 8;
  const maxDigitos = tipoDocumento === "NIT" ? 11 : 10;
  
  if (cedulaLimpia.length < minDigitos || cedulaLimpia.length > maxDigitos) {
    return `La cédula debe tener entre ${minDigitos} y ${maxDigitos} dígitos`;
  }
  
  return null;
}

// ─── Validación de teléfono ──────────────────────────
export function validateTelefono(telefono) {
  if (!telefono || !telefono.trim()) {
    return "El teléfono es obligatorio";
  }
  
  const telefonoLimpio = telefono.replace(/\D/g, "");
  
  // Validar que solo tenga dígitos
  if (!telefonoLimpio) {
    return "El teléfono debe contener solo números";
  }
  
  if (telefonoLimpio.length !== 10) {
    return "El teléfono debe tener exactamente 10 dígitos";
  }

  return null;
}

// ─── INITIAL DATA ─────────────────────────────────────────
export const INIT_USERS = [
  { id:1, nombre:"Ana",    apellidos:"García",     telefono:"321-555-0001", cedula:"1001234567", correo:"ana@tostones.com",    direccion:"Calle 10 #5-20",      municipio:"Medellín",  departamento:"Cundinamarca", contrasena:"", rol:"Admin",    estado:true,  fechaCreacion:"15/01/2024", foto:null, esAdmin:true  },
  { id:2, nombre:"Carlos", apellidos:"López",      telefono:"322-555-0002", cedula:"1009876543", correo:"carlos@tostones.com", direccion:"Carrera 7 #14-30",    municipio:"Medellín",  departamento:"Cundinamarca", contrasena:"", rol:"Empleado", estado:true,  fechaCreacion:"02/03/2024", foto:null },
  { id:3, nombre:"María",  apellidos:"Rodríguez",  telefono:"315-555-0003", cedula:"1011223344", correo:"maria@tostones.com",  direccion:"Av. El Poblado 45",   municipio:"Medellín",  departamento:"Cundinamarca", contrasena:"", rol:"Cliente",  estado:true,  fechaCreacion:"18/05/2024", foto:null },
  { id:4, nombre:"Juan",   apellidos:"Martínez",   telefono:"318-555-0004", cedula:"1055667788", correo:"juan@tostones.com",   direccion:"Calle 80 #23-10",     municipio:"Medellín",  departamento:"Cundinamarca", contrasena:"", rol:"Empleado", estado:true,  fechaCreacion:"09/07/2024", foto:null },
  { id:5, nombre:"Sofía",  apellidos:"Herrera",    telefono:"311-555-0005", cedula:"1099001122", correo:"sofia@tostones.com",  direccion:"Transversal 6 #8-5",  municipio:"Medellín",  departamento:"Cundinamarca", contrasena:"", rol:"Cliente",  estado:false, fechaCreacion:"25/09/2024", foto:null },
];

export const EMPTY_FORM = {
  nombre:       "",
  apellidos:    "",
  tipoDocumento: "CC",
  cedula:       "",
  correo:       "",
  direccion:    "",
  municipio:    "",
  departamento: "",
  telefono:     "",
  foto:         null,
  fechaCreacion: new Date().toLocaleDateString("es-CO"),
  contrasena:   "",
  confirmar:    "",
  rol:          "",
  estado:       true,
};

export const EMPTY_FILTERS = { roles: [], estado: "", desde: "", hasta: "" };

export const PER_PAGE = 5;

export const TIPO_DOC = ['CC', 'CE', 'TI', 'NIT', 'PPT', 'Pasaporte'];