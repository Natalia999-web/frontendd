import { useState, useEffect, useRef } from "react";
import { getProveedores } from "../../../services/proveedoresService.js";
import { getInsumos } from "../../../services/insumosService.js";
import SearchableSelect from "../../../shared/components/SearchableSelect.jsx";
import "./compras.css";

const METODOS_PAGO = [
  { value: "efectivo",      label: "Efectivo",      icon: "💵" },
  { value: "transferencia", label: "Transferencia", icon: "🏦" },
];

const COP = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const UNIDADES = [
  { id: 1, nombre: "Kilogramo", simbolo: "kg"   },
  { id: 2, nombre: "Gramo",     simbolo: "g"    },
  { id: 3, nombre: "Litro",     simbolo: "L"    },
  { id: 4, nombre: "Mililitro", simbolo: "ml"   },
  { id: 5, nombre: "Unidad",    simbolo: "uds." },
  { id: 6, nombre: "Libra",     simbolo: "lb"   },
];

const GRUPO_UNIDAD = { 1: "masa", 2: "masa", 6: "masa", 3: "vol", 4: "vol", 5: "und" };

// Cantidad máx 10 000 por línea; total entre $1 000 y $50 000 000 COP
const CANT_MAX  = 10_000;
const TOTAL_MIN = 1_000;
const TOTAL_MAX = 50_000_000;

const unidadesDelGrupo = (idUnidadBase) => {
  const grupo = GRUPO_UNIDAD[Number(idUnidadBase)];
  if (!grupo) return [];
  return UNIDADES.filter(u => GRUPO_UNIDAD[u.id] === grupo);
};

const emptyDetalle = () => ({
  _key:             Date.now() + Math.random(),
  idInsumo:         "",
  idUnidad:         "",
  cantidad:         "",
  precioUnd:        "",
  notas:            "",
  vencimientoTipo:  "dias",
  vencimientoValor: "30",
  fechaVencimiento: "",
  isExpanded:       true,
});

const STEPS = [
  { idx: 1, label: "Información general" },
  { idx: 2, label: "Insumos comprados"   },
  { idx: 3, label: "Gastos adicionales"  },
];

function StepsBar({ current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "14px 28px", flexShrink: 0, background: "#fff", borderBottom: "1px solid #f0f0f0" }}>
      {STEPS.map((s, i) => {
        const done   = current > s.idx;
        const active = current === s.idx;
        return (
          <div key={s.idx} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", border: `2px solid ${active || done ? "#2e7d32" : "#d0d0d0"}`, background: done ? "#2e7d32" : "#fff", color: active ? "#2e7d32" : done ? "#fff" : "#bdbdbd", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
              {done ? "✓" : s.idx}
            </div>
            <span style={{ marginLeft: 10, fontSize: 14, fontWeight: active ? 700 : 500, color: active ? "#2e7d32" : done ? "#9e9e9e" : "#bdbdbd", whiteSpace: "nowrap", transition: "color 0.2s" }}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1.5, background: done ? "#2e7d32" : "#e0e0e0", margin: "0 14px", transition: "background 0.2s" }} />}
          </div>
        );
      })}
    </div>
  );
}

