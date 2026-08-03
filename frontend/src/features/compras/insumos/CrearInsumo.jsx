import { useState } from "react";
import "./GestionInsumos.css";
import { soloLetras } from "../../../utils/inputFilters";

const STEPS = ["Identificación", "Stock"];

function StepsBar({ current }) {
  return (
    <div className="wizard-steps-bar">
      {STEPS.map((label, i) => {
        const idx    = i + 1;
        const done   = idx < current;
        const active = idx === current;
        return (
          <div key={label} className="wizard-step-item">
            <div className={`wizard-step-circle${done ? " done" : active ? " active" : ""}`}>
              {done ? "✓" : idx}
            </div>
            <span className={`wizard-step-label${active ? " active" : done ? " done" : ""}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`wizard-step-line${done ? " done" : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CrearInsumo({ onClose, onSave, categorias, unidades, existingInsumos = [] }) {
  const [form, setForm] = useState({
    nombre: "", idCategoria: "", idUnidad: "", stockMinimo: "",
  });
  const [errors, setSErrors] = useState({});
  const [saving, setSaving]  = useState(false);
  const [step, setStep]      = useState(1);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    let err = "";
    if (k === "stockMinimo" && v !== "" && (isNaN(v) || Number(v) < 0)) err = "Valor válido requerido";
    setSErrors(p => ({ ...p, [k]: err }));
  };

  const validateStep = (s) => {
    const e = {};
    if (s === 1) {
      const nom = form.nombre.trim().toLowerCase();
      if (!form.nombre.trim()) e.nombre = "El nombre es obligatorio";
      else if (existingInsumos.some(i => i.nombre.trim().toLowerCase() === nom))
        e.nombre = "Ya existe un insumo con este nombre";
      if (!form.idCategoria)   e.idCategoria = "Selecciona una categoría";
      if (!form.idUnidad)      e.idUnidad    = "Selecciona una unidad";
    }
    if (s === 2) {
      if (form.stockMinimo === "" || isNaN(form.stockMinimo) || Number(form.stockMinimo) < 0)
        e.stockMinimo = "Valor válido requerido";
    }
    return e;
  };

  const handleNext = () => {
    const e = validateStep(step);
    if (Object.keys(e).length) { setSErrors(e); return; }
    setStep(s => s + 1);
  };

  const handleSave = async () => {
    const e = validateStep(2);
    if (Object.keys(e).length) { setSErrors(e); return; }
    setSaving(true);
    try {
      await onSave({
        Nombre:       form.nombre.trim(),
        ID_Categoria: Number(form.idCategoria),
        Unidad_Medida: Number(form.idUnidad),
        Stock_Actual:  0,
        Stock_Minimo:  Number(form.stockMinimo),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Gestión de Insumos</p>
            <h2 className="modal-header__title">Nuevo insumo</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: "16px 24px 0" }}>
          <StepsBar current={step} />
        </div>

        <div className="modal-body" style={{ minHeight: 200 }}>

          {step === 1 && (
            <>
              <div className="form-group">
                <label className="form-label">Nombre <span className="required">*</span></label>
                <input
                  className={`field-input${errors.nombre ? " error" : ""}`}
                  value={form.nombre} onChange={e => set("nombre", soloLetras(e.target.value))}
                  placeholder="Ej. Plátano verde"
                />
                {errors.nombre && <p className="field-error">{errors.nombre}</p>}
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Categoría <span className="required">*</span></label>
                  <select
                    className={`field-input${errors.idCategoria ? " error" : ""}`}
                    value={form.idCategoria} onChange={e => set("idCategoria", e.target.value)}
                  >
                    <option value="">— Seleccionar —</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.icon} {c.nombre}</option>)}
                  </select>
                  {errors.idCategoria && <p className="field-error">{errors.idCategoria}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Unidad de medida <span className="required">*</span></label>
                  <select
                    className={`field-input${errors.idUnidad ? " error" : ""}`}
                    value={form.idUnidad} onChange={e => set("idUnidad", e.target.value)}
                  >
                    <option value="">— Seleccionar —</option>
                    {unidades.map(u => <option key={u.id} value={u.id}>{u.simbolo} — {u.nombre}</option>)}
                  </select>
                  {errors.idUnidad && <p className="field-error">{errors.idUnidad}</p>}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="form-group">
              <label className="form-label">Stock mínimo <span className="required">*</span></label>
              <input
                type="number" min="0"
                className={`field-input${errors.stockMinimo ? " error" : ""}`}
                value={form.stockMinimo} onChange={e => set("stockMinimo", e.target.value)}
                placeholder="0"
              />
              {errors.stockMinimo && <p className="field-error">{errors.stockMinimo}</p>}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step > 1
            ? <button className="btn-ghost" onClick={() => setStep(s => s - 1)}>← Atrás</button>
            : <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          }
          <div style={{ display: "flex", gap: 10 }}>
            {step < 2
              ? <button className="btn-save" onClick={handleNext}>Siguiente →</button>
              : <button className="btn-save" onClick={handleSave} disabled={saving}>
                  {saving ? "Guardando…" : "Guardar"}
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
