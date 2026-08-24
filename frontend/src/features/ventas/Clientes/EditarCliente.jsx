import { useState, useRef, useEffect } from "react";
import { validatePassword } from "../../configuracion/Usuarios/usuariosUtils.js";
import "./clientes.css";
import { soloLetras, soloDigitos } from "../../../utils/inputFilters";

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
function LocationSelects({ departamento, municipio, onDepto, onMunicipio, errDepto, errMunicipio, isView }) {
  const [deptos,     setDeptos]     = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [loadingD,   setLoadingD]   = useState(false);
  const [loadingM,   setLoadingM]   = useState(false);

  useEffect(() => {
    if (isView) return;
    setLoadingD(true);
    fetch("https://api-colombia.com/api/v1/Department")
      .then(r => r.json())
      .then(data => setDeptos(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {})
      .finally(() => setLoadingD(false));
  }, [isView]);

  useEffect(() => {
    if (isView) return;
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
  }, [departamento, deptos, isView]);

  if (isView) return (
    <div className="form-grid-2">
      <div className="form-group"><label className="form-label">Departamento</label><div className="field-input field-input--disabled">{departamento || "—"}</div></div>
      <div className="form-group"><label className="form-label">Municipio</label><div className="field-input field-input--disabled">{municipio || "—"}</div></div>
    </div>
  );

  return (
    <div className="form-grid-2">
      <div className="form-group">
        <label className="form-label">Departamento</label>
        <select className={"field-input" + (errDepto ? " field-input--error" : "")}
          value={departamento || ""} onChange={e => onDepto(e.target.value)}
          disabled={loadingD} style={{ cursor: "pointer" }}>
          <option value="">{loadingD ? "Cargando…" : "— Seleccionar —"}</option>
          {deptos.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        {errDepto && <p className="field-error">{errDepto}</p>}
      </div>
      <div className="form-group">
        <label className="form-label">Municipio</label>
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

/* ── Toggle ───────────────────────────────────────────────── */
function Toggle({ value, onChange, disabled }) {
  return (
    <button onClick={() => !disabled && onChange(!value)} className="toggle-btn"
      style={{ background: value ? "#43a047" : "#c62828", cursor: disabled ? "default" : "pointer",
        boxShadow: value ? "0 2px 8px rgba(67,160,71,0.45)" : "0 2px 8px rgba(198,40,40,0.3)" }}>
      <span className="toggle-thumb" style={{ left: value ? 27 : 3 }}>
        <span className="toggle-label" style={{ color: "black" }}>{value ? "ON" : "OFF"}</span>
      </span>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════
   MODAL VER — Side panel con nav lateral
══════════════════════════════════════════════════════════ */
const NAV_VER = [
  { id: "personal",  label: "Personal",  icon: "👤" },
  { id: "ubicacion", label: "Ubicación", icon: "📍" },
  { id: "cuenta",    label: "Cuenta",    icon: "🔐" },
];

function ModalVerCliente({ cliente, onClose }) {
  const [activeSection, setActiveSection] = useState("personal");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--wide" onClick={e => e.stopPropagation()}
        style={{ overflow: "hidden" }}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Clientes</p>
            <h2 className="modal-header__title">{cliente.nombre} {cliente.apellidos}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Side panel layout */}
        <div style={{ display: "flex" }}>

          {/* Nav lateral */}
          <nav style={{
            width: 148, borderRight: "1px solid #f0f0f0", background: "#fafdf9",
            display: "flex", flexDirection: "column", padding: "12px 0", flexShrink: 0,
          }}>
            {/* Avatar compacto */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #f0f0f0" }}>
              <div className="avatar-wrap" style={{ width: 52, height: 52, fontSize: 22 }}>
                {cliente.fotoPreview
                  ? <img src={cliente.fotoPreview} alt={cliente.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span>👤</span>}
              </div>
            </div>

            {NAV_VER.map(item => (
              <button key={item.id} onClick={() => setActiveSection(item.id)} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 16px", border: "none",
                borderLeft: activeSection === item.id ? "3px solid #2e7d32" : "3px solid transparent",
                background: activeSection === item.id ? "#e8f5e9" : "transparent",
                color: activeSection === item.id ? "#2e7d32" : "#757575",
                fontWeight: activeSection === item.id ? 700 : 500,
                fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.15s", textAlign: "left", width: "100%",
              }}>
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Contenido */}
          <div style={{ flex: 1, padding: "20px 24px" }}>

            {/* ── Personal ── */}
            {activeSection === "personal" && (
              <>
                <p className="section-label" style={{ marginTop: 0 }}>Identificación</p>
                <div className="form-group">
                  <label className="form-label">Tipo y Número de documento</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="doc-type">{cliente.tipoDoc}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#424242" }}>{cliente.numDoc || "—"}</span>
                  </div>
                </div>

                <p className="section-label">Datos personales</p>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Nombre</label>
                    <div className="field-input field-input--disabled">{cliente.nombre || "—"}</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Apellidos</label>
                    <div className="field-input field-input--disabled">{cliente.apellidos || "—"}</div>
                  </div>
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label className="form-label">Correo electrónico</label>
                    <div className="field-input field-input--disabled">
                      {cliente.correo
                        ? <a href={`mailto:${cliente.correo}`} style={{ color: "#1565c0", textDecoration: "none", fontWeight: 600 }}>✉ {cliente.correo}</a>
                        : "—"}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teléfono</label>
                    <div className="field-input field-input--disabled">
                      {cliente.telefono
                        ? <a href={`https://wa.me/${cliente.telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ color: "#2e7d32", textDecoration: "none", fontWeight: 600 }}>📞 {cliente.telefono}</a>
                        : "—"}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fecha de registro</label>
                    <div className="field-input field-input--disabled">{cliente.fechaCreacion || "—"}</div>
                  </div>
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label className="form-label">Estado</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
                      <Toggle value={cliente.estado} onChange={() => {}} disabled />
                      <span style={{ fontSize: 13, fontWeight: 600, color: cliente.estado ? "#2e7d32" : "#9e9e9e" }}>
                        {cliente.estado ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Ubicación ── */}
            {activeSection === "ubicacion" && (
              <>
                <p className="section-label" style={{ marginTop: 0 }}>Ubicación</p>
                <div className="form-group">
                  <label className="form-label">Dirección</label>
                  <div className="field-input field-input--disabled">{cliente.direccion || "—"}</div>
                </div>
                <LocationSelects
                  departamento={cliente.departamento} municipio={cliente.municipio}
                  onDepto={() => {}} onMunicipio={() => {}} isView
                />
              </>
            )}

            {/* ── Cuenta ── */}
            {activeSection === "cuenta" && (
              <>
                <p className="section-label" style={{ marginTop: 0 }}>Información de cuenta</p>
                <div className="form-group">
                  <label className="form-label">Correo de acceso</label>
                  <div className="field-input field-input--disabled">{cliente.correo || "—"}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Contraseña</label>
                  <div className="field-input field-input--disabled" style={{ color: "#bdbdbd" }}>••••••••</div>
                </div>
                {cliente.fechaCreacion && (
                  <div className="date-info" style={{ marginTop: 8 }}>
                    <span>📅</span>
                    <span>Cliente desde <strong>{cliente.fechaCreacion}</strong></span>
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

/* ══════════════════════════════════════════════════════════
   MODAL EDITAR — Wizard 3 pasos
══════════════════════════════════════════════════════════ */
function ModalEditarCliente({ cliente, onClose, onSave }) {
  const [form, setForm]         = useState({ ...cliente, contrasena: "", confirmar: "" });
  const [errors, setErrors]     = useState({});
  const [saving, setSaving]     = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [step, setStep]         = useState(1);
  const fotoRef = useRef();

  useEffect(() => { if (cliente) setForm({ ...cliente, contrasena: "", confirmar: "" }); }, [cliente]);

  const set = (k, v) => {
    let val = v;
    if (k === 'numDoc' && typeof v === 'string') val = soloDigitos(v);
    if ((k === 'nombre' || k === 'apellidos') && typeof v === 'string') val = soloLetras(v);
    const newForm = { ...form, [k]: val };
    setForm(newForm);
    let err = "";
    if (k === 'tipoDoc' && !val) err = "Requerido";
    if (k === 'numDoc') {
      if (!val.trim()) err = "Requerido";
      else if (val.length < 8 || val.length > 11) err = "Debe tener entre 8 y 11 dígitos";
    }
    if (k === 'nombre' && !val.trim()) err = "Requerido";
    if (k === 'apellidos' && !val.trim()) err = "Requerido";
    if (k === 'correo') {
      if (!val.trim()) err = "Correo inválido";
      else if (!/\S+@\S+\.\S+/.test(val)) err = "Correo inválido";
    }
    if (k === 'telefono') {
      if (!val.trim()) err = "Requerido";
      else if (val.replace(/\D/g, "").length !== 10) err = "El teléfono debe tener 10 dígitos";
    }
    if (k === 'fechaCreacion' && !val) err = "Requerido";
    if (k === 'departamento' && !val) err = "Requerido";
    if (k === 'municipio' && !val) err = "Requerido";
    if (k === 'contrasena' && val) {
      const pe = validatePassword(val, newForm.confirmar || undefined);
      err = pe || "";
    }
    if (k === 'confirmar' && newForm.contrasena && val !== newForm.contrasena) {
      err = "Las contraseñas no coinciden";
    }
    setErrors(p => {
      const n = { ...p, [k]: err };
      if (k === 'contrasena' && newForm.confirmar) {
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
      if (!form.numDoc?.trim()) e.numDoc  = "Requerido";
      else if (form.numDoc.length < 8 || form.numDoc.length > 11) e.numDoc = "Debe tener entre 8 y 11 dígitos";
    }
    if (s === 2) {
      if (!form.nombre?.trim())    e.nombre    = "Requerido";
      if (!form.apellidos?.trim()) e.apellidos = "Requerido";
      if (!form.correo?.trim() || !/\S+@\S+\.\S+/.test(form.correo)) e.correo = "Correo inválido";
      if (!form.telefono?.trim())  e.telefono  = "Requerido";
      else if (form.telefono.replace(/\D/g, "").length !== 10) e.telefono = "El teléfono debe tener 10 dígitos";
      if (!form.fechaCreacion)     e.fechaCreacion = "Requerido";
      if (!form.departamento)      e.departamento  = "Requerido";
      if (!form.municipio)         e.municipio     = "Requerido";
    }
    if (s === 3) {
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
    const e = validateStep(3);
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

        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Clientes</p>
            <h2 className="modal-header__title">Editar Cliente</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: "16px 24px 0" }}>
          <StepsBar current={step} />
        </div>

        {/* Body — sin overflow */}
        <div className="modal-body" style={{ overflow: "visible" }}>

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
                <p style={{ margin: 0, fontSize: 11, color: "#9e9e9e" }}>Foto de perfil</p>
                <input ref={fotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFoto} />
              </div>

              <p className="section-label" style={{ marginTop: 0, textTransform: "none" }}>Identificación</p>
              <div className="form-group">
                <label className="form-label">Tipo y Número de documento</label>
                <div className="doc-combo">
                  <select className={"field-input doc-sel" + (errors.tipoDoc ? " field-input--error" : "")}
                    value={form.tipoDoc} onChange={e => set("tipoDoc", e.target.value)} style={{ cursor: "pointer" }}>
                    {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className={"field-input doc-input" + (errors.numDoc ? " field-input--error" : "")}
                    type="text" value={form.numDoc || ""} onChange={e => set("numDoc", e.target.value)}
                    placeholder="Número de documento" maxLength={11}
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
              <p className="section-label" style={{ marginTop: 0, textTransform: "none" }}>Datos personales</p>
              <div className="form-grid-2">
                {[
                  { k: "nombre",    label: "Nombre",    ph: "Ej. Ana" },
                  { k: "apellidos", label: "Apellidos", ph: "Ej. García López" },
                ].map(({ k, label, ph }) => (
                  <div key={k} className="form-group">
                    <label className="form-label">{label}</label>
                    <input className={"field-input" + (errors[k] ? " field-input--error" : "")}
                      type="text" value={form[k] || ""} onChange={e => set(k, e.target.value)} placeholder={ph}
                      onFocus={e => e.target.style.borderColor = "#4caf50"}
                      onBlur={e  => e.target.style.borderColor = errors[k] ? "#e53935" : "#e0e0e0"} />
                    {errors[k] && <p className="field-error">{errors[k]}</p>}
                  </div>
                ))}

                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Correo electrónico</label>
                  <input className={"field-input" + (errors.correo ? " field-input--error" : "")}
                    type="email" value={form.correo || ""} onChange={e => set("correo", e.target.value)}
                    placeholder="correo@ejemplo.com"
                    onFocus={e => e.target.style.borderColor = "#4caf50"}
                    onBlur={e  => e.target.style.borderColor = errors.correo ? "#e53935" : "#e0e0e0"} />
                  {errors.correo && <p className="field-error">{errors.correo}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className={"field-input" + (errors.telefono ? " field-input--error" : "")}
                    type="tel" value={form.telefono || ""} maxLength={12}
                    onChange={e => set("telefono", fmtTel(e.target.value))} placeholder="300 000 0000"
                    onFocus={e => e.target.style.borderColor = "#4caf50"}
                    onBlur={e  => e.target.style.borderColor = errors.telefono ? "#e53935" : "#e0e0e0"} />
                  {errors.telefono && <p className="field-error">{errors.telefono}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label">Fecha de registro</label>
                  <input className={"field-input" + (errors.fechaCreacion ? " field-input--error" : "")}
                    type="date" value={toInputDate(form.fechaCreacion)}
                    onChange={e => set("fechaCreacion", fromInputDate(e.target.value))}
                    onFocus={e => e.target.style.borderColor = "#4caf50"}
                    onBlur={e  => e.target.style.borderColor = errors.fechaCreacion ? "#e53935" : "#e0e0e0"} />
                  {errors.fechaCreacion && <p className="field-error">{errors.fechaCreacion}</p>}
                </div>

                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Estado</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
                    <Toggle value={form.estado} onChange={v => set("estado", v)} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: form.estado ? "#2e7d32" : "#9e9e9e" }}>
                      {form.estado ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </div>

                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Dirección</label>
                  <input className="field-input" type="text" value={form.direccion || ""}
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
                isView={false}
              />
            </>
          )}

          {/* ── Paso 3: Contraseña (opcional en edición) ── */}
          {step === 3 && (
            <>
              <p className="section-label" style={{ marginTop: 0, textTransform: "none" }}>Cambiar contraseña</p>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">
                    Nueva contraseña{" "}
                    <span style={{ color: "#bdbdbd", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opcional)</span>
                  </label>
                  <div className="pass-wrap">
                    <input className="field-input" type={showPass ? "text" : "password"} style={{ paddingRight: 36 }}
                      value={form.contrasena || ""} onChange={e => set("contrasena", e.target.value)}
                      placeholder="Dejar vacío para no cambiar"
                      onFocus={e => e.target.style.borderColor = "#4caf50"}
                      onBlur={e  => e.target.style.borderColor = "#e0e0e0"} />
                    <button className="pass-toggle-btn" onClick={() => setShowPass(v => !v)}>{showPass ? "🙈" : "👁"}</button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Confirmar contraseña</label>
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
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
          }
        </div>
      </div>
    </div>
  );
}

/* ── Exports ──────────────────────────────────────────────── */
export { ModalVerCliente, ModalEditarCliente };
export default ModalEditarCliente;