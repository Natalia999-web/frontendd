import { useState, useEffect, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { getDomicilios, asignarRepartidor, actualizarDomicilio, cambiarEstadoDomicilio } from "../../../services/domiciliosService.js";
import { getUsuarios, toggleEstadoUsuario, crearEmpleado, editarUsuario } from "../../../services/usuariosService.js";
import { getUser } from "../../../services/authService.js";
import { fmtFecha } from "../../../utils/dateUtils.js";
import DateRangeFilter from "../../../shared/components/DateRangeFilter";
import "./Domicilios.css";

function SkeletonRows({ cols = 9, rows = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((__, j) => (
        <td key={j}><div className="skeleton-cell" /></td>
      ))}
    </tr>
  ));
}

/* ─── Helpers ────────────────────────────────────────────── */
const fmt = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

const PER_PAGE = 5;

// Estado del domicilio (entrega)
const ESTADO_CONFIG = {
  3:  { dot: "#f9a825", label: "Pendiente",      desc: "Pendiente de salida",                       bg: "#fff8e1" },
  4:  { dot: "#43a047", label: "Confirmado",     desc: "Confirmado y listo para preparar",           bg: "#e8f5e9" },
  13: { dot: "#1976d2", label: "En preparación", desc: "Cocinando y preparando",                     bg: "#e3f2fd" },
  11: { dot: "#43a047", label: "Listo",          desc: "Preparado y listo para salir",              bg: "#e8f5e9" },
  10: { dot: "#43a047", label: "Asignado",       desc: "Domiciliario asignado",                      bg: "#e8f5e9" },
  9:  { dot: "#6a1b9a", label: "En camino",      desc: "En ruta de entrega",                        bg: "#f3e5f5" },
  8:  { dot: "#43a047", label: "Entregado",      desc: "Entregado al cliente",                       bg: "#e8f5e9" },
  5:  { dot: "#c62828", label: "Cancelado",      desc: "Cancelado",                                  bg: "#ffebee" },
};

// Estado del pedido (venta)
const VENTA_ESTADO_CONFIG = {
  1:  { dot: "#43a047", label: "Activo",         bg: "#e8f5e9" },
  3:  { dot: "#f9a825", label: "Pendiente",      bg: "#fff8e1" },
  4:  { dot: "#43a047", label: "Confirmado",     bg: "#e8f5e9" },
  5:  { dot: "#c62828", label: "Cancelado",      bg: "#ffebee" },
  8:  { dot: "#43a047", label: "Entregado",      bg: "#e8f5e9" },
  9:  { dot: "#6a1b9a", label: "En camino",      bg: "#f3e5f5" },
  10: { dot: "#43a047", label: "Asignado",       bg: "#e8f5e9" },
  11: { dot: "#43a047", label: "Listo",          bg: "#e8f5e9" },
  13: { dot: "#1976d2", label: "En preparación", bg: "#e3f2fd" },
};

const ESTADO_TRANSITIONS = {
  3:  [{ id: 4,  label: "Confirmado" },     { id: 5, label: "Cancelado" }],
  4:  [{ id: 13, label: "En preparación" }, { id: 8, label: "Entregado" }, { id: 5, label: "Cancelado" }],
  13: [{ id: 11, label: "Listo" },          { id: 5, label: "Cancelado" }],
  11: [{ id: 10, label: "Asignado" },       { id: 5, label: "Cancelado" }],
  10: [{ id: 9,  label: "En camino" },      { id: 5, label: "Cancelado" }],
  9:  [{ id: 8,  label: "Entregado" },      { id: 5, label: "Cancelado" }],
};

const FILTER_OPTIONS = [
  { val: "todos",       label: "Todos",       dot: "#bdbdbd" },
  { val: "activos",     label: "Activos",     dot: "#43a047" },
  { val: 3,               label: "Pendiente",   dot: "#f9a825" },
  { val: 4,               label: "Confirmado",  dot: "#43a047" },
  { val: 13,              label: "En preparación", dot: "#1976d2" },
  { val: 11,              label: "Listo",       dot: "#43a047" },
  { val: 10,              label: "Asignado",    dot: "#43a047" },
  { val: 9,               label: "En camino",   dot: "#6a1b9a" },
  { val: 8,               label: "Entregado",   dot: "#43a047" },
  { val: 5,               label: "Cancelado",   dot: "#c62828" },
  { val: "sin-asignar", label: "Sin asignar", dot: "#e53935" },
];

/* ─── Componentes pequeños ───────────────────────────────── */
function EstadoBadge({ estado, estadoId }) {
  const cfg = ESTADO_CONFIG[estadoId] || { dot: "#bdbdbd", label: estado || estadoId, desc: "" };
  const label = cfg.label || estado || estadoId;
  const cls = `estado-badge estado--${String(label).replace(/ /g, "-")}`;
  return (
    <span className={cls} title={cfg.desc}>
      <span className="estado-badge__dot" />
      {label}
    </span>
  );
}

