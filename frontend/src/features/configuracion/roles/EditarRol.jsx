import { useState, useRef, useEffect } from "react";
import { X, Lock, Users } from "lucide-react";
import { createPortal } from "react-dom";
import { soloLetras } from "../../../utils/inputFilters";
import "./Roles.css";
import { editarRol, gestionarPermisos } from "../../../services/rolesService.js";
import { subirImagenCloudinary } from "../../../utils/cloudinary.js";
import PrivilegiosModal, { buildPrivilegios, buildAdminPrivilegios } from "./PrivilegiosModal.jsx";
import { usePrivilegios } from "../../../context/PrivilegiosContext.jsx";
import EmojiPickerGrid from "./EmojiPickerGrid.jsx";

export default function EditarRol({ rol, mode = "edit", onClose, onSave }) {
  const normalize = (p, isAdmin = false) => {
    if (isAdmin) return buildAdminPrivilegios();
    return p?.length > 0 && p[0].modulo ? p : buildPrivilegios(p || []);
  };

  const [form, setForm]                       = useState({ ...rol, privilegios: normalize(rol.permisos, rol.esAdmin) });
  const [errors, setErrors]                   = useState({});
  const [saving, setSaving]                   = useState(false);
  const [pickingIcon, setPickingIcon]         = useState(false);
  const [showPrivilegios, setShowPrivilegios] = useState(false);
  const [iconFile, setIconFile]               = useState(null);
  const fileRef   = useRef();
  const isView    = mode === "view";
  const { recargar: recargarPrivilegios } = usePrivilegios();

  useEffect(() => {
    if (rol) setForm({ ...rol, privilegios: normalize(rol.permisos, rol.esAdmin) });
  }, [rol]);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    let err = "";
    if (k === "nombre") {
      const t = v.trim();
      if (!t) err = "Campo requerido";
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

  const activosCount = form.privilegios?.filter(p => p.estado).length || 0;
  const totalCount   = form.privilegios?.length || 0;

  const handleSave = async () => {
    const newErrors = {};
    if (!form.nombre.trim()) newErrors.nombre = "Campo requerido";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSaving(true);
    try {
      const payload = { Rol: form.nombre.trim() };
      if (iconFile) {
        payload.Icono = await subirImagenCloudinary(iconFile);
      } else if (form.icono) {
        payload.Icono = form.icono;
      } else if (!form.iconoPreview) {
        payload.limpiar_icono = true;
      }
      await editarRol(rol.id, payload);
      const activeIds = (form.privilegios || []).filter(p => p.estado).map(p => p.id);
      await gestionarPermisos(rol.id, activeIds);
      recargarPrivilegios();
      onSave?.();
    } catch (e) {
      setErrors({ _api: e.message || "Error al guardar" });
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
              <h2 className="modal-header__title">{isView ? "Ver rol" : "Editar rol"}</h2>
            </div>
            <button className="modal-close-btn" onClick={onClose} style={{display:"flex",alignItems:"center",justifyContent:"center"}}><X size={16} /></button>
          </div>

          <div className="modal-body">
            {/* Ícono */}
            <div className="form-group">
              <label className="form-label">Ícono</label>
              <div className="icon-row">
                <div className="rol-icon-wrap"
                  style={{ cursor: isView ? "default" : "pointer" }}
                  onClick={() => !isView && fileRef.current.click()}>
                  {form.iconoPreview
                    ? <img src={form.iconoPreview} alt="icon" />
                    : <span style={{ fontSize: 22 }}>{form.icono}</span>}
                </div>
                {!isView && (
                  <>
                    <button className="icon-change-btn" onClick={() => fileRef.current.click()}>Cambiar imagen</button>
                    <span style={{ color: "#9e9e9e", fontSize: 12 }}>o</span>
                    <button className="icon-change-btn" onClick={() => setPickingIcon(v => !v)}>Elegir emoji</button>
                  </>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleIconFile} />
              </div>
              {!isView && pickingIcon && (
                <EmojiPickerGrid
                  selected={form.icono}
                  onSelect={ic => { set("icono", ic); set("iconoPreview", null); setIconFile(null); setPickingIcon(false); }}
                />
              )}
            </div>

            {/* Nombre */}
            <div className="form-group">
              <label className="form-label">Nombre del rol</label>
              {isView
                ? <div className="field-input field-input--disabled">{form.nombre}</div>
                : <>
                    <input
                      className={`field-input${errors.nombre ? " field-input--error" : ""}`}
                      value={form.nombre}
                      onChange={e => set("nombre", soloLetras(e.target.value))}
                      placeholder="Ej. Administrador"
                      onFocus={e => (e.target.style.borderColor = "#4caf50")}
                      onBlur={e  => (e.target.style.borderColor = errors.nombre ? "#e53935" : "#e0e0e0")}
                    />
                    {errors.nombre && <p className="field-error">{errors.nombre}</p>}
                  </>
              }
            </div>

            {/* Usuarios asignados */}
            <div className="form-group">
              <label className="form-label">Usuarios asignados</label>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                padding: "8px 14px",
                borderRadius: 10,
                background: (rol.totalUsuarios ?? 0) > 0 ? "#e8f5e9" : "#fafafa",
                border: `1px solid ${(rol.totalUsuarios ?? 0) > 0 ? "#c8e6c9" : "#e0e0e0"}`,
              }}>
                <Users size={18} />
                <span style={{
                  fontSize: 15, fontWeight: 700,
                  color: (rol.totalUsuarios ?? 0) > 0 ? "#2e7d32" : "#9e9e9e",
                }}>
                  {rol.totalUsuarios ?? 0}
                </span>
                <span style={{ fontSize: 12, color: "#757575" }}>
                  {(rol.totalUsuarios ?? 0) === 1 ? "usuario" : "usuarios"}
                </span>
              </div>
            </div>

            {/* Privilegios */}
            <div className="form-group">
              <label className="form-label">Privilegios</label>
              <button
                className="privilegios-open-btn"
                onClick={() => setShowPrivilegios(true)}
              >
                <Lock size={16} />
                <span>Ver y gestionar privilegios</span>
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
            <button className="btn-ghost" onClick={onClose}>{isView ? "Cerrar" : "Salir sin guardar"}</button>
            {!isView && (
              <button className="btn-save" onClick={handleSave} disabled={saving}>
                {saving && <span className="spinner">◌</span>}
                {saving ? "Guardando…" : "Guardar"}
              </button>
            )}
          </div>
        </div>
      </div>

      {showPrivilegios && (
        <PrivilegiosModal
          privilegios={form.privilegios}
          esAdmin={rol?.esAdmin}
          isView={isView}
          onChange={privilegios => set("privilegios", privilegios)}
          onClose={() => setShowPrivilegios(false)}
        />
      )}
    </>,
    document.body
  );
}
