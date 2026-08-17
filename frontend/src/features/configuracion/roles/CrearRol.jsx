import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { soloLetras } from "../../../utils/inputFilters";
import "./Roles.css";
import { crearRol, gestionarPermisos } from "../../../services/rolesService.js";
import { subirImagenCloudinary } from "../../../utils/cloudinary.js";
import PrivilegiosModal, { buildPrivilegios } from "./PrivilegiosModal.jsx";
import EmojiPickerGrid from "./EmojiPickerGrid.jsx";

export default function CrearRol({ onClose, onSave }) {
  const [form, setForm] = useState({
    nombre:       "",
    icono:        "👤",
    iconoPreview: null,
    privilegios:  buildPrivilegios(),
  });
  const [errors,         setErrors]         = useState({});
  const [saving,         setSaving]         = useState(false);
  const [pickingIcon,    setPickingIcon]    = useState(false);
  const [showPrivilegios, setShowPrivilegios] = useState(false);
  const [iconFile,       setIconFile]       = useState(null);
  const fileRef = useRef();

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    let err = "";
    if (k === "nombre") {
      const t = v.trim();
      if (!t) err = "El nombre del rol es obligatorio";
      else if (t.length < 2) err = "Mínimo 2 caracteres";
    }
    setErrors(p => ({ ...p, [k]: err }));
  };

  const handleIconFile = e => {
    const file = e.target.files[0]; if (!file) return;
    setIconFile(file);
    const reader = new FileReader();
    reader.onload = ev => { set("iconoPreview", ev.target.result); set("icono", null); };
    reader.readAsDataURL(file);
  };

  const activosCount = form.privilegios.filter(p => p.estado).length;
  const totalCount   = form.privilegios.length;

  const handleSave = async () => {
    const newErrors = {};
    if (!form.nombre.trim()) newErrors.nombre = "El nombre del rol es obligatorio";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSaving(true);
    try {
      let icono = form.icono || "👤";
      if (iconFile) {
        icono = await subirImagenCloudinary(iconFile);
      }
      const data = await crearRol({ Rol: form.nombre.trim(), Icono: icono });
      const activeIds = form.privilegios.filter(p => p.estado).map(p => p.id);
      if (activeIds.length > 0 && data?.ID_Rol) {
        await gestionarPermisos(data.ID_Rol, activeIds);
      }
      onSave?.();
    } catch (e) {
      setErrors({ _api: e.message || "Error al crear rol" });
    }
    setSaving(false);
  };

  return createPortal(
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box modal-box--wide" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <p className="modal-header__eyebrow">Roles</p>
              <h2 className="modal-header__title">Nuevo rol</h2>
            </div>
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          </div>

          <div className="modal-body">
            {/* Ícono */}
            <div className="form-group">
              <label className="form-label">Ícono</label>
              <div className="icon-row">
                <div className="rol-icon-wrap" onClick={() => fileRef.current.click()}>
                  {form.iconoPreview
                    ? <img src={form.iconoPreview} alt="icon" />
                    : <span style={{ fontSize: 22 }}>{form.icono}</span>}
                </div>
                <button className="icon-change-btn" onClick={() => fileRef.current.click()}>Subir imagen</button>
                <span style={{ color: "#9e9e9e", fontSize: 12 }}>o</span>
                <button className="icon-change-btn" onClick={() => setPickingIcon(v => !v)}>Elegir emoji</button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleIconFile} />
              </div>
              {pickingIcon && (
                <EmojiPickerGrid
                  selected={form.icono}
                  onSelect={ic => { set("icono", ic); set("iconoPreview", null); setIconFile(null); setPickingIcon(false); }}
                />
              )}
            </div>

            {/* Nombre */}
            <div className="form-group">
              <label className="form-label">Nombre del rol <span className="required" /></label>
              <input
                className={`field-input${errors.nombre ? " field-input--error" : ""}`}
                value={form.nombre}
                onChange={e => set("nombre", soloLetras(e.target.value))}
                placeholder="Ej. Supervisor"
                onFocus={e => (e.target.style.borderColor = "#4caf50")}
                onBlur={e  => (e.target.style.borderColor = errors.nombre ? "#e53935" : "#e0e0e0")}
              />
              {errors.nombre && <p className="field-error">{errors.nombre}</p>}
            </div>

            {/* Privilegios */}
            <div className="form-group">
              <label className="form-label">Privilegios</label>
              <button
                className="privilegios-open-btn"
                onClick={() => setShowPrivilegios(true)}
              >
                <span>🔐</span>
                <span>Configurar privilegios</span>
                <span className="permiso-grupo-badge" style={{ marginLeft: "auto" }}>
                  {activosCount}/{totalCount} activos
                </span>
                <span style={{ color: "#9e9e9e", fontSize: 13 }}>›</span>
              </button>
            </div>

            {errors._api && (
              <p className="field-error" style={{ textAlign: "center" }}>{errors._api}</p>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn-ghost" onClick={onClose}>Salir sin guardar</button>
            <button className="btn-save" onClick={handleSave} disabled={saving}>
              {saving && <span className="spinner">◌</span>}
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>

      {showPrivilegios && (
        <PrivilegiosModal
          privilegios={form.privilegios}
          esAdmin={false}
          onChange={privilegios => set("privilegios", privilegios)}
          onClose={() => setShowPrivilegios(false)}
        />
      )}
    </>,
    document.body
  );
}