function VentaEstadoBadge({ estadoId }) {
  const cfg = VENTA_ESTADO_CONFIG[estadoId] || { dot: "#bdbdbd", label: `Estado ${estadoId}`, bg: "#f5f5f5" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700,
      background: cfg.bg, color: cfg.dot, border: `1px solid ${cfg.dot}44`,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function AlertaEstado({ pedido, empleados }) {
  const emp = empleados.find(e => e.id === pedido.idEmpleado);

  if (!emp && !["Entregado", "Cancelado"].includes(pedido.estado)) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "#ffebee", color: "#c62828", fontSize: 12,
        fontWeight: 600, padding: "3px 6px", borderRadius: 4,
        whiteSpace: "nowrap"
      }}>
        <span>⚠️</span> Sin asignar
      </div>
    );
  }

  if (pedido.estado === "Entregado") {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "#e8f5e9", color: "#2e7d32", fontSize: 12,
        fontWeight: 600, padding: "3px 6px", borderRadius: 4,
        whiteSpace: "nowrap"
      }}>
        <span>✅</span> Completado
      </div>
    );
  }

  if (pedido.estado === "En camino") {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "#f3e5f5", color: "#6a1b9a", fontSize: 12,
        fontWeight: 600, padding: "3px 6px", borderRadius: 4,
        whiteSpace: "nowrap"
      }}>
        <span>🚴</span> En tránsito
      </div>
    );
  }

  return null;
}

function Toast({ toast }) {
  if (!toast) return null;
  const bg =
    toast.type === "error" ? "#c62828" :
    toast.type === "warn"  ? "#e65100" :
    "#2e7d32";
  return (
    <div className="toast" style={{ background: bg }}>
      <span style={{ fontSize: 15 }}>
        {toast.type === "error" ? "✕" : toast.type === "warn" ? "⚠" : "✓"}
      </span>
      {toast.message}
    </div>
  );
}

