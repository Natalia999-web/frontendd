import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getLotesInsumo } from "../../../services/insumosService.js";
import { fmtFecha } from "../../../utils/dateUtils";
import "./GestionInsumos.css";

function BadgeVenc({ color, bg, border, icon, label, tooltip }) {
  const [show, setShow] = useState(false);
  return (
    <span
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 10, fontWeight: 700, color, background: bg,
        border: `1px solid ${border}`, borderRadius: 6, padding: "3px 8px",
        whiteSpace: "nowrap", cursor: "help", userSelect: "none" }}
    >
      {icon} {label}
      {show && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 7px)", left: "50%",
          transform: "translateX(-50%)", whiteSpace: "nowrap",
          background: "#1a1a2e", color: "#fff",
          borderRadius: 8, padding: "6px 12px",
          fontSize: 11, fontWeight: 600, lineHeight: 1.4,
          boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
          zIndex: 999, pointerEvents: "none",
        }}>
          {tooltip}
          <div style={{
            position: "absolute", top: "100%", left: "50%",
            transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: "5px solid #1a1a2e",
          }} />
        </div>
      )}
    </span>
  );
}

function calcEstado(actual, minimo) {
  if (actual === 0)    return "agotado";
  if (actual < minimo) return "bajo";
  return "disponible";
}

function Toggle({ value }) {
  return (
    <button className="toggle-btn" style={{
      background: value ? "#43a047" : "#bdbdbd",
      boxShadow: value ? "0 2px 8px rgba(67,160,71,0.4)" : "none",
      cursor: "default",
    }}>
      <span className="toggle-thumb" style={{ left: value ? 27 : 3 }}>
        <span className="toggle-label">{value ? "ON" : ""}</span>
      </span>
    </button>
  );
}

function StockBar({ actual, minimo, simbolo = "" }) {
  const pct   = minimo > 0 ? Math.min(100, Math.round((actual / (minimo * 2)) * 100)) : 100;
  const est   = calcEstado(actual, minimo);
  const color = est === "agotado" ? "#ef5350" : est === "bajo" ? "#ffa726" : "#43a047";
  return (
    <div className="stock-cell">
      <div className="stock-bar-wrap" style={est === "agotado" ? { background: "#ffcdd2" } : undefined}>
        <div className="stock-bar" style={{ width: est === "agotado" ? "100%" : pct + "%", background: color }} />
      </div>
      <span className="stock-nums" style={est === "agotado" ? { color: "#c62828" } : undefined}>
        <strong>{actual}</strong>{simbolo ? ` ${simbolo}` : ""} / mín {minimo}{simbolo ? ` ${simbolo}` : ""}
      </span>
    </div>
  );
}

