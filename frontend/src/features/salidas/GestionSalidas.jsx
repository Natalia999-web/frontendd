import { useState, useEffect, useRef } from "react";
import { getSalidas, registrarSalida, anularSalida, procesarVencidos } from "../../services/salidasService.js";
import { getProductos } from "../../services/productosService.js";
import { getInsumos } from "../../services/insumosService.js";
import { fmtFecha } from "../../utils/dateUtils.js";
import "./Salidas.css";

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */

const ITEMS_PER_PAGE = 5;

function hoyISO() { return new Date().toISOString().split("T")[0]; }
function estaVencido(fv)    { return fv ? fv < hoyISO() : false; }
function diasParaVencer(fv) {
  if (!fv) return null;
  return Math.ceil((new Date(fv + "T00:00:00") - new Date(hoyISO() + "T00:00:00")) / 86400000);
}

const TIPOS = [
  { val: "vencimiento", label: "Vencido",    icon: "🕒", color: "#e65100", bg: "#fff3e0", border: "#ffcc80" },
  { val: "daño",        label: "Dañado",     icon: "💥", color: "#c62828", bg: "#ffebee", border: "#ef9a9a" },
  { val: "ajuste",      label: "Ajuste",     icon: "⚖️", color: "#1565c0", bg: "#e3f2fd", border: "#90caf9" },
  { val: "consumo",     label: "Consumo",    icon: "🍽️", color: "#4a148c", bg: "#f3e5f5", border: "#ce93d8" },
  { val: "devolución",  label: "Devolución", icon: "↩️", color: "#2e7d32", bg: "#e8f5e9", border: "#a5d6a7" },
];
const TIPO_MAP = Object.fromEntries(TIPOS.map(t => [t.val, t]));

function fmtDate(dt) {
  if (!dt) return null;
  return String(dt).split("T")[0];
}

function adaptarSalida(s) {
  return {
    id:              s.ID_Salida,
    tipo:            s.Tipo,
    entidadId:       s.ID_Insumo || s.ID_Producto,
    entidadTipo:     s.ID_Insumo ? "insumo" : "producto",
    entidadNombre:   s.nombre_insumo || s.nombre_producto || "—",
    entidadCat:      s.nombre_categoria || "—",
    unidad:          "uds.",
    cantidad:        s.Cantidad,
    motivo:          s.Motivo,
    fecha:           fmtDate(s.Fecha),
    anulada:         s.estado_label === "Anulada",
    estadoLabel:     s.estado_label || "Activa",
    empleado:        s.nombre_empleado || (s.Tipo === "vencimiento" ? "Sistema (auto)" : "—"),
    anuladoPor:      s.nombre_anulado_por || null,
    fechaAnulacion:  fmtDate(s.Fecha_Anulacion),
  };
}


/* ══════════════════════════════════════════════════════════
   MODAL VER DETALLE
══════════════════════════════════════════════════════════ */
function InfoRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: color || "#1a1a1a" }}>{value}</span>
    </div>
  );
}

function ModalVerDetalle({ salida, onClose }) {
  const tc = TIPO_MAP[salida.tipo] || { color: "#757575", bg: "#f5f5f5", border: "#e0e0e0", icon: "📋", label: salida.tipo };
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 30000 }}>
      <div className="modal-box" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: `linear-gradient(135deg, ${tc.color} 0%, ${tc.color}cc 100%)` }}>
          <div>
            <p className="modal-header__eyebrow">Detalle de salida #{salida.id}</p>
            <h2 className="modal-header__title">{tc.icon} {tc.label}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: "20px 24px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <InfoRow label="Estado"         value={salida.estadoLabel} color={salida.anulada ? "#c62828" : "#2e7d32"} />
            <InfoRow label="Tipo elemento"  value={salida.entidadTipo === "producto" ? "📦 Producto" : "🧺 Insumo"} />
            <InfoRow label="Elemento"       value={salida.entidadNombre} />
            <InfoRow label="Categoría"      value={salida.entidadCat} />
            <InfoRow label="Cantidad"       value={`-${salida.cantidad} ${salida.unidad}`} color="#c62828" />
            <InfoRow label="Registrado por" value={salida.empleado} />
            <InfoRow label="Fecha registro" value={salida.fecha || "—"} />
            {salida.anulada && (
              <InfoRow label="Anulado por"    value={salida.anuladoPor || "—"} color="#c62828" />
            )}
            {salida.anulada && (
              <InfoRow label="Fecha anulación" value={salida.fechaAnulacion || "—"} />
            )}
          </div>
          {salida.motivo && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "#f9f9f9", borderRadius: 9, border: "1px solid #e0e0e0" }}>
              <InfoRow label="Motivo" value={salida.motivo} />
            </div>
          )}
          <div style={{ marginTop: 20, textAlign: "right" }}>
            <button className="btn-ghost" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MODAL CONFIRMAR ANULAR
