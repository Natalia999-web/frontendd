import { useState } from "react";
import { X, Package, Utensils, CornerUpLeft, Zap, Scale } from "lucide-react";

/**
 * SalidaModal — Modal unificado de salidas para Productos e Insumos
 *
 * Props:
 *  entidad     — objeto producto o insumo
 *  tipo        — "producto" | "insumo"
 *  stockActual — número
 *  unidadLabel — string  (ej. "uds." / "kg")
 *  onClose     — fn
 *  onConfirm   — fn(payload) → { ok, razon? }
 *
 * El modal resuelve solo la UI; la lógica de descuento está en AppContext.
 */

const TIPOS = [
  { val: "daño",       label: "Dañado",      Icon: Zap,           color: "#c62828", bg: "#ffebee", border: "#ef9a9a" },
  { val: "ajuste",     label: "Ajuste",      Icon: Scale,         color: "#1565c0", bg: "#e3f2fd", border: "#90caf9" },
  { val: "consumo",    label: "Consumo",     Icon: Utensils,      color: "#4a148c", bg: "#f3e5f5", border: "#ce93d8" },
  { val: "devolución", label: "Devolución",  Icon: CornerUpLeft,  color: "#2e7d32", bg: "#e8f5e9", border: "#a5d6a7" },
];

export default function SalidaModal({ entidad, tipo, stockActual, unidadLabel = "uds.", onClose, onConfirm }) {
  const [tipoSalida, setTipoSalida] = useState("daño");
  const [cantidad,   setCantidad]   = useState("");
  const [motivo,     setMotivo]     = useState("");
  const [errors,     setErrors]     = useState({});
  const [saving,     setSaving]     = useState(false);

  const tipoActual = TIPOS.find(t => t.val === tipoSalida);

  const validate = () => {
    const e    = {};
    const cant = Number(cantidad);
    if (!cantidad || isNaN(cant) || cant <= 0) e.cantidad = "Ingresa una cantidad válida";
    else if (cant > stockActual)               e.cantidad = `Máximo disponible: ${stockActual} ${unidadLabel}`;
    return e;
  };

  const handleConfirm = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    await onConfirm({
      id:       entidad.id,
      tipo:     tipoSalida,
      cantidad: Number(cantidad),
      motivo:   motivo.trim() || tipoActual.label,
      fecha:    new Date().toLocaleDateString("es-CO"),
    });
    setSaving(false);
  };

  const stockDespues = Math.max(0, stockActual - (Number(cantidad) || 0));
  const pct          = stockActual > 0
    ? Math.min(100, Math.round((stockDespues / stockActual) * 100))
    : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">{tipo === "producto" ? "Productos" : "Insumos"}</p>
            <h2 className="modal-header__title">Registrar salida</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ overflow: "visible" }}>

          {/* Entidad */}
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "#f9fdf9", border: "1px solid #c8e6c9", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center" }}>{tipo === "producto" ? <Package size={20} /> : <Package size={20} />}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{entidad.nombre}</div>
              <div style={{ fontSize: 12, color: "#9e9e9e", marginTop: 1 }}>
                Stock actual: <strong style={{ color: "#2e7d32" }}>{stockActual} {unidadLabel}</strong>
              </div>
            </div>
          </div>

          {/* Tipo de salida */}
          <div className="form-group">
            <label className="form-label">Tipo de salida</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {TIPOS.map(t => (
                <button key={t.val} onClick={() => setTipoSalida(t.val)}
                  style={{
                    padding: "8px 6px", borderRadius: 9,
                    border: `2px solid ${tipoSalida === t.val ? t.border : "#e0e0e0"}`,
                    background: tipoSalida === t.val ? t.bg : "#fafafa",
                    color: tipoSalida === t.val ? t.color : "#9e9e9e",
                    fontWeight: tipoSalida === t.val ? 700 : 500,
                    fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    transition: "all 0.15s",
                  }}>
                  <t.Icon size={18} />{t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cantidad */}
          <div className="form-group">
            <label className="form-label">Cantidad a descontar</label>
            <div style={{ position: "relative" }}>
              <input
                type="number" min="1" max={stockActual}
                className={`field-input${errors.cantidad ? " field-input--error" : ""}`}
                value={cantidad}
                onKeyDown={e => { if (["-", "e", "E", "+", "."].includes(e.key)) e.preventDefault(); }}
                onChange={e => {
                  const val = e.target.value;
                  setCantidad(val);
                  const cant = Number(val);
                  let err = "";
                  if (!val || isNaN(cant) || cant <= 0) err = "Ingresa una cantidad válida";
                  else if (cant > stockActual) err = `Máximo disponible: ${stockActual} ${unidadLabel}`;
                  setErrors(p => ({ ...p, cantidad: err }));
                }}
                placeholder={`Máx. ${stockActual}`}
                onFocus={e => e.target.style.borderColor = "#4caf50"}
                onBlur={e => e.target.style.borderColor = errors.cantidad ? "#e53935" : "#e0e0e0"}
              />
              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9e9e9e", pointerEvents: "none" }}>{unidadLabel}</span>
            </div>
            {errors.cantidad && <p className="field-error">{errors.cantidad}</p>}
          </div>

          {/* Preview stock resultante */}
          {cantidad && !errors.cantidad && (
            <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: tipoActual.bg, border: `1px solid ${tipoActual.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "#9e9e9e" }}>Stock después de la salida</span>
                <span style={{ fontWeight: 700, color: tipoActual.color }}>{stockDespues} {unidadLabel}</span>
              </div>
              <div style={{ height: 6, background: "#e0e0e0", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, transition: "width 0.35s", width: pct + "%", background: pct > 50 ? "#43a047" : pct > 20 ? "#ffa726" : "#ef5350" }} />
              </div>
            </div>
          )}

          {/* Motivo */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Motivo <span style={{ color: "#bdbdbd", fontWeight: 400, textTransform: "none" }}>(opcional)</span></label>
            <input className="field-input" value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Descripción adicional…"
              onFocus={e => e.target.style.borderColor = "#4caf50"}
              onBlur={e => e.target.style.borderColor = "#e0e0e0"} />
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-save" onClick={handleConfirm} disabled={saving}
            style={{ background: tipoActual.color, boxShadow: "none" }}>
            {saving ? "Registrando…" : `Registrar ${tipoActual.label.toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}