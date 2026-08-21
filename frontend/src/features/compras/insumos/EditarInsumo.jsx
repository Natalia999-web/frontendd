import { useState } from "react";
import SearchableSelect from "../../../shared/components/SearchableSelect.jsx";
import "./GestionInsumos.css";
import { soloLetras, esRepetitivo } from "../../../utils/inputFilters";

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

export default function EditarInsumo({ ins, onClose, onSave, categorias, unidades, existingInsumos = [] }) {
  const [form, setForm] = useState({
    nombre:       ins.nombre,
    idCategoria:  ins.idCategoria,
    idUnidad:     ins.idUnidad,
    stockMinimo:  ins.stockMinimo,
  });
  const [errors, setSErrors]  = useState({});
  const [saving, setSaving]   = useState(false);
  const [step, setStep]       = useState(1);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    let err = "";
    if (k === "nombre") {
      const t = v.trim();
      if (!t)                                  err = "Campo requerido";
      else if (t.length < 2)                   err = "Mínimo 2 caracteres";
      else if (t.length > 50)                  err = "Máximo 50 caracteres";
      else if (esRepetitivo(v))                err = "El nombre no puede ser texto repetitivo";
      else if (existingInsumos.some(i => i.nombre.trim().toLowerCase() === t.toLowerCase() && i.id !== ins?.id))
        err = "Ya existe un insumo con este nombre";
    }
    if (k === "idCategoria" && !v)             err = "Selecciona una categoría";
    if (k === "idUnidad" && !v)                err = "Selecciona una unidad";
    if (k === "stockMinimo") {
      if (v === "" || v === null)              err = "Campo requerido";
      else if (isNaN(v) || Number(v) < 0)      err = "Campo requerido";
    }
    setSErrors(p => ({ ...p, [k]: err }));
  };

  const validateStep = (s) => {
    const e = {};
    if (s === 1) {
      const nom = form.nombre.trim().toLowerCase();
      if (!form.nombre.trim())                e.nombre = "Campo requerido";
      else if (form.nombre.trim().length < 2)  e.nombre = "Mínimo 2 caracteres";
      else if (form.nombre.trim().length > 50) e.nombre = "Máximo 50 caracteres";
      else if (esRepetitivo(form.nombre))      e.nombre = "El nombre no puede ser texto repetitivo";
      else if (existingInsumos.some(i => i.nombre.trim().toLowerCase() === nom && i.id !== ins?.id))
        e.nombre = "Ya existe un insumo con este nombre";
      if (!form.idCategoria)   e.idCategoria = "Selecciona una categoría";
      if (!form.idUnidad)      e.idUnidad    = "Selecciona una unidad";
    }
    if (s === 2) {
      if (form.stockMinimo === "" || form.stockMinimo === null) e.stockMinimo = "Campo requerido";
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
        Nombre:        form.nombre.trim(),
        ID_Categoria:  Number(form.idCategoria),
        Unidad_Medida: Number(form.idUnidad),
        Stock_Minimo:  Number(form.stockMinimo),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Gestión de Insumos</p>
            <h2 className="modal-header__title">Editar insumo</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: "16px 24px 0" }}>
          <StepsBar current={step} />
        </div>

        <div className="modal-body" style={{ overflow: "visible" }}>

          {step === 1 && (
            <>
              <div className="form-group">
                <label className="form-label">Nombre <span className="required">*</span></label>
                <input
                  className={`field-input${errors.nombre ? " field-input--error" : ""}`}
                  value={form.nombre} onChange={e => set("nombre", soloLetras(e.target.value))}
                  placeholder="Ej. Plátano verde"
                  onFocus={e => (e.target.style.borderColor = "#4caf50")}
                  onBlur={e  => (e.target.style.borderColor = errors.nombre ? "#e53935" : "#e0e0e0")}
                />
                {errors.nombre && <p className="field-error">{errors.nombre}</p>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Categoría <span className="required">*</span></label>
                  <SearchableSelect
                    options={categorias}
                    value={form.idCategoria}
                    onChange={e => set("idCategoria", e.target.value)}
                    getValue={c => c.id}
                    getLabel={c => `${c.icon || ""} ${c.nombre}`}
                    placeholder="— Seleccionar —"
                    searchPlaceholder="🔍 Buscar categoría…"
                    className={`field-input${errors.idCategoria ? " field-input--error" : ""}`}
                  />
                  {errors.idCategoria && <p className="field-error">{errors.idCategoria}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Unidad de medida <span className="required">*</span></label>
                  <select
                    className={`field-input${errors.idUnidad ? " field-input--error" : ""}`}
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
                className={`field-input${errors.stockMinimo ? " field-input--error" : ""}`}
                value={form.stockMinimo} onChange={e => set("stockMinimo", e.target.value)}
                onFocus={e => (e.target.style.borderColor = "#4caf50")}
                onBlur={e  => (e.target.style.borderColor = errors.stockMinimo ? "#e53935" : "#e0e0e0")}
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
          {step < 2
            ? <button className="btn-save" onClick={handleNext}>Siguiente →</button>
            : <button className="btn-save" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
          }
        </div>
      </div>
    </div>
  );
}
