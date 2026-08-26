import { useState } from "react";
import { X, Check } from "lucide-react";
import { esUbicacionValida } from "../../../utils/inputFilters";
import "./Proveedores.css";

const fmtTel = raw => {
  if (!raw || typeof raw !== "string") return "";
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
};

const STEPS = ["Identificación", "Contacto y Ubicación"];

function StepsBar({ current }) {
  return (
    <div className="wizard-steps-bar" style={{ padding: "0 24px" }}>
      {STEPS.map((label, i) => {
        const idx    = i + 1;
        const done   = idx < current;
        const active = idx === current;
        return (
          <div key={label} className="wizard-step-item" style={{ flex: 1 }}>
            <div className={`wizard-step-circle${done ? " done" : active ? " active" : ""}`}>
              {done ? <Check size={13} /> : idx}
            </div>
            <span className={`wizard-step-label${active ? " active" : done ? " done" : ""}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`wizard-step-line${done ? " done" : ""}`} style={{ flex: 1 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const DEPARTAMENTOS_CO = [
  "Amazonas","Antioquia","Arauca","Atlántico","Bogotá D.C.","Bolívar","Boyacá",
  "Caldas","Caquetá","Casanare","Cauca","Cesar","Chocó","Córdoba","Cundinamarca",
  "Guainía","Guaviare","Huila","La Guajira","Magdalena","Meta","Nariño",
  "Norte de Santander","Putumayo","Quindío","Risaralda","San Andrés y Providencia",
  "Santander","Sucre","Tolima","Valle del Cauca","Vaupés","Vichada",
];

const ARROW_SVG = (
  <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
  </div>
);

function LocationSelects({ departamento, ciudad, onDepto, onCiudad, errDepto, errCiudad }) {
  const selStyle = { appearance: "none", paddingRight: 32 };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div className="form-group">
        <label className="form-label">Departamento <span className="required">*</span></label>
        <div style={{ position: "relative" }}>
          <select
            className={`field-input${errDepto ? " error" : ""}`}
            style={selStyle}
            value={departamento || ""}
            onChange={e => onDepto(e.target.value)}
          >
            <option value="">— Seleccionar —</option>
            {DEPARTAMENTOS_CO.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {ARROW_SVG}
        </div>
        {errDepto && <span className="field-error">{errDepto}</span>}
      </div>

      <div className="form-group">
        <label className="form-label">Ciudad / Municipio <span className="required">*</span></label>
        <input
          className={`field-input${errCiudad ? " error" : ""}`}
          type="text"
          value={ciudad || ""}
          onChange={e => onCiudad(e.target.value)}
          placeholder="Ej: Medellín, Bogotá…"
        />
        {errCiudad && <span className="field-error">{errCiudad}</span>}
      </div>
    </div>
  );
}

function FieldText({ label, value, onChange, error, type = "text", placeholder = "", required }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required && <span className="required"> *</span>}</label>
      <input
        className={`field-input${error ? " error" : ""}`}
        type={type}
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export default function CrearProveedor({ onClose, onSave }) {
  const [form, setForm] = useState({
    tipo:         "natural",
    responsable:  "",
    celular:      "",
    correo:       "",
    direccion:    "",
    departamento: "",
    ciudad:       "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [step,   setStep]   = useState(1);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    let err = "";
    if (k === "responsable" && !v.trim()) err = "El nombre/razón social es obligatorio";
    if (k === "celular") {
      if (!v.trim()) err = "El celular es obligatorio";
      else if (v.replace(/\D/g, "").length !== 10) err = "El celular debe tener 10 dígitos";
    }
    if (k === "correo") {
      if (!v.trim()) err = "El correo es obligatorio";
      else if (!/\S+@\S+\.\S+/.test(v)) err = "Formato de correo inválido";
    }
    if (k === "departamento" && !v) err = "Selecciona un departamento";
    if (k === "ciudad" && !v) err = "Selecciona una ciudad";
    if (k === "direccion" && v.trim() && !esUbicacionValida(v))
      err = "La dirección debe tener letras y números (mín. 5 caracteres)";
    setErrors(e => ({ ...e, [k]: err }));
  };

  const labelResponsable = form.tipo === "juridica" ? "Razón Social" : "Nombre del responsable";

  const validateStep = (s) => {
    const e = {};
    if (s === 1) {
      if (!form.responsable.trim()) e.responsable = "El nombre/razón social es obligatorio";
    }
    if (s === 2) {
      if (!form.celular.trim())  e.celular  = "El celular es obligatorio";
      else if (form.celular.replace(/\D/g, "").length !== 10) e.celular = "El celular debe tener 10 dígitos";
      if (!form.correo.trim())   e.correo   = "El correo es obligatorio";
      else if (!/\S+@\S+\.\S+/.test(form.correo)) e.correo = "Formato de correo inválido";
      if (!form.departamento)    e.departamento = "Selecciona un departamento";
      if (!form.ciudad)          e.ciudad       = "Selecciona una ciudad";
      if (form.direccion?.trim() && !esUbicacionValida(form.direccion))
        e.direccion = "La dirección debe tener letras y números (mín. 5 caracteres)";
    }
    return e;
  };

  const handleNext = () => {
    const e = validateStep(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setStep(s => s + 1);
  };

  const handleSave = async () => {
    const e = { ...validateStep(1), ...validateStep(2) };
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await onSave({
        Sujeto_Derecho: form.tipo === "juridica" ? 2 : 1,
        Responsable:    form.responsable.trim(),
        Direccion:      form.direccion    || undefined,
        Municipio:      form.ciudad       || undefined,
        Departamento:   form.departamento || undefined,
        Telefono:       form.celular      || undefined,
        Correo:         form.correo       || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Proveedores</p>
            <h2 className="modal-header__title">Nuevo Proveedor</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ padding: "16px 24px 0" }}>
          <StepsBar current={step} />
        </div>

        <div className="modal-body" style={{ minHeight: 220 }}>

          {step === 1 && (
            <>
              <p className="section-label" style={{ marginTop: 0 }}>Datos de identificación</p>

              <div className="form-group">
                <label className="form-label">Tipo de persona <span className="required">*</span></label>
                <div style={{ position: "relative" }}>
                  <select
                    className="field-input"
                    style={{ appearance: "none", paddingRight: 32 }}
                    value={form.tipo}
                    onChange={e => set("tipo", e.target.value)}
                  >
                    <option value="natural">Persona Natural</option>
                    <option value="juridica">Persona Jurídica</option>
                  </select>
                  <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                  </div>
                </div>
              </div>

              <FieldText
                label={labelResponsable}
                value={form.responsable}
                onChange={v => set("responsable", v)}
                error={errors.responsable}
                placeholder={form.tipo === "juridica" ? "Ej: Distribuidora XYZ S.A.S." : "Ej: Juan García"}
                required
              />
            </>
          )}

          {step === 2 && (
            <>
              <p className="section-label" style={{ marginTop: 0 }}>Contacto</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FieldText
                  label="Celular"
                  value={form.celular}
                  onChange={v => set("celular", fmtTel(v))}
                  error={errors.celular}
                  placeholder="300 000 0000"
                  required
                />
                <FieldText
                  label="Correo electrónico"
                  value={form.correo}
                  onChange={v => set("correo", v)}
                  error={errors.correo}
                  type="email"
                  placeholder="correo@empresa.com"
                  required
                />
              </div>

              <p className="section-label">Ubicación</p>
              <FieldText
                label="Dirección (opcional)"
                value={form.direccion}
                onChange={v => set("direccion", v)}
                placeholder="Ej: Cra 5 #12-34"
              />
              <LocationSelects
                departamento={form.departamento}
                ciudad={form.ciudad}
                onDepto={v => set("departamento", v)}
                onCiudad={v => set("ciudad", v)}
                errDepto={errors.departamento}
                errCiudad={errors.ciudad}
              />
            </>
          )}
        </div>

        <div className="modal-footer">
          {step > 1
            ? <button className="btn-ghost" onClick={() => setStep(1)}>← Atrás</button>
            : <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          }
          <div style={{ display: "flex", gap: 10 }}>
            {step < 2
              ? <button className="btn-save" onClick={handleNext}>Siguiente →</button>
              : <button className="btn-save" onClick={handleSave} disabled={saving}>
                  {saving ? "Guardando…" : "Crear proveedor"}
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