function SelectArrow() {
  return (
    <div className="select-arrow">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

const safeParseDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDuration = (minutes) => {
  if (!Number.isFinite(minutes)) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const mapToGoogleMaps = (address) => {
  if (!address) return "https://www.google.com/maps";
  const query = encodeURIComponent(address);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
};

const exportToCsv = (rows) => {
  if (!rows || rows.length === 0) return;
  const headers = ["Pedido", "Cliente", "Domiciliario", "Dirección", "Estado", "Total", "Fecha pedido", "Fecha entrega", "Observaciones"];
  const csvRows = [headers.join(",")];
  rows.forEach(row => {
    const values = [
      row.numero,
      row.cliente?.nombre || "",
      row.domiciliario || "Sin asignar",
      row.direccion_entrega || "",
      row.estado || "",
      row.total != null ? row.total : "",
      row.fecha_pedido || "",
      row.fecha_entrega_real || "",
      row.obs_domicilio ? row.obs_domicilio.replace(/\r?\n/g, " ") : "",
    ];
    csvRows.push(values.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));
  });
  const csv = csvRows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `domicilios_export_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/* ═══════════════════════════════════════════════════════════
   MODAL CONFIRMAR DESACTIVAR DOMICILIARIO
   ═══════════════════════════════════════════════════════════ */
function ModalConfirmarDesactivar({ usuario, pedidosActivos, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Advertencia</p>
            <h2 className="modal-header__title">Desactivar domiciliario</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ overflow: "visible" }}>
          <div className="info-box info-box--warn">
            <span className="info-box__icon">⚠️</span>
            <div className="info-box__text">
              <span className="info-box__label">
                {usuario.nombre} {usuario.apellidos} tiene {pedidosActivos.length}{" "}
                domicilio{pedidosActivos.length !== 1 ? "s" : ""} activo
                {pedidosActivos.length !== 1 ? "s" : ""}
              </span>
              Al desactivarlo, estos pedidos quedarán sin domiciliario asignado.
            </div>
          </div>

          {/* Lista de pedidos afectados */}
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
            {pedidosActivos.map(p => (
              <div key={p.id} className="hist-pedido-row">
                <span className="hist-pedido-num">{p.numero}</span>
                <span className="hist-pedido-dir">{p.direccion_entrega}</span>
                <EstadoBadge estado={p.estado} estadoId={p.estadoId} />
                <span className="hist-pedido-fecha">{fmtFecha(p.fecha_pedido)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button
            className="btn-save"
            style={{ background: "#c62828", boxShadow: "0 3px 10px rgba(198,40,40,0.35)" }}
            onClick={onConfirm}
          >
            Desactivar de todas formas
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL CAMBIAR ESTADO
   ═══════════════════════════════════════════════════════════ */
function ModalCambiarEstado({ pedido, onClose, onSave }) {
  const opciones = ESTADO_TRANSITIONS[pedido.estadoId] || [];
  const [seleccion, setSeleccion] = useState(opciones[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!seleccion) return;
    setSaving(true);
    try {
      await onSave(pedido.id, seleccion, pedido);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Domicilio</p>
            <h2 className="modal-header__title">Cambiar estado</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#616161" }}>
            Pedido: <strong>{pedido.numero}</strong> — Estado actual: <strong>{ESTADO_CONFIG[pedido.estadoId]?.label || pedido.estado}</strong>
          </p>
          {opciones.length === 0 ? (
            <p style={{ color: "#9e9e9e", fontSize: 13 }}>No hay transiciones disponibles para este estado.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {opciones.map(op => {
                const cfg = ESTADO_CONFIG[op.id] || {};
                return (
                  <button
                    key={op.id}
                    onClick={() => setSeleccion(op.id)}
                    style={{
                      padding: "12px 16px", borderRadius: 10, cursor: "pointer",
                      border: seleccion === op.id ? `2px solid ${cfg.dot || "#4caf50"}` : "1.5px solid #e0e0e0",
                      background: seleccion === op.id ? (cfg.bg || "#e8f5e9") : "#fafafa",
                      color: seleccion === op.id ? (cfg.dot || "#2e7d32") : "#616161",
                      fontWeight: 700, fontSize: 13, textAlign: "left",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.dot || "#bdbdbd", flexShrink: 0 }} />
                    {op.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={saving || !seleccion || opciones.length === 0}
          >
            {saving ? "Guardando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL VER DETALLE — Side panel
   ═══════════════════════════════════════════════════════════ */
const NAV_VER = [
  { id: "cliente",      label: "Cliente",      icon: "👤" },
  { id: "direccion",    label: "Dirección",    icon: "📍" },
  { id: "domiciliario", label: "Domiciliario", icon: "🛵" },
  { id: "fechas",       label: "Fechas",       icon: "📅" },
];

function ModalVerDomicilio({ pedido, emp, domicilios, onClose, onReasignar, onObservaciones }) {
  const [activeSection, setActiveSection] = useState("cliente");
  const navigate = useNavigate();
  const activo = !["Entregado", "Cancelado"].includes(pedido.estado);
  const cfg = ESTADO_CONFIG[pedido.estadoId] || { dot: "#bdbdbd", label: pedido.estado, desc: "" };
  const pedidosAsignados = domicilios.filter(d => d.idEmpleado === emp?.id);
  const pendientes  = pedidosAsignados.filter(d => !["Entregado", "Cancelado"].includes(d.estado)).length;
  const enCamino    = pedidosAsignados.filter(d => d.estado === "En camino").length;
  const entregados  = pedidosAsignados.filter(d => d.estado === "Entregado").length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box modal-box--wide"
        onClick={e => e.stopPropagation()}
        style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Domicilio</p>
            <h2 className="modal-header__title">{pedido.numero}</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6, fontSize: 11,
                fontWeight: 600, color: cfg.dot, marginBottom: 2
              }}>
                <span style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: cfg.dot, display: "inline-block"
                }} />
                {cfg.label}
              </div>
              <div style={{ fontSize: 11, color: "#999" }}>{cfg.desc}</div>
            </div>
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Side panel layout */}
        <div style={{ display: "flex" }}>

          {/* Nav lateral */}
          <nav style={{
            width: 150, borderRight: "1px solid #f0f0f0", background: "#fafdf9",
            display: "flex", flexDirection: "column", padding: "12px 0", flexShrink: 0,
          }}>
            <div style={{
              display: "flex", justifyContent: "center",
              marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #f0f0f0"
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%", background: "#e8f5e9",
                border: "1.5px solid #a5d6a7", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 22,
              }}>🛵</div>
            </div>

            {NAV_VER.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 16px", border: "none",
                  borderLeft: activeSection === item.id ? "3px solid #2e7d32" : "3px solid transparent",
                  background: activeSection === item.id ? "#e8f5e9" : "transparent",
                  color: activeSection === item.id ? "#2e7d32" : "#757575",
                  fontWeight: activeSection === item.id ? 700 : 500,
                  fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.15s", textAlign: "left", width: "100%",
                }}
              >
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Contenido */}
          <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto", maxHeight: "calc(100vh - 300px)" }}>

            {/* ── Cliente ── */}
            {activeSection === "cliente" && (
              <>
                <p className="section-label" style={{ marginTop: 0 }}>Datos del cliente</p>
                <div className="form-grid-2">
                  <div>
                    <label className="form-label">Nombre</label>
                    <div className="field-input--disabled">{pedido.cliente?.nombre || "—"}</div>
                  </div>
                  <div>
                    <label className="form-label">Teléfono</label>
                    <div className="field-input--disabled">{pedido.cliente?.telefono || "—"}</div>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <label className="form-label">Total del pedido</label>
                  <div className="field-input--disabled" style={{ color: "#2e7d32", fontWeight: 700 }}>
                    {fmt(pedido.total)}
                  </div>
                </div>

                <p className="section-label">Estado del pedido</p>
                <div style={{
                  background: cfg.dot + "11",
                  border: `1px solid ${cfg.dot}33`,
                  borderRadius: 8,
                  padding: 12
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    marginBottom: 6, fontSize: 14, fontWeight: 700, color: cfg.dot
                  }}>
                    <span style={{ width: 12, height: 12, borderRadius: "50%", background: cfg.dot }} />
                    {cfg.label}
                  </div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {cfg.desc || "Ver más información en las otras pestañas."}
                  </div>
                </div>
              </>
            )}

            {/* ── Dirección ── */}
            {activeSection === "direccion" && (
              <>
                <p className="section-label" style={{ marginTop: 0 }}>Dirección de entrega</p>
                <div className="info-box info-box--info">
                  <span className="info-box__icon">📍</span>
                  <span className="info-box__text">{pedido.direccion_entrega || "—"}</span>
                </div>
                {pedido.direccion_entrega && (
                  <a
                    className="link-button"
                    href={mapToGoogleMaps(pedido.direccion_entrega)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginTop: 12, display: "inline-block", fontSize: 13 }}
                  >Abrir en Google Maps</a>
                )}
                {pedido.obs_domicilio ? (
                  <>
                    <p className="section-label">Observaciones</p>
                    <div className="info-box info-box--warn">
                      <span className="info-box__icon">📝</span>
                      <span className="info-box__text">{pedido.obs_domicilio}</span>
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: "#bdbdbd", marginTop: 12 }}>Sin observaciones registradas.</p>
                )}
              </>
            )}

            {/* ── Domiciliario ── */}
            {activeSection === "domiciliario" && (
              <>
                <p className="section-label" style={{ marginTop: 0 }}>Domiciliario asignado</p>
                {emp ? (
                  <>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                      borderRadius: 10, border: "1.5px solid #c8e6c9", background: "#f9fdf9",
                    }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: "50%", background: "#e8f5e9",
                        border: "1.5px solid #a5d6a7", display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 20, flexShrink: 0,
                      }}>🛵</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>
                          {emp.nombre} {emp.apellidos}
                        </div>
                        <div style={{ fontSize: 11, color: "#9e9e9e", marginTop: 2 }}>{emp.correo}</div>
                      </div>
                    </div>

                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                      gap: 10, marginTop: 14
                    }}>
                      {[
                        { label: "Asignados",  val: pedidosAsignados.length, bg: "#fff8e1", border: "#ffe082", color: "#6d4c41" },
                        { label: "Pendientes", val: pendientes,              bg: "#e3f2fd", border: "#90caf9", color: "#1565c0" },
                        { label: "En camino",  val: enCamino,               bg: "#f3e5f5", border: "#ce93d8", color: "#6a1b9a" },
                        { label: "Entregados", val: entregados,             bg: "#e8f5e9", border: "#a5d6a7", color: "#2e7d32" },
                      ].map(s => (
                        <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 12, color: s.color, marginBottom: 4 }}>{s.label}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.val}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="info-box info-box--warn">
                    <span className="info-box__icon">⚠️</span>
                    <span className="info-box__text">Sin domiciliario asignado.</span>
                  </div>
                )}
              </>
            )}

            {/* ── Fechas ── */}
            {activeSection === "fechas" && (
              <>
                <p className="section-label" style={{ marginTop: 0 }}>Fechas</p>
                <div className="form-grid-2">
                  <div>
                    <label className="form-label">Fecha del pedido</label>
                    <div className="field-input--disabled">{fmtFecha(pedido.fecha_pedido)}</div>
                  </div>
                  <div>
                    <label className="form-label">Fecha de entrega real</label>
                    <div className="field-input--disabled" style={{ color: pedido.fecha_entrega_real ? "#2e7d32" : "#bdbdbd" }}>
                      {pedido.fecha_entrega_real ? fmtFecha(pedido.fecha_entrega_real) : "Pendiente"}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cerrar</button>
          <button
            className="btn-cancel"
            style={{ background: "#e3f2fd", color: "#1565c0", border: "1px solid #90caf9" }}
            onClick={() => { onClose(); navigate(`/admin/chat/${pedido.id}`); }}
          >
            💬 Chat
          </button>
          {activo && (
            <>
              <button className="btn-cancel" onClick={() => { onClose(); onObservaciones(pedido); }}>
                📝 Observaciones
              </button>
              <button className="btn-save" onClick={() => { onClose(); onReasignar(pedido); }}>
                🛵 Reasignar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL REASIGNAR DOMICILIARIO
   ═══════════════════════════════════════════════════════════ */
function ModalReasignar({ pedido, empleados, onClose, onConfirm }) {
  const [empId, setEmpId] = useState(pedido.idEmpleado || "");
  const [error, setError] = useState("");
  const empActual = empleados.find(e => e.id === pedido.idEmpleado);

  const handleConfirm = () => {
    if (!empId) { setError("Selecciona un domiciliario"); return; }
    if (parseInt(empId) === pedido.idEmpleado) { setError("Ya está asignado a este domiciliario"); return; }
    onConfirm(pedido.id, parseInt(empId));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Logística</p>
            <h2 className="modal-header__title">Reasignar domiciliario</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ overflow: "visible" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#616161" }}>
            Pedido: <strong>{pedido.numero}</strong>
          </p>

          <div className="info-box info-box--info">
            <span className="info-box__icon">📍</span>
            <span className="info-box__text">{pedido.direccion_entrega}</span>
          </div>

          {empActual && (
            <div className="info-box info-box--warn">
              <span className="info-box__icon">🛵</span>
              <span className="info-box__text">
                Actual: <strong>{empActual.nombre} {empActual.apellidos}</strong>
              </span>
            </div>
          )}

          <div>
            <label className="form-label">Nuevo domiciliario <span className="required">*</span></label>
            <div className="select-wrap">
              <select
                className={`field-select${error ? " error" : ""}`}
                value={empId}
                onChange={e => { setEmpId(e.target.value); setError(""); }}
              >
                <option value="">Seleccione…</option>
                {empleados.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.nombre} {e.apellidos}
                    {e.id === pedido.idEmpleado ? " (actual)" : ""}
                  </option>
                ))}
              </select>
              <SelectArrow />
            </div>
            {error && <p className="field-error">{error}</p>}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-save" onClick={handleConfirm}>Reasignar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL OBSERVACIONES
   ═══════════════════════════════════════════════════════════ */
function ModalObservaciones({ pedido, onClose, onConfirm }) {
  const [obs, setObs]   = useState(pedido.obs_domicilio || "");
  const [done, setDone] = useState(false);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Domicilio</p>
            <h2 className="modal-header__title">Observaciones</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ overflow: "visible" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#616161" }}>
            Pedido: <strong>{pedido.numero}</strong> · {pedido.cliente?.nombre}
          </p>
          <div className="info-box info-box--info">
            <span className="info-box__icon">📍</span>
            <span className="info-box__text">{pedido.direccion_entrega}</span>
          </div>
          <div>
            <label className="form-label">Observaciones de entrega</label>
            <textarea
              className="field-textarea"
              rows={4}
              placeholder="Instrucciones especiales, referencias del lugar, llamar al llegar…"
              value={obs}
              onChange={e => setObs(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button
            className="btn-save"
            disabled={done}
            onClick={() => { setDone(true); setTimeout(() => onConfirm(pedido.id, obs), 700); }}
          >
            {done ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HISTORIAL POR DOMICILIARIO
   ═══════════════════════════════════════════════════════════ */
function HistorialDomiciliario({ domicilios, empleados, onDesactivar }) {
  const [abiertos, setAbiertos] = useState({});
  const toggle = (id) => setAbiertos(p => ({ ...p, [id]: !p[id] }));

  const grupos = empleados.map(emp => {
    const pedidosEmp = domicilios.filter(p => p.idEmpleado === emp.id);
    return {
      emp,
      total:      pedidosEmp.length,
      entregados: pedidosEmp.filter(p => p.estado === "Entregado").length,
      enCamino:   pedidosEmp.filter(p => p.estado === "En camino").length,
      activos:    pedidosEmp.filter(p => !["Entregado", "Cancelado"].includes(p.estado)).length,
      pedidos:    pedidosEmp,
    };
  }).filter(g => g.total > 0).sort((a, b) => b.total - a.total);

  if (grupos.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">🛵</div>
        <p className="empty-state__text">No hay domicilios asignados a empleados.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {grupos.map(({ emp, total, entregados, enCamino, activos, pedidos }) => (
        <div key={emp.id} className="hist-emp-card">
          <div className="hist-emp-header" onClick={() => toggle(emp.id)}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%", background: "#e8f5e9",
                border: "1.5px solid #a5d6a7", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 18, flexShrink: 0,
              }}>🛵</div>
              <div>
                <div className="hist-emp-name">{emp.nombre} {emp.apellidos}</div>
                <div style={{ fontSize: 11, color: "#9e9e9e" }}>{emp.correo}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="hist-emp-stats">
                <span className="hist-stat hist-stat--total">Total: {total}</span>
                <span className="hist-stat hist-stat--active">Pendientes: {activos}</span>
                {enCamino   > 0 && <span className="hist-stat hist-stat--camino">🛵 {enCamino}</span>}
                {entregados > 0 && <span className="hist-stat hist-stat--entregado">✓ {entregados}</span>}
              </div>
              {/* ── Botón desactivar con advertencia si tiene activos ── */}
              {onDesactivar && (
                <button
                  className="act-btn"
                  title={activos > 0 ? `Tiene ${activos} domicilio(s) activo(s)` : "Desactivar domiciliario"}
                  style={{
                    background: activos > 0 ? "#fff8e1" : "#ffebee",
                    border: `1.5px solid ${activos > 0 ? "#ffe082" : "#ef9a9a"}`,
                    color:   activos > 0 ? "#f9a825" : "#c62828",
                    fontSize: 14,
                  }}
                  onClick={e => { e.stopPropagation(); onDesactivar(emp, pedidos.filter(p => !["Entregado", "Cancelado"].includes(p.estado))); }}
                >
                  {activos > 0 ? "⚠️" : "🚫"}
                </button>
              )}
              <span style={{
                color: "#9e9e9e", fontSize: 16,
                transform: abiertos[emp.id] ? "rotate(90deg)" : "none",
                transition: "transform 0.2s",
              }}>›</span>
            </div>
          </div>

          {abiertos[emp.id] && (
            <div className="hist-pedidos-list">
              {pedidos.map(p => (
                <div key={p.id} className="hist-pedido-row">
                  <span className="hist-pedido-num">{p.numero}</span>
                  <span className="hist-pedido-dir">{p.direccion_entrega}</span>
                  <EstadoBadge estado={p.estado} estadoId={p.estadoId} />
                  <span className="hist-pedido-fecha">{fmtFecha(p.fecha_pedido)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════ */
export default function GestionDomicilios() {
  const [domicilios,   setDomicilios]   = useState([]);
  const [empleados,    setEmpleados]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [actionSaving, setActionSaving] = useState(false);
  const [tab,          setTab]          = useState("tabla");
  const [search,       setSearch]       = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [filterDesde,  setFilterDesde]  = useState("");
  const [filterHasta,  setFilterHasta]  = useState("");
  const [showFilter,   setShowFilter]   = useState(false);
  const [page,         setPage]         = useState(1);
  const [modal,        setModal]        = useState(null);
  const [toast,        setToast]        = useState(null);
  const filterRef = useRef();

  const showToast = (msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [dData, uData] = await Promise.all([
        getDomicilios({ porPagina: 100 }),
        getUsuarios({ porPagina: 100 }),
      ]);
      setDomicilios(dData.domicilios);
      setEmpleados((uData || []).filter(u =>
        u.tipo === "empleado" && u.estado && (
          u.idRol === 1 || u.idRol === 3 ||
          ["admin", "administrador", "domiciliario"].includes((u.rol || "").toLowerCase())
        )
      ));
    } catch (err) {
      showToast(err.message || "Error al cargar domicilios", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  useEffect(() => {
    const h = e => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pedidosPorEmpleado = empleados.reduce((acc, emp) => {
    acc[emp.id] = domicilios.filter(p => p.idEmpleado === emp.id).length;
    return acc;
  }, {});

  /* ── Filtrado ── */
  const filtered = domicilios.filter(p => {
    const q   = search.toLowerCase();
    const emp = empleados.find(e => e.id === p.idEmpleado);
    const matchQ = [
      p.numero, p.cliente?.nombre, p.cliente?.correo,
      p.direccion_entrega,
      emp ? `${emp.nombre} ${emp.apellidos}` : "",
    ].filter(Boolean).some(v => v.toLowerCase().includes(q));

    const activeEstados = [3, 4, 13, 11, 10, 9];
  const matchE =
    filterEstado === "todos"       ? true :
    filterEstado === "activos"     ? activeEstados.includes(p.estadoId) :
    filterEstado === "Entregado"   ? p.estado === "Entregado" :
    filterEstado === "sin-asignar" ? !p.idEmpleado && ![8, 5].includes(p.estadoId) :
    p.estadoId === filterEstado;

    let matchFecha = true;
    if (filterDesde || filterHasta) {
      const fechaRaw = String(p.fecha_pedido || "").slice(0, 10);
      const fecha = fechaRaw ? new Date(`${fechaRaw}T00:00:00`) : null;
      if (!fecha) matchFecha = false;
      if (filterDesde && fecha && new Date(`${filterDesde}T00:00:00`) > fecha) matchFecha = false;
      if (filterHasta && fecha && new Date(`${filterHasta}T00:00:00`) < fecha) matchFecha = false;
    }

    return matchQ && matchE && matchFecha;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const paged      = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  useEffect(() => setPage(1), [search, filterEstado, filterDesde, filterHasta]);

  const hasFilter = filterEstado !== "todos" || filterDesde || filterHasta;

  /* ── Handlers ── */
  const handleReasignar = async (domicilioId, empId) => {
    setActionSaving(true);
    try {
      await asignarRepartidor(domicilioId, empId);
      await cargarDatos();
      const emp = empleados.find(e => e.id === empId);
      showToast(`Reasignado a ${emp?.nombre} ${emp?.apellidos}`);
      setModal(null);
    } catch (err) {
      showToast(err.message || "Error al reasignar domiciliario", "error");
    } finally {
      setActionSaving(false);
    }
  };

  const handleObservaciones = async (domicilioId, obs) => {
    setActionSaving(true);
    try {
      await actualizarDomicilio(domicilioId, { Observaciones: obs });
      await cargarDatos();
      showToast("Observaciones guardadas");
      setModal(null);
    } catch (err) {
      showToast(err.message || "Error al guardar observaciones", "error");
    } finally {
      setActionSaving(false);
    }
  };

  const handleCambiarEstado = async (domicilioId, nuevoEstadoId, pedido = null) => {
    if (nuevoEstadoId === 8 && pedido && !pedido.comprobante_pago) {
      showToast("No se puede entregar: el domicilio no tiene comprobante de pago adjunto.", "error");
      return;
    }
    setActionSaving(true);
    try {
      await cambiarEstadoDomicilio(domicilioId, nuevoEstadoId);
      await cargarDatos();
      showToast("Estado actualizado correctamente");
    } catch (err) {
      showToast(err.message || "Error al cambiar el estado", "error");
    } finally {
      setActionSaving(false);
    }
  };

  const abrirReasignar = (ped) => {
    if (["Entregado", "Cancelado"].includes(ped.estado)) {
      showToast("No se puede reasignar un domicilio ya finalizado", "warn"); return;
    }
    setModal({ type: "reasignar", pedido: ped });
  };

  const abrirObservaciones = (ped) => {
    if (["Entregado", "Cancelado"].includes(ped.estado)) {
      showToast("No se pueden editar observaciones de un domicilio finalizado", "warn"); return;
    }
    setModal({ type: "obs", pedido: ped });
  };

  const handleSolicitarDesactivar = (emp, pedidosActivos) => {
    if (pedidosActivos.length > 0) {
      setModal({ type: "confirmar-desactivar", usuario: emp, pedidosActivos });
    } else {
      toggleEstadoUsuario(emp.tipo || "empleado", emp.id, emp.estado)
        .then(() => { cargarDatos(); showToast(`${emp.nombre} ${emp.apellidos} desactivado`); })
        .catch(err => showToast(err.message || "Error al desactivar", "error"));
    }
  };

  const handleConfirmarDesactivar = async () => {
    const { usuario } = modal;
    try {
      await toggleEstadoUsuario(usuario.tipo || "empleado", usuario.id, usuario.estado);
      await cargarDatos();
      showToast(`${usuario.nombre} ${usuario.apellidos} desactivado`, "warn");
    } catch (err) {
      showToast(err.message || "Error al desactivar", "error");
    }
    setModal(null);
  };

  /* ── Stats ── */
  const totalDom   = domicilios.length;
  const enCamino   = domicilios.filter(p => p.estado === "En camino").length;
  const entregados = domicilios.filter(p => p.estado === "Entregado").length;
  const conAsignar = domicilios.filter(p => p.idEmpleado).length;
  const sinAsignar = domicilios.filter(p => !p.idEmpleado && !["Entregado", "Cancelado"].includes(p.estado)).length;

  // Domiciliarios solo pueden ver su propio panel
  if (getUser()?.rol === "Domiciliario") {
    return <Navigate to="/admin/mi-dashboard" replace />;
  }

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-header__title">Gestión de Domicilios</h1>
        <div className="page-header__line" />
      </div>

      <div className="page-inner">

        {/* ── Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total domicilios", val: totalDom,   color: "#2e7d32", bg: "#e8f5e9", border: "#a5d6a7", icon: "🛵" },
            { label: "Asignados",        val: conAsignar, color: "#1565c0", bg: "#e3f2fd", border: "#90caf9", icon: "📌" },
            { label: "En camino",        val: enCamino,   color: "#6a1b9a", bg: "#f3e5f5", border: "#ce93d8", icon: "🚴" },
            { label: "Entregados",       val: entregados, color: "#2e7d32", bg: "#e8f5e9", border: "#a5d6a7", icon: "✅" },
            {
              label: "Sin asignar",
              val: sinAsignar,
              color:  sinAsignar > 0 ? "#c62828" : "#9e9e9e",
              bg:     sinAsignar > 0 ? "#ffebee" : "#fafafa",
              border: sinAsignar > 0 ? "#ef9a9a" : "#e0e0e0",
              icon:   sinAsignar > 0 ? "⚠️" : "—",
            },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 12,
              padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ fontSize: 24 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "var(--font-head)", lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 11, color: s.color, marginTop: 3, fontWeight: 600 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {[
            { key: "tabla",     label: "📋 Lista de domicilios" },
            { key: "historial", label: "📊 Historial por domiciliario" },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "9px 18px", borderRadius: "10px 10px 0 0", border: "none",
              background: tab === t.key ? "#fff" : "transparent",
              fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              color: tab === t.key ? "#2e7d32" : "#9e9e9e", cursor: "pointer",
              borderBottom: tab === t.key ? "3px solid #2e7d32" : "3px solid transparent",
              transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* ══ TAB: Tabla ══ */}
        {tab === "tabla" && (
          <>
            <div className="toolbar">
              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Buscar por pedido, cliente, dirección o domiciliario…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
              </div>

              <button className="btn-action" onClick={() => exportToCsv(filtered)}>
                📄 Exportar CSV
              </button>

              <div ref={filterRef} style={{ position: "relative" }}>
                <button
                  className={`filter-icon-btn${hasFilter ? " has-filter" : ""}`}
                  onClick={() => setShowFilter(v => !v)}
                >▼</button>
                {showFilter && (
                  <div className="filter-dropdown" style={{ minWidth: 185 }}>
                    <p className="filter-section-title">Estado</p>
                    {FILTER_OPTIONS.map(f => (
                      <button
                        key={f.val}
                        className={`filter-option${filterEstado === f.val ? " active" : ""}`}
                        onClick={() => { setFilterEstado(f.val); setPage(1); setShowFilter(false); }}
                      >
                        <span className="filter-dot" style={{ background: f.dot }} />
                        {f.label}
                      </button>
                    ))}
                    <div style={{ height: 1, background: "#f0f0f0", margin: "8px 0" }} />
                    <DateRangeFilter
                      desde={filterDesde}
                      hasta={filterHasta}
                      label="Fecha del pedido"
                      onApply={({ desde, hasta }) => {
                        setFilterDesde(desde || "");
                        setFilterHasta(hasta || "");
                      }}
                      onClear={() => {
                        setFilterDesde("");
                        setFilterHasta("");
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="tbl-wrapper">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}>Nº</th>
                      <th>Pedido</th>
                      <th>Cliente</th>
                      <th>Dirección</th>
                      <th>Domiciliario</th>
                      <th>Fechas</th>
                      <th>Estado venta</th>
                      <th>Estado entrega</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <SkeletonRows cols={9} rows={5} />
                    ) : paged.length === 0 ? (
                      <tr><td colSpan={9}>
                        <div className="empty-state">
                          <div className="empty-state__icon">🛵</div>
                          <p className="empty-state__text">
                            {hasFilter || search ? "Sin domicilios que coincidan." : "No hay domicilios registrados."}
                          </p>
                        </div>
                      </td></tr>
                    ) : paged.map((ped, idx) => {
                      const emp    = empleados.find(e => e.id === ped.idEmpleado);
                      const activo = !["Entregado", "Cancelado"].includes(ped.estado);
                      const sinAsignado = !emp && activo;
                      return (
                        <tr
                          key={ped.id}
                          className="tbl-row"
                          style={{ background: sinAsignado ? "#fffbf0" : "transparent" }}
                        >
                          <td>
                            <span className="row-num">
                              {String((safePage - 1) * PER_PAGE + idx + 1).padStart(2, "0")}
                            </span>
                          </td>
                          <td>
                            <div className="pedido-num">{ped.numero}</div>
                            <div className="pedido-fecha">{fmt(ped.total)}</div>
                          </td>
                          <td>
                            <div className="client-name">{ped.cliente?.nombre || "—"}</div>
                            <div className="client-phone">{ped.cliente?.telefono || ""}</div>
                          </td>
                          <td>
                            <div
                              className="dir-main"
                              style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            >
                              {ped.direccion_entrega || "—"}
                            </div>
                            {ped.obs_domicilio && (
                              <div className="dir-sub" title={ped.obs_domicilio}>
                                📝 {ped.obs_domicilio.length > 30
                                  ? ped.obs_domicilio.slice(0, 30) + "…"
                                  : ped.obs_domicilio}
                              </div>
                            )}
                          </td>
                          <td>
                            {emp ? (
                              <div>
                                <div className="emp-name">🛵 {emp.nombre} {emp.apellidos}</div>
                                <div style={{ fontSize: 11, color: "#616161", marginTop: 2 }}>
                                  {pedidosPorEmpleado[emp.id] || 0} pedido
                                  {pedidosPorEmpleado[emp.id] === 1 ? "" : "s"}
                                </div>
                              </div>
                            ) : (
                              <div className="emp-none">Sin asignar</div>
                            )}
                          </td>
                          <td>
                            <div className="date-col">
                              <span className="date-row date-row--pedido">📅 {fmtFecha(ped.fecha_pedido)}</span>
                              {ped.fecha_entrega_real
                                ? <span className="date-row date-row--entrega">✅ {fmtFecha(ped.fecha_entrega_real)}</span>
                                : <span className="date-row date-row--pendiente">⏳ Pendiente</span>
                              }
                            </div>
                          </td>
                          <td>
                            {ped.venta_estado_id != null
                              ? <VentaEstadoBadge estadoId={ped.venta_estado_id} />
                              : <span style={{ color: "#bdbdbd", fontSize: 11 }}>—</span>
                            }
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <EstadoBadge estado={ped.estado} estadoId={ped.estadoId} />
                              {/* Avisa si venta cancelada pero entrega aún abierta */}
                              {ped.venta_estado_id === 5 && ped.estadoId !== 5 && ped.estadoId !== 8 && (
                                <span style={{
                                  fontSize: 10, fontWeight: 700, color: "#c62828",
                                  background: "#ffebee", borderRadius: 4, padding: "2px 5px",
                                }}>⚠ Pedido cancelado</span>
                              )}
                              <AlertaEstado pedido={ped} empleados={empleados} />
                            </div>
                          </td>
                          <td>
                            <div className="actions-cell">
                              <button
                                className="act-btn act-btn--view"
                                title="Ver detalle"
                                onClick={() => setModal({ type: "ver", pedido: ped })}
                              >👁</button>
                              <button
                                className="act-btn act-btn--map"
                                title="Abrir dirección en Google Maps"
                                onClick={() => window.open(mapToGoogleMaps(ped.direccion_entrega), "_blank", "noopener")}
                              >🌍</button>
                              {ESTADO_TRANSITIONS[ped.estadoId] && (
                                <button
                                  className="act-btn"
                                  title="Cambiar estado"
                                  onClick={() => setModal({ type: "cambiarEstado", pedido: ped })}
                                  style={{ background: "#e8f5e9", color: "#2e7d32" }}
                                >⚡</button>
                              )}
                              <button
                                className="act-btn act-btn--reasignar"
                                title="Reasignar domiciliario"
                                onClick={() => abrirReasignar(ped)}
                                style={{ opacity: activo ? 1 : 0.35, cursor: activo ? "pointer" : "default" }}
                              >🛵</button>
                              <button
                                className="act-btn act-btn--obs"
                                title="Observaciones"
                                onClick={() => abrirObservaciones(ped)}
                                style={{ opacity: activo ? 1 : 0.35, cursor: activo ? "pointer" : "default" }}
                              >📝</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pagination-bar">
                <span className="pagination-count">
                  {filtered.length} {filtered.length === 1 ? "domicilio" : "domicilios"} en total
                </span>
                <div className="pagination-btns">
                  <button className="pg-btn-arrow" onClick={() => setPage(1)} disabled={safePage === 1}>«</button>
                  <button
                    className="pg-btn-arrow"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                  >‹</button>
                  <span className="pg-pill">Página {safePage} de {totalPages}</span>
                  <button
                    className="pg-btn-arrow"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                  >›</button>
                  <button className="pg-btn-arrow" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>»</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══ TAB: Historial ══ */}
        {tab === "historial" && (
          <div className="card" style={{ padding: 20 }}>
            <HistorialDomiciliario
              domicilios={domicilios}
              empleados={empleados}
              onDesactivar={handleSolicitarDesactivar}
            />
          </div>
        )}
      </div>

      {/* ── Modales ── */}
      {modal?.type === "ver" && (
        <ModalVerDomicilio
          pedido={modal.pedido}
          emp={empleados.find(e => e.id === modal.pedido.idEmpleado)}
          domicilios={domicilios}
          onClose={() => setModal(null)}
          onReasignar={ped => setModal({ type: "reasignar", pedido: ped })}
          onObservaciones={ped => setModal({ type: "obs", pedido: ped })}
        />
      )}
      {modal?.type === "reasignar" && (
        <ModalReasignar
          pedido={modal.pedido}
          empleados={empleados}
          onClose={() => setModal(null)}
          onConfirm={handleReasignar}
        />
      )}
      {modal?.type === "obs" && (
        <ModalObservaciones
          pedido={modal.pedido}
          onClose={() => setModal(null)}
          onConfirm={handleObservaciones}
        />
      )}
      {modal?.type === "confirmar-desactivar" && (
        <ModalConfirmarDesactivar
          usuario={modal.usuario}
          pedidosActivos={modal.pedidosActivos}
          onClose={() => setModal(null)}
          onConfirm={handleConfirmarDesactivar}
        />
      )}
      {modal?.type === "cambiarEstado" && (
        <ModalCambiarEstado
          pedido={modal.pedido}
          onClose={() => setModal(null)}
          onSave={handleCambiarEstado}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}