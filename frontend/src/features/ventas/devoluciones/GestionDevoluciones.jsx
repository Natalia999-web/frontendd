import { useState, useEffect, useRef } from "react";
import CrearDevolucion from "./CrearDevolucion.jsx";
import { getDevoluciones, crearDevolucion, resolverDevolucion } from "../../../services/devolucionesService.js";
import { crearNotificacionCliente } from "../../../services/notificacionesService.js";
import { registrarSalida } from "../../../services/salidasService.js";
import DateRangeFilter from "../../../shared/components/DateRangeFilter";
import "./Devoluciones.css";

function SkeletonRows({ cols = 8, rows = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((__, j) => (
        <td key={j}><div className="skeleton-cell" /></td>
      ))}
    </tr>
  ));
}

const fmt = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

const PER_PAGE = 5;

function EstadoBadge({ estado }) {
  return (
    <span className={`estado-badge estado--${estado}`}>
      <span className="estado-badge__dot" />
      {estado}
    </span>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const bg = toast.type === "error" ? "#c62828" : toast.type === "warn" ? "#e65100" : "#2e7d32";
  return (
    <div className="toast" style={{ background: bg }}>
      <span style={{ fontSize: 15 }}>{toast.type === "error" ? "✕" : toast.type === "warn" ? "⚠" : "✓"}</span>
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

/* ─── Evidencia inline en modal detalle ─────────────────── */
function EvidenciaVer({ evidencia }) {
  if (!evidencia) return null;
  const isImage = evidencia.tipo?.startsWith("image/");
  const isVideo = evidencia.tipo?.startsWith("video/");

  return (
    <div className="evidencia-ver">
      {isImage ? (
        <>
          <img src={evidencia.base64} alt="evidencia" className="evidencia-ver__img" />
          <div className="evidencia-ver__footer">
            <span className="evidencia-ver__icon">🖼️</span>
            <span className="evidencia-ver__name">{evidencia.nombre}</span>
          </div>
        </>
      ) : isVideo ? (
        <>
          <video
            src={evidencia.base64}
            controls
            style={{ width: "100%", maxHeight: 200, display: "block", background: "#000" }}
          />
          <div className="evidencia-ver__footer">
            <span className="evidencia-ver__icon">🎥</span>
            <span className="evidencia-ver__name">{evidencia.nombre}</span>
          </div>
        </>
      ) : (
        <div className="evidencia-ver__file">
          <span className="evidencia-ver__file-icon">📄</span>
          <div className="evidencia-ver__file-info">
            <div className="evidencia-ver__file-name">{evidencia.nombre}</div>
            <div className="evidencia-ver__file-sub">Archivo adjunto</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL VER DETALLE
   ═══════════════════════════════════════════════════════════ */
function ModalVerDevolucion({ dev, creditoCliente, onClose }) {
  const [tab, setTab] = useState("informacion");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--wide" onClick={(e) => e.stopPropagation()}>

        <div className="modal-header modal-header--red">
          <div>
            <p className="modal-header__eyebrow">DEVOLUCIÓN</p>
            <h2 className="modal-header__title modal-header__title--red">{dev.numero}</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <EstadoBadge estado={dev.estado} />
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={{ padding: "16px 24px 0", borderBottom: "1px solid #e0e0e0" }}>
          <div className="modal-tabs">
            <button
              className={`modal-tab-btn ${tab === "informacion" ? "active" : ""}`}
              onClick={() => setTab("informacion")}
            >Información</button>
            <button
              className={`modal-tab-btn ${tab === "productos" ? "active" : ""}`}
              onClick={() => setTab("productos")}
            >Productos y evidencia</button>
          </div>
        </div>

        <div className="modal-body" style={{ flexShrink: 0 }}>

          {tab === "informacion" && (
            <>
              <p className="section-label">Información general</p>
              <div className="form-grid-2">
                <div>
                  <label className="form-label">Cliente</label>
                  <div className="field-input--disabled">{dev.cliente?.nombre || "—"}</div>
                </div>
                <div>
                  <label className="form-label">Pedido original</label>
                  <div className="field-input--disabled" style={{ color: "#2e7d32", fontWeight: 700 }}>
                    {dev.numeroPedido}
                  </div>
                </div>
                <div>
                  <label className="form-label">Fecha solicitud</label>
                  <div className="field-input--disabled">{dev.fechaSolicitud}</div>
                </div>
                <div>
                  <label className="form-label">Fecha aprobación</label>
                  <div className="field-input--disabled">{dev.fechaAprobacion || "—"}</div>
                </div>
              </div>

              <p className="section-label">Motivo</p>
              <div className="info-box info-box--warn">
                <span className="info-box__icon">📋</span>
                <div className="info-box__text">
                  <span className="info-box__label">{dev.motivo}</span>
                  {dev.comentario && dev.comentario}
                </div>
              </div>

              {dev.estado === "Reembolsada" && (
                <div className="credito-box" style={{ marginTop: 12 }}>
                  <span className="credito-box__icon">💳</span>
                  <div>
                    <div className="credito-box__label">Crédito aplicado</div>
                    <div className="credito-box__val">{fmt(dev.totalDevuelto)}</div>
                    <div className="credito-box__saldo">
                      Saldo actual del cliente: {fmt(creditoCliente || 0)}
                    </div>
                  </div>
                </div>
              )}

              {dev.estado === "Rechazada" && dev.motivoRechazo && (
                <div className="info-box info-box--danger" style={{ marginTop: 12 }}>
                  <span className="info-box__icon">🚫</span>
                  <div className="info-box__text">
                    <span className="info-box__label">Motivo de rechazo</span>
                    {dev.motivoRechazo}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "productos" && (
            <>
              <p className="section-label">Productos devueltos</p>
              <div style={{ borderRadius: 10, border: "1px solid #e8f5e9", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f1f8f1" }}>
                      <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#2e7d32", textAlign: "left" }}>Producto</th>
                      <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#2e7d32", textAlign: "center" }}>Cant.</th>
                      <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#2e7d32", textAlign: "right" }}>Precio unit.</th>
                      <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#2e7d32", textAlign: "right" }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dev.productos || []).map((p, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #f1f8f1" }}>
                        <td style={{ padding: "9px 12px", fontWeight: 600 }}>{p.nombre}</td>
                        <td style={{ padding: "9px 12px", textAlign: "center", fontWeight: 700, color: "#1565c0" }}>{p.cantidad}</td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 12, color: "#757575" }}>{fmt(p.precioUnitario)}</td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: "#c62828" }}>{fmt(p.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#f9fdf9", borderTop: "1.5px solid #c8e6c9" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total a devolver</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#c62828" }}>{fmt(dev.totalDevuelto)}</span>
                </div>
              </div>

              {dev.evidencia && (
                <>
                  <p className="section-label" style={{ marginTop: 16 }}>Evidencia</p>
                  <EvidenciaVer evidencia={dev.evidencia} />
                </>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL APROBAR
   ═══════════════════════════════════════════════════════════ */
function ModalAprobar({ dev, onClose, onConfirm }) {
  const [done, setDone] = useState(false);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">APROBAR</p>
            <h2 className="modal-header__title">Aprobar devolución</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 13, color: "#616161" }}>
            ¿Aprobar la devolución <strong>{dev.numero}</strong> de <strong>{dev.cliente?.nombre}</strong>?
          </p>
          <div className="info-box info-box--success" style={{ marginTop: 12 }}>
            <span className="info-box__icon">✅</span>
            <div className="info-box__text">
              <span className="info-box__label">Al aprobar</span>
              La devolución se marcará como aprobada y se realizará el reembolso automático al crédito del cliente.
            </div>
          </div>
          <div className="credito-box" style={{ marginTop: 12 }}>
            <span className="credito-box__icon">💳</span>
            <div>
              <div className="credito-box__label">Monto a reembolsar</div>
              <div className="credito-box__val">{fmt(dev.totalDevuelto)}</div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button
            className="btn-approve"
            disabled={done}
            onClick={() => { setDone(true); setTimeout(() => onConfirm(dev.id), 700); }}
          >
            {done ? "Aprobando…" : "✅ Aprobar y Reembolsar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL RECHAZAR
   ═══════════════════════════════════════════════════════════ */
function ModalRechazar({ dev, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState("");
  const [error,  setError]  = useState("");
  const [done,   setDone]   = useState(false);

  const handleConfirm = () => {
    if (!motivo.trim()) { setError("Ingresa el motivo del rechazo"); return; }
    setDone(true);
    setTimeout(() => onConfirm(dev.id, motivo), 700);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header modal-header--red">
          <div>
            <p className="modal-header__eyebrow">RECHAZAR</p>
            <h2 className="modal-header__title modal-header__title--red">Rechazar devolución</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 13, color: "#616161" }}>
            ¿Rechazar la devolución <strong>{dev.numero}</strong>?
          </p>
          <div className="info-box info-box--danger" style={{ marginTop: 12 }}>
            <span className="info-box__icon">⚠️</span>
            <span className="info-box__text">El cliente recibirá una notificación en la aplicación informando el rechazo.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
            <label className="form-label">Motivo del rechazo <span className="required">*</span></label>
            <textarea
              className={`field-textarea${error ? " error" : ""}`}
              rows={3}
              placeholder="Explica por qué se rechaza la devolución…"
              value={motivo}
              onChange={(e) => { setMotivo(e.target.value); setError(""); }}
              style={{ borderColor: error ? "#e53935" : undefined }}
            />
            {error && <span className="field-error">{error}</span>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-reject" disabled={done} onClick={handleConfirm}>
            {done ? "Rechazando…" : "🚫 Rechazar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════ */
export default function GestionDevoluciones() {
  const [devoluciones, setDevoluciones] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [actionSaving, setActionSaving] = useState(false);
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
      const data = await getDevoluciones({ porPagina: 100 });
      setDevoluciones([...(data.devoluciones || [])].sort((a, b) => b.id - a.id));
    } catch (err) {
      showToast(err.message || "Error al cargar devoluciones", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  useEffect(() => {
    const h = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = devoluciones.filter((d) => {
    const q = search.toLowerCase();
    const matchQ = [d.numero, d.numeroPedido, d.cliente?.nombre, d.motivo]
      .filter(Boolean).some((v) => v.toLowerCase().includes(q));
    const matchE = filterEstado === "todos" || d.estado === filterEstado;

    let matchFecha = true;
    if (filterDesde || filterHasta) {
      const fechaRaw = String(d.fechaSolicitud || "").slice(0, 10);
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

  const handleCrear = async (payload) => {
    setActionSaving(true);
    try {
      const dev = await crearDevolucion(payload);
      await cargarDatos();
      showToast(`Devolución ${dev.numero} registrada`);
      setModal(null);
    } catch (err) {
      showToast(err.message || "Error al registrar devolución", "error");
    } finally {
      setActionSaving(false);
    }
  };

  const handleAprobar = async (id) => {
    setActionSaving(true);
    try {
      const dev = await resolverDevolucion(id, "aprobar");

      // Registrar salida por cada producto devuelto
      for (const prod of dev.productos || []) {
        await registrarSalida({
          tipo:       "Producto",
          idProducto: prod.idProducto,
          cantidad:   prod.cantidad,
          motivo:     `Devolución aprobada ${dev.numero} — pedido ${dev.numeroPedido}`,
        });
      }

      if (dev.idCliente) {
        crearNotificacionCliente(
          dev.idCliente,
          "devolucion_aprobada",
          "Devolución aprobada ✅",
          `Tu solicitud de devolución ${dev.numero} fue aprobada. El reembolso se aplicó a tu crédito.`,
        ).catch(() => {});
      }
      window.dispatchEvent(new Event('credito-updated'));
      await cargarDatos();
      showToast("Devolución aprobada y reembolso procesado");
      setModal(null);
    } catch (err) {
      showToast(err.message || "Error al aprobar devolución", "error");
    } finally {
      setActionSaving(false);
    }
  };

  const handleRechazar = async (id, motivo) => {
    setActionSaving(true);
    try {
      const dev = await resolverDevolucion(id, "rechazar", motivo);
      if (dev.idCliente) {
        crearNotificacionCliente(
          dev.idCliente,
          "devolucion_rechazada",
          "Devolución rechazada ❌",
          `Tu solicitud de devolución ${dev.numero} fue rechazada. Motivo: ${motivo}`,
        ).catch(() => {});
      }
      await cargarDatos();
      showToast("Devolución rechazada", "error");
      setModal(null);
    } catch (err) {
      showToast(err.message || "Error al rechazar devolución", "error");
    } finally {
      setActionSaving(false);
    }
  };

  const counts = {
    todos:       devoluciones.length,
    Pendiente:   devoluciones.filter((d) => d.estado === "Pendiente").length,
    Aprobada:    devoluciones.filter((d) => d.estado === "Aprobada").length,
    Reembolsada: devoluciones.filter((d) => d.estado === "Reembolsada").length,
    Rechazada:   devoluciones.filter((d) => d.estado === "Rechazada").length,
  };

  const toggleFilter = (est) => {
    setFilterEstado((prev) => (prev === est ? "todos" : est));
    setPage(1);
  };

  const abrirAprobar = (dev) => {
    if (dev.estado !== "Pendiente") { showToast("Solo se pueden aprobar devoluciones pendientes", "warn"); return; }
    setModal({ type: "aprobar", dev });
  };

  const abrirRechazar = (dev) => {
    if (dev.estado !== "Pendiente") { showToast("Solo se pueden rechazar devoluciones pendientes", "warn"); return; }
    setModal({ type: "rechazar", dev });
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-header__title">Gestión de Devoluciones</h1>
        <div className="page-header__line" />
      </div>

      <div className="page-inner">

        {/* Métricas */}
        <div className="metrics-row">
          {[
            { val: "todos",       label: "Total",        count: counts.todos,       color: "#2e7d32", icon: "📊" },
            { val: "Pendiente",   label: "Pendientes",   count: counts.Pendiente,   color: "#f9a825", icon: "⏳" },
            { val: "Reembolsada", label: "Reembolsadas", count: counts.Reembolsada, color: "#2e7d32", icon: "💳" },
            { val: "Rechazada",   label: "Rechazadas",   count: counts.Rechazada,   color: "#c62828", icon: "🚫" },
          ].map((m) => (
            <button
              key={m.val}
              className={`metric-card-btn ${filterEstado === m.val ? "active" : ""}`}
              onClick={() => toggleFilter(m.val)}
              style={{ borderColor: filterEstado === m.val ? m.color : "#e0e0e0" }}
            >
              <div className="metric-card-btn__icon" style={{ background: m.color + "15", color: m.color }}>{m.icon}</div>
              <div className="metric-card-btn__info">
                <span className="metric-card-btn__count">{m.count}</span>
                <span className="metric-card-btn__label">{m.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text" className="search-input"
              placeholder="Buscar por número, cliente, pedido o motivo…"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div ref={filterRef} style={{ position: "relative" }}>
            <button
              className={`filter-icon-btn${hasFilter ? " has-filter" : ""}`}
              onClick={() => setShowFilter((v) => !v)}
            >▼</button>
            {showFilter && (
              <div className="filter-dropdown" style={{ minWidth: 175 }}>
                <p className="filter-section-title">Estado</p>
                {[
                  { val: "todos",       label: "Todos",       dot: "#bdbdbd" },
                  { val: "Pendiente",   label: "Pendiente",   dot: "#f9a825" },
                  { val: "Aprobada",    label: "Aprobada",    dot: "#43a047" },
                  { val: "Rechazada",   label: "Rechazada",   dot: "#e53935" },
                  { val: "Reembolsada", label: "Reembolsada", dot: "#43a047" },
                ].map((f) => (
                  <button
                    key={f.val}
                    className={`filter-option${filterEstado === f.val ? " active" : ""}`}
                    onClick={() => { setFilterEstado(f.val); setPage(1); setShowFilter(false); }}
                  >
                    <span className="filter-dot" style={{ background: f.dot }} />{f.label}
                  </button>
                ))}
                <div style={{ height: 1, background: "#f0f0f0", margin: "8px 0" }} />
                <DateRangeFilter
                  desde={filterDesde}
                  hasta={filterHasta}
                  label="Fecha de solicitud"
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

          {(hasFilter || search) && (
            <button className="btn-limpiar" onClick={() => { setSearch(""); setFilterEstado("todos"); setFilterDesde(""); setFilterHasta(""); }}>
              ✕ Limpiar
            </button>
          )}

          <button className="btn-agregar" onClick={() => setModal({ type: "crear" })}>
            Nueva devolución <span style={{ fontSize: 18 }}>+</span>
          </button>
        </div>

        {/* Tabla */}
        <div className="card">
          <div className="tbl-wrapper">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>Nº</th>
                  <th>Devolución</th>
                  <th>Cliente</th>
                  <th>Motivo</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows cols={8} rows={5} />
                ) : paged.length === 0 ? (
                  <tr><td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-state__icon">↩️</div>
                      <p className="empty-state__text">
                        {hasFilter || search ? "Sin devoluciones que coincidan." : "No hay devoluciones registradas."}
                      </p>
                    </div>
                  </td></tr>
                ) : paged.map((dev, idx) => (
                  <tr key={dev.id} className="tbl-row">
                    <td>
                      <span className="row-num">
                        {String((safePage - 1) * PER_PAGE + idx + 1).padStart(2, "0")}
                      </span>
                    </td>
                    <td>
                      <div className="dev-num">{dev.numero}</div>
                      <div className="dev-pedido">📦 {dev.numeroPedido}</div>
                    </td>
                    <td>
                      <div className="client-name">{dev.cliente?.nombre || "—"}</div>
                      <div className="client-email">{dev.cliente?.correo || ""}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13, color: "#424242", fontWeight: 500 }}>{dev.motivo}</div>
                      {dev.comentario && (
                        <div style={{ fontSize: 11, color: "#9e9e9e", marginTop: 2, maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {dev.comentario}
                        </div>
                      )}
                    </td>
                    <td><span className="date-badge">{dev.fechaSolicitud}</span></td>
                    <td>
                      <div className="monto-val">{fmt(dev.totalDevuelto)}</div>
                      <div className="monto-met">Crédito</div>
                    </td>
                    <td><EstadoBadge estado={dev.estado} /></td>
                    <td>
                      <div className="actions-cell">
                        <button className="act-btn act-btn--view" title="Ver detalle"
                          onClick={() => setModal({ type: "ver", dev })}>👁</button>
                        <button className="act-btn act-btn--approve" title="Aprobar y Reembolsar"
                          onClick={() => abrirAprobar(dev)}
                          style={{ opacity: dev.estado === "Pendiente" ? 1 : 0.35, cursor: dev.estado === "Pendiente" ? "pointer" : "default" }}>
                          ✅
                        </button>
                        <button className="act-btn act-btn--reject" title="Rechazar"
                          onClick={() => abrirRechazar(dev)}
                          style={{ opacity: dev.estado === "Pendiente" ? 1 : 0.35, cursor: dev.estado === "Pendiente" ? "pointer" : "default" }}>
                          🚫
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <span className="pagination-count">
              {filtered.length} {filtered.length === 1 ? "devolución" : "devoluciones"} en total
            </span>
            <div className="pagination-btns">
              <button className="pg-btn-arrow" onClick={() => setPage(1)} disabled={safePage === 1}>«</button>
              <button className="pg-btn-arrow"
                onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
              <span className="pg-pill">Página {safePage} de {totalPages}</span>
              <button className="pg-btn-arrow"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
              <button className="pg-btn-arrow" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>››</button>
            </div>
          </div>
        </div>
      </div>

      {modal?.type === "crear"    && <CrearDevolucion onClose={() => setModal(null)} onSave={handleCrear} saving={actionSaving} />}
      {modal?.type === "ver"      && <ModalVerDevolucion dev={modal.dev} creditoCliente={0} onClose={() => setModal(null)} />}
      {modal?.type === "aprobar"  && <ModalAprobar  dev={modal.dev} onClose={() => setModal(null)} onConfirm={handleAprobar} />}
      {modal?.type === "rechazar" && <ModalRechazar dev={modal.dev} onClose={() => setModal(null)} onConfirm={handleRechazar} />}

      <Toast toast={toast} />
    </div>
  );
}