function LotesTab({ lotes, loading, tipo, unidad }) {
  if (loading) return (
    <div style={{ textAlign: "center", padding: "28px 0", color: "#9e9e9e", fontSize: 13 }}>Cargando lotes…</div>
  );
  if (!lotes.length) return (
    <div style={{ textAlign: "center", padding: "28px 0", color: "#9e9e9e" }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
      <p style={{ margin: 0, fontSize: 13 }}>No hay lotes registrados.</p>
    </div>
  );

  const activos  = lotes.filter(l => !l.vencido);
  const vencidos = lotes.filter(l => l.vencido);

  // FEFO: mostrar activos del que vence primero al último
  const activosSorted = [...activos].sort((a, b) => {
    if (!a.fecha_vencimiento && !b.fecha_vencimiento) return 0;
    if (!a.fecha_vencimiento) return 1;
    if (!b.fecha_vencimiento) return -1;
    return a.fecha_vencimiento.localeCompare(b.fecha_vencimiento);
  });

  const mostrar = tipo === "vencidos" ? vencidos : activosSorted;

  if (!mostrar.length) return (
    <div style={{ textAlign: "center", padding: "28px 0", color: "#9e9e9e" }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{tipo === "vencidos" ? "✅" : "📦"}</div>
      <p style={{ margin: 0, fontSize: 13 }}>
        {tipo === "vencidos" ? "Sin lotes vencidos." : "Sin lotes activos."}
      </p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {mostrar.map(l => {
        const fv   = l.fecha_vencimiento;
        const dias = l.dias_para_vencer;
        const urgente = !l.vencido && dias !== null && dias <= 7;
        const pronto  = !l.vencido && dias !== null && dias > 7 && dias <= 30;
        const borderColor = l.vencido ? "#ef9a9a" : urgente ? "#ffcc80" : pronto ? "#ffe082" : "#c8e6c9";
        const bg          = l.vencido ? "#fff8f8" : urgente ? "#fff3e0" : pronto ? "#fffde7" : "#f9fdf9";
        return (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${borderColor}`, background: bg }}>
            <span style={{ fontSize: 18 }}>📦</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a1a" }}>
                Lote #{l.id}
                {l.numero_lote && <span style={{ fontWeight: 400, fontSize: 11, color: "#9e9e9e", marginLeft: 8 }}>{l.numero_lote}</span>}
              </div>
              <div style={{ fontSize: 11, color: "#9e9e9e", marginTop: 2 }}>
                {l.fecha_produccion && `Producción: ${fmtFecha(l.fecha_produccion)} · `}
                {fv
                  ? (l.vencido
                      ? `Venció: ${fmtFecha(fv)}${dias !== null ? ` · hace ${Math.abs(dias)} días` : ""}`
                      : `Vence: ${fmtFecha(fv)}`)
                  : "Sin fecha de vencimiento"}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#2e7d32" }}>
                {l.cantidad ?? l.cantidad_inicial ?? "—"}
              </div>
              <div style={{ fontSize: 10, color: "#9e9e9e" }}>{unidad?.simbolo ?? "uds."}</div>
            </div>
            {l.vencido && (
              <BadgeVenc
                color="#c62828" bg="#ffebee" border="#ef9a9a"
                icon="🚫" label="Vencido"
                tooltip={dias !== null ? `Venció hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? "" : "s"} — no apto para producción` : "Este lote ya está vencido — no apto para producción"}
              />
            )}
            {urgente && (
              <BadgeVenc
                color="#e65100" bg="#fff3e0" border="#ffcc80"
                icon="⚠️" label={`${dias}d`}
                tooltip={`Vence en ${dias} día${dias === 1 ? "" : "s"} — requiere atención urgente`}
              />
            )}
            {pronto && (
              <BadgeVenc
                color="#f9a825" bg="#fff8e1" border="#ffe082"
                icon="🟡" label={`${dias}d`}
                tooltip={`Próximo a vencer — quedan ${dias} días`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function VerInsumo({ ins, categorias, unidades, onClose }) {
  const navigate = useNavigate();
  const [tab,     setTab]     = useState("info");

  // Guardia: si el insumo no existe o fue eliminado
  if (!ins) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
          <div className="modal-header">
            <h2 className="modal-header__title">Insumo no encontrado</h2>
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <div className="empty-state" style={{ padding: "32px 0" }}>
              <div className="empty-state__icon" style={{ fontSize: 36 }}>🔍</div>
              <p className="empty-state__text">El insumo no existe o fue eliminado del sistema.</p>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-ghost" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    );
  }
  const [lotes,   setLotes]   = useState([]);
  const [lotesLoading, setLotesLoading] = useState(false);

  useEffect(() => {
    if (tab === "lotes" || tab === "vencidos") {
      if (lotes.length === 0) {
        setLotesLoading(true);
        getLotesInsumo(ins.id)
          .then(d => setLotes(d.lotes || []))
          .catch(() => {})
          .finally(() => setLotesLoading(false));
      }
    }
  }, [tab]);

  const cat    = (categorias ?? []).find(c => c.id === ins.idCategoria) ?? { icon: "🧺", nombre: "—" };
  const unidad = (unidades   ?? []).find(u => u.id === ins.idUnidad)    ?? { simbolo: ins.simboloUnidad || "uds.", nombre: "Unidad" };
  const est    = calcEstado(ins.stockActual, ins.stockMinimo);

  const estConfig = {
    disponible: { label: "Disponible", color: "#2e7d32", bg: "#e8f5e9", border: "#a5d6a7", icon: "✅" },
    bajo:       { label: "Stock bajo", color: "#f57f17", bg: "#fff8e1", border: "#ffe082", icon: "⚠️" },
    agotado:    { label: "Agotado",    color: "#c62828", bg: "#ffebee", border: "#ef9a9a", icon: "🚫" },
  };
  const ec = estConfig[est];

  const handleSolicitarProveedor = () => { onClose(); navigate("/admin/proveedores"); };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 660, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 40px)" }}
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="ver-ins-avatar">{cat.icon}</div>
            <div>
              <p className="modal-header__eyebrow">Insumo #{String(ins.id).padStart(4, "0")}</p>
              <h2 className="modal-header__title">{ins.nombre}</h2>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="ver-ins-tabs">
          <button className={`ver-ins-tab${tab === "info"     ? " ver-ins-tab--active" : ""}`} onClick={() => setTab("info")}>📋 Información</button>
          <button className={`ver-ins-tab${tab === "lotes"    ? " ver-ins-tab--active" : ""}`} onClick={() => setTab("lotes")}>📦 Lotes en inventario</button>
          <button className={`ver-ins-tab${tab === "vencidos" ? " ver-ins-tab--active" : ""}`} onClick={() => setTab("vencidos")}>📦 Lotes vencidos</button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: "auto" }}>

          {tab === "info" && (
            <>
              {est !== "disponible" && (
                <>
                  <div className="ver-ins-alerta" style={{ borderColor: ec.border, background: ec.bg, color: ec.color, marginBottom: 8 }}>
                    {ec.icon} <strong>{ec.label}</strong>
                    {est === "bajo"    && ` — faltan ${ins.stockMinimo - ins.stockActual} ${unidad.simbolo} para alcanzar el mínimo`}
                    {est === "agotado" && " — este insumo no tiene stock disponible"}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                    <button onClick={handleSolicitarProveedor} style={{ fontSize: 12, fontWeight: 600, color: "#1565c0", background: "#e3f2fd", border: "1px solid #90caf9", borderRadius: 8, padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      🛒 Solicitar al proveedor →
                    </button>
                  </div>
                </>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Columna izquierda: clasificación */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="ver-ins-field">
                    <span className="ver-ins-field__label">Categoría</span>
                    <span className="cat-chip" style={{ display: "inline-flex" }}>
                      <span className="cat-chip__icon">{cat.icon}</span>{cat.nombre}
                    </span>
                  </div>
                  <div className="ver-ins-field">
                    <span className="ver-ins-field__label">Unidad de medida</span>
                    <span className="unidad-badge">{unidad.simbolo} — {unidad.nombre}</span>
                  </div>
                  <div className="ver-ins-field">
                    <span className="ver-ins-field__label">Estado operativo</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Toggle value={ins.estado} />
                      <span style={{ fontSize: 12, color: ins.estado ? "#2e7d32" : "#9e9e9e", fontWeight: 700 }}>
                        {ins.estado ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Columna derecha: stock */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="ver-ins-stock-cards" style={{ marginBottom: 0 }}>
                    <div className="ver-ins-stock-card ver-ins-stock-card--actual">
                      <span className="ver-ins-stock-card__num">{ins.stockActual}</span>
                      <span className="ver-ins-stock-card__label">Stock actual</span>
                      <span className="ver-ins-stock-card__uni">{unidad.simbolo}</span>
                    </div>
                    <div className="ver-ins-stock-card ver-ins-stock-card--minimo">
                      <span className="ver-ins-stock-card__num">{ins.stockMinimo}</span>
                      <span className="ver-ins-stock-card__label">Stock mínimo</span>
                      <span className="ver-ins-stock-card__uni">{unidad.simbolo}</span>
                    </div>
                  </div>
                  <StockBar actual={ins.stockActual} minimo={ins.stockMinimo} simbolo={unidad.simbolo} />
                </div>
              </div>
            </>
          )}

          {(tab === "lotes" || tab === "vencidos") && (
            <LotesTab lotes={lotes} loading={lotesLoading} tipo={tab} unidad={unidad} />
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
