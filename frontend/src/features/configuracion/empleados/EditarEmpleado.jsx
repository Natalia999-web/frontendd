import { useState, useRef, useEffect } from "react";
import { TIPOS_DOC, fmtTel, toInputDate, fromInputDate } from "./empleadosUtils.js";
import { soloLetras, soloDigitos } from "../../../utils/inputFilters";
import { RolBadge, LocationSelects } from "./CrearEmpleado.jsx";
import { validatePassword } from "../Usuarios/usuariosUtils.js";
import "./Empleados.css";

/* ─── Barra de pasos (reutilizada en Editar) ─────────────── */
const STEPS_EDITAR = ["Identificación", "Personal", "Ubicación", "Contraseña"];

function StepsBar({ current }) {
  return (
    <div className="wizard-steps-bar">
      {STEPS_EDITAR.map((label, i) => {
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
            {i < STEPS_EDITAR.length - 1 && (
              <div className={`wizard-step-line${done ? " done" : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Modal Ver — Side Panel ─────────────────────────────── */
const NAV_ITEMS = [
  { id:"personal",  label:"Personal",  icon:"👤" },
  { id:"ubicacion", label:"Ubicación", icon:"📍" },
  { id:"rol",       label:"Rol",       icon:"🎖️" },
];

export function ModalVerEmpleado({ empleado, onClose, roles = [] }) {
  const [activeSection, setActiveSection] = useState("personal");
  const rol = roles.find(r => r.id === Number(empleado.idRol));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        style={{ maxWidth:660, width:"100%", maxHeight:"calc(100vh - 40px)", display:"flex", flexDirection:"column", overflow:"hidden" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Empleados</p>
            <h2 className="modal-header__title">{empleado.nombre} {empleado.apellidos}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Side panel layout */}
        <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

          {/* Nav lateral */}
          <nav style={{
            width:160, borderRight:"1px solid #f0f0f0", background:"#fafdf9",
            display:"flex", flexDirection:"column", padding:"12px 0", flexShrink:0,
          }}>
            {/* Avatar compacto */}
            <div style={{ display:"flex", justifyContent:"center", marginBottom:16, paddingBottom:12, borderBottom:"1px solid #f0f0f0" }}>
              <div className="avatar-wrap" style={{ width:52, height:52, fontSize:22 }}>
                {empleado.fotoPreview
                  ? <img src={empleado.fotoPreview} alt={empleado.nombre} />
                  : <span>👤</span>}
              </div>
            </div>

            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                style={{
                  display:"flex", alignItems:"center", gap:8,
                  padding:"10px 16px", border:"none",
                  borderLeft: activeSection === item.id ? "3px solid #2e7d32" : "3px solid transparent",
                  background: activeSection === item.id ? "#e8f5e9" : "transparent",
                  color: activeSection === item.id ? "#2e7d32" : "#757575",
                  fontWeight: activeSection === item.id ? 700 : 500,
                  fontSize:13, cursor:"pointer", fontFamily:"inherit",
                  transition:"all 0.15s", textAlign:"left", width:"100%",
                }}
              >
                <span style={{ fontSize:14 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Contenido — sin overflow */}
          <div style={{ flex:1, padding:"20px 24px", display:"flex", flexDirection:"column" }}>

            {/* ── Personal ── */}
            {activeSection === "personal" && (
              <>
                <p className="section-label" style={{ marginTop:0 }}>Identificación</p>
                <div className="form-group">
                  <label className="form-label">Tipo y Número de documento</label>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span className="doc-type">{empleado.tipoDoc}</span>
                    <span style={{ fontSize:14, fontWeight:600, color:"#424242" }}>{empleado.numDoc || "—"}</span>
                  </div>
                </div>

                <p className="section-label">Datos personales</p>
                <div className="form-grid-2">
                  {[
                    ["Nombre",    empleado.nombre],
                    ["Apellidos", empleado.apellidos],
                  ].map(([label, val]) => (
                    <div key={label} className="form-group">
                      <label className="form-label">{label}</label>
                      <div className="field-input field-input--disabled">{val || "—"}</div>
                    </div>
                  ))}
                  <div className="form-group" style={{ gridColumn:"1 / -1" }}>
                    <label className="form-label">Correo electrónico</label>
                    <div className="field-input field-input--disabled">{empleado.correo || "—"}</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teléfono</label>
                    <div className="field-input field-input--disabled">{empleado.telefono || "—"}</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fecha de ingreso</label>
                    <div className="field-input field-input--disabled">{empleado.fechaIngreso || "—"}</div>
                  </div>
                  <div className="form-group" style={{ gridColumn:"1 / -1" }}>
                    <label className="form-label">Estado</label>
                    <div style={{ display:"flex", alignItems:"center", gap:10, paddingTop:4 }}>
                      <button className="toggle-btn" style={{ background: empleado.estado ? "#43a047" : "#c62828", cursor:"default", boxShadow: empleado.estado ? "0 2px 8px rgba(67,160,71,0.45)" : "0 2px 8px rgba(198,40,40,0.3)" }}>
                        <span className="toggle-thumb" style={{ left: empleado.estado ? 27 : 3 }}>
                          <span className="toggle-label" style={{ color:"black" }}>{empleado.estado ? "ON" : "OFF"}</span>
                        </span>
                      </button>
                      <span style={{ fontSize:13, fontWeight:600, color: empleado.estado ? "#2e7d32" : "#9e9e9e" }}>
                        {empleado.estado ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Ubicación ── */}
            {activeSection === "ubicacion" && (
              <>
                <p className="section-label" style={{ marginTop:0 }}>Ubicación</p>
                <div className="form-group">
                  <label className="form-label">Dirección</label>
                  <div className="field-input field-input--disabled">{empleado.direccion || "—"}</div>
                </div>
                <LocationSelects
                  departamento={empleado.departamento} municipio={empleado.municipio}
                  onDepto={() => {}} onMunicipio={() => {}}
                  isView
                />
              </>
            )}

            {/* ── Rol ── */}
            {activeSection === "rol" && (
              <>
                <p className="section-label" style={{ marginTop:0 }}>Rol asignado</p>
                <div className="form-group">
                  <label className="form-label">Rol del empleado</label>
                  <div style={{ paddingTop:4 }}><RolBadge idRol={empleado.idRol} roles={roles} /></div>
                </div>
                {rol && (
                  <div className="form-group">
                    <label className="form-label">Descripción</label>
                    <div className="field-input field-input--disabled">{rol.nombre}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal Eliminar ─────────────────────────────────────── */
export function ModalEliminarEmpleado({ empleado, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  const run = async () => { setDeleting(true); await new Promise(r => setTimeout(r, 500)); onConfirm(); };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()}>
        <div style={{ padding:"28px 24px 18px", textAlign:"center" }}>
          <div className="delete-icon-wrap">🗑️</div>
          <h3 className="delete-title">Eliminar empleado</h3>
          <p className="delete-body">¿Eliminar a <strong>"{empleado.nombre} {empleado.apellidos}"</strong>?</p>
          <p className="delete-warn">Esta acción no se puede deshacer.</p>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel-full" onClick={onClose}>Cancelar</button>
          <button className="btn-danger" onClick={run} disabled={deleting}>{deleting ? "Eliminando…" : "Eliminar"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── EditarEmpleado — Wizard 4 pasos ────────────────────── */
export default function EditarEmpleado({ empleado, onClose, onSave, roles = [] }) {
  const [form, setForm]         = useState({ ...empleado, contrasena:"", confirmar:"" });
  const [errors, setErrors]     = useState({});
  const [saving, setSaving]     = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [step, setStep]         = useState(1);
  const fotoRef = useRef();

  useEffect(() => { if (empleado) setForm({ ...empleado, contrasena:"", confirmar:"" }); }, [empleado]);

  const set = (k, v) => {
    let val = v;
    if ((k === "nombre" || k === "apellidos") && typeof v === "string") val = soloLetras(v);
    if (k === "numDoc" && typeof v === "string") val = soloDigitos(v);
    if (k === "telefono" && typeof v === "string") val = soloDigitos(v, 10);
    const newForm = { ...form, [k]: val };
    setForm(newForm);
    let err = "";
    if (k === "tipoDoc" && !val) err = "Requerido";
    if (k === "numDoc") {
      if (!val.trim()) err = "Requerido";
      else if (val.length < 8 || val.length > 11) err = "Debe tener entre 8 y 11 dígitos";
    }
    if (k === "idRol" && !val) err = "Selecciona un rol";
    if (k === "nombre" && !val.trim()) err = "Requerido";
    if (k === "apellidos" && !val.trim()) err = "Requerido";
    if (k === "correo") {
      if (!val.trim()) err = "Correo inválido";
      else if (!/\S+@\S+\.\S+/.test(val)) err = "Correo inválido";
    }
    if (k === "telefono") {
      if (!val.trim()) err = "Requerido";
      else if (val.replace(/\D/g, "").length !== 10) err = "El teléfono debe tener 10 dígitos";
    }
    if (k === "fechaIngreso" && !val) err = "Requerido";
    if (k === "departamento" && !val) err = "Requerido";
    if (k === "municipio" && !val) err = "Requerido";
    if (k === "contrasena" && val) {
      const pe = validatePassword(val, newForm.confirmar || undefined);
      err = pe || "";
    }
    if (k === "confirmar" && newForm.contrasena && val !== newForm.contrasena) {
      err = "Las contraseñas no coinciden";
    }
    setErrors(p => {
      const n = { ...p, [k]: err };
      if (k === "contrasena" && newForm.confirmar) {
        const pe = val ? validatePassword(val, newForm.confirmar) : null;
        n.confirmar = pe ? "Las contraseñas no coinciden" : "";
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
    if (s === 1) {
      if (!form.tipoDoc)       e.tipoDoc = "Requerido";
      if (!form.numDoc.trim()) e.numDoc  = "Requerido";
      else if (form.numDoc.length < 8 || form.numDoc.length > 11) e.numDoc = "Debe tener entre 8 y 11 dígitos";
      if (!form.idRol)         e.idRol   = "Selecciona un rol";
    }
    if (s === 2) {
      if (!form.nombre.trim())    e.nombre       = "Requerido";
      if (!form.apellidos.trim()) e.apellidos    = "Requerido";
      if (!form.correo.trim() || !/\S+@\S+\.\S+/.test(form.correo)) e.correo = "Correo inválido";
      if (!form.telefono.trim())  e.telefono     = "Requerido";
      if (!form.fechaIngreso)     e.fechaIngreso = "Requerido";
    }
    if (s === 3) {
      if (!form.departamento) e.departamento = "Requerido";
      if (!form.municipio)    e.municipio    = "Requerido";
    }
    if (s === 4) {
      // Contraseña es opcional en edición; solo validar si ingresó algo
      if (form.contrasena) {
        const passError = validatePassword(form.contrasena, form.confirmar);
        if (passError) e.contrasena = passError;
      }
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
    try {
      const { confirmar, ...data } = form;
      await onSave(data);
    } catch {
      // parent shows toast on error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--wide" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Empleados</p>
            <h2 className="modal-header__title">Editar Empleado</h2>
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
              <div style={{ textAlign:"center", marginBottom:16 }}>
                <div className="avatar-upload-wrap" onClick={() => fotoRef.current.click()}>
                  {form.fotoPreview
                    ? <img className="avatar-upload-img" src={form.fotoPreview} alt="avatar" />
                    : <div className="avatar-upload-placeholder">👤</div>}
                  <div className="avatar-upload-overlay">📷</div>
                </div>
                <p style={{ margin:0, fontSize:11, color:"#9e9e9e" }}>Foto de perfil</p>
                <input ref={fotoRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFoto} />
              </div>

              <p className="section-label" style={{ marginTop:0, textTransform: "none"}}>Identificación</p>
              <div className="form-group">
                <label className="form-label">Tipo y Número de documento</label>
                <div className="doc-combo">
                  <select className={"field-input doc-sel" + (errors.tipoDoc ? " field-input--error" : "")}
                    value={form.tipoDoc} onChange={e => set("tipoDoc", e.target.value)} style={{ cursor:"pointer" }}>
                    {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className={"field-input doc-input" + (errors.numDoc ? " field-input--error" : "")}
                    type="text" value={form.numDoc} onChange={e => set("numDoc", e.target.value)}
                    placeholder="Número de documento" maxLength={11}
                    onFocus={e => e.target.style.borderColor = "#4caf50"}
                    onBlur={e => e.target.style.borderColor = errors.numDoc ? "#e53935" : "#e0e0e0"} />
                </div>
                {(errors.tipoDoc || errors.numDoc) && <p className="field-error">{errors.tipoDoc || errors.numDoc}</p>}
              </div>

              <p className="section-label" style={{ textTransform: "none" }}>Rol</p>
              <div className="form-group">
                <label className="form-label">Rol del empleado</label>
                <select className={"field-input" + (errors.idRol ? " field-input--error" : "")}
                  value={form.idRol || ""} onChange={e => set("idRol", Number(e.target.value))} style={{ cursor:"pointer" }}>
                  <option value="">— Seleccionar rol —</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.icono} {r.nombre}</option>)}
                </select>
                {errors.idRol && <p className="field-error">{errors.idRol}</p>}
              </div>
            </>
          )}

          {/* ── Paso 2: Datos personales ── */}
          {step === 2 && (
            <>
              <p className="section-label" style={{ marginTop:0, textTransform: "none"}}>Datos personales</p>
              <div className="form-grid-2">
                {[
                  { k:"nombre",    label:"Nombre",    ph:"Ej. Laura" },
                  { k:"apellidos", label:"Apellidos", ph:"Ej. Sánchez Ríos" },
                ].map(({ k, label, ph }) => (
                  <div key={k} className="form-group">
                    <label className="form-label">{label}</label>
                    <input className={"field-input" + (errors[k] ? " field-input--error" : "")}
                      type="text" value={form[k] || ""} onChange={e => set(k, e.target.value)} placeholder={ph}
                      onFocus={e => e.target.style.borderColor = "#4caf50"}
                      onBlur={e => e.target.style.borderColor = errors[k] ? "#e53935" : "#e0e0e0"} />
                    {errors[k] && <p className="field-error">{errors[k]}</p>}
                  </div>
                ))}

                <div className="form-group" style={{ gridColumn:"1 / -1" }}>
                  <label className="form-label">Correo electrónico</label>
                  <input className={"field-input" + (errors.correo ? " field-input--error" : "")}
                    type="email" value={form.correo || ""} onChange={e => set("correo", e.target.value)}
                    placeholder="correo@empresa.com"
                    onFocus={e => e.target.style.borderColor = "#4caf50"}
                    onBlur={e => e.target.style.borderColor = errors.correo ? "#e53935" : "#e0e0e0"} />
                  {errors.correo && <p className="field-error">{errors.correo}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className={"field-input" + (errors.telefono ? " field-input--error" : "")}
                    type="tel" value={form.telefono} maxLength={12}
                    onChange={e => set("telefono", fmtTel(e.target.value))} placeholder="300 000 0000"
                    onFocus={e => e.target.style.borderColor = "#4caf50"}
                    onBlur={e => e.target.style.borderColor = errors.telefono ? "#e53935" : "#e0e0e0"} />
                  {errors.telefono && <p className="field-error">{errors.telefono}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label">Fecha de ingreso</label>
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
              <p className="section-label" style={{ marginTop:0, textTransform: "none"}}>Ubicación</p>
              <div className="form-group">
                <label className="form-label">Dirección</label>
                <input className="field-input" value={form.direccion || ""}
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

          {/* ── Paso 4: Contraseña (opcional en edición) ── */}
          {step === 4 && (
            <>
              <p className="section-label" style={{ marginTop:0, textTransform: "none"}}>Cambiar contraseña</p>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">
                    Nueva contraseña{" "}
                    <span style={{ color:"#bdbdbd", fontWeight:400, textTransform:"none" }}>(opcional)</span>
                  </label>
                  <div className="pass-wrap">
                    <input className="field-input" type={showPass ? "text" : "password"} style={{ paddingRight:36 }}
                      value={form.contrasena || ""} onChange={e => set("contrasena", e.target.value)}
                      placeholder="Dejar vacío para no cambiar"
                      onFocus={e => e.target.style.borderColor = "#4caf50"}
                      onBlur={e => e.target.style.borderColor = "#e0e0e0"} />
                    <button className="pass-toggle-btn" onClick={() => setShowPass(v => !v)}>{showPass ? "🙈" : "👁"}</button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Confirmar contraseña</label>
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
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
          }
        </div>
      </div>
    </div>
  );
}