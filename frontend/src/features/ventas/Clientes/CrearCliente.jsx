import { useState, useRef, useEffect } from "react";
import { getUsuarios } from "../../../services/usuariosService.js";
import "./clientes.css";
import { soloLetras } from "../../../utils/inputFilters";
import CharCount from "../../../shared/components/CharCount";

const TIPOS_DOC = ["CC", "TI", "CE", "Pasaporte", "NIT", "PPT"];
const fmtTel = raw => {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)} ${d.slice(3)}`;
  return `${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}`;
};
const toInputDate   = v => v && v.includes("/") ? v.split("/").reverse().join("-") : (v || "");
const fromInputDate = v => { if (!v) return ""; const [y,m,d] = v.split("-"); return `${d}/${m}/${y}`; };

/* ── API Colombia ─────────────────────────────────────────── */
function LocationSelects({ departamento, municipio, onDepto, onMunicipio, errDepto, errMunicipio }) {
  const [deptos,     setDeptos]     = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [loadingD,   setLoadingD]   = useState(false);
  const [loadingM,   setLoadingM]   = useState(false);

  useEffect(() => {
    setLoadingD(true);
    fetch("https://api-colombia.com/api/v1/Department")
      .then(r => r.json())
      .then(data => setDeptos(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {})
      .finally(() => setLoadingD(false));
  }, []);

  useEffect(() => {
    if (!departamento) { setMunicipios([]); onMunicipio(""); return; }
    const found = deptos.find(d => d.name === departamento);
    if (!found) return;
    setLoadingM(true);
    onMunicipio("");
    fetch(`https://api-colombia.com/api/v1/Department/${found.id}/cities`)
      .then(r => r.json())
      .then(data => setMunicipios(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {})
      .finally(() => setLoadingM(false));
  }, [departamento, deptos]);

  return (
    <div className="form-grid-2">
      <div className="form-group">
        <label className="form-label">Departamento <span className="required">*</span></label>
        <select className={"field-input" + (errDepto ? " field-input--error" : "")}
          value={departamento || ""} onChange={e => onDepto(e.target.value)}
          disabled={loadingD} style={{ cursor: "pointer" }}>
          <option value="">{loadingD ? "Cargando…" : "— Seleccionar —"}</option>
          {deptos.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        {errDepto && <p className="field-error">{errDepto}</p>}
      </div>
      <div className="form-group">
        <label className="form-label">Municipio <span className="required">*</span></label>
        <select className={"field-input" + (errMunicipio ? " field-input--error" : "")}
          value={municipio || ""} onChange={e => onMunicipio(e.target.value)}
          disabled={!departamento || loadingM} style={{ cursor: "pointer" }}>
          <option value="">{!departamento ? "Seleccione depto…" : loadingM ? "Cargando…" : "— Seleccionar —"}</option>
          {municipios.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
        </select>
        {errMunicipio && <p className="field-error">{errMunicipio}</p>}
      </div>
    </div>
  );
}

/* ── Barra de pasos ───────────────────────────────────────── */
const STEPS = ["Identificación", "Personal & Ubicación", "Contraseña"];

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

/* ── CrearCliente ─────────────────────────────────────────── */
export default function CrearCliente({ onClose, onSave }) {
  const [existing, setExisting] = useState([]);
  useEffect(() => {
    getUsuarios({ porPagina: 100 }).then(list => setExisting(list)).catch(() => {});
  }, []);
  const [form, setForm] = useState({
    tipoDoc: "CC", numDoc: "", nombre: "", apellidos: "",
    correo: "", telefono: "", direccion: "", departamento: "",
    municipio: "", contrasena: "", confirmar: "",
    estado: true, fotoPreview: null, fechaCreacion: "",
  });
  const [errors, setErrors]     = useState({});
  const [saving, setSaving]     = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [step, setStep]         = useState(1);
  const fotoRef = useRef();

  const set = (k, v) => {
    let val = v;
    if (k === 'numDoc') val = v.replace(/\D/g, '');
    if ((k === 'nombre' || k === 'apellidos') && typeof v === 'string') val = soloLetras(v);
    const newForm = { ...form, [k]: val };
    setForm(newForm);
    let err = "";
    if (val) {
      if (k === 'correo' && val.includes('@') && !/\S+@\S+\.\S+/.test(val)) err = "Formato de correo inválido";
      if (k === 'contrasena' && val.length < 8) err = "Mínimo 8 caracteres";
      if (k === 'contrasena' && val.length >= 8 && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(val)) err = "Debe incluir mayúsculas, minúsculas y números";
      if (k === 'confirmar' && newForm.contrasena && val !== newForm.contrasena) err = "Las contraseñas no coinciden";
    }
    setErrors(p => {
      const n = { ...p, [k]: err };
      if (k === 'contrasena' && newForm.confirmar) {
        n.confirmar = val !== newForm.confirmar ? "Las contraseñas no coinciden" : "";
      }
      return n;
    });
  };

  const handleFoto = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set("fotoPreview", ev.target.result);
    reader.readAsDataURL(file);
  };

  const validateStep = (s) => {
    const e = {};
    const users = existing || [];

    if (s === 1) {
      if (!form.tipoDoc)       e.tipoDoc = "Requerido";
      if (!form.numDoc.trim()) e.numDoc  = "El número de documento es obligatorio";
      else if (users.some(u => u.cedula === form.numDoc)) e.numDoc = "Este documento ya está registrado";
    }
    if (s === 2) {
      if (!form.nombre.trim())    e.nombre    = "El nombre es obligatorio";
      if (!form.apellidos.trim()) e.apellidos = "Los apellidos son obligatorios";
      
      if (!form.correo.trim())    e.correo = "El correo es obligatorio";
      else if (!/\S+@\S+\.\S+/.test(form.correo)) e.correo = "Formato de correo inválido";
      else if (users.some(u => u.correo.toLowerCase() === form.correo.toLowerCase())) e.correo = "Este correo ya está en uso";

      if (!form.telefono.trim())  e.telefono  = "El teléfono es obligatorio";
      else if (form.telefono.replace(/\D/g, "").length !== 10) e.telefono = "El teléfono debe tener 10 dígitos";
      if (!form.fechaCreacion)    e.fechaCreacion = "La fecha de registro es obligatoria";
      if (!form.departamento)     e.departamento  = "Selecciona un departamento";
      if (!form.municipio)        e.municipio     = "Selecciona un municipio";
    }
    if (s === 3) {
      if (!form.contrasena) e.contrasena = "La contraseña es obligatoria";
      else if (form.contrasena.length < 8) e.contrasena = "Mínimo 8 caracteres";
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.contrasena)) 
        e.contrasena = "Debe incluir mayúsculas, minúsculas y números";

      if (form.contrasena !== form.confirmar) e.confirmar  = "Las contraseñas no coinciden";
    }
    return e;
  };

  const handleNext = () => {
    const e = validateStep(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setStep(s => s + 1);
  };

  const handleBack = () => setStep(s => s - 1);

  const handleSave = async () => {
    const e = validateStep(3);
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    const { confirmar, ...data } = form;
    onSave({ ...data, id: Date.now(), fechaCreacion: form.fechaCreacion || new Date().toLocaleDateString("es-CO") });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Clientes</p>
            <h2 className="modal-header__title">Nuevo Cliente</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: "16px 24px 0" }}>
          <StepsBar current={step} />
        </div>

        <div className="modal-body" style={{ minHeight: 280 }}>

          {/* ── Paso 1: Identificación ── */}
          {step === 1 && (
            <>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div className="avatar-upload-wrap" onClick={() => fotoRef.current.click()}>
                  {form.fotoPreview
                    ? <img className="avatar-upload-img" src={form.fotoPreview} alt="avatar" />
                    : <div className="avatar-upload-placeholder">👤</div>}
                  <div className="avatar-upload-overlay">📷</div>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: "#9e9e9e" }}>Foto de perfil (opcional)</p>
                <input ref={fotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFoto} />
              </div>

              <p className="section-label" style={{ marginTop: 0,  textTransform: "none"}}>Identificación</p>
              <div className="form-group">
                <label className="form-label">Tipo y Número de documento <span className="required">*</span></label>
                <div className="doc-combo">
                  <select className={"field-input doc-sel" + (errors.tipoDoc ? " field-input--error" : "")}
                    value={form.tipoDoc} onChange={e => set("tipoDoc", e.target.value)} style={{ cursor: "pointer" }}>
                    {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className={"field-input doc-input" + (errors.numDoc ? " field-input--error" : "")}
                    type="text" value={form.numDoc} onChange={e => set("numDoc", e.target.value)}
                    placeholder="Número de documento"
                    onFocus={e => e.target.style.borderColor = "#4caf50"}
                    onBlur={e  => e.target.style.borderColor = errors.numDoc ? "#e53935" : "#e0e0e0"} />
                </div>
                {(errors.tipoDoc || errors.numDoc) && <p className="field-error">{errors.tipoDoc || errors.numDoc}</p>}
              </div>
            </>
          )}

          {/* ── Paso 2: Personal & Ubicación ── */}
          {step === 2 && (
            <>
              <p className="section-label" style={{ marginTop: 0 }}>Datos personales</p>
              <div className="form-grid-2">
                {[
                  { k: "nombre",    label: "Nombre",    ph: "Ej. Ana",          max: 50 },
                  { k: "apellidos", label: "Apellidos", ph: "Ej. García López", max: 50 },
                ].map(({ k, label, ph, max }) => (
                  <div key={k} className="form-group">
                    <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{label} <span className="required">*</span></span>
                      <CharCount value={form[k] || ""} max={max} min={2} />
                    </label>
                    <input className={"field-input" + (errors[k] ? " field-input--error" : "")}
                      type="text" value={form[k] || ""} maxLength={max}
                      onChange={e => set(k, e.target.value)} placeholder={ph}
                      onFocus={e => e.target.style.borderColor = "#4caf50"}
                      onBlur={e  => e.target.style.borderColor = errors[k] ? "#e53935" : "#e0e0e0"} />
                    {errors[k] && <p className="field-error">{errors[k]}</p>}
                  </div>
                ))}

                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Correo electrónico <span className="required">*</span></label>
                  <input className={"field-input" + (errors.correo ? " field-input--error" : "")}
                    type="email" value={form.correo || ""} onChange={e => set("correo", e.target.value)}
                    placeholder="correo@ejemplo.com"
                    onFocus={e => e.target.style.borderColor = "#4caf50"}
                    onBlur={e  => e.target.style.borderColor = errors.correo ? "#e53935" : "#e0e0e0"} />
                  {errors.correo && <p className="field-error">{errors.correo}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label">Teléfono <span className="required">*</span></label>
                  <input className={"field-input" + (errors.telefono ? " field-input--error" : "")}
                    type="tel" value={form.telefono || ""} maxLength={12}
                    onChange={e => set("telefono", fmtTel(e.target.value))} placeholder="300 000 0000"
                    onFocus={e => e.target.style.borderColor = "#4caf50"}
                    onBlur={e  => e.target.style.borderColor = errors.telefono ? "#e53935" : "#e0e0e0"} />
                  {errors.telefono && <p className="field-error">{errors.telefono}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label">Fecha de registro <span className="required">*</span></label>
                  <input className={"field-input" + (errors.fechaCreacion ? " field-input--error" : "")}
                    type="date" value={toInputDate(form.fechaCreacion)}
                    onChange={e => set("fechaCreacion", fromInputDate(e.target.value))}
                    onFocus={e => e.target.style.borderColor = "#4caf50"}
                    onBlur={e  => e.target.style.borderColor = errors.fechaCreacion ? "#e53935" : "#e0e0e0"} />
                  {errors.fechaCreacion && <p className="field-error">{errors.fechaCreacion}</p>}
                </div>

                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Dirección</span>
                    <CharCount value={form.direccion || ""} max={200} min={5} />
                  </label>
                  <input className="field-input" type="text" value={form.direccion || ""}
                    maxLength={200}
                    onChange={e => set("direccion", e.target.value)} placeholder="Ej. Cra 5 #12-34, Apto 201"
                    onFocus={e => e.target.style.borderColor = "#4caf50"}
                    onBlur={e  => e.target.style.borderColor = "#e0e0e0"} />
                </div>
              </div>

              <LocationSelects
                departamento={form.departamento} municipio={form.municipio}
                onDepto={v  => { set("departamento", v); set("municipio", ""); }}
                onMunicipio={v => set("municipio", v)}
                errDepto={errors.departamento} errMunicipio={errors.municipio}
              />
            </>
          )}

          {/* ── Paso 3: Contraseña ── */}
          {step === 3 && (
            <>
              <p className="section-label" style={{ marginTop: 0 }}>Contraseña</p>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Contraseña <span className="required">*</span></label>
                  <div className="pass-wrap">
                    <input className={"field-input" + (errors.contrasena ? " field-input--error" : "")}
                      type={showPass ? "text" : "password"} style={{ paddingRight: 36 }}
                      value={form.contrasena || ""} onChange={e => set("contrasena", e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      onFocus={e => e.target.style.borderColor = "#4caf50"}
                      onBlur={e  => e.target.style.borderColor = errors.contrasena ? "#e53935" : "#e0e0e0"} />
                    <button className="pass-toggle-btn" onClick={() => setShowPass(v => !v)}>{showPass ? "🙈" : "👁"}</button>
                  </div>
                  {errors.contrasena && <p className="field-error">{errors.contrasena}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Confirmar contraseña <span className="required">*</span></label>
                  <div className="pass-wrap">
                    <input className={"field-input" + (errors.confirmar ? " field-input--error" : "")}
                      type={showPass ? "text" : "password"} style={{ paddingRight: 36 }}
                      value={form.confirmar || ""} onChange={e => set("confirmar", e.target.value)}
                      placeholder="Repetir contraseña"
                      onFocus={e => e.target.style.borderColor = "#4caf50"}
                      onBlur={e  => e.target.style.borderColor = errors.confirmar ? "#e53935" : "#e0e0e0"} />
                    <button className="pass-toggle-btn" onClick={() => setShowPass(v => !v)}>{showPass ? "🙈" : "👁"}</button>
                  </div>
                  {errors.confirmar && <p className="field-error">{errors.confirmar}</p>}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          {step > 1
            ? <button className="btn-ghost" onClick={handleBack}>← Atrás</button>
            : <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          }
          {step < 3
            ? <button className="btn-save" onClick={handleNext}>Siguiente →</button>
            : <button className="btn-save" onClick={handleSave} disabled={saving}>
                {saving && <span className="spinner">◌</span>}
                {saving ? "Guardando…" : "Crear cliente"}
              </button>
          }
        </div>
      </div>
    </div>
  );
}