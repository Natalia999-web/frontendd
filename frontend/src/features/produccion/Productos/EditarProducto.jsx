// src/features/produccion/Productos/EditarProducto.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal de edición de producto conectado a la API real.
// Flujo:
//   1. Validar form (2 pasos)
//   2. PUT  /api/productos/{id}                       (datos del producto)
//   3. DELETE /api/productos/{id}/imagenes/{idImg}    (imágenes marcadas a borrar)
//   4. POST  /api/productos/{id}/imagenes             (archivos nuevos, si hay)
//   5. Llamar onSave() para que GestionProductos recargue
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef } from "react";
import { tieneLetras } from "../../../utils/inputFilters";
import CharCount from "../../../shared/components/CharCount";
import { ModalOverlay } from "./ui.jsx";
import {
  editarProducto as apiEditarProducto,
  subirImagenes,
  eliminarImagen,
} from "../../../services/productosService";
import { subirImagenCloudinary } from "../../../utils/cloudinary";
import "./Productos.css";

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const fmt = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n ?? 0);

/* ── Barra de pasos ───────────────────────────────────────────────────────── */
const STEPS = ["Información", "Precio, stock e imágenes"];

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

/* ── Toggle ───────────────────────────────────────────────────────────────── */
function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="toggle-btn"
      style={{
        background: value ? "#43a047" : "#bdbdbd",
        boxShadow: value ? "0 2px 8px rgba(67,160,71,0.4)" : "none",
      }}
    >
      <span className="toggle-thumb" style={{ left: value ? 27 : 3 }}>
        <span className="toggle-label">{value ? "ON" : ""}</span>
      </span>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════ */