function InsumoSelect({ value, insumosActivos, idsSeleccionados, onChange, error }) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef  = useRef(null);
  const inputRef = useRef(null);

  const selected = insumosActivos.find(i => String(i.id) === String(value));

  const filtered = insumosActivos.filter(i =>
    i.nombre.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setOpen(o => !o);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1 }}>
      <button
        type="button"
        onClick={handleOpen}
        className={`field-select ${error ? "error" : ""}`}
        style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: selected ? "#222" : "#9e9e9e", flex: 1 }}>
          {selected
            ? `${selected.nombre}${selected.unidad ? ` (${selected.unidad})` : ""}`
            : "— Seleccionar insumo —"}
        </span>
        <span style={{ color: "#9e9e9e", flexShrink: 0 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#fff", border: "1.5px solid #d0e8d0", borderRadius: 10,
          boxShadow: "0 8px 28px rgba(0,0,0,0.13)", zIndex: 200, overflow: "hidden",
        }}>
          {/* Buscador */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderBottom: "1px solid #f0f0f0", background: "#fafdf9" }}>
            <span style={{ fontSize: 13, color: "#9e9e9e" }}>🔍</span>
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar insumo…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent", color: "#333", fontFamily: "inherit" }}
            />
            {query && (
              <button type="button" onClick={() => setQuery("")}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#bdbdbd", fontSize: 14, padding: 0, lineHeight: 1 }}>
                ✕
              </button>
            )}
          </div>

          {/* Lista */}
          <div style={{ maxHeight: 210, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "12px", fontSize: 12, color: "#9e9e9e", textAlign: "center" }}>
                Sin resultados para "{query}"
              </div>
            ) : filtered.map(ins => {
              const isSelected = String(ins.id) === String(value);
              const isDisabled = idsSeleccionados.includes(String(ins.id)) && !isSelected;
              return (
                <button
                  key={ins.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => { onChange(ins); setOpen(false); setQuery(""); }}
                  style={{
                    width: "100%", textAlign: "left", padding: "8px 12px",
                    border: "none", background: isSelected ? "#e8f5e9" : "transparent",
                    color: isDisabled ? "#bdbdbd" : isSelected ? "#2e7d32" : "#333",
                    fontSize: 13, cursor: isDisabled ? "not-allowed" : "pointer",
                    fontWeight: isSelected ? 700 : 400,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    fontFamily: "inherit",
                  }}
                >
                  <span>{ins.nombre}</span>
                  {ins.unidad && (
                    <span style={{ fontSize: 11, color: isDisabled ? "#d0d0d0" : "#9e9e9e", flexShrink: 0, marginLeft: 8 }}>
                      {ins.unidad}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CrearCompra({ onClose, onSave }) {
  const [proveedores,  setProveedores]  = useState([]);
  const [insumosActivos, setInsumosActivos] = useState([]);

  useEffect(() => {
    getProveedores({ porPagina: 100 }).then(d => setProveedores(d.proveedores || d || [])).catch(() => {});
    getInsumos({ porPagina: 100 }).then(d => {
      const lista = (d.insumos || d || []).map(i => ({
        id:        i.ID_Insumo || i.id,
        nombre:    i.Nombre    || i.nombre    || "",
        unidad:    i.simbolo_unidad || i.unidad || "",
        idUnidad:  i.Unidad_Medida  || i.idUnidad || null,
        estado:    i.Estado !== 0,
      }));
      setInsumosActivos(lista.filter(i => i.estado));
    }).catch(() => {});
  }, []);

  const [form, setForm] = useState({
    idProveedor: "",
    fecha:       new Date().toISOString().split("T")[0],
    estado:      "pendiente",
    metodoPago:  "",
    notas:       "",
  });

  const [comprobante, setComprobante] = useState(null);

  const [gastos, setGastos] = useState({
    transporte: "",
    iva:        "", // se entenderá como porcentaje
    descuento:  "", // se entenderá como porcentaje
    otros:      "",
  });

  const setGasto = (k, v) => setGastos(g => ({ ...g, [k]: v }));

  const [detalles, setDetalles] = useState([emptyDetalle()]);
  const [errors,   setErrors]   = useState({});
  const [saving,   setSaving]   = useState(false);
  const [step,     setStep]     = useState(1);

  const subtotalInsumos = detalles.reduce((s, d) => s + (Number(d.cantidad) || 0) * (Number(d.precioUnd) || 0), 0);

  // Cálculos de porcentajes
  const valorIva = (subtotalInsumos * (Number(gastos.iva) || 0)) / 100;
  const valorDescuento = (subtotalInsumos * (Number(gastos.descuento) || 0)) / 100;

  const totalGastosExtras =
    (Number(gastos.transporte) || 0) +
    valorIva -
    valorDescuento +
    (Number(gastos.otros)      || 0);

  const totalActual = subtotalInsumos + totalGastosExtras;

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    const hoy = new Date().toISOString().split("T")[0];
    let err = "";
    if (k === "idProveedor" && !v) err = "Selecciona un proveedor";
    if (k === "fecha") {
      if (!v) err = "Ingresa la fecha";
      else if (v < hoy) err = "La fecha no puede ser anterior a hoy";
    }
    if (k === "metodoPago" && !v) err = "Selecciona el método de pago";
    setErrors(e => ({ ...e, [k]: err }));
  };

  const setDetalle = (key, field, value) => {
    setDetalles(ds => ds.map((d, i) => {
      if (d._key !== key) return d;
      const updated = { ...d, [field]: value };
      let err = "";
      if (field === "idInsumo" && !value) err = "Selecciona un insumo";
      if (field === "cantidad") {
        const n = Number(value);
        const grupo = GRUPO_UNIDAD[Number(d.idUnidad)];
        const soloEntero = grupo === "und";
        if (!value || n <= 0) err = "Cantidad inválida";
        else if (soloEntero && !Number.isInteger(n)) err = "La cantidad debe ser un número entero";
        else if (n > CANT_MAX) err = `Máximo ${CANT_MAX.toLocaleString("es-CO")} por línea`;
      }
      if (field === "precioUnd") {
        if (!value || Number(value) <= 0) err = "El precio unitario debe ser mayor a $0";
      }
      if (field === "fechaVencimiento" && updated.vencimientoTipo === "fecha" && !value) err = "Ingresa la fecha";
      if (field === "vencimientoValor" && updated.vencimientoTipo === "dias" && (!value || Number(value) <= 0)) err = "Ingresa los días";

      const errKey = field === "idInsumo" ? `ins_${i}`
        : field === "cantidad" ? `cant_${i}`
        : field === "precioUnd" ? `precio_${i}`
        : (field === "fechaVencimiento" || field === "vencimientoValor") ? `venc_${i}`
        : null;
      if (errKey) {
        setErrors(prev => ({ ...prev, [errKey]: err }));
      }
      return updated;
    }));
  };

  const toggleExpand = (key) =>
    setDetalles(ds => ds.map(d => d._key === key ? { ...d, isExpanded: !d.isExpanded } : d));

  const addDetalle = () => {
    setDetalles(ds => [
      ...ds.map(d => ({ ...d, isExpanded: false })),
      emptyDetalle(),
    ]);
  };

  const removeDetalle = (key) => setDetalles(ds => ds.filter(d => d._key !== key));

  const idsSeleccionados = detalles.map(d => String(d.idInsumo)).filter(Boolean);

  const validateStep1 = () => {
    const e = {};
    const hoy = new Date().toISOString().split("T")[0];
    if (!form.idProveedor)  e.idProveedor = "Selecciona un proveedor";
    if (!form.fecha)        e.fecha       = "Ingresa la fecha";
    else if (form.fecha < hoy) e.fecha    = "La fecha no puede ser anterior a hoy";
    if (!form.metodoPago)  e.metodoPago  = "Selecciona el método de pago";
    return e;
  };

  const validateStep2 = () => {
    const e = {};
    if (detalles.length === 0) e.detalles = "Agrega al menos un insumo";
    detalles.forEach((d, i) => {
      const n = Number(d.cantidad);
      const grupo = GRUPO_UNIDAD[Number(d.idUnidad)];
      const soloEntero = grupo === "und";
      if (!d.idInsumo)
        e[`ins_${i}`] = "Selecciona un insumo";
      if (!d.cantidad || n <= 0)
        e[`cant_${i}`] = "Cantidad inválida";
      else if (soloEntero && !Number.isInteger(n))
        e[`cant_${i}`] = "La cantidad debe ser un número entero para esta unidad";
      else if (n > CANT_MAX)
        e[`cant_${i}`] = `Máximo ${CANT_MAX.toLocaleString("es-CO")} por línea`;
      if (!d.precioUnd || Number(d.precioUnd) <= 0)
        e[`precio_${i}`] = "El precio unitario debe ser mayor a $0";
      if (d.vencimientoTipo === "fecha" && !d.fechaVencimiento)
        e[`venc_${i}`] = "Ingresa la fecha";
      else if (d.vencimientoTipo === "dias" && (!d.vencimientoValor || Number(d.vencimientoValor) <= 0))
        e[`venc_${i}`] = "Ingresa los días";
    });
    return e;
  };

  const handleNextStep = () => {
    let e = {};
    if (step === 1) e = validateStep1();
    if (step === 2) e = validateStep2();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setStep(s => s + 1);
  };

  const handleBack = () => setStep(s => s - 1);

  const validateTotal = () => {
    const e = {};
    if (totalActual < TOTAL_MIN)
      e.total = `El total (${COP(totalActual)}) debe ser al menos ${COP(TOTAL_MIN)} COP`;
    else if (totalActual > TOTAL_MAX)
      e.total = `El total (${COP(totalActual)}) supera el máximo permitido de ${COP(TOTAL_MAX)} COP`;
    return e;
  };

  const handleSave = async () => {
    if (saving) return;
    const e = { ...validateStep1(), ...validateStep2(), ...validateTotal() };
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      const detallesLimpios = detalles.map(d => ({
        idInsumo:         Number(d.idInsumo),
        idUnidad:         d.idUnidad ? Number(d.idUnidad) : null,
        cantidad:         Number(d.cantidad),
        precioUnd:        Number(d.precioUnd),
        notas:            (d.notas || "").trim(),
        fechaVencimiento: d.vencimientoTipo === "dias"
          ? (() => { const f = new Date(); f.setDate(f.getDate() + Number(d.vencimientoValor)); return f.toISOString().split("T")[0]; })()
          : d.fechaVencimiento || null,
      }));
      onSave({
        ...form,
        detalles: detallesLimpios,
        comprobante:  comprobante || null,
        gastos: {
          transporte: Number(gastos.transporte) || 0,
          iva:        valorIva,
          descuento:  valorDescuento,
          otros:      Number(gastos.otros)      || 0,
          ivaPorcentaje: Number(gastos.iva) || 0,
          descPorcentaje: Number(gastos.descuento) || 0,
        },
        totalConGastos: totalActual,
      });
    } catch (err) {
      console.error("Error saving purchase:", err);
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          /* ── FIX 1: modal más ancho ── */
          maxWidth: 860,
          width: "95vw",
          display: "flex",
          flexDirection: "column",
          maxHeight: "92vh",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0, padding: "18px 28px" }}>
          <div>
            <p className="modal-header__eyebrow">Compras</p>
            <h2 className="modal-header__title">Nueva Compra</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} style={{ flexShrink: 0 }}>✕</button>
        </div>

        <StepsBar current={step} />

        {/* Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "22px 28px" }}>

          {/* ── PASO 1 ── */}
          {step === 1 && (
            <>
              <div className="field-wrap">
                <label className="field-label">Proveedor <span className="required">*</span></label>
                <SearchableSelect
                  options={proveedores}
                  value={form.idProveedor}
                  onChange={e => set("idProveedor", e.target.value)}
                  getValue={p => p.ID_Proveedor || p.id}
                  getLabel={p => `${p.Responsable || p.responsable || ""} · ${p.Municipio || p.ciudad || ""}`}
                  placeholder="— Seleccionar proveedor —"
                  searchPlaceholder="🔍 Buscar proveedor…"
                  className="field-select"
                  error={!!errors.idProveedor}
                />
                {errors.idProveedor && <span className="field-error">{errors.idProveedor}</span>}
              </div>

              <div className="field-grid-2">
                <div className="field-wrap">
                  <label className="field-label">Fecha de compra <span className="required">*</span></label>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    className={`field-input ${errors.fecha ? "error" : ""}`}
                    value={form.fecha}
                    onChange={e => set("fecha", e.target.value)}
                  />
                  {errors.fecha && <span className="field-error">{errors.fecha}</span>}
                </div>
                <div className="field-wrap">
                  <label className="field-label">Método de pago <span className="required">*</span></label>
                  <SearchableSelect
                    options={METODOS_PAGO}
                    value={form.metodoPago}
                    onChange={e => { set("metodoPago", e.target.value); setComprobante(null); }}
                    getValue={m => m.value}
                    getLabel={m => `${m.icon} ${m.label}`}
                    placeholder="— Seleccionar método —"
                    searchPlaceholder="🔍 Método…"
                    className={`field-select ${errors.metodoPago ? "error" : ""}`}
                  />
                  {errors.metodoPago && <span className="field-error">{errors.metodoPago}</span>}
                </div>
              </div>

              {form.metodoPago === "transferencia" && (
                <div className="field-wrap comprobante-wrap">
                  <label className="field-label">Comprobante de transferencia</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <label className="comprobante-upload-btn" style={{ flex: 1 }}>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        style={{ display: "none" }}
                        onChange={e => setComprobante(e.target.files?.[0] || null)}
                      />
                      <span className="comprobante-upload-icon">📎</span>
                      {comprobante
                        ? <span className="comprobante-filename">{comprobante.name}</span>
                        : <span>Adjuntar comprobante (imagen o PDF)</span>
                      }
                    </label>
                    {comprobante && (
                      <button
                        type="button"
                        onClick={e => { e.preventDefault(); setComprobante(null); }}
                        style={{ flexShrink: 0, padding: "0 12px", height: 36, borderRadius: 8, border: "1.5px solid #ef5350", background: "#fff", color: "#c62828", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        ✕ Quitar
                      </button>
                    )}
                  </div>
                  <span className="field-hint">Opcional — puedes adjuntarlo ahora o más tarde</span>
                </div>
              )}

              <div className="field-wrap">
                <label className="field-label">Notas</label>
                <textarea
                  className="field-input field-textarea"
                  placeholder="Observaciones generales…"
                  rows={2}
                  value={form.notas}
                  onChange={e => set("notas", e.target.value)}
                />
              </div>
            </>
          )}

          {/* ── PASO 2 ── */}
          {step === 2 && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#616161" }}>Insumos comprados</p>
                {errors.detalles && <span className="field-error">{errors.detalles}</span>}
              </div>

              {detalles.map((d, i) => {
                const insSelect = insumosActivos.find(ins => String(ins.id) === String(d.idInsumo));
                return (
                <div key={d._key} style={{ border: "1px solid #e8e8e8", borderRadius: 10, padding: "10px 12px", marginBottom: 8, background: "#fafafa" }}>

                  {/* Línea 1: selector + botón eliminar */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#9e9e9e", flexShrink: 0, minWidth: 20 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <InsumoSelect
                      value={d.idInsumo}
                      insumosActivos={insumosActivos}
                      idsSeleccionados={idsSeleccionados}
                      error={errors[`ins_${i}`]}
                      onChange={ins => {
                        setDetalles(ds => ds.map(det =>
                          det._key === d._key
                            ? { ...det, idInsumo: String(ins.id), idUnidad: ins.idUnidad ? String(ins.idUnidad) : "" }
                            : det
                        ));
                      }}
                    />
                    <button className="detalle-remove-btn" type="button" onClick={() => removeDetalle(d._key)}>✕</button>
                  </div>
                  {errors[`ins_${i}`] && <span className="field-error" style={{ marginBottom: 6, display: "block" }}>{errors[`ins_${i}`]}</span>}

                  {/* Línea 2: cantidad | precio | vencimiento (toggle + valor) */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, paddingLeft: 28 }}>

                    {/* Cantidad + unidad */}
                    <div>
                      <label className="field-label" style={{ fontSize: 10 }}>Cantidad</label>
                      <div style={{ display: "flex", gap: 4 }}>
                        {(() => {
                          const grupoActual = GRUPO_UNIDAD[Number(d.idUnidad)];
                          const soloEntero = grupoActual === "und";
                          return (
                            <input
                              type="number"
                              className={`field-input ${errors[`cant_${i}`] ? "error" : ""}`}
                              placeholder="0"
                              min="0.001"
                              max={CANT_MAX}
                              step={soloEntero ? "1" : "0.001"}
                              value={d.cantidad}
                              onChange={e => {
                                const v = e.target.value;
                                setDetalle(d._key, "cantidad", v);
                              }}
                              style={{ flex: 1, minWidth: 0 }}
                            />
                          );
                        })()}
                        {(() => {
                          const opciones = insSelect ? unidadesDelGrupo(insSelect.idUnidad) : [];
                          if (opciones.length <= 1) {
                            return insSelect?.unidad
                              ? <span style={{ display: "flex", alignItems: "center", padding: "0 8px", background: "#f5f5f5", border: "1.5px solid #e8e8e8", borderRadius: 7, fontSize: 11, color: "#555", fontWeight: 700, flexShrink: 0 }}>{insSelect.unidad}</span>
                              : null;
                          }
                          return (
                            <select
                              value={d.idUnidad}
                              onChange={e => setDetalle(d._key, "idUnidad", e.target.value)}
                              style={{ flexShrink: 0, width: 68, borderRadius: 7, border: "1.5px solid #e0e0e0", background: "#fff", fontSize: 12, fontWeight: 700, color: "#333", cursor: "pointer", padding: "0 4px" }}
                            >
                              {opciones.map(u => (
                                <option key={u.id} value={String(u.id)}>{u.simbolo}</option>
                              ))}
                            </select>
                          );
                        })()}
                      </div>
                      {errors[`cant_${i}`] && <span className="field-error" style={{ fontSize: 10 }}>{errors[`cant_${i}`]}</span>}
                    </div>

                    {/* Precio unitario */}
                    <div>
                      <label className="field-label" style={{ fontSize: 10 }}>Precio unitario</label>
                      <input
                        type="number"
                        className={`field-input ${errors[`precio_${i}`] ? "error" : ""}`}
                        placeholder="$ 0"
                        value={d.precioUnd}
                        onChange={e => {
                          const v = e.target.value;
                          setDetalle(d._key, "precioUnd", v);
                        }}
                      />
                      {errors[`precio_${i}`] && <span className="field-error" style={{ fontSize: 10 }}>{errors[`precio_${i}`]}</span>}
                    </div>

                    {/* Vencimiento — toggle + input en una sola línea */}
                    <div>
                      <label className="field-label" style={{ fontSize: 10 }}>Vencimiento</label>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button type="button"
                          onClick={() => setDetalle(d._key, "vencimientoTipo", "dias")}
                          style={{ flexShrink: 0, padding: "0 8px", height: 36, borderRadius: 7, border: `1.5px solid ${d.vencimientoTipo === "dias" ? "#4caf50" : "#e0e0e0"}`, background: d.vencimientoTipo === "dias" ? "#e8f5e9" : "#fff", color: d.vencimientoTipo === "dias" ? "#2e7d32" : "#9e9e9e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Días
                        </button>
                        <button type="button"
                          onClick={() => setDetalle(d._key, "vencimientoTipo", "fecha")}
                          style={{ flexShrink: 0, padding: "0 8px", height: 36, borderRadius: 7, border: `1.5px solid ${d.vencimientoTipo === "fecha" ? "#4caf50" : "#e0e0e0"}`, background: d.vencimientoTipo === "fecha" ? "#e8f5e9" : "#fff", color: d.vencimientoTipo === "fecha" ? "#2e7d32" : "#9e9e9e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Fecha
                        </button>
                        {d.vencimientoTipo === "dias" ? (
                          <input type="number" className="field-input" style={{ flex: 1 }}
                            placeholder="30" value={d.vencimientoValor}
                            onChange={e => setDetalle(d._key, "vencimientoValor", e.target.value)} />
                        ) : (
                          <input type="date" className={`field-input ${errors[`venc_${i}`] ? "error" : ""}`} style={{ flex: 1 }}
                            value={d.fechaVencimiento}
                            onChange={e => setDetalle(d._key, "fechaVencimiento", e.target.value)} />
                        )}
                      </div>
                      {errors[`venc_${i}`] && <span className="field-error" style={{ fontSize: 10 }}>{errors[`venc_${i}`]}</span>}
                    </div>

                  </div>
                </div>
              );
              })}

              <button className="btn-add-detalle" type="button" onClick={addDetalle} style={{ marginTop: 4 }}>
                + Agregar insumo
              </button>
            </>
          )}

          {/* ── PASO 3 ── */}
          {step === 3 && (
            <>
              <div style={{ marginBottom: 18 }}>
                <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#616161" }}>
                  Gastos adicionales
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#9e9e9e" }}>
                  Ingresa los porcentajes para IVA y Descuento; el sistema calculará el valor automáticamente.
                </p>
              </div>

              <div className="gastos-grid gastos-grid--standalone">
                <div className="field-wrap">
                  <label className="field-label">🚚 Transporte</label>
                  <input type="number" className="field-input" placeholder="$ 0" value={gastos.transporte} onChange={e => setGasto("transporte", e.target.value)} />
                </div>
                <div className="field-wrap">
                  <label className="field-label">🧾 IVA (%)</label>
                  <div style={{ position: "relative" }}>
                    <input type="number" className="field-input" placeholder="0" value={gastos.iva} onChange={e => setGasto("iva", e.target.value)} style={{ paddingRight: 30 }} />
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#9e9e9e", fontWeight: 700 }}>%</span>
                  </div>
                  {valorIva > 0 && <span className="field-hint" style={{ color: "#2e7d32", fontWeight: 600 }}>+ {COP(valorIva)}</span>}
                </div>
                <div className="field-wrap">
                  <label className="field-label">🏷️ Descuento (%)</label>
                  <div style={{ position: "relative" }}>
                    <input type="number" className="field-input gastos-descuento-input" placeholder="0" value={gastos.descuento} onChange={e => setGasto("descuento", e.target.value)} style={{ paddingRight: 30 }} />
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#c62828", fontWeight: 700 }}>%</span>
                  </div>
                  {valorDescuento > 0 && <span className="field-hint" style={{ color: "#c62828", fontWeight: 600 }}>− {COP(valorDescuento)}</span>}
                </div>
                <div className="field-wrap">
                  <label className="field-label">➕ Otros costos</label>
                  <input type="number" className="field-input" placeholder="$ 0" value={gastos.otros} onChange={e => setGasto("otros", e.target.value)} />
                </div>
              </div>

              <div className="total-desglose" style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span style={{ color: "#757575" }}>Subtotal insumos</span>
                  <span style={{ fontWeight: 600 }}>{COP(subtotalInsumos)}</span>
                </div>
                {Number(gastos.transporte) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ color: "#757575" }}>+ Transporte</span>
                    <span style={{ color: "#2e7d32" }}>{COP(Number(gastos.transporte))}</span>
                  </div>
                )}
                {valorIva > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ color: "#757575" }}>+ IVA ({gastos.iva}%)</span>
                    <span style={{ color: "#2e7d32" }}>{COP(valorIva)}</span>
                  </div>
                )}
                {valorDescuento > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ color: "#757575" }}>− Descuento ({gastos.descuento}%)</span>
                    <span style={{ color: "#c62828" }}>{COP(valorDescuento)}</span>
                  </div>
                )}
                {Number(gastos.otros) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ color: "#757575" }}>+ Otros</span>
                    <span style={{ color: "#2e7d32" }}>{COP(Number(gastos.otros))}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: "14px 28px 20px", borderTop: "1px solid #f5f5f5" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="total-bar" style={{ margin: 0 }}>
              <span className="total-bar__label">Total</span>
              <span className="total-bar__value" style={{ color: errors.total ? "#c62828" : undefined }}>
                {COP(totalActual || 0)}
              </span>
              {errors.total && (
                <span className="field-error" style={{ display: "block", fontSize: 11, marginTop: 2 }}>
                  {errors.total}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {step > 1
                ? <button className="btn-ghost" onClick={handleBack}>← Volver</button>
                : <button className="btn-ghost" onClick={onClose}>Cancelar</button>
              }
              <button
                className="btn-save"
                onClick={step < 3 ? handleNextStep : handleSave}
                disabled={saving}
              >
                {saving ? "Guardando…" : step < 3 ? "Siguiente →" : "Guardar compra"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}