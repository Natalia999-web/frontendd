import { useState } from "react";
import { X } from "lucide-react";
import { ModalOverlay } from "./ui.jsx";
import EmojiPicker from "../../../shared/components/EmojiPicker";
import CharCount from "../../../shared/components/CharCount";
import "./CategoriaInsumos.css";
import { soloLetras, tieneLetras, esRepetitivo } from "../../../utils/inputFilters";

export default function CrearCategoriaInsumo({ onClose, onSave, existingCategories = [] }) {
  const [form, setForm]   = useState({ nombre: "", descripcion: "", icon: "🥬" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    let err = "";
    if (k === "nombre") {
      const t = v.trim();
      if (!t)                             err = "Campo requerido";
      else if (t.length < 2)              err = "Mínimo 2 caracteres";
      else if (esRepetitivo(v))           err = "El nombre no puede ser texto repetitivo";
      else if (existingCategories.some(c => c.nombre.trim().toLowerCase() === t.toLowerCase()))
        err = "Ya existe una categoría con este nombre";
    }
    if (k === "descripcion") {
      const t = v.trim();
      if (!t)                             err = "Campo requerido";
      else if (t.length < 5)              err = "Mínimo 5 caracteres";
      else if (!tieneLetras(v))           err = "La descripción debe contener letras";
      else if (esRepetitivo(v))           err = "La descripción no puede ser texto repetitivo";
    }
    if (k === "icon") {
      if (existingCategories.some(c => c.icon === v))
        err = "Este icono ya está en uso por otra categoría";
    }
    setErrors(p => ({ ...p, [k]: err }));
  };

  const validate = () => {
    const e = {};
    const nom = form.nombre.trim().toLowerCase();
    if (!form.nombre.trim())                        e.nombre = "Campo requerido";
    else if (form.nombre.trim().length < 2)         e.nombre = "Mínimo 2 caracteres";
    else if (esRepetitivo(form.nombre))             e.nombre = "El nombre no puede ser texto repetitivo";
    else if (existingCategories.some(c => c.nombre.trim().toLowerCase() === nom))
      e.nombre = "Ya existe una categoría con este nombre";
    if (!form.descripcion.trim())                   e.descripcion = "Campo requerido";
    else if (form.descripcion.trim().length < 5)    e.descripcion = "Mínimo 5 caracteres";
    else if (!tieneLetras(form.descripcion))        e.descripcion = "La descripción debe contener letras";
    else if (esRepetitivo(form.descripcion))        e.descripcion = "La descripción no puede ser texto repetitivo";
    if (existingCategories.some(c => c.icon === form.icon))
      e.icon = "Este icono ya está en uso por otra categoría";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await onSave({
        Nombre_Categoria: form.nombre.trim(),
        Descripcion:      form.descripcion.trim(),
        Icono:            form.icon,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal-header">
        <div>
          <p className="modal-header__eyebrow">Categorías de Insumos</p>
          <h2 className="modal-header__title">Nueva categoría</h2>
        </div>
        <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="modal-body">
        <EmojiPicker value={form.icon} onChange={ic => set("icon", ic)} />
        {errors.icon && <p className="field-error" style={{ marginTop: -6, marginBottom: 8 }}>{errors.icon}</p>}

        <div className="form-group">
          <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Nombre <span style={{ color: "#e53935", fontWeight: 800 }}>*</span></span>
            <CharCount value={form.nombre} max={50} min={2} />
          </label>
          <input
            className={`field-input${errors.nombre ? " field-input--error" : ""}`}
            value={form.nombre}
            maxLength={50}
            onChange={e => set("nombre", soloLetras(e.target.value))}
            placeholder="Ej. Vegetales"
            onFocus={e  => (e.target.style.borderColor = "#4caf50")}
            onBlur={e   => (e.target.style.borderColor = errors.nombre ? "#e53935" : "#e0e0e0")}
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
            placeholder="Describe esta categoría de insumos"
            onFocus={e  => (e.target.style.borderColor = "#4caf50")}
            onBlur={e   => (e.target.style.borderColor = errors.descripcion ? "#e53935" : "#e0e0e0")}
          />
          {errors.descripcion && <p className="field-error">{errors.descripcion}</p>}
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-save" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </ModalOverlay>
  );
}