export default function EditarProducto({ product, categorias = [], onClose, onSave, existingProducts = [] }) {
  const calcularCostoProduccion = null;
  const sugerirPrecioConGanancia = null;

  // ── Estado del form ──────────────────────────────────────────────────────
  // Separamos imágenes en tres grupos:
  //   imagenesExistentes → vienen de la API con { ID_Producto_Img, url }
  //   archivosNuevos     → File objects del <input> que el usuario acaba de agregar
  //   imagenesABorrar    → IDs de imágenes existentes que el usuario quitó
  const [form, setForm] = useState(() => ({
    nombre:              product.nombre ?? "",
    idCategoria:         String(product.idCategoria ?? ""),
    precio:              String(product.precio ?? ""),
    stockMinimo:         String(product.stockMinimo ?? "10"),
    activo:              product.activo !== false,
    publicado:           product.publicado !== false,
    requiereProduccion:  product.requiereProduccion ?? false,
    descripcion_corta:   product.descripcion_corta ?? "",
    descripcion_larga:   product.descripcion_larga ?? "",

    // Imágenes existentes (array de { ID_Producto_Img, url })
    imagenesExistentes: product.imagenesApi ?? [],

    // Nuevos archivos a subir (File objects)
    archivosNuevos: [],

    // IDs de imágenes existentes marcadas para borrar
    imagenesABorrar: [],

    // Previews combinados: URLs de existentes + base64 de nuevas
    // Mantenemos el mismo orden visual que el usuario ve
    imagenesPreview: (product.imagenesApi ?? []).map((img) => img.url).filter(Boolean),
  }));

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [step,   setStep]   = useState(1);
  const fileRef = useRef();

  /* ── Costos ── */
  const costoProduccion = calcularCostoProduccion
    ? calcularCostoProduccion(product)
    : 0;
  const precioSugerido = sugerirPrecioConGanancia
    ? sugerirPrecioConGanancia(costoProduccion)
    : 0;

  /* ── Setter genérico ──────────────────────────────────── */
  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    let err = "";
    if (v !== "" && v !== null) {
      if ((k === "descripcion_corta" || k === "descripcion_larga") && !tieneLetras(v)) err = "La descripción debe contener letras";
      if (k === "precio" && (isNaN(v) || Number(v) <= 0)) err = "Precio válido requerido";
      if (k === "stockMinimo" && (isNaN(v) || Number(v) < 0)) err = "Valor válido requerido";
      if (k === "stockMinimo" && !isNaN(v) && Number(v) > 99999) err = "Máximo 99 999 unidades";
    }
    setErrors((p) => ({ ...p, [k]: err }));
  };

  /* ── Imágenes ─────────────────────────────────────────── */
  const handleImgs = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setForm((p) => ({
          ...p,
          imagenesPreview: [...p.imagenesPreview, ev.target.result],
          archivosNuevos: [...p.archivosNuevos, file],
        }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  /**
   * Elimina una imagen del preview.
   * Si idx < imagenesExistentes.length → es una imagen existente: la marca para borrar.
   * Si idx >= imagenesExistentes.length → es una imagen nueva: la descarta.
   */
  const removeImg = (idx) => {
    const totalExistentes = form.imagenesExistentes.length;

    if (idx < totalExistentes) {
      // Imagen existente → marcar para borrar en la API
      const imgId = form.imagenesExistentes[idx].ID_Producto_Img;
      setForm((p) => ({
        ...p,
        imagenesExistentes: p.imagenesExistentes.filter((_, i) => i !== idx),
        imagenesPreview:    p.imagenesPreview.filter((_, i) => i !== idx),
        imagenesABorrar:    [...p.imagenesABorrar, imgId],
      }));
    } else {
      // Imagen nueva (base64) → simplemente descartar
      const newIdx = idx - totalExistentes;
      setForm((p) => ({
        ...p,
        archivosNuevos:  p.archivosNuevos.filter((_, i) => i !== newIdx),
        imagenesPreview: p.imagenesPreview.filter((_, i) => i !== idx),
      }));
    }
  };

  /* ── Validación ───────────────────────────────────────── */
  const validateStep = (s) => {
    const e = {};
    if (s === 1) {
      const nom = form.nombre?.trim().toLowerCase() ?? "";
      if (!form.nombre?.trim())  e.nombre = "Campo requerido";
      else if (existingProducts.some(p => p.nombre.trim().toLowerCase() === nom && p.id !== product?.id))
        e.nombre = "Ya existe un producto con este nombre";
      if (!form.idCategoria)     e.idCategoria = "Selecciona una categoría";
      if (form.descripcion_corta?.trim() && !tieneLetras(form.descripcion_corta))
        e.descripcion_corta = "La descripción debe contener letras";
      if (form.descripcion_larga?.trim() && !tieneLetras(form.descripcion_larga))
        e.descripcion_larga = "La descripción debe contener letras";
    }
    if (s === 2) {
      if (!form.precio || isNaN(form.precio) || Number(form.precio) <= 0)
        e.precio = "Precio válido requerido";
      if (form.stockMinimo === "" || isNaN(form.stockMinimo) || Number(form.stockMinimo) < 0)
        e.stockMinimo = "Valor válido requerido";
      else if (Number(form.stockMinimo) > 99999)
        e.stockMinimo = "Máximo 99 999 unidades";
    }
    return e;
  };

  const handleNext = () => {
    const e = validateStep(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setStep((s) => s + 1);
  };
  const handleBack = () => setStep((s) => s - 1);

  /* ── Guardar ──────────────────────────────────────────── */
  const handleSave = async () => {
    const e = validateStep(2);
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    setErrors({});

    try {
      const id = product.id;

      // ── 1. Editar datos del producto ────────────────────
      await apiEditarProducto(id, {
        nombre:               form.nombre.trim(),
        ID_Categoria:         Number(form.idCategoria),
        Precio_venta:         Number(form.precio),
        Stock_Minimo:         Number(form.stockMinimo),
        Estado:               form.activo ? 1 : 0,
        Publicado:            form.publicado ? 1 : 0,
        Requiere_Produccion:  form.requiereProduccion ? 1 : 0,
        Descripcion_Corta:    form.descripcion_corta.trim(),
        Descripcion_Larga:    form.descripcion_larga.trim(),
      });

      // ── 2. Borrar imágenes marcadas ─────────────────────
      if (form.imagenesABorrar.length > 0) {
        await Promise.all(
          form.imagenesABorrar.map((imgId) => eliminarImagen(id, imgId))
        );
      }

      // ── 3. Subir imágenes nuevas ────────────────────────
      if (form.archivosNuevos.length > 0) {
        const urls = await Promise.all(
          form.archivosNuevos.map(archivo => subirImagenCloudinary(archivo))
        );
        await subirImagenes(id, urls);
      }

      // ── 4. Notificar al padre ───────────────────────────
      onSave();
    } catch (err) {
      setErrors({ general: err.message || "Error al guardar los cambios" });
      setSaving(false);
    }
  };

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  return (
    <ModalOverlay onClose={onClose}>
      {/* Header */}
      <div className="modal-header">
        <div>
          <p className="modal-header__eyebrow">Productos</p>
          <h2 className="modal-header__title">Editar producto</h2>
        </div>
        <button className="modal-close-btn" onClick={onClose}>✕</button>
      </div>

      {/* Steps */}
      <div style={{ padding: "16px 24px 0" }}>
        <StepsBar current={step} />
      </div>

      {/* Body */}
      <div className="modal-body" style={{ overflow: "visible" }}>

        {/* Error general de API */}
        {errors.general && (
          <div
            style={{
              padding: "10px 14px", borderRadius: 9,
              background: "#ffebee", border: "1px solid #ef9a9a",
              color: "#c62828", fontSize: 13, fontWeight: 600, marginBottom: 14,
            }}
          >
            ⚠️ {errors.general}
          </div>
        )}

        {/* ── Paso 1: Información ── */}
        {step === 1 && (
          <div>
            <div className="form-group">
              <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Nombre</span>
                <CharCount value={form.nombre} max={100} min={2} />
              </label>
              <input
                className={`field-input${errors.nombre ? " field-input--error" : ""}`}
                value={form.nombre}
                maxLength={100}
                onChange={(e) => set("nombre", e.target.value)}
                placeholder="Ej. Tostones de plátano verde"
                onFocus={(e)  => (e.target.style.borderColor = "#4caf50")}
                onBlur={(e)   => (e.target.style.borderColor = errors.nombre ? "#e53935" : "#e0e0e0")}
              />
              {errors.nombre && <p className="field-error">{errors.nombre}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select
                className={`field-input${errors.idCategoria ? " field-input--error" : ""}`}
                value={form.idCategoria}
                onChange={(e) => set("idCategoria", e.target.value)}
                style={{ cursor: "pointer" }}
              >
                <option value="">— Seleccionar —</option>
                {categorias.map((c) => (
                  <option key={c.ID_Categoria} value={c.ID_Categoria}>
                    {c.Icono ?? "📦"} {c.Nombre_Categoria}
                  </option>
                ))}
              </select>
              {errors.idCategoria && (
                <p className="field-error">{errors.idCategoria}</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Estado</label>
              <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Toggle value={form.activo} onChange={(v) => set("activo", v)} />
                  <span className="estado-label" style={{ color: form.activo ? "#2e7d32" : "#9e9e9e" }}>
                    {form.activo ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Toggle value={form.publicado} onChange={(v) => set("publicado", v)} />
                  <span className="estado-label" style={{ color: form.publicado ? "#2e7d32" : "#9e9e9e" }}>
                    {form.publicado ? "Visible en la tienda" : "Oculto en la tienda"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Toggle value={form.requiereProduccion} onChange={(v) => set("requiereProduccion", v)}
                    title="Cuando el stock no alcanza, el déficit se convierte en orden de producción" />
                  <span className="estado-label" style={{ color: form.requiereProduccion ? "#1565c0" : "#9e9e9e" }}>
                    {form.requiereProduccion ? "Requiere producción" : "Stock directo"}
                  </span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Descripción corta</span>
                <CharCount value={form.descripcion_corta || ""} max={150} />
              </label>
              <input
                className={`field-input${errors.descripcion_corta ? " field-input--error" : ""}`}
                maxLength={150}
                value={form.descripcion_corta}
                onChange={(e) => set("descripcion_corta", e.target.value)}
                placeholder="Ej. Chips crocantes de plátano verde, perfectos para snack."
              />
              {errors.descripcion_corta && <p className="field-error">{errors.descripcion_corta}</p>}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Descripción larga</span>
                <CharCount value={form.descripcion_larga || ""} max={1000} />
              </label>
              <textarea
                className={`field-input${errors.descripcion_larga ? " field-input--error" : ""}`}
                rows={2}
                maxLength={1000}
                value={form.descripcion_larga}
                onChange={(e) => set("descripcion_larga", e.target.value)}
                placeholder="Descripción detallada del producto para la tienda..."
                style={{ resize: "none" }}
              />
              {errors.descripcion_larga && <p className="field-error">{errors.descripcion_larga}</p>}
            </div>
          </div>
        )}

        {/* ── Paso 2: Precio, stock e imágenes ── */}
        {step === 2 && (
          <div>
            {/* Bloque de costos */}
            {costoProduccion > 0 && (
              <div
                style={{
                  background: "#f9f9f9", border: "1px solid #e0e0e0",
                  borderRadius: 8, padding: "12px 16px", marginBottom: 16,
                }}
              >
                <p style={{ fontSize: 13, color: "#424242", margin: 0, fontWeight: 600 }}>
                  💰 Información de costos
                </p>
                <div
                  style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}
                >
                  <span style={{ fontSize: 12, color: "#757575" }}>Costo de producción:</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#2e7d32" }}>
                    {fmt(costoProduccion)}
                  </span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}
                >
                  <span style={{ fontSize: 12, color: "#757575" }}>
                    Precio sugerido (50% ganancia):
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1565c0" }}>
                    {fmt(precioSugerido)}
                  </span>
                </div>
                {Number(form.precio) < costoProduccion && (
                  <p
                    style={{ fontSize: 11, color: "#e65100", marginTop: 8, marginBottom: 0 }}
                  >
                    ⚠️ El precio actual es menor al costo de producción.
                  </p>
                )}
              </div>
            )}

            {/* Precio y stock mínimo */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Precio de venta</label>
                <div style={{ position: "relative" }}>
                  <span
                    style={{
                      position: "absolute", left: 12, top: "50%",
                      transform: "translateY(-50%)", color: "#9e9e9e",
                      fontSize: 13, pointerEvents: "none",
                    }}
                  >
                    $
                  </span>
                  <input
                    className={`field-input${errors.precio ? " field-input--error" : ""}`}
                    style={{ paddingLeft: 24 }}
                    type="text"
                    inputMode="numeric"
                    value={form.precio ? Number(form.precio).toLocaleString("es-CO") : ""}
                    onChange={(e) => set("precio", e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="0"
                    onFocus={(e) => (e.target.style.borderColor = "#4caf50")}
                    onBlur={(e)  => (e.target.style.borderColor = errors.precio ? "#e53935" : "#e0e0e0")}
                  />
                </div>
                {errors.precio && <p className="field-error">{errors.precio}</p>}
              </div>

              {/* Stock actual (solo lectura) */}
              <div className="form-group">
                <label className="form-label">Stock actual</label>
                <input
                  className="field-input"
                  type="number"
                  disabled
                  value={product.stock ?? 0}
                  style={{ background: "#f5f5f5", cursor: "not-allowed" }}
                />
                <p style={{ fontSize: 10, color: "#9e9e9e", marginTop: 4 }}>
                  Actualizado por producción
                </p>
              </div>
            </div>

            {/* Stock mínimo */}
            <div className="form-group">
              <label className="form-label">
                Stock mínimo{" "}
                <span style={{ color: "#9e9e9e", fontWeight: 400, marginLeft: 4, fontSize: 11 }}>
                  (el estado se ajusta automáticamente)
                </span>
              </label>
              <input
                className={`field-input${errors.stockMinimo ? " field-input--error" : ""}`}
                type="number"
                min="0"
                value={form.stockMinimo}
                onChange={(e) => set("stockMinimo", e.target.value)}
                placeholder="Ej. 10"
                onFocus={(e) => (e.target.style.borderColor = "#4caf50")}
                onBlur={(e)  => (e.target.style.borderColor = errors.stockMinimo ? "#e53935" : "#e0e0e0")}
              />
              {errors.stockMinimo && (
                <p className="field-error">{errors.stockMinimo}</p>
              )}
            </div>

            {/* Imágenes */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Imágenes del producto</label>

              {/* Grid de previews */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                {form.imagenesPreview.map((url, idx) => {
                  const esExistente = idx < form.imagenesExistentes.length;
                  return (
                    <div
                      key={idx}
                      style={{
                        position: "relative", width: 80, height: 80,
                        borderRadius: 10, overflow: "hidden",
                        border: `1px solid ${esExistente ? "#c8e6c9" : "#90caf9"}`,
                      }}
                    >
                      <img
                        src={url}
                        alt="preview"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      {/* Indicador de imagen nueva */}
                      {!esExistente && (
                        <span
                          style={{
                            position: "absolute", bottom: 2, left: 2,
                            fontSize: 8, fontWeight: 700, color: "#fff",
                            background: "#1565c0", padding: "1px 4px", borderRadius: 4,
                          }}
                        >
                          NUEVA
                        </span>
                      )}
                      <button
                        onClick={() => removeImg(idx)}
                        style={{
                          position: "absolute", top: 2, right: 2,
                          background: "rgba(255,255,255,0.85)", border: "none",
                          borderRadius: "50%", width: 18, height: 18,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, cursor: "pointer", color: "#c62828",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}

                {/* Botón agregar */}
                <div
                  onClick={() => fileRef.current.click()}
                  style={{
                    width: 80, height: 80, borderRadius: 10,
                    border: "1.5px dashed #a5d6a7", background: "#f1f8f1",
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", cursor: "pointer", gap: 2, flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 22, fontWeight: 300, color: "#43a047", lineHeight: 1 }}>+</span>
                  <span style={{ fontSize: 9, color: "#66bb6a", fontWeight: 600 }}>Subir</span>
                </div>
              </div>

              {/* Info de cambios pendientes */}
              {(form.imagenesABorrar.length > 0 || form.archivosNuevos.length > 0) && (
                <div
                  style={{
                    fontSize: 11, color: "#757575", background: "#f9f9f9",
                    padding: "6px 10px", borderRadius: 7, border: "1px solid #e0e0e0",
                  }}
                >
                  {form.imagenesABorrar.length > 0 && (
                    <span style={{ color: "#c62828", marginRight: 8 }}>
                      🗑 {form.imagenesABorrar.length} imagen{form.imagenesABorrar.length !== 1 ? "es" : ""} a eliminar
                    </span>
                  )}
                  {form.archivosNuevos.length > 0 && (
                    <span style={{ color: "#1565c0" }}>
                      ➕ {form.archivosNuevos.length} imagen{form.archivosNuevos.length !== 1 ? "es" : ""} a subir
                    </span>
                  )}
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={handleImgs}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="modal-footer">
        {step > 1 ? (
          <button className="btn-ghost" onClick={handleBack}>← Atrás</button>
        ) : (
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        )}
        {step < 2 ? (
          <button className="btn-save" onClick={handleNext}>Siguiente →</button>
        ) : (
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="spinner">⏳</span> Guardando…
              </span>
            ) : (
              "Guardar cambios"
            )}
          </button>
        )}
      </div>
    </ModalOverlay>
  );
}