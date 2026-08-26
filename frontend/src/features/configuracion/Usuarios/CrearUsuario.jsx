import { useState, useRef, useEffect } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { subirImagenCloudinary } from "../../../utils/cloudinary.js";
import { soloLetras, soloDigitos, esUbicacionValida } from "../../../utils/inputFilters";
import { GB, getRolStyle, EMPTY_FORM, TIPO_DOC, validatePassword, validateCedula, validateTelefono } from "./usuariosUtils.js";
import { Ic } from "./usuariosIcons.jsx";
import { crearEmpleado, crearCliente, editarUsuario } from "../../../services/usuariosService.js";
import { getUser } from "../../../services/authService.js";
import SearchableSelect from "../../../shared/components/SearchableSelect.jsx";
import "./Usuarios.css";

const ROL_ICONS_BASE = {
  Admin:    "👑",
  Empleado: "👷",
  Cliente:  "👤",
};

// ─── COMPONENTES SHARED ───────────────────────────────────

export function RolBadge({ rol, roles = [] }) {
  const c = getRolStyle(rol);
  const rolObj = roles.find(r => r.nombre === rol);
  const icono = rolObj?.iconoPreview
    ? <img src={rolObj.iconoPreview} alt={rol} style={{ width: 15, height: 15, borderRadius: "50%", objectFit: "cover" }} />
    : <span style={{ fontSize: 14 }}>{rolObj?.icono ?? ROL_ICONS_BASE[rol] ?? "👤"}</span>;
  return (
    <span className="rol-badge rol-badge--icon-only" style={{ background: c.bg, color: c.color, borderColor: c.border }}>
      {icono}
      <span className="rol-badge__tooltip">{rol}</span>
    </span>
  );
}

