import { useState, useRef, useEffect } from "react";
import { TIPOS_DOC, ROLES_EMPLEADO, uid, fmtTel, toInputDate, fromInputDate } from "./empleadosUtils.js";
import { soloLetras, soloDigitos } from "../../../utils/inputFilters";
import { getUsuarios } from "../../../services/usuariosService.js";
import "./Empleados.css";

/* ─── RolBadge ───────────────────────────────────────────── */
export function RolBadge({ idRol }) {
  const rol = ROLES_EMPLEADO.find(r => r.id === Number(idRol));
  if (!rol) return null;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:20, fontSize:12, fontWeight:700, background:rol.bg, color:rol.color, border:`1px solid ${rol.border}`, whiteSpace:"nowrap" }}>
      <span style={{ fontSize:13 }}>{rol.icon}</span>{rol.nombre}
    </span>
  );
}

/* ─── API Colombia ───────────────────────────────────────── */
export function LocationSelects({ departamento, municipio, onDepto, onMunicipio, errDepto, errMunicipio, isView }) {
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

  if (isView) return (
    <div className="form-grid-2">
      <div className="form-group"><label className="form-label">Departamento</label><div className="field-input field-input--disabled">{departamento || "—"}</div></div>
      <div className="form-group"><label className="form-label">Municipio</label><div className="field-input field-input--disabled">{municipio || "—"}</div></div>
    </div>
  );

  return (
    <div className="form-grid-2">
      <div className="form-group">
        <label className="form-label">Departamento <span className="required">*</span></label>
        <select className={"field-input" + (errDepto ? " field-input--error" : "")}
          value={departamento || ""} onChange={e => onDepto(e.target.value)}
          disabled={loadingD} style={{ cursor:"pointer" }}>
          <option value="">{loadingD ? "Cargando…" : "— Seleccionar —"}</option>
          {deptos.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        {errDepto && <p className="field-error">{errDepto}</p>}
      </div>
      <div className="form-group">
        <label className="form-label">Municipio <span className="required">*</span></label>
        <select className={"field-input" + (errMunicipio ? " field-input--error" : "")}
          value={municipio || ""} onChange={e => onMunicipio(e.target.value)}
          disabled={!departamento || loadingM} style={{ cursor:"pointer" }}>
          <option value="">{!departamento ? "Seleccione depto…" : loadingM ? "Cargando…" : "— Seleccionar —"}</option>
          {municipios.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
        </select>
        {errMunicipio && <p className="field-error">{errMunicipio}</p>}
      </div>
    </div>
  );
}

/* ─── Field helper ───────────────────────────────────────── */
function Field({ k, label, type = "text", ph = "", full = false, required = true, form, errors, onChange }) {
  return (
    <div className="form-group" style={full ? { gridColumn:"1 / -1" } : {}}>
      <label className="form-label">{label}{required && <span className="required"> *</span>}</label>
      <input className={"field-input" + (errors[k] ? " field-input--error" : "")}
        type={type} value={form[k] || ""} onChange={e => onChange(k, e.target.value)} placeholder={ph}
        onFocus={e => e.target.style.borderColor = "#4caf50"}
        onBlur={e => e.target.style.borderColor = errors[k] ? "#e53935" : "#e0e0e0"} />
      {errors[k] && <p className="field-error">{errors[k]}</p>}
    </div>
  );
}

/* ─── Barra de pasos ─────────────────────────────────────── */
const STEPS = ["Identificación", "Personal", "Ubicación", "Contraseña"];

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

/* ─── CrearEmpleado ──────────────────────────────────────── */
export default function CrearEmpleado({ onClose, onSave }) {
  const [existing, setExisting] = useState([]);
  useEffect(() => {
    getUsuarios({ porPagina: 100 }).then(list => setExisting(list)).catch(() => {});
  }, []);
  const empty = {
    tipoDoc:"CC", numDoc:"", nombre:"", apellidos:"", correo:"",
    telefono:"", direccion:"", departamento:"", municipio:"",
    contrasena:"", confirmar:"", idRol:"", estado:true,
    fotoPreview:null, fechaIngreso:"",
  };

  const [form, setForm]         = useState(empty);
  const [errors, setErrors]     = useState({});
  const [saving, setSaving]     = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [step, setStep]         = useState(1);
  const fotoRef = useRef();

  const set = (k, v) => {
    let val = v;
    if ((k === "nombre" || k === "apellidos") && typeof v === "string") val = soloLetras(v);
    if (k === "numDoc" && typeof v === "string") val = soloDigitos(v);
    const newForm = { ...form, [k]: val };
    setForm(newForm);
    let err = "";
    if (val) {
      if (k === "correo" && val.includes("@") && !/\S+@\S+\.\S+/.test(val)) err = "Formato de correo inválido";
      if (k === "contrasena" && val.length < 8) err = "Mínimo 8 caracteres";
      if (k === "contrasena" && val.length >= 8 && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(val)) err = "Debe incluir mayúsculas, minúsculas y números";
      if (k === "confirmar" && newForm.contrasena && val !== newForm.contrasena) err = "Las contraseñas no coinciden";
    }
    setErrors(p => {
      const n = { ...p, [k]: err };
      if (k === "contrasena" && newForm.confirmar) {
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

  // Validación por paso
  const validateStep = (s) => {
    const e = {};
    const users = existing || [];

    if (s === 1) {
      if (!form.tipoDoc)       e.tipoDoc = "Requerido";
      if (!form.numDoc.trim()) e.numDoc  = "El número de documento es obligatorio";
      else if (users.some(u => u.cedula === form.numDoc)) e.numDoc = "Este documento ya está registrado";
      
      if (!form.idRol)         e.idRol   = "Selecciona un rol";
    }
    if (s === 2) {
      if (!form.nombre.trim())    e.nombre       = "El nombre es obligatorio";
      if (!form.apellidos.trim()) e.apellidos    = "Los apellidos son obligatorios";
      
      if (!form.correo.trim())    e.correo = "El correo es obligatorio";
      else if (!/\S+@\S+\.\S+/.test(form.correo)) e.correo = "Formato de correo inválido";
      else if (users.some(u => u.correo.toLowerCase() === form.correo.toLowerCase())) e.correo = "Este correo ya está en uso";

      if (!form.telefono.trim())  e.telefono     = "El teléfono es obligatorio";
      if (!form.fechaIngreso)     e.fechaIngreso = "La fecha de ingreso es obligatoria";
    }
    if (s === 3) {
      if (!form.departamento) e.departamento = "Selecciona un departamento";
      if (!form.municipio)    e.municipio    = "Selecciona un municipio";
    }
    if (s === 4) {
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
    const e = validateStep(4);
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    const { confirmar: _, ...data } = form;
    onSave({ ...data, id: uid(), fechaIngreso: form.fechaIngreso });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--wide" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Empleados</p>
            <h2 className="modal-header__title">Nuevo Empleado</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Steps */}
        <div style={{ padding:"16px 24px 0" }}>
          <StepsBar current={step} />
        </div>

        {/* Body — sin overflow */}
        <div className="modal-body" style={{ overflow:"visible" }}>

          {/* ── Paso 1: Identificación & Rol ── */}
          {step === 1 && (
            <>
              {/* Avatar */}
              <div style={{ textAlign:"center", marginBottom:16 }}>
                <div className="avatar-upload-wrap" onClick={() => fotoRef.current.click()}>
                  {form.fotoPreview
                    ? <img className="avatar-upload-img" src={form.fotoPreview} alt="avatar" />
                    : <div className="avatar-upload-placeholder">👤</div>}
                  <div className="avatar-upload-overlay">📷</div>
                </div>
                <p style={{ margin:0, fontSize:11, color:"#9e9e9e" }}>Foto de perfil (opcional)</p>
                <input ref={fotoRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFoto} />
              </div>

              <p className="section-label" style={{ marginTop:0 }}>Identificación</p>
              <div className="form-group">
                <label className="form-label">Tipo y Número de documento <span className="required">*</span></label>
                <div className="doc-combo">
                  <select className={"field-input doc-sel" + (errors.tipoDoc ? " field-input--error" : "")}
                    value={form.tipoDoc} onChange={e => set("tipoDoc", e.target.value)} style={{ cursor:"pointer" }}>
                    {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className={"field-input doc-input" + (errors.numDoc ? " field-input--error" : "")}
                    type="text" value={form.numDoc} onChange={e => set("numDoc", e.target.value)}
                    placeholder="Número de documento"
                    onFocus={e => e.target.style.borderColor = "#4caf50"}
                    onBlur={e => e.target.style.borderColor = errors.numDoc ? "#e53935" : "#e0e0e0"} />
                </div>
                {(errors.tipoDoc || errors.numDoc) && <p className="field-error">{errors.tipoDoc || errors.numDoc}</p>}
              </div>

              <p className="section-label">Rol</p>
              <div className="form-group">
                <label className="form-label">Rol del empleado <span className="required">*</span></label>
                <select className={"field-input" + (errors.idRol ? " field-input--error" : "")}
                  value={form.idRol || ""} onChange={e => set("idRol", Number(e.target.value))} style={{ cursor:"pointer" }}>
                  <option value="">— Seleccionar rol —</option>
                  {ROLES_EMPLEADO.map(r => <option key={r.id} value={r.id}>{r.icon} {r.nombre}</option>)}
                </select>
                {errors.idRol && <p className="field-error">{errors.idRol}</p>}
              </div>
            </>
          )}

          {/* ── Paso 2: Datos personales ── */}
          {step === 2 && (
            <>
              <p className="section-label" style={{ marginTop:0 }}>Datos personales</p>
              <div className="form-grid-2">
                <Field form={form} errors={errors} onChange={set} k="nombre"    label="Nombre"    ph="Ej. Laura" />
                <Field form={form} errors={errors} onChange={set} k="apellidos" label="Apellidos" ph="Ej. Sánchez Ríos" />
                <Field form={form} errors={errors} onChange={set} k="correo" label="Correo electrónico" type="email" ph="correo@empresa.com" full />

                <div className="form-group">
                  <label className="form-label">Teléfono <span className="required">*</span></label>
                  <input className={"field-input" + (errors.telefono ? " field-input--error" : "")}
                    type="tel" value={form.telefono} maxLength={12}
                    onChange={e => set("telefono", fmtTel(e.target.value))} placeholder="300 000 0000"
                    onFocus={e => e.target.style.borderColor = "#4caf50"}
                    onBlur={e => e.target.style.borderColor = errors.telefono ? "#e53935" : "#e0e0e0"} />
                  {errors.telefono && <p className="field-error">{errors.telefono}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label">Fecha de ingreso <span className="required">*</span></label>
                  <input className={"field-input" + (errors.fechaIngreso ? " field-input--error" : "")}
                    type="date" value={toInputDate(form.fechaIngreso)}
                    onChange={e => set("fechaIngreso", fromInputDate(e.target.value))}
                    onFocus={e => e.target.style.borderColor = "#4caf50"}
                    onBlur={e => e.target.style.borderColor = errors.fechaIngreso ? "#e53935" : "#e0e0e0"} />
                  {errors.fechaIngreso && <p className="field-error">{errors.fechaIngreso}</p>}
                </div>

                <div className="form-group" style={{ gridColumn:"1 / -1" }}>
                  <label className="form-label">Estado</label>
                  <div style={{ display:"flex", alignItems:"center", gap:10, paddingTop:4 }}>
                    <button onClick={() => set("estado", !form.estado)} className="toggle-btn"
                      style={{ background: form.estado ? "#43a047" : "#c62828", boxShadow: form.estado ? "0 2px 8px rgba(67,160,71,0.45)" : "0 2px 8px rgba(198,40,40,0.3)" }}>
                      <span className="toggle-thumb" style={{ left: form.estado ? 27 : 3 }}>
                        <span className="toggle-label" style={{ color:"black" }}>{form.estado ? "ON" : "OFF"}</span>
                      </span>
                    </button>
                    <span style={{ fontSize:13, fontWeight:600, color: form.estado ? "#2e7d32" : "#9e9e9e" }}>
                      {form.estado ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Paso 3: Ubicación ── */}
          {step === 3 && (
            <>
              <p className="section-label" style={{ marginTop:0 }}>Ubicación</p>
              <div className="form-group">
                <label className="form-label">Dirección</label>
                <input className="field-input" type="text" value={form.direccion || ""}
                  onChange={e => set("direccion", e.target.value)} placeholder="Ej. Calle 10 # 5-20"
                  onFocus={e => e.target.style.borderColor = "#4caf50"}
                  onBlur={e => e.target.style.borderColor = "#e0e0e0"} />
              </div>
              <LocationSelects
                departamento={form.departamento} municipio={form.municipio}
                onDepto={v => { set("departamento", v); set("municipio", ""); }}
                onMunicipio={v => set("municipio", v)}
                errDepto={errors.departamento} errMunicipio={errors.municipio}
              />
            </>
          )}

          {/* ── Paso 4: Contraseña ── */}
          {step === 4 && (
            <>
              <p className="section-label" style={{ marginTop:0 }}>Contraseña</p>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Contraseña <span className="required">*</span></label>
                  <div className="pass-wrap">
                    <input className={"field-input" + (errors.contrasena ? " field-input--error" : "")}
                      type={showPass ? "text" : "password"} style={{ paddingRight:36 }}
                      value={form.contrasena || ""} onChange={e => set("contrasena", e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      onFocus={e => e.target.style.borderColor = "#4caf50"}
                      onBlur={e => e.target.style.borderColor = errors.contrasena ? "#e53935" : "#e0e0e0"} />
                    <button className="pass-toggle-btn" onClick={() => setShowPass(v => !v)}>{showPass ? "🙈" : "👁"}</button>
                  </div>
                  {errors.contrasena && <p className="field-error">{errors.contrasena}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Confirmar contraseña <span className="required">*</span></label>
                  <div className="pass-wrap">
                    <input className={"field-input" + (errors.confirmar ? " field-input--error" : "")}
                      type={showPass ? "text" : "password"} style={{ paddingRight:36 }}
                      value={form.confirmar || ""} onChange={e => set("confirmar", e.target.value)}
                      placeholder="Repetir contraseña"
                      onFocus={e => e.target.style.borderColor = "#4caf50"}
                      onBlur={e => e.target.style.borderColor = errors.confirmar ? "#e53935" : "#e0e0e0"} />
                    <button className="pass-toggle-btn" onClick={() => setShowPass(v => !v)}>{showPass ? "🙈" : "👁"}</button>
                  </div>
                  {errors.confirmar && <p className="field-error">{errors.confirmar}</p>}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer — navegación wizard */}
        <div className="modal-footer">
          {step > 1
            ? <button className="btn-ghost" onClick={handleBack}>← Atrás</button>
            : <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          }
          {step < 4
            ? <button className="btn-save" onClick={handleNext}>Siguiente →</button>
            : <button className="btn-save" onClick={handleSave} disabled={saving}>
                {saving && <span className="spinner">◌</span>}
                {saving ? "Guardando…" : "Crear empleado"}
              </button>
          }
        </div>
      </div>
    </div>
  );
}