══════════════════════════════════════════════════════════ */
function ModalConfirmarAnular({ salida, onConfirmar, onCancelar }) {
  const tc = TIPO_MAP[salida.tipo] || { color: "#757575", bg: "#f5f5f5", border: "#e0e0e0", icon: "📋", label: salida.tipo };
  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Confirmar acción</p>
            <h2 className="modal-header__title">Anular salida</h2>
          </div>
          <button className="modal-close-btn" onClick={onCancelar}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: "20px 24px 24px" }}>
          <div className="sl-confirm-card">
            <div className="sl-confirm-card__icon">🚫</div>
            <p className="sl-confirm-card__text">
              ¿Estás seguro de que deseas anular esta salida? El stock será <strong>reintegrado automáticamente</strong>.
            </p>
            <div className="sl-confirm-card__detail" style={{ borderColor: tc.border, background: tc.bg }}>
              <span style={{ fontSize: 18 }}>{salida.entidadTipo === "producto" ? "📦" : "🧺"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a1a" }}>{salida.entidadNombre}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                  <span className="sl-tipo-badge" style={{ color: tc.color, background: "#fff", border: `1px solid ${tc.border}`, fontSize: 11 }}>
                    {tc.icon} {tc.label}
                  </span>
                  <span style={{ fontSize: 12, color: "#c62828", fontWeight: 700 }}>-{salida.cantidad} uds.</span>
                  <span style={{ fontSize: 12, color: "#9e9e9e" }}>{salida.fecha}</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button className="sl-btn-cancel" onClick={onCancelar}>Cancelar</button>
            <button className="sl-btn-delete" onClick={onConfirmar}>Sí, anular</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MODAL REGISTRAR SALIDA
══════════════════════════════════════════════════════════ */
function RegistrarSalida({ productos, insumos, onClose, onRegistrada }) {
  const [entidadTipo,  setEntidadTipo]  = useState("producto");
  const [busqueda,     setBusqueda]     = useState("");
  const [seleccionado, setSeleccionado] = useState(null);
  const [tipoSalida,   setTipoSalida]   = useState("daño");
  const [cantidad,     setCantidad]     = useState("");
  const [motivo,       setMotivo]       = useState("");
  const [errors,       setErrors]       = useState({});
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const lista = entidadTipo === "producto" ? productos : insumos;
  const filtrados = lista.filter(e =>
    (e.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (e._label || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  const unidadLabel  = seleccionado?._unidad || "uds.";
  const stockActual  = seleccionado?._stock ?? 0;
  const tipoActual   = TIPO_MAP[tipoSalida];
  const stockDespues = Math.max(0, stockActual - (Number(cantidad) || 0));
  const pct          = stockActual > 0 ? Math.min(100, Math.round((stockDespues / stockActual) * 100)) : 0;

  const validate = () => {
    const e = {};
    if (!seleccionado)                                          e.seleccionado = "Selecciona un producto o insumo";
    if (!cantidad || isNaN(cantidad) || Number(cantidad) <= 0) e.cantidad     = "Ingresa una cantidad válida";
    else if (Number(cantidad) > stockActual)                   e.cantidad     = `Máximo: ${stockActual} ${unidadLabel}`;
    return e;
  };

  const handleRegistrar = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await registrarSalida({
        tipo:       tipoSalida,
        idProducto: seleccionado._tipo === "producto" ? seleccionado.id : null,
        idInsumo:   seleccionado._tipo === "insumo"   ? seleccionado.id : null,
        cantidad:   Number(cantidad),
        motivo:     motivo.trim() || undefined,
      });
      showToast(`Salida registrada — ${seleccionado.nombre} (-${cantidad} ${unidadLabel})`);
      setTimeout(() => onRegistrada?.(), 1500);
    } catch (err) {
      showToast(err.message || "Error al registrar", "error");
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--wide" onClick={e => e.stopPropagation()} style={{ maxWidth: 850 }}>
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Logística</p>
            <h2 className="modal-header__title">Registrar Salida</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="sl-registrar-grid">
            <div className="sl-panel">
              <p className="sl-panel__title">1 · Seleccionar elemento</p>
              <div className="sl-tipo-tabs">
                <button className={`sl-tipo-tab${entidadTipo === "producto" ? " active" : ""}`}
                  onClick={() => { setEntidadTipo("producto"); setSeleccionado(null); setBusqueda(""); }}>
                  📦 Productos
                </button>
                <button className={`sl-tipo-tab${entidadTipo === "insumo" ? " active" : ""}`}
                  onClick={() => { setEntidadTipo("insumo"); setSeleccionado(null); setBusqueda(""); }}>
                  🧺 Insumos
                </button>
              </div>
              <div className="sl-search">
                <span className="sl-search__icon">🔍</span>
                <input className="sl-search__input" placeholder="Buscar por nombre o categoría…"
                  value={busqueda}
                  onChange={e => { setBusqueda(e.target.value); setErrors(p => ({ ...p, seleccionado: "" })); }} />
              </div>
              <div className="sl-lista">
                {filtrados.length === 0
                  ? <div className="sl-lista__empty">Sin resultados</div>
                  : filtrados.map(item => {
                      const stock = item._stock;
                      const min   = item.stockMinimo ?? 10;
                      const agot  = stock === 0;
                      const bajo  = stock < min && !agot;
                      return (
                        <button key={`${item._tipo}-${item.id}`}
                          className={`sl-lista__item${seleccionado?.id === item.id && seleccionado?._tipo === item._tipo ? " selected" : ""}`}
                          onClick={() => { setSeleccionado(item); setErrors(p => ({ ...p, seleccionado: "" })); }}
                          style={agot ? { borderColor: "#ef9a9a", background: "#fff8f8" } : undefined}>
                          <div className="sl-lista__item-name" style={agot ? { color: "#c62828" } : undefined}>
                            {item.nombre}
                          </div>
                          <div className="sl-lista__item-meta">
                            <span className="sl-lista__item-cat">{item._label}</span>
                            <span style={{ fontWeight: 700, fontSize: 12, color: agot ? "#c62828" : bajo ? "#f57f17" : "#2e7d32" }}>
                              {stock} {item._unidad || "uds."}
                            </span>
                          </div>
                        </button>
                      );
                    })
                }
              </div>
              {errors.seleccionado && <p className="field-error" style={{ marginTop: 6 }}>{errors.seleccionado}</p>}
            </div>

            <div className="sl-panel sl-panel--form">
              <p className="sl-panel__title">2 · Registrar salida</p>
              {seleccionado ? (
                <div className="sl-seleccionado">
                  <span style={{ fontSize: 22 }}>{seleccionado._tipo === "producto" ? "📦" : "🧺"}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{seleccionado.nombre}</div>
                    <div style={{ fontSize: 12, color: "#9e9e9e" }}>
                      Stock actual: <strong style={{ color: "#2e7d32" }}>{stockActual} {unidadLabel}</strong>
                    </div>
                  </div>
                  <button onClick={() => { setSeleccionado(null); setCantidad(""); setErrors({}); }}
                    style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#bdbdbd" }}>✕</button>
                </div>
              ) : (
                <div className="sl-seleccionado sl-seleccionado--empty">
                  <span style={{ fontSize: 26, opacity: 0.3 }}>👈</span>
                  <span style={{ fontSize: 13, color: "#bdbdbd" }}>Selecciona un elemento</span>
                </div>
              )}

              <div style={{ marginTop: 10, marginBottom: 10 }}>
                <label className="sl-label">Tipo de salida</label>
                <div className="sl-tipos-grid">
                  {TIPOS.filter(t => t.val !== "vencimiento").map(t => (
                    <button key={t.val} onClick={() => setTipoSalida(t.val)}
                      className={`sl-tipo-btn${tipoSalida === t.val ? " active" : ""}`}
                      style={tipoSalida === t.val ? { borderColor: t.border, background: t.bg, color: t.color } : {}}>
                      <span style={{ fontSize: 17 }}>{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label className="sl-label">Cantidad a descontar</label>
                <div style={{ position: "relative" }}>
                  <input type="number" min="1" max={stockActual}
                    className={`sl-input${errors.cantidad ? " sl-input--error" : ""}`}
                    value={cantidad}
                    onKeyDown={e => { if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") e.preventDefault(); }}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === "" || Number(v) > 0) {
                        setCantidad(v);
                        setErrors(p => ({ ...p, cantidad: "" }));
                      }
                    }}
                    placeholder={seleccionado ? `Máx. ${stockActual}` : "—"}
                    disabled={!seleccionado} />
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9e9e9e", pointerEvents: "none" }}>
                    {unidadLabel}
                  </span>
                </div>
                {errors.cantidad && <p className="field-error">{errors.cantidad}</p>}
              </div>

              {seleccionado && cantidad && !errors.cantidad && (
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: tipoActual.bg, border: `1px solid ${tipoActual.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                    <span style={{ color: "#9e9e9e" }}>Stock después de la salida</span>
                    <span style={{ fontWeight: 700, color: tipoActual.color }}>{stockDespues} {unidadLabel}</span>
                  </div>
                  <div style={{ height: 5, background: "#e0e0e0", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3, transition: "width 0.35s", width: pct + "%", background: pct > 50 ? "#43a047" : pct > 20 ? "#ffa726" : "#ef5350" }} />
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 10 }}>
                <label className="sl-label">Motivo <span style={{ color: "#bdbdbd", fontWeight: 400, textTransform: "none" }}>(opcional)</span></label>
                <input className="sl-input" value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder="Descripción adicional…" disabled={!seleccionado} />
              </div>

              <button className="sl-btn-registrar" onClick={handleRegistrar}
                disabled={saving || !seleccionado}
                style={{ background: tipoActual.color }}>
                {saving ? "Registrando…" : `${tipoActual.icon} Registrar ${tipoActual.label.toLowerCase()}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="sl-toast" style={{ background: toast.type === "error" ? "#c62828" : "#2e7d32" }}>
          <span>{toast.type === "error" ? "❌" : "✅"}</span> {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SKELETON
══════════════════════════════════════════════════════════ */
function SkeletonRows() {
  return Array.from({ length: 5 }, (_, i) => (
    <tr key={i}>
      {Array.from({ length: 7 }, (_, j) => (
        <td key={j}><div className="skeleton-cell" /></td>
      ))}
    </tr>
  ));
}

/* ══════════════════════════════════════════════════════════
   TAB HISTORIAL
══════════════════════════════════════════════════════════ */
function HistorialSalidas({ salidas, loading, onAgregarClick, cargarSalidas }) {
  const [filtroTipo,      setFiltroTipo]     = useState("todos");
  const [filtroEntidad,   setFiltroEntidad]  = useState("todos");
  const [busqueda,        setBusqueda]       = useState("");
  const [showFilter,      setShowFilter]     = useState(false);
  const [salidaAAnular,   setSalidaAAnular]  = useState(null);
  const [salidaAVer,      setSalidaAVer]     = useState(null);
  const [toast,           setToast]          = useState(null);
  const [page,            setPage]           = useState(1);
  const filterRef = useRef();

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const h = e => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => { setPage(1); }, [filtroTipo, filtroEntidad, busqueda]);

  const filtradas = salidas.filter(s => {
    const matchTipo    = filtroTipo    === "todos" || s.tipo === filtroTipo;
    const matchEntidad = filtroEntidad === "todos" || s.entidadTipo === filtroEntidad;
    const matchQ       = s.entidadNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                         (s.motivo || "").toLowerCase().includes(busqueda.toLowerCase());
    return matchTipo && matchEntidad && matchQ;
  });

  const totalPages = Math.ceil(filtradas.length / ITEMS_PER_PAGE);
  const safePage   = Math.min(page, Math.max(1, totalPages));
  const paginadas  = filtradas.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  const totalUnidades = salidas.reduce((acc, s) => acc + (s.cantidad || 0), 0);

  const toggleFiltroTipo = (val) => setFiltroTipo(prev => prev === val ? "todos" : val);

  const handleConfirmarAnular = async () => {
    if (!salidaAAnular) return;
    try {
      await anularSalida(salidaAAnular.id);
      showToast("Salida anulada — stock reintegrado ✔");
      await cargarSalidas();
    } catch (err) {
      showToast(err.message || "Error al anular", "error");
    }
    setSalidaAAnular(null);
  };

  return (
    <div className="sl-tab-content">
      {/* Stats */}
      <div className="sl-stats-row">
        <div className={`sl-stat-card ${filtroTipo === "todos" && filtroEntidad === "todos" ? "active" : ""}`}
          onClick={() => { setFiltroTipo("todos"); setFiltroEntidad("todos"); }} style={{ cursor: "pointer" }}>
          <span className="sl-stat-card__num">{salidas.length}</span>
          <span className="sl-stat-card__label">Total salidas</span>
        </div>
        <div className="sl-stat-card">
          <span className="sl-stat-card__num">{totalUnidades}</span>
          <span className="sl-stat-card__label">Unidades</span>
        </div>
        {TIPOS.map(t => {
          const count = salidas.filter(s => s.tipo === t.val).length;
          return (
            <div key={t.val} className={`sl-stat-card ${filtroTipo === t.val ? "active" : ""}`}
              style={{ borderColor: count > 0 ? (filtroTipo === t.val ? t.color : t.border) : "#e0e0e0", cursor: "pointer" }}
              onClick={() => toggleFiltroTipo(t.val)}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span className="sl-stat-card__num" style={{ color: count > 0 ? t.color : "#bdbdbd", fontSize: 18 }}>{count}</span>
              <span className="sl-stat-card__label">{t.label}</span>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="sl-toolbar" style={{ alignItems: "stretch" }}>
        <div className="sl-search" style={{ flex: 1, marginBottom: 0, display: "flex", alignItems: "center" }}>
          <span className="sl-search__icon">🔍</span>
          <input className="sl-search__input" placeholder="Buscar por nombre o motivo…"
            value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ height: "100%" }} />
        </div>
        <div ref={filterRef} style={{ position: "relative", display: "flex" }}>
          <button className={`sl-filter-btn ${filtroTipo !== "todos" || filtroEntidad !== "todos" ? "has-filter" : ""}`}
            onClick={() => setShowFilter(v => !v)}>▼ Filtros</button>
          {showFilter && (
            <div className="sl-filter-dropdown sl-filter-dropdown--wide">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <p className="sl-filter-title">Tipo de salida</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
                    {[{ val: "todos", label: "Todos", icon: "📋" }, ...TIPOS].map(t => (
                      <button key={t.val} className={`sl-filter-opt${filtroTipo === t.val ? " active" : ""}`}
                        onClick={() => setFiltroTipo(t.val)}>
                        <span>{t.icon}</span>{t.val === "todos" ? "Todos los tipos" : t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ borderLeft: "1px solid #f0f0f0", paddingLeft: 12 }}>
                  <p className="sl-filter-title">Tipo de elemento</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
                    {[{ val: "todos", label: "Todos", icon: "📋" }, { val: "producto", label: "Productos", icon: "📦" }, { val: "insumo", label: "Insumos", icon: "🧺" }]
                      .map(opt => (
                        <button key={opt.val} className={`sl-filter-opt${filtroEntidad === opt.val ? " active" : ""}`}
                          onClick={() => { setFiltroEntidad(opt.val); setShowFilter(false); }}>
                          <span>{opt.icon}</span>{opt.label}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {(filtroTipo !== "todos" || filtroEntidad !== "todos" || busqueda) && (
          <button className="btn-limpiar" onClick={() => { setBusqueda(""); setFiltroTipo("todos"); setFiltroEntidad("todos"); }}>
            ✕ Limpiar
          </button>
        )}

        <button className="btn-agregar" onClick={onAgregarClick}>
          Registrar Salida <span style={{ fontSize: 18 }}>+</span>
        </button>
      </div>

      <div className="card">
        <table className="tbl">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Elemento</th>
                <th>Categoría</th>
                <th>Cantidad</th>
                <th>Motivo</th>
                <th>Fecha</th>
                <th style={{ width: 80, textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : paginadas.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state__icon">📋</div>
                    <p className="empty-state__text">No hay salidas registradas</p>
                  </div>
                </td></tr>
              ) : paginadas.map((s, idx) => {
                const tc = TIPO_MAP[s.tipo] || { color: "#757575", bg: "#f5f5f5", border: "#e0e0e0", icon: "📋", label: s.tipo };
                return (
                  <tr key={s.id || idx} className="tbl-row" style={{ opacity: s.anulada ? 0.5 : 1 }}>
                    <td>
                      <span className="sl-tipo-badge" style={{ color: tc.color, background: tc.bg, border: `1px solid ${tc.border}` }}>
                        {tc.icon} {tc.label}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 15 }}>{s.entidadTipo === "producto" ? "📦" : "🧺"}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{s.entidadNombre}</div>
                          <div style={{ fontSize: 11, color: "#9e9e9e" }}>{s.entidadTipo}</div>
                        </div>
                      </div>
                    </td>
                    <td><span style={{ fontSize: 12, color: "#616161" }}>{s.entidadCat}</span></td>
                    <td><span style={{ fontWeight: 700, color: "#c62828", fontSize: 14 }}>-{s.cantidad} <span style={{ fontWeight: 400, fontSize: 11, color: "#9e9e9e" }}>{s.unidad}</span></span></td>
                    <td><span style={{ fontSize: 13, color: "#424242" }}>{s.motivo || "—"}</span></td>
                    <td><span style={{ fontSize: 12, color: "#9e9e9e" }}>{s.fecha || "—"}</span></td>
                    <td>
                      <div className="sl-table-actions">
                        <button className="sl-action-btn" title="Ver detalles" onClick={() => setSalidaAVer(s)}
                          style={{ background: "#e3f2fd", color: "#1565c0", border: "1.5px solid #90caf9" }}>👁</button>
                        {s.anulada
                          ? <span className="sl-action-locked" title="Salida anulada">🚫</span>
                          : <button className="sl-action-btn sl-action-btn--delete" title="Anular salida" onClick={() => setSalidaAAnular(s)}>🚫</button>
                        }
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
          {filtradas.length} {filtradas.length === 1 ? "salida" : "salidas"} en total
        </span>
        <div className="pagination-btns">
          <button className="pg-btn-arrow" onClick={() => setPage(1)} disabled={safePage === 1}>«</button>
          <button className="pg-btn-arrow" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
          <span className="pg-pill">Página {safePage} de {Math.max(1, totalPages)}</span>
          <button className="pg-btn-arrow" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>›</button>
          <button className="pg-btn-arrow" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}>»</button>
        </div>
      </div>

      {salidaAVer && (
        <ModalVerDetalle salida={salidaAVer} onClose={() => setSalidaAVer(null)} />
      )}

      {salidaAAnular && (
        <ModalConfirmarAnular
          salida={salidaAAnular}
          onConfirmar={handleConfirmarAnular}
          onCancelar={() => setSalidaAAnular(null)}
        />
      )}

      {toast && (
        <div className="sl-toast" style={{ background: toast.type === "error" ? "#c62828" : "#2e7d32" }}>
          <span>{toast.type === "error" ? "❌" : "✅"}</span> {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TAB VENCIDOS
══════════════════════════════════════════════════════════ */
function Vencidos({ salidas, loading, cargarSalidas }) {
  const [filtro,     setFiltro]     = useState("todos");
  const [procesando, setProcesando] = useState(false);
  const [toast,      setToast]      = useState(null);
  const [page,       setPage]       = useState(1);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { setPage(1); }, [filtro]);

  const vencimientos = salidas.filter(s => s.tipo === "vencimiento");
  const porProducto  = vencimientos.filter(s => s.entidadTipo === "producto");
  const porInsumo    = vencimientos.filter(s => s.entidadTipo === "insumo");
  const totalUnidades = vencimientos.reduce((acc, s) => acc + (s.cantidad || 0), 0);

  const filtrados = filtro === "producto" ? porProducto
    : filtro === "insumo" ? porInsumo
    : vencimientos;

  const totalPages = Math.ceil(filtrados.length / ITEMS_PER_PAGE);
  const safePage   = Math.min(page, Math.max(1, totalPages));
  const paginados  = filtrados.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleProcesar = async () => {
    setProcesando(true);
    try {
      const res = await procesarVencidos();
      showToast(`${res.procesados} lote(s) procesado(s) — stock descontado`);
      await cargarSalidas();
    } catch (err) {
      showToast(err.message || "Error al procesar vencidos", "error");
    }
    setProcesando(false);
  };

  return (
    <div className="sl-tab-content">
      {/* Stats */}
      <div className="sl-stats-row">
        <div className={`sl-stat-card ${filtro === "todos" ? "active" : ""}`}
          style={{ cursor: "pointer", borderColor: vencimientos.length > 0 ? (filtro === "todos" ? "#c62828" : "#ef9a9a") : "#e0e0e0" }}
          onClick={() => setFiltro("todos")}>
          <span style={{ fontSize: 18 }}>⛔</span>
          <span className="sl-stat-card__num" style={{ color: vencimientos.length > 0 ? "#c62828" : "#bdbdbd" }}>{vencimientos.length}</span>
          <span className="sl-stat-card__label">Total vencimientos</span>
        </div>
        <div className="sl-stat-card">
          <span style={{ fontSize: 18 }}>📉</span>
          <span className="sl-stat-card__num" style={{ color: totalUnidades > 0 ? "#c62828" : "#bdbdbd" }}>{totalUnidades}</span>
          <span className="sl-stat-card__label">Unidades perdidas</span>
        </div>
        <div className={`sl-stat-card ${filtro === "producto" ? "active" : ""}`}
          style={{ cursor: "pointer", borderColor: porProducto.length > 0 ? (filtro === "producto" ? "#c62828" : "#ef9a9a") : "#e0e0e0" }}
          onClick={() => setFiltro("producto")}>
          <span style={{ fontSize: 18 }}>📦</span>
          <span className="sl-stat-card__num" style={{ color: porProducto.length > 0 ? "#c62828" : "#bdbdbd" }}>{porProducto.length}</span>
          <span className="sl-stat-card__label">Productos</span>
        </div>
        <div className={`sl-stat-card ${filtro === "insumo" ? "active" : ""}`}
          style={{ cursor: "pointer", borderColor: porInsumo.length > 0 ? (filtro === "insumo" ? "#c62828" : "#ef9a9a") : "#e0e0e0" }}
          onClick={() => setFiltro("insumo")}>
          <span style={{ fontSize: 18 }}>🧺</span>
          <span className="sl-stat-card__num" style={{ color: porInsumo.length > 0 ? "#c62828" : "#bdbdbd" }}>{porInsumo.length}</span>
          <span className="sl-stat-card__label">Insumos</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sl-toolbar">
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { val: "todos",    label: "Todos",     icon: "📋" },
            { val: "producto", label: "Productos", icon: "📦" },
            { val: "insumo",   label: "Insumos",   icon: "🧺" },
          ].map(opt => (
            <button key={opt.val}
              className={`sl-pill${filtro === opt.val ? " active" : ""}`}
              onClick={() => setFiltro(opt.val)}>
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
        <button className="btn-agregar" onClick={handleProcesar} disabled={procesando}
          style={{ marginLeft: "auto", background: procesando ? "#bdbdbd" : "#c62828" }}>
          {procesando ? "Procesando…" : "🔄 Procesar vencidos"}
        </button>
      </div>

      {/* Tabla compacta */}
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Elemento</th>
              <th>Categoría</th>
              <th>Cantidad</th>
              <th>Motivo / Lote</th>
              <th>Fecha</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows />
            ) : paginados.length === 0 ? (
              <tr><td colSpan={6}>
                <div className="empty-state">
                  <div className="empty-state__icon">✅</div>
                  <p className="empty-state__text">No hay registros de vencimiento</p>
                </div>
              </td></tr>
            ) : paginados.map((s, idx) => (
              <tr key={s.id || idx} className="tbl-row" style={{ opacity: s.anulada ? 0.5 : 1 }}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15 }}>{s.entidadTipo === "producto" ? "📦" : "🧺"}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{s.entidadNombre}</div>
                      <div style={{ fontSize: 11, color: "#9e9e9e" }}>{s.entidadTipo}</div>
                    </div>
                  </div>
                </td>
                <td><span style={{ fontSize: 12, color: "#616161" }}>{s.entidadCat}</span></td>
                <td>
                  <span style={{ fontWeight: 700, color: "#c62828", fontSize: 14 }}>
                    -{s.cantidad} <span style={{ fontWeight: 400, fontSize: 11, color: "#9e9e9e" }}>uds.</span>
                  </span>
                </td>
                <td><span style={{ fontSize: 12, color: "#424242" }}>{s.motivo || "—"}</span></td>
                <td><span style={{ fontSize: 12, color: "#9e9e9e" }}>{s.fecha || "—"}</span></td>
                <td>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: s.anulada ? "#f5f5f5" : "#ffebee",
                    color: s.anulada ? "#9e9e9e" : "#c62828",
                    border: `1px solid ${s.anulada ? "#e0e0e0" : "#ef9a9a"}`,
                  }}>
                    {s.anulada ? "🚫 Anulada" : "⛔ Vencido"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
        <span className="pagination-count">
          {filtrados.length} {filtrados.length === 1 ? "registro" : "registros"} en total
        </span>
        <div className="pagination-btns">
          <button className="pg-btn-arrow" onClick={() => setPage(1)} disabled={safePage === 1}>«</button>
          <button className="pg-btn-arrow" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
          <span className="pg-pill">Página {safePage} de {Math.max(1, totalPages)}</span>
          <button className="pg-btn-arrow" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>›</button>
          <button className="pg-btn-arrow" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}>»</button>
        </div>
      </div>

      {toast && (
        <div className="sl-toast" style={{ background: toast.type === "error" ? "#c62828" : "#2e7d32" }}>
          <span>{toast.type === "error" ? "❌" : "✅"}</span> {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
══════════════════════════════════════════════════════════ */
export default function GestionSalidas() {
  const [tab,       setTab]       = useState("historial");
  const [showModal, setShowModal] = useState(false);
  const [salidas,   setSalidas]   = useState([]);
  const [productos, setProductos] = useState([]);
  const [insumos,   setInsumos]   = useState([]);
  const [loading,   setLoading]   = useState(true);

  // Mapas id → nombre de categoría, construidos una vez al cargar
  const prodCatMap = useRef({});
  const insCatMap  = useRef({});

  const enriquecerSalidas = (rawSalidas) =>
    rawSalidas.map(s => {
      const adapted = adaptarSalida(s);
      if (adapted.entidadTipo === "producto" && adapted.entidadId) {
        adapted.entidadCat = prodCatMap.current[adapted.entidadId] || adapted.entidadCat;
      } else if (adapted.entidadTipo === "insumo" && adapted.entidadId) {
        adapted.entidadCat = insCatMap.current[adapted.entidadId] || adapted.entidadCat;
      }
      return adapted;
    });

  const cargarSalidas = async () => {
    setLoading(true);
    try {
      const data = await getSalidas();
      setSalidas(enriquecerSalidas([...(data.salidas || [])].sort((a, b) => b.id - a.id)));
    } catch {
      // error shown in child toast
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [sData, pData, iData] = await Promise.all([
          getSalidas(),
          getProductos(),
          getInsumos(),
        ]);

        const prodList = (pData.productos || []).filter(p => p.Estado !== 0).map(p => ({
          id:          p.ID_Producto,
          nombre:      p.nombre || p.Nombre || "",
          _tipo:       "producto",
          _stock:      p.Stock_Actual ?? p.Stock ?? 0,
          _label:      p.nombre_categoria || "",
          _unidad:     "uds.",
        }));
        const insList = (iData.insumos || []).filter(i => i.Estado !== 0).map(i => ({
          id:          i.ID_Insumo,
          nombre:      i.Nombre,
          _tipo:       "insumo",
          _stock:      i.Stock_Actual ?? 0,
          _label:      i.nombre_categoria || "",
          _unidad:     i.simbolo_unidad || "uds.",
          stockMinimo: i.Stock_Minimo,
        }));

        // Construir mapas id → categoría para enriquecer el historial
        prodCatMap.current = Object.fromEntries(prodList.map(p => [p.id, p._label]));
        insCatMap.current  = Object.fromEntries(insList.map(i => [i.id, i._label]));

        setProductos(prodList);
        setInsumos(insList);
        setSalidas(enriquecerSalidas([...(sData.salidas || [])].sort((a, b) => b.id - a.id)));
      } catch {
        // fallback silencioso
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const TABS = [
    { key: "historial", label: "📋 Historial" },
    { key: "vencidos",  label: "⛔ Vencidos"  },
  ];

  return (
    <div className="sl-page">
      <div className="sl-page__header">
        <h1 className="sl-page__title">Gestión de Salidas</h1>
        <div className="sl-page__line" />
      </div>

      <div className="sl-page__tabs">
        {TABS.map(t => (
          <button key={t.key}
            className={`sl-tab${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="sl-page__body">
        {tab === "historial" && (
          <HistorialSalidas
            salidas={salidas}
            loading={loading}
            onAgregarClick={() => setShowModal(true)}
            cargarSalidas={cargarSalidas}
          />
        )}
        {tab === "vencidos" && (
          <Vencidos salidas={salidas} loading={loading} cargarSalidas={cargarSalidas} />
        )}
      </div>

      {showModal && (
        <RegistrarSalida
          productos={productos}
          insumos={insumos}
          onClose={() => setShowModal(false)}
          onRegistrada={() => { setShowModal(false); cargarSalidas(); }}
        />
      )}
    </div>
  );
}