export function Toggle({ on, onToggle, disabled }) {
  return (
    <button
      onClick={!disabled ? onToggle : undefined}
      className={`toggle-btn${disabled ? " disabled" : ""}`}
      style={{
        background: on ? "#43a047" : "#c62828",
        boxShadow: on ? "0 2px 8px rgba(67,160,71,0.45)" : "0 2px 8px rgba(198,40,40,0.3)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span className="toggle-thumb" style={{ left: on ? 27 : 3 }}>
        <span className="toggle-label" style={{ color: "black" }}>{on ? "ON" : "OFF"}</span>
      </span>
    </button>
  );
}

export function Avatar({ foto, size = 80, border = true }) {
  return foto ? (
    <img src={foto} alt="foto" className="avatar"
      style={{ width: size, height: size, border: border ? `2.5px solid ${GB}` : "none" }} />
  ) : (
    <div className="avatar-placeholder"
      style={{ width: size, height: size, border: border ? `2.5px solid ${GB}` : "none" }}>
      <Ic.UserSvg />
    </div>
  );
}

export function Field({ label, value, onChange, type = "text", placeholder = "", error, readOnly, required, children }) {
  return (
    <div className="field-wrap">
      <label className="field-label">
        {label}{required && <span className="required">*</span>}
      </label>
      {children || (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          readOnly={readOnly}
          autoComplete="new-password"
          className={`field-input${error ? " error" : ""}${readOnly ? " readonly" : ""}`}
          onFocus={e => { if (!readOnly) e.target.style.borderColor = GB; }}
          onBlur={e  => { e.target.style.borderColor = error ? "#e03030" : "#e0e0e0"; }}
        />
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

// ─── SELECTOR DEPARTAMENTO / MUNICIPIO (Valle de Aburrá) ──
const VALLE_ABURRA = [
  "Barbosa", "Bello", "Caldas", "Copacabana", "Envigado",
  "Girardota", "Itagüí", "La Estrella", "Medellín", "Sabaneta",
];

function LocationSelects({ departamento, municipio, onDepto, onMunicipio, errDepto, errMunicipio, optional = false }) {
  useEffect(() => {
    if (!departamento) onDepto("Antioquia");
  }, []); // eslint-disable-line

  // Si el municipio actual no está en la lista (usuario preexistente), incluirlo
  const opciones = VALLE_ABURRA.includes(municipio) || !municipio
    ? VALLE_ABURRA
    : [...VALLE_ABURRA, municipio].sort((a, b) => a.localeCompare(b));

  const SVG = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );

  return (
    <>
      <div className="field-wrap">
        <label className="field-label">Departamento {!optional && <span className="required">*</span>}</label>
        <div className={`field-select${errDepto ? " error" : ""}`} style={{ display: "flex", alignItems: "center", color: "#1a1a1a", cursor: "default" }}>
          Antioquia
        </div>
        {errDepto && <span className="field-error">{errDepto}</span>}
      </div>

      <div className="field-wrap">
        <label className="field-label">Municipio {!optional && <span className="required">*</span>}</label>
        <SearchableSelect
          options={opciones.map(m => ({ value: m, label: m }))}
          value={municipio}
          onChange={e => onMunicipio(e.target.value)}
          getValue={o => o.value}
          getLabel={o => o.label}
          placeholder="Seleccione…"
          searchPlaceholder="Buscar municipio…"
          className={`field-select${errMunicipio ? " error" : ""}`}
        />
        {errMunicipio && <span className="field-error">{errMunicipio}</span>}
      </div>
    </>
  );
}

function PhotoUploader({ foto, onFoto }) {
  const fileRef = useRef();
  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onFoto(ev.target.result, file);
    reader.readAsDataURL(file);
  };
  return (
    <div className="photo-uploader">
      <div className="photo-uploader-wrap" style={{ width: 88, height: 88 }}>
        <Avatar foto={foto} size={88} />
        <button className="photo-camera-btn" onClick={() => fileRef.current.click()}>
          <Ic.Camera />
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
      </div>
      <span className="photo-label">Foto</span>
      {foto && (
        <button className="photo-remove-btn" onClick={() => onFoto(null)}>
          <Ic.XCircle /> Quitar
        </button>
      )}
    </div>
  );
}

// ─── BARRA DE PASOS ───────────────────────────────────────
const STEPS = ["Personal", "Ubicación", "Acceso y Rol"];

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
              {done ? <Check size={14} /> : idx}
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

// ─── MODAL CREAR / EDITAR — WIZARD ────────────────────────
export default function CrearUsuario({ user, roles = [], onClose, onSave }) {
  const isEdit = !!user;
  const rolesDisponibles = roles.filter(r => r.estado);

  const [form, setForm] = useState(() => {
    if (isEdit) {
      const { contrasena: _c, confirmar: _cf, ...rest } = user;
      const rol = rest.rol || (rest.tipo !== "empleado" ? "Cliente" : "");
      return { ...rest, rol, contrasena: "", confirmar: "" };
    }
    return { ...EMPTY_FORM };
  });

  const [errors,      setErrors]      = useState({});
  const [saving,      setSaving]      = useState(false);
  const [step,        setStep]        = useState(1);
  const [fotoFile,    setFotoFile]    = useState(null);
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const set = (k, v) => {
    let val = v;
    if (k === "cedula"   && typeof v === "string") val = soloDigitos(v);
    if (k === "telefono" && typeof v === "string") val = soloDigitos(v, 10);
    if ((k === "nombre" || k === "apellidos") && typeof v === "string") val = soloLetras(v);
    const newForm = { ...form, [k]: val };
    setForm(newForm);
    let err = "";
    if (k === "nombre" && !val.trim()) err = "El nombre es obligatorio";
    if (k === "apellidos" && !val.trim()) err = "Los apellidos son obligatorios";
    if (k === "correo") {
      if (!val.trim()) err = "El correo es obligatorio";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) err = "Formato de correo inválido";
    }
    if (k === "cedula") {
      if (!isEdit || val.trim()) {
        err = validateCedula(val || "", newForm.tipoDocumento) || "";
      }
    }
    if (k === "tipoDocumento") {
      if (newForm.cedula) {
        setErrors(e => ({ ...e, cedula: validateCedula(newForm.cedula || "", val) || "" }));
      }
    }
    if (k === "telefono") {
      if (!isEdit || val.trim()) {
        err = validateTelefono(val || "") || "";
      }
    }
    if (k === "departamento" && !isEdit && !val) err = "Selecciona un departamento";
    if (k === "municipio" && !isEdit && !val) err = "Selecciona un municipio";
    if (k === "direccion") {
      if (!isEdit && !val.trim()) err = "La dirección es obligatoria";
      else if (val.trim() && !esUbicacionValida(val)) err = "La dirección debe tener letras y números (mín. 5 caracteres)";
    }
    if (k === "rol" && !val) err = "Seleccione un rol";
    if (k === "contrasena") {
      if (!isEdit && !val) err = "La contraseña es obligatoria";
      else if (val) err = validatePassword(val, newForm.confirmar || undefined) || "";
    }
    if (k === "confirmar") {
      if (!isEdit && !val) err = "Confirma tu contraseña";
      else if (newForm.contrasena && val !== newForm.contrasena) err = "Las contraseñas no coinciden";
    }
    setErrors(e => {
      const n = { ...e, [k]: err };
      if (k === "contrasena" && newForm.confirmar) {
        const pe = val ? validatePassword(val, newForm.confirmar) : null;
        n.confirmar = pe ? "Las contraseñas no coinciden" : "";
      }
      return n;
    });
  };

  const validateStep = (s) => {
    const e = {};

    if (s === 1) {
      if (!form.nombre.trim())    e.nombre    = "El nombre es obligatorio";
      if (!form.apellidos.trim()) e.apellidos = "Los apellidos son obligatorios";
      if (!form.correo.trim())    e.correo    = "El correo es obligatorio";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) e.correo = "Formato de correo inválido";

      // En edición solo validar formato si el campo tiene valor
      if (!isEdit || form.cedula?.trim()) {
        const cedulaError = validateCedula(form.cedula || "", form.tipoDocumento);
        if (cedulaError) e.cedula = cedulaError;
      }
      if (!isEdit || form.telefono?.trim()) {
        const telefonoError = validateTelefono(form.telefono || "");
        if (telefonoError) e.telefono = telefonoError;
      }
    }

    if (s === 2) {
      if (!isEdit) {
        if (!form.departamento)      e.departamento = "Selecciona un departamento";
        if (!form.municipio)         e.municipio    = "Selecciona un municipio";
        if (!form.direccion?.trim()) e.direccion    = "La dirección es obligatoria";
        else if (!esUbicacionValida(form.direccion)) e.direccion = "La dirección debe tener letras y números (mín. 5 caracteres)";
      } else if (form.direccion?.trim() && !esUbicacionValida(form.direccion)) {
        e.direccion = "La dirección debe tener letras y números (mín. 5 caracteres)";
      }
    }

    if (s === 3) {
      if (!form.rol) e.rol = "Seleccione un rol";
      const editandoCliente = isEdit && user?.tipo !== "empleado";
      if (!editandoCliente) {
        if (isEdit) {
          if (form.contrasena) {
            const passError = validatePassword(form.contrasena, form.confirmar);
            if (passError) e.contrasena = passError;
          }
        } else {
          const passError = validatePassword(form.contrasena, form.confirmar);
          if (passError) e.contrasena = passError;
        }
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

    const rolObj   = rolesDisponibles.find(r => r.nombre === form.rol);
    const esCliente = form.rol === "Cliente";

    const payload = {
      Nombre:    form.nombre.trim(),
      Apellidos: form.apellidos.trim(),
      Correo:    form.correo.trim(),
    };

    if (!isEdit) {
      payload.Tipo_Documento = form.tipoDocumento;
      payload.Cedula         = form.cedula.trim();
      payload.Telefono       = form.telefono.trim();
      payload.Departamento   = form.departamento;
      payload.Municipio      = form.municipio;
      payload.Direccion      = form.direccion.trim();
    } else {
      if (form.tipoDocumento)     payload.Tipo_Documento = form.tipoDocumento;
      if (form.cedula?.trim())    payload.Cedula         = form.cedula.trim();
      if (form.telefono?.trim())  payload.Telefono       = form.telefono.trim();
      if (form.departamento)      payload.Departamento   = form.departamento;
      if (form.municipio)         payload.Municipio      = form.municipio;
      if (form.direccion?.trim()) payload.Direccion      = form.direccion.trim();
    }

    if (fotoFile) {
      try {
        payload.Foto = await subirImagenCloudinary(fotoFile);
      } catch {
        setErrors(e => ({ ...e, _api: "Error al subir la foto. Intenta de nuevo." }));
        setSaving(false);
        return;
      }
    } else if (form.foto && !form.foto.startsWith("data:")) {
      payload.Foto = form.foto; // URL existente de Cloudinary
    }
    if (rolObj)           payload.ID_Rol     = rolObj.id;
    if (form.contrasena)  payload.Contrasena = form.contrasena;

    try {
      if (isEdit) {
        await editarUsuario(user.tipo, user.id, payload);
        // Si el admin editó al usuario de la sesión actual, refrescar el contexto
        const sesion = getUser();
        if (sesion && String(sesion.id) === String(user.id)) {
          window.dispatchEvent(new CustomEvent("session-changed"));
        }
      } else if (esCliente) {
        await crearCliente(payload);
      } else {
        await crearEmpleado(payload);
      }
      onSave?.();
    } catch (err) {
      const msg = Array.isArray(err?.detail)
        ? err.detail.map(v => v.msg).join(", ")
        : (err?.detail || err?.message || "Error al guardar");
      setErrors({ _api: msg });
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Usuarios</p>
            <h2 className="modal-title">{isEdit ? "Editar Usuario" : "Agregar Usuario"}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}><Ic.Close /></button>
        </div>

        <div style={{ padding: "16px 24px 0" }}>
          <StepsBar current={step} />
        </div>

        <div className="modal-body" style={{ overflowY: "hidden", overflowX: "hidden", minHeight: 280 }}>

          {/* ── Step 1: Datos personales ── */}
          {step === 1 && (
            <>
              <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                <PhotoUploader foto={form.foto} onFoto={(preview, file) => { set("foto", preview); setFotoFile(file); }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <Field required label="Nombre"    placeholder="Ej: Juan"        value={form.nombre}    onChange={e => set("nombre",    e.target.value)} error={errors.nombre} />
                  <Field required label="Apellidos" placeholder="Ej: Pérez Gómez" value={form.apellidos} onChange={e => set("apellidos", e.target.value)} error={errors.apellidos} />
                </div>
              </div>
              <Field required label="Correo" placeholder="Ej: juan@correo.com"
                value={form.correo} onChange={e => set("correo", e.target.value)} error={errors.correo} />
              <div className="field-grid-2">
                <Field required label="Tipo Doc.">
                  <SearchableSelect
                    options={TIPO_DOC.map(t => ({ value: t, label: t }))}
                    value={form.tipoDocumento}
                    onChange={e => set("tipoDocumento", e.target.value)}
                    getValue={o => o.value}
                    getLabel={o => o.label}
                    placeholder="Seleccione…"
                    searchPlaceholder="Tipo…"
                    className="field-select"
                  />
                </Field>
                <Field required label="Cédula" placeholder="Ej: 1023456789" value={form.cedula} onChange={e => set("cedula", e.target.value)} error={errors.cedula} />
              </div>
              <Field required label="Teléfono" placeholder="Ej: 3001234567" value={form.telefono} onChange={e => set("telefono", e.target.value)} error={errors.telefono} />
            </>
          )}

          {/* ── Step 2: Ubicación ── */}
          {step === 2 && (
            <>
              <div className="field-grid-2">
                <LocationSelects
                  departamento={form.departamento}
                  municipio={form.municipio}
                  onDepto={v => set("departamento", v)}
                  onMunicipio={v => set("municipio", v)}
                  errDepto={errors.departamento}
                  errMunicipio={errors.municipio}
                  optional={isEdit}
                />
              </div>
              <div style={{ marginTop: 4 }}>
                <Field
                  required={!isEdit}
                  label="Dirección"
                  placeholder="Ej: Cra 5 #12-34, Apto 201"
                  value={form.direccion}
                  onChange={e => set("direccion", e.target.value)}
                  error={errors.direccion}
                  readOnly={!isEdit && (!form.departamento || !form.municipio)}
                />
              </div>
            </>
          )}

          {/* ── Step 3: Acceso y Rol ── */}
          {step === 3 && (
            <>
              {(() => {
                const editandoCliente = isEdit && user?.tipo !== "empleado";
                if (editandoCliente) return null;
                return (
                  <>
                    {isEdit && (
                      <div style={{ marginBottom: 16, padding: "10px 14px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                        <h4 style={{ margin: 0, fontSize: 13, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                          <Ic.LockSvg /> Cambio de contraseña
                        </h4>
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>
                          Complete estos campos solo si desea actualizar la contraseña del usuario.
                        </p>
                      </div>
                    )}
                    <Field required={!isEdit} label={isEdit ? "Nueva contraseña" : "Contraseña"} error={errors.contrasena}>
                      <div className="pass-input-wrap">
                        <input
                          type={showPass ? "text" : "password"}
                          value={form.contrasena}
                          onChange={e => set("contrasena", e.target.value)}
                          placeholder={isEdit ? "Dejar vacío para no cambiar" : "Mínimo 8 caracteres"}
                          autoComplete="new-password"
                          className={`field-input${errors.contrasena ? " error" : ""}`}
                        />
                        <button type="button" className="pass-eye-btn" onClick={() => setShowPass(v => !v)}>
                          {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </Field>
                    <Field required={!isEdit} label="Confirmar contraseña" error={errors.confirmar}>
                      <div className="pass-input-wrap">
                        <input
                          type={showConfirm ? "text" : "password"}
                          value={form.confirmar}
                          onChange={e => set("confirmar", e.target.value)}
                          placeholder={isEdit ? "Dejar vacío para no cambiar" : "Repite la contraseña"}
                          autoComplete="new-password"
                          className={`field-input${errors.confirmar ? " error" : ""}`}
                        />
                        <button type="button" className="pass-eye-btn" onClick={() => setShowConfirm(v => !v)}>
                          {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </Field>
                  </>
                );
              })()}

              <div className="field-wrap">
                <label className="field-label">Rol <span className="required">*</span></label>
                <SearchableSelect
                  className={`field-select${errors.rol ? " error" : ""}`}
                  options={rolesDisponibles}
                  value={form.rol}
                  onChange={e => set("rol", e.target.value)}
                  getValue={r => r.nombre}
                  getLabel={r => `${r.icono && !r.iconoPreview ? r.icono + " " : ""}${r.nombre}`}
                  placeholder="Seleccione un rol…"
                  searchPlaceholder="Buscar rol…"
                />
                {errors.rol && <span className="field-error">{errors.rol}</span>}

                {form.rol && (() => {
                  const rolObj = rolesDisponibles.find(r => r.nombre === form.rol);
                  const style  = getRolStyle(form.rol);
                  if (!rolObj) return null;
                  return (
                    <div style={{
                      marginTop: 8, display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "5px 12px", borderRadius: 20,
                      background: style.bg, border: `1px solid ${style.border}`, color: style.color,
                      fontSize: 12, fontWeight: 700,
                    }}>
                      {rolObj.iconoPreview
                        ? <img src={rolObj.iconoPreview} alt={rolObj.nombre}
                            style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "cover" }} />
                        : <span>{rolObj.icono}</span>}
                      {rolObj.nombre}
                    </div>
                  );
                })()}
              </div>

              {errors._api && (
                <p className="field-error" style={{ textAlign: "center", marginTop: 8 }}>{errors._api}</p>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          {step > 1
            ? <button className="btn-ghost" onClick={handleBack}>← Atrás</button>
            : <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          }
          <div style={{ display: "flex", gap: 10 }}>
            {step < 3
              ? <button className="btn-save" onClick={handleNext}>Siguiente →</button>
              : <button className="btn-save" onClick={handleSave} disabled={saving}>
                  {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear usuario"}
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
