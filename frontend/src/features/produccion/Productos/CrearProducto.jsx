// src/features/produccion/Productos/CrearProducto.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal de creación de producto conectado a la API real.
// Flujo:
//   1. Validar form (2 pasos)
//   2. POST /api/productos/  con los datos del producto
//   3. POST /api/productos/{id}/imagenes  con los archivos File (si hay)
//   4. Llamar onSave() para que GestionProductos recargue la lista
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef } from "react";
import { tieneLetras } from "../../../utils/inputFilters";
import CharCount from "../../../shared/components/CharCount";
import SearchableSelect from "../../../shared/components/SearchableSelect.jsx";
import CrearFicha from "./ficha_tecnica/CrearFicha.jsx";
import {
  crearProducto as apiCrearProducto,
  subirImagenes,
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

/* ══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════ */
export default function CrearProducto({ categorias = [], onClose, onSave, existingProducts = [] }) {
  const calcularCostoProduccion = () => 0;
  const sugerirPrecioConGanancia = () => 0;

  const [form, setForm] = useState({
    nombre:              "",
    idCategoria:         "",
    precio:              "",
    stockMinimo:         "10",
    descripcion_corta:   "",
    descripcion_larga:   "",
    activo:              true,
    publicado:           true,
    requiereProduccion:  false,
    archivos:            [], // File objects reales para subir a la API
    imagenesPreview:     [], // base64 para mostrar en la UI
    ficha:               null,
  });
  const [errors,    setErrors]    = useState({});
  const [saving,    setSaving]    = useState(false);
  const [showFicha, setShowFicha] = useState(false);
  const [step,      setStep]      = useState(1);
  const fileRef = useRef();

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    let err = "";
    if (k === "nombre") {
      const t = v.trim();
      if (!t) err = "El nombre es obligatorio";
      else if (t.length < 2) err = "Mínimo 2 caracteres";
      else if (existingProducts.some(p => p.nombre.trim().toLowerCase() === t.toLowerCase()))
        err = "Ya existe un producto con este nombre";
    }
    if (k === "idCategoria" && !v) err = "Selecciona una categoría";
    if (k === "precio") {
      if (v === "" || v === null) err = "El precio es obligatorio";
      else if (isNaN(v) || Number(v) <= 0) err = "Precio válido requerido";
      else if (Number(v) < 100) err = "El precio mínimo es $100";
    }
    if (k === "stockMinimo") {
      if (v === "" || v === null) err = "El stock mínimo es obligatorio";
      else if (isNaN(v) || Number(v) < 0) err = "Valor válido requerido";
      else if (Number(v) > 99999) err = "Máximo 99 999 unidades";
    }
    if ((k === "descripcion_corta" || k === "descripcion_larga") && v.trim() && !tieneLetras(v)) {
      err = "La descripción debe contener letras";
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
          archivos:        [...p.archivos, file],
        }));
      };
      reader.readAsDataURL(file);
    });
    // Resetear el input para permitir volver a seleccionar el mismo archivo
    e.target.value = "";
  };

  const removeImg = (idx) => {
    setForm((p) => ({
      ...p,
      imagenesPreview: p.imagenesPreview.filter((_, i) => i !== idx),
      archivos:        p.archivos.filter((_, i) => i !== idx),
    }));
  };

  /* ── Validación por paso ──────────────────────────────── */
  const validateStep = (s) => {
    const e = {};
    if (s === 1) {
      const nom = form.nombre.trim().toLowerCase();
      if (!form.nombre.trim()) e.nombre = "El nombre es obligatorio";
      else if (existingProducts.some(p => p.nombre.trim().toLowerCase() === nom))
        e.nombre = "Ya existe un producto con este nombre";
      if (!form.idCategoria)   e.idCategoria = "Selecciona una categoría";
      if (form.descripcion_corta.trim() && !tieneLetras(form.descripcion_corta))
        e.descripcion_corta = "La descripción debe contener letras";
      if (form.descripcion_larga.trim() && !tieneLetras(form.descripcion_larga))
        e.descripcion_larga = "La descripción debe contener letras";
    }
    if (s === 2) {
      if (!form.precio || isNaN(form.precio) || Number(form.precio) <= 0)
        e.precio = "Precio válido requerido";
      else if (Number(form.precio) < 100)
        e.precio = "El precio mínimo es $100";
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
      // ── 1. Crear el producto en la API ──────────────────
      const payload = {
        nombre:            form.nombre.trim(),
        ID_Categoria:      Number(form.idCategoria),
        Precio_venta:      Number(form.precio),
        Stock:             0,
        Stock_Minimo:      Number(form.stockMinimo),
        Descripcion_Corta:    form.descripcion_corta.trim(),
        Descripcion_Larga:    form.descripcion_larga.trim(),
        Publicado:            form.publicado ? 1 : 0,
        Requiere_Produccion:  form.requiereProduccion ? 1 : 0,
        ...(form.ficha
          ? {
              ficha_tecnica: {
                Version:       form.ficha.version        ?? null,
                Observaciones: form.ficha.observaciones  ?? null,
                Procedimiento: form.ficha.procedimiento  ?? null,
              },
            }
          : {}),
      };

      const productoCreado = await apiCrearProducto(payload);

      // ── 2. Subir imágenes (si el usuario seleccionó alguna) ──
      if (form.archivos.length > 0) {
        const urls = await Promise.all(
          form.archivos.map(archivo => subirImagenCloudinary(archivo))
        );
        await subirImagenes(productoCreado.ID_Producto, urls);
      }

      // ── 3. Notificar al padre para que recargue ─────────
      onSave(productoCreado);
    } catch (err) {
      setErrors({ general: err.message || "Error al guardar el producto" });
      setSaving(false);
    }
  };

  /* ── Info de costos (usando funciones del contexto) ────── */
  const costoProduccion = form.ficha ? calcularCostoProduccion({ ficha: form.ficha }) : 0;
  const precioSugerido  = sugerirPrecioConGanancia
    ? sugerirPrecioConGanancia(costoProduccion)
    : 0;

  const catSeleccionada = categorias.find((c) => c.ID_Categoria === Number(form.idCategoria));

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-card"
          style={{ maxWidth: 500 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="modal-header">
            <div>
              <p className="modal-header__eyebrow">Productos</p>
              <h2 className="modal-header__title">Nuevo producto</h2>
            </div>
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          </div>

          {/* Steps */}
          <div style={{ padding: "16px 24px 0" }}>
            <StepsBar current={step} />
          </div>

          {/* Body */}
          <div className="modal-body" style={{ minHeight: 260 }}>

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
                    <span>Nombre <span className="required">*</span></span>
                    <CharCount value={form.nombre} max={100} min={2} />
                  </label>
                  <input
                    className={`field-input${errors.nombre ? " error" : ""}`}
                    value={form.nombre}
                    maxLength={100}
                    onChange={(e) => set("nombre", e.target.value)}
                    placeholder="Ej. Tostones de plátano verde"
                    onBlur={(e) => {
                      if (!e.target.value.trim())
                        setErrors((p) => ({ ...p, nombre: "El nombre es obligatorio" }));
                    }}
                  />
                  {errors.nombre && <p className="field-error">{errors.nombre}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Categoría <span className="required">*</span>
                  </label>
                  <SearchableSelect
                    options={categorias}
                    value={form.idCategoria}
                    onChange={e => set("idCategoria", e.target.value)}
                    getValue={c => c.ID_Categoria}
                    getLabel={c => `${c.Icono ?? "📦"} ${c.Nombre_Categoria}`}
                    placeholder="— Seleccionar —"
                    searchPlaceholder="🔍 Buscar categoría…"
                    className={`field-input${errors.idCategoria ? " error" : ""}`}
                  />
                  {errors.idCategoria && (
                    <p className="field-error">{errors.idCategoria}</p>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Descripción corta</span>
                    <CharCount value={form.descripcion_corta} max={150} />
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

                <div className="form-group">
                  <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Descripción larga</span>
                    <CharCount value={form.descripcion_larga} max={1000} />
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

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Estado</label>
                  <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => set("activo", !form.activo)}
                        style={{
                          width: 52, height: 28, borderRadius: 14, border: "none",
                          background: form.activo ? "#43a047" : "#bdbdbd",
                          position: "relative", cursor: "pointer", transition: "background 0.2s",
                        }}
                      >
                        <span style={{
                          position: "absolute", top: 3,
                          left: form.activo ? 26 : 3,
                          width: 22, height: 22, borderRadius: "50%",
                          background: "#fff", transition: "left 0.2s",
                        }} />
                      </button>
                      <span style={{ fontSize: 13, color: form.activo ? "#2e7d32" : "#9e9e9e" }}>
                        {form.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => set("publicado", !form.publicado)}
                        style={{
                          width: 52, height: 28, borderRadius: 14, border: "none",
                          background: form.publicado ? "#43a047" : "#bdbdbd",
                          position: "relative", cursor: "pointer", transition: "background 0.2s",
                        }}
                      >
                        <span style={{
                          position: "absolute", top: 3,
                          left: form.publicado ? 26 : 3,
                          width: 22, height: 22, borderRadius: "50%",
                          background: "#fff", transition: "left 0.2s",
                        }} />
                      </button>
                      <span style={{ fontSize: 13, color: form.publicado ? "#2e7d32" : "#9e9e9e" }}>
                        {form.publicado ? "Visible en la tienda" : "Oculto en la tienda"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => set("requiereProduccion", !form.requiereProduccion)}
                        style={{
                          width: 52, height: 28, borderRadius: 14, border: "none",
                          background: form.requiereProduccion ? "#1565c0" : "#bdbdbd",
                          position: "relative", cursor: "pointer", transition: "background 0.2s",
                        }}
                      >
                        <span style={{
                          position: "absolute", top: 3,
                          left: form.requiereProduccion ? 26 : 3,
                          width: 22, height: 22, borderRadius: "50%",
                          background: "#fff", transition: "left 0.2s",
                        }} />
                      </button>
                      <span style={{ fontSize: 13, color: form.requiereProduccion ? "#1565c0" : "#9e9e9e" }}>
                        {form.requiereProduccion ? "Requiere producción" : "Stock directo"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Paso 2: Precio, stock e imágenes ── */}
            {step === 2 && (
              <div>
                {/* Bloque de costos (solo si hay ficha con costo calculado) */}
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
                      style={{
                        display: "flex", justifyContent: "space-between", marginTop: 8,
                      }}
                    >
                      <span style={{ fontSize: 12, color: "#757575" }}>
                        Costo de producción:
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#2e7d32" }}>
                        {fmt(costoProduccion)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex", justifyContent: "space-between", marginTop: 4,
                      }}
                    >
                      <span style={{ fontSize: 12, color: "#757575" }}>
                        Precio sugerido (50% ganancia):
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#1565c0" }}>
                        {fmt(precioSugerido)}
                      </span>
                    </div>
                    {form.precio && Number(form.precio) < costoProduccion && (
                      <p
                        style={{
                          fontSize: 11, color: "#e65100", marginTop: 8, marginBottom: 0,
                        }}
                      >
                        ⚠️ El precio es menor al costo de producción.
                      </p>
                    )}
                  </div>
                )}

                {/* Precio y stock mínimo */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      Precio venta <span className="required">*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <span style={{
                        position: "absolute", left: 12, top: "50%",
                        transform: "translateY(-50%)", color: "#9e9e9e",
                        fontSize: 13, pointerEvents: "none",
                      }}>$</span>
                      <input
                        className={`field-input${errors.precio ? " error" : ""}`}
                        style={{ paddingLeft: 24 }}
                        type="text"
                        inputMode="numeric"
                        value={form.precio ? form.precio.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ""}
                        onChange={(e) => set("precio", e.target.value.replace(/[^\d]/g, ""))}
                        placeholder="0"
                      />
                    </div>
                    {errors.precio && <p className="field-error">{errors.precio}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Stock mín. <span className="required">*</span>
                    </label>
                    <input
                      className={`field-input${errors.stockMinimo ? " error" : ""}`}
                      type="number"
                      min="0"
                      value={form.stockMinimo}
                      onChange={(e) => set("stockMinimo", e.target.value)}
                      placeholder="10"
                    />
                    {errors.stockMinimo && (
                      <p className="field-error">{errors.stockMinimo}</p>
                    )}
                  </div>
                </div>

                {/* Ficha técnica */}
                <div className="form-group">
                  <button
                    className={`btn-ghost${form.ficha ? " active" : ""}`}
                    onClick={() => setShowFicha(true)}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    {form.ficha
                      ? "📋 Ficha técnica configurada ✓"
                      : "📋 Configurar ficha técnica"}
                  </button>
                </div>

                {/* Imágenes */}
                <div className="form-group">
                  <label className="form-label">Imágenes</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {form.imagenesPreview.map((img, i) => (
                      <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                        <img
                          src={img}
                          alt={`preview-${i}`}
                          style={{
                            width: 50, height: 50, borderRadius: 8, objectFit: "cover",
                            border: "1px solid #c8e6c9",
                          }}
                        />
                        <button
                          onClick={() => removeImg(i)}
                          style={{
                            position: "absolute", top: -4, right: -4,
                            background: "#c62828", color: "#fff",
                            border: "none", borderRadius: "50%",
                            width: 16, height: 16, fontSize: 10,
                            cursor: "pointer", display: "flex",
                            alignItems: "center", justifyContent: "center",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => fileRef.current.click()}
                      style={{
                        width: 50, height: 50, borderRadius: 8,
                        border: "1.5px dashed #a5d6a7", background: "#f1f8f1",
                        color: "#43a047", fontSize: 22, fontWeight: 300, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      +
                    </button>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleImgs}
                  />
                  {form.archivos.length > 0 && (
                    <p style={{ fontSize: 11, color: "#9e9e9e", marginTop: 4 }}>
                      {form.archivos.length} imagen{form.archivos.length !== 1 ? "es" : ""} seleccionada{form.archivos.length !== 1 ? "s" : ""}
                    </p>
                  )}
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
              <button
                className="btn-save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="spinner">⏳</span> Guardando…
                  </span>
                ) : (
                  "Guardar"
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ficha técnica se monta encima sin desmontar CrearProducto */}
      {showFicha && (
        <CrearFicha
          productoNombre={form.nombre}
          productoCategoria={catSeleccionada?.Nombre_Categoria ?? ""}
          onClose={() => setShowFicha(false)}
          onSave={(ficha) => { set("ficha", ficha); setShowFicha(false); }}
        />
      )}
    </>
  );
}