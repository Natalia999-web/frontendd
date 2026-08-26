import { useState, useEffect } from "react";
import { AlertTriangle, Info, X, User, MapPin, ShieldCheck, Banknote, Check, Calendar, Package, CheckCircle2, XCircle, Search, Trash2 } from "lucide-react";
import { getPedidos } from "../../../services/pedidosService.js";
import { Avatar } from "./CrearUsuario.jsx";
import { Ic } from "./usuariosIcons.jsx";
import { getRolStyle } from "./usuariosUtils.js";
import "./Usuarios.css";

// ─── Campo solo lectura ───────────────────────────────────
function FieldView({ label, value, full = false }) {
  return (
    <div className="form-group" style={full ? { gridColumn: "1 / -1" } : {}}>
      <label className="form-label">{label}</label>
      <div className="field-input field-input--disabled">{value || "—"}</div>
    </div>
  );
}

// ─── Toggle visual solo lectura ───────────────────────────
function ToggleView({ value, razon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
      <div style={{ position: "relative", display: "inline-flex" }} className="toggle-tooltip-wrap">
        <button
          className="toggle-btn"
          style={{
            background: value ? "#43a047" : "#c62828",
            boxShadow: value
              ? "0 2px 8px rgba(67,160,71,0.45)"
              : "0 2px 8px rgba(198,40,40,0.3)",
            cursor: "default",
            opacity: razon ? 0.6 : 1,
          }}
        >
          <span className="toggle-thumb" style={{ left: value ? 27 : 3 }}>
            <span className="toggle-label" style={{ color: "black" }}>
              {value ? "ON" : "OFF"}
            </span>
          </span>
        </button>
        {razon && <div className="toggle-tooltip">{razon}</div>}
      </div>
      <div>
        <span style={{ fontSize: 13, fontWeight: 600, color: value ? "#2e7d32" : "#9e9e9e" }}>
          {value ? "Activo" : "Inactivo"}
        </span>
        {razon && (
          <div style={{
            fontSize: 11, marginTop: 2, fontWeight: 600,
            color: razon.startsWith("El rol") ? "#ef5350" : "#757575",
          }}>
            {razon.startsWith("El rol") ? <AlertTriangle size={11} style={{marginRight:3}} /> : <Info size={11} style={{marginRight:3}} />}{razon}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Secciones del side panel ─────────────────────────────
const NAV_ITEMS_BASE = [
  { id: "personal",  label: "Personal",  Icon: User },
  { id: "ubicacion", label: "Ubicación", Icon: MapPin },
  { id: "rol",       label: "Rol",       Icon: ShieldCheck },
];

// ─── MODAL VER USUARIO — SIDE PANEL ──────────────────────
export function ModalVerUsuario({ user, roles = [], onClose }) {
  const [activeSection, setActiveSection] = useState("personal");
  const [pedidosCliente, setPedidosCliente] = useState([]);

  const esCliente = user.tipo !== "empleado";
  const saldoFavor = 0;

  useEffect(() => {
    if (esCliente) {
      getPedidos({ porPagina: 100 }).then(data => {
        const todos = data.pedidos || [];
        setPedidosCliente(todos.filter(p => p.cliente?.correo === user.correo || p.idCliente === user.id));
      }).catch(() => {});
    }
  }, [user, esCliente]);

  const navItems = esCliente
    ? [...NAV_ITEMS_BASE, { id: "cliente", label: "Saldo", Icon: Banknote }]
    : NAV_ITEMS_BASE;

  const rolObj   = roles.find(r => r.nombre === user.rol);
  const rolStyle = getRolStyle(user.rol);
  const razonInactivo = !user.estado
    ? (rolObj && !rolObj.estado
        ? `El rol "${user.rol}" está desactivado`
        : "Desactivado manualmente")
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        style={{ maxWidth: 600, width: "100%", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Usuarios</p>
            <h2 className="modal-header__title">
              {user.nombre} {user.apellidos}
            </h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} style={{display:"flex",alignItems:"center",justifyContent:"center"}}><X size={16} /></button>
        </div>

        {/* SIDE PANEL LAYOUT */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* NAV LATERAL */}
          <nav style={{
            width: 160,
            borderRight: "1px solid #f0f0f0",
            background: "#fafdf9",
            display: "flex",
            flexDirection: "column",
            padding: "12px 0",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #f0f0f0" }}>
              <Avatar foto={user.foto} size={52} border />
            </div>

            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  border: "none",
                  borderLeft: activeSection === item.id ? "3px solid #2e7d32" : "3px solid transparent",
                  background: activeSection === item.id ? "#e8f5e9" : "transparent",
                  color: activeSection === item.id ? "#2e7d32" : "#757575",
                  fontWeight: activeSection === item.id ? 700 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                {item.Icon ? <item.Icon size={14} /> : <span style={{ fontSize: 14 }}>{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </nav>

          {/* CONTENIDO */}
          <div style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", justifyContent: "flex-start", overflowY: "auto" }}>

            {/* ── Sección: Personal ── */}
            {activeSection === "personal" && (
              <>
                <p className="section-label" style={{ marginTop: 0 }}>Identificación</p>
                <div className="form-group">
                  <label className="form-label">Tipo y Número de documento</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="doc-type">{user.tipoDocumento || "CC"}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#424242" }}>
                      {user.cedula || "—"}
                    </span>
                  </div>
                </div>

                <p className="section-label">Datos personales</p>
                <div className="form-grid-2">
                  <FieldView label="Nombre"    value={user.nombre} />
                  <FieldView label="Apellidos" value={user.apellidos} />
                  <FieldView label="Correo electrónico" value={user.correo} full />
                  <FieldView label="Teléfono"  value={user.telefono} />
                  <FieldView label="Fecha de registro" value={user.fechaCreacion} />
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label className="form-label">Estado</label>
                    <ToggleView value={user.estado} razon={razonInactivo} />
                  </div>
                </div>
              </>
            )}

            {/* ── Sección: Ubicación ── */}
            {activeSection === "ubicacion" && (
              <>
                <p className="section-label" style={{ marginTop: 0 }}>Ubicación</p>
                <div className="form-grid-2">
                  <FieldView label="Dirección"    value={user.direccion} full />
                  <FieldView label="Departamento" value={user.departamento} />
                  <FieldView label="Municipio"    value={user.municipio} />
                </div>
              </>
            )}

            {/* ── Sección: Rol ── */}
            {activeSection === "rol" && (
              <>
                <p className="section-label" style={{ marginTop: 0 }}>Rol asignado</p>
                <div className="form-group">
                  <label className="form-label">Rol</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
                    <span
                      className="rol-badge"
                      style={{
                        background: rolStyle.bg,
                        color: rolStyle.color,
                        borderColor: rolStyle.border,
                        fontSize: 13,
                        padding: "4px 14px",
                      }}
                    >
                      {user.rol || "—"}
                    </span>
                  </div>
                </div>

                {rolObj && (
                  <div className="form-group">
                    <label className="form-label">Estado del rol</label>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "5px 12px", borderRadius: 8,
                      background: rolObj.estado ? "#e8f5e9" : "#ffebee",
                      border: `1px solid ${rolObj.estado ? "#c8e6c9" : "#ef9a9a"}`,
                      fontSize: 12, fontWeight: 700,
                      color: rolObj.estado ? "#2e7d32" : "#c62828",
                    }}>
                      {rolObj.estado ? <><Check size={12} /> Activo</> : <><X size={12} /> Desactivado</>}
                    </div>
                  </div>
                )}

                {user.fechaCreacion && (
                  <div className="date-info" style={{ marginTop: 16 }}>
                    <Calendar size={14} />
                    <span>Usuario desde <strong>{user.fechaCreacion}</strong></span>
                  </div>
                )}
              </>
            )}

            {/* ── Sección: Saldo (solo Clientes) ── */}
            {activeSection === "cliente" && esCliente && (
              <>
                <p className="section-label" style={{ marginTop: 0 }}>Saldo a favor</p>

                {/* Tarjeta de saldo */}
                <div style={{
                  background: saldoFavor > 0 ? "#e8f5e9" : "#fafafa",
                  border: `1.5px solid ${saldoFavor > 0 ? "#c8e6c9" : "#e0e0e0"}`,
                  borderRadius: 12,
                  padding: "18px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginBottom: 20,
                }}>
                  <Banknote size={32} strokeWidth={1} style={{color: saldoFavor > 0 ? "#2e7d32" : "#9e9e9e"}} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                      Saldo disponible
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: saldoFavor > 0 ? "#2e7d32" : "#9e9e9e", fontFamily: "inherit" }}>
                      ${saldoFavor.toLocaleString("es-CO")}
                    </div>
                    {saldoFavor > 0 && (
                      <div style={{ fontSize: 11, color: "#66bb6a", marginTop: 2 }}>
                        Acumulado por devoluciones aprobadas
                      </div>
                    )}
                    {saldoFavor === 0 && (
                      <div style={{ fontSize: 11, color: "#bdbdbd", marginTop: 2 }}>
                        Sin saldo a favor actualmente
                      </div>
                    )}
                  </div>
                </div>

                {/* Resumen de pedidos del cliente */}
                {pedidosCliente.length > 0 && (
                  <>
                    <p className="section-label">Actividad del cliente</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[
                        { label: "Total pedidos", value: pedidosCliente.length, Icon: Package },
                        { label: "Entregados",    value: pedidosCliente.filter(p => p.estado === "Entregado").length,  Icon: CheckCircle2 },
                        { label: "En curso",      value: pedidosCliente.filter(p => !["Entregado","Cancelado"].includes(p.estado)).length, icon: "🔄" },
                        { label: "Cancelados",    value: pedidosCliente.filter(p => p.estado === "Cancelado").length,  Icon: XCircle },
                      ].map(stat => (
                        <div key={stat.label} style={{
                          background: "#fff",
                          border: "1px solid #f0f0f0",
                          borderRadius: 10,
                          padding: "12px 14px",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}>
                          {stat.Icon ? <stat.Icon size={20} /> : <span style={{ fontSize: 20 }}>{stat.icon}</span>}
                          <div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#1a1a1a" }}>{stat.value}</div>
                            <div style={{ fontSize: 11, color: "#9e9e9e" }}>{stat.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {pedidosCliente.length === 0 && (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "#9e9e9e", fontSize: 13 }}>
                    <Search size={28} strokeWidth={1} style={{color:"#bdbdbd",marginBottom:8}} />
                    No se encontró un registro de cliente vinculado a este usuario.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL ELIMINAR ───────────────────────────────────────
// razon      → bloqueo duro (admin): solo muestra el mensaje y cierra
// advertencias → lista de consecuencias, pero igual permite confirmar
export function ModalEliminarUsuario({ user, razon, advertencias = [], onClose, onConfirm }) {
  const [done, setDone] = useState(false);

  const handleEliminar = () => {
    setDone(true);
    onConfirm(user.id);
  };

  // ── Bloqueo duro (ej: admin principal) ──
  if (razon) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()}>
          <div style={{ padding: "28px 24px 18px", textAlign: "center" }}>
            <div className="delete-icon-wrap" style={{ background: "#fff8e1", border: "1px solid #ffe082", color: "#e65100" }}><AlertTriangle size={32} /></div>
            <h3 className="delete-title">Restricción de seguridad</h3>
            <p className="delete-body" style={{ color: "#e65100", fontWeight: 500 }}>{razon}</p>
          </div>
          <div className="modal-footer" style={{ justifyContent: "center" }}>
            <button className="btn-ghost" onClick={onClose}>Entendido</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Confirmación normal (con o sin advertencias) ──
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()}>
        <div style={{ padding: "28px 24px 18px", textAlign: "center" }}>
          <div className="delete-icon-wrap"><Trash2 size={32} /></div>
          <h3 className="delete-title">Eliminar usuario</h3>
          <p className="delete-body">
            ¿Está seguro de que desea eliminar permanentemente al usuario{" "}
            <strong>"{user.nombre} {user.apellidos}"</strong>?
          </p>

          {/* Advertencias de elementos asociados */}
          {advertencias.length > 0 && (
            <div style={{
              textAlign: "left",
              margin: "12px 0 4px",
              background: "#fff8e1",
              borderRadius: 10,
              padding: "12px 16px",
              border: "1px solid #ffe082",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9a6400", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, display:"flex", alignItems:"center", gap:4 }}>
                <AlertTriangle size={11} /> Ten en cuenta lo siguiente
              </div>
              {advertencias.map((adv, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: i < advertencias.length - 1 ? 7 : 0 }}>
                  <span style={{ fontSize: 12, color: "#e65100", marginTop: 1, flexShrink: 0 }}>•</span>
                  <span style={{ fontSize: 12, color: "#6d4c00", lineHeight: 1.4 }}>{adv}</span>
                </div>
              ))}
            </div>
          )}

          <p className="delete-warn" style={{ marginTop: advertencias.length ? 8 : 0 }}>
            Esta operación es definitiva y no podrá ser revertida.
          </p>
        </div>

        <div className="modal-footer modal-footer--center">
          <button className="btn-cancel-full" onClick={onClose}>Cancelar</button>
          <button className="btn-danger" onClick={handleEliminar} disabled={done}>
            {done ? "Eliminando…" : "Confirmar eliminación"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL ADVERTENCIA AL DESACTIVAR ─────────────────────
export function ModalDesactivarUsuario({ user, advertencias, onClose, onConfirm }) {
  const [done, setDone] = useState(false);

  const handleConfirm = () => {
    setDone(true);
    setTimeout(() => { onConfirm(user.id); onClose(); }, 600);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()}>
        <div style={{ padding: "28px 24px 18px", textAlign: "center" }}>
          <div className="delete-icon-wrap" style={{ background: "#fff8e1", border: "1px solid #ffe082", color: "#e65100" }}><AlertTriangle size={32} /></div>
          <h3 className="delete-title">Desactivar usuario</h3>
          <p className="delete-body">
            El usuario <strong>"{user.nombre} {user.apellidos}"</strong> tiene elementos asociados. Al desactivarlo ocurrirá lo siguiente:
          </p>

          <div style={{ textAlign: "left", margin: "12px 0", background: "#fff8e1", borderRadius: 10, padding: "12px 16px", border: "1px solid #ffe082" }}>
            {advertencias.map((adv, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: i < advertencias.length - 1 ? 8 : 0 }}>
                <span style={{ fontSize: 14, marginTop: 1 }}>•</span>
                <span style={{ fontSize: 13, color: "#6d4c00", lineHeight: 1.4 }}>{adv}</span>
              </div>
            ))}
          </div>

          <p className="delete-warn">¿Desea continuar de todas formas?</p>
        </div>
        <div className="modal-footer modal-footer--center">
          <button className="btn-cancel-full" onClick={onClose}>Cancelar</button>
          <button
            className="btn-danger"
            style={{ background: "#e65100", boxShadow: "0 3px 10px rgba(230,81,0,0.3)" }}
            onClick={handleConfirm}
            disabled={done}
          >
            {done ? "Desactivando…" : "Sí, desactivar"}
          </button>
        </div>
      </div>
    </div>
  );
}