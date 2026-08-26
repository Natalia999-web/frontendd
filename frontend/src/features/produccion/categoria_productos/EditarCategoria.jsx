import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { soloLetras, tieneLetras } from "../../../utils/inputFilters";
import { ModalOverlay } from "./ui.jsx";
import EmojiPicker from "../../../shared/components/EmojiPicker";
import CharCount from "../../../shared/components/CharCount";
import "./Categoriaproductos.css";

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="toggle-btn"
      style={{
        background: value ? "#43a047" : "#c62828",
        boxShadow: value ? "0 2px 8px rgba(67,160,71,0.45)" : "0 2px 8px rgba(198,40,40,0.3)",
      }}
    >
      <span className="toggle-thumb" style={{ left: value ? 27 : 3 }}>
        <span className="toggle-label" style={{ color: "black" }}>
          {value ? "ON" : "OFF"}
        </span>
      </span>
    </button>
  );
}

export default function EditarCategoria({ category, onClose, onSave, existingCategories = [] }) {
  const [form, setForm] = useState({
    nombre: category?.nombre ?? "",
    descripcion: category?.descripcion ?? "",
    icon: category?.icon ?? "",
    estado: category?.estado ?? true,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (category) setForm({ nombre: category.nombre, descripcion: category.descripcion, icon: category.icon, estado: category.estado });
  }, [category]);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    let err = "";
    if (k === "nombre") {
      const t = v.trim();
      if (!t)                   err = "Campo requerido";
      else if (existingCategories.some(c => c.nombre.trim().toLowerCase() === t.toLowerCase() && c.id !== category?.id))
        err = "Ya existe una categoría con este nombre";
    }
    if (k === "descripcion") {
      const t = v.trim();
      if (!t)                   err = "Campo requerido";
      else if (!tieneLetras(v)) err = "La descripción debe contener letras";
    }
    if (k === "icon") {
      if (existingCategories.some(c => c.icon === v && c.id !== category?.id))
        err = "Este icono ya está en uso por otra categoría";
    }
    setErrors(p => ({ ...p, [k]: err }));
  };

  const validate = () => {
    const e = {};
    const nom = form.nombre.trim().toLowerCase();
    if (!form.nombre.trim())                 e.nombre = "Campo requerido";
    else if (existingCategories.some(c => c.nombre.trim().toLowerCase() === nom && c.id !== category?.id))
      e.nombre = "Ya existe una categoría con este nombre";
    if (!form.descripcion.trim())            e.descripcion = "Campo requerido";
    else if (!tieneLetras(form.descripcion)) e.descripcion = "La descripción debe contener letras";
    if (existingCategories.some(c => c.icon === form.icon && c.id !== category?.id))
      e.icon = "Este icono ya está en uso por otra categoría";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await onSave(
        { Nombre_Categoria: form.nombre.trim(), Descripcion: form.descripcion.trim(), Icono: form.icon },
        form.estado !== category.estado,
      );
    } catch {
      // el padre ya mostró el toast de error; el modal se mantiene abierto
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal-header">
        <div>
          <p className="modal-header__eyebrow">Categorías</p>
          <h2 className="modal-header__title">Editar categoría</h2>
        </div>
        <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="modal-body">
        <EmojiPicker value={form.icon} onChange={ic => set("icon", ic)} />
        {errors.icon && <p className="field-error" style={{ marginTop: -6, marginBottom: 8 }}>{errors.icon}</p>}

        <div className="form-group">
          <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Nombre <span style={{ color: "#e53935", fontWeight: 800 }}>*</span></span>
            <CharCount value={form.nombre} max={100} min={2} />
          </label>
          <input
            className={`field-input${errors.nombre ? " field-input--error" : ""}`}
            value={form.nombre}
            maxLength={50}
            onChange={e => set("nombre", soloLetras(e.target.value))}
            placeholder="Ej. Snacks Premium"
            onFocus={e => (e.target.style.borderColor = "#4caf50")}
            onBlur={e  => (e.target.style.borderColor = errors.nombre ? "#e53935" : "#e0e0e0")}
          />
          {errors.nombre && <p className="field-error">{errors.nombre}</p>}
        </div>

        <div className="form-group">
          <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "inherit" }}>Descripción <span style={{ color: "#e53935", fontWeight: 800 }}>*</span></span>
            <CharCount value={form.descripcion} max={200} min={5} />
          </label>
          <textarea
            className={`field-input${errors.descripcion ? " field-input--error" : ""}`}
            rows={2}
            style={{ resize: "none" }}
            maxLength={200}
            value={form.descripcion}
            onChange={e => set("descripcion", e.target.value)}
            placeholder="Describe los productos de esta categoría"
            onFocus={e => (e.target.style.borderColor = "#4caf50")}
            onBlur={e  => (e.target.style.borderColor = errors.descripcion ? "#e53935" : "#e0e0e0")}
          />
          {errors.descripcion && <p className="field-error">{errors.descripcion}</p>}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Estado</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Toggle value={form.estado} onChange={v => setForm(p => ({ ...p, estado: v }))} />
              <span style={{ fontSize: 13, fontWeight: 600, color: form.estado ? "#2e7d32" : "#9e9e9e" }}>
                {form.estado ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>
          {category?.fecha && (
            <div style={{ textAlign: "right", fontSize: 11, color: "#9e9e9e" }}>
              <p style={{ margin: 0 }}>Fecha de creación</p>
              <strong style={{ color: "#616161" }}>{category.fecha}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-save" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </ModalOverlay>
  );
}
