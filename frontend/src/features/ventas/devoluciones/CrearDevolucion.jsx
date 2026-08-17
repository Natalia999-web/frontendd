import { useState, useRef, useEffect } from "react";
import { getPedidos } from "../../../services/pedidosService.js";
import "./Devoluciones.css";

const fmt = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

const MOTIVOS = [
  "Producto en mal estado",
  "Producto incorrecto",
  "Producto vencido",
  "No cumple con lo solicitado",
  "Error en el pedido",
  "Otro",
];

function SelectArrow() {
  return (
    <div className="select-arrow">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

/* ─── BARRA DE PASOS ─────────────────────────────────────── */
const STEPS = ["Pedido", "Detalles devolución"];

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

/* ─── UPLOAD DE EVIDENCIA ────────────────────────────────── */
function EvidenciaUpload({ evidencia, onEvidencia }) {
  const fileRef = useRef();
  const [dragging, setDragging] = useState(false);

  const processFile = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) =>
      onEvidencia({ nombre: file.name, base64: ev.target.result, tipo: file.type });
    r.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  const isImage = evidencia?.tipo?.startsWith("image/");

  if (evidencia) {
    return (
      <div className="evidencia-preview">
        {isImage ? (
          <img src={evidencia.base64} alt="evidencia" className="evidencia-preview__img" />
        ) : (
          <div className="evidencia-preview__file">
            <span className="evidencia-preview__file-icon">
              {evidencia.tipo?.startsWith("video/") ? "🎥" : "📄"}
            </span>
            <span className="evidencia-preview__file-name">{evidencia.nombre}</span>
          </div>
        )}
        <div className="evidencia-preview__bar">
          <span className="evidencia-preview__name">📎 {evidencia.nombre}</span>
          <button
            className="evidencia-preview__remove"
            onClick={() => onEvidencia(null)}
            data-tooltip="Quitar evidencia adjunta"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`evidencia-dropzone${dragging ? " dragging" : ""}`}
      onClick={() => fileRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <span className="evidencia-dropzone__icon">📎</span>
      <span className="evidencia-dropzone__text">
        Arrastra un archivo o <strong>haz clic para seleccionar</strong>
      </span>
      <span className="evidencia-dropzone__hint">Imágenes, PDF, video · Opcional</span>
      <input
        ref={fileRef}
        type="file"
        style={{ display: "none" }}
        accept="image/*,application/pdf,video/*"
        onChange={(e) => processFile(e.target.files[0])}
      />
    </div>
  );
}

/* ─── ITEM DE PRODUCTO ───────────────────────────────────── */
function ProdItem({ item, idx, onSet }) {
  return (
    <div className="prod-dev-row">
      <div className="prod-dev-row__info">
        <div className="prod-dev-row__name">{item.nombre}</div>
        <div className="prod-dev-row__meta">
          {fmt(item.precio)} c/u · disponibles: {item.cantMax}
        </div>
      </div>

      <div className="prod-dev-row__qty-wrap">
        <button
          className="qty-btn"
          onClick={() => onSet(idx, item.cantidad - 1)}
          disabled={item.cantidad === 0}
        >−</button>
        <input
          className="qty-input"
          type="number"
          min={0}
          max={item.cantMax}
          value={item.cantidad}
          onChange={(e) => onSet(idx, e.target.value)}
        />
        <button
          className="qty-btn"
          onClick={() => onSet(idx, item.cantidad + 1)}
          disabled={item.cantidad >= item.cantMax}
        >+</button>
      </div>

      <div className="prod-dev-row__sub">
        {item.cantidad > 0 ? fmt(item.precio * item.cantidad) : "—"}
      </div>
    </div>
  );
}

/* ─── COMPONENTE PRINCIPAL ───────────────────────────────── */
export default function CrearDevolucion({ onClose, onSave, saving }) {
  const [pedidosEntregados, setPedidosEntregados] = useState([]);
  const [loadError,         setLoadError]         = useState("");

  useEffect(() => {
    getPedidos({ porPagina: 100, estado: 8 })
      .then(data => setPedidosEntregados(data.pedidos || []))
      .catch(err => setLoadError(err?.message || "Error al cargar pedidos entregados"));
  }, []);

  const [idPedido,   setIdPedido]   = useState("");
  const [motivo,     setMotivo]     = useState("");
  const [comentario, setComentario] = useState("");
  const [evidencia,  setEvidencia]  = useState(null);
  const [items,      setItems]      = useState([]);
  const [errors,     setErrors]     = useState({});
  const [step,       setStep]       = useState(1);

  const pedidoSel = pedidosEntregados.find((p) => String(p.id) === String(idPedido));

  const handleSelectPedido = (val) => {
    setIdPedido(val);
    setErrors((e) => ({ ...e, idPedido: val ? "" : "Debes seleccionar un pedido para registrar la devolución" }));
    const ped = pedidosEntregados.find((p) => String(p.id) === String(val));
    if (ped) {
      setItems(
        (ped.productosItems || []).map((p) => ({
          idProducto: p.idProducto,
          nombre:     p.nombre,
          precio:     p.precio,
          cantMax:    p.cantidad,
          cantidad:   0,
        }))
      );
    } else {
      setItems([]);
    }
  };

  const setCantidad = (idx, val) => {
    const n = Math.max(0, Math.min(items[idx].cantMax, Number(val) || 0));
    setItems((prev) => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], cantidad: n };
      const hasAny = arr.some(i => i.cantidad > 0);
      setErrors((e) => ({ ...e, items: hasAny ? "" : "Selecciona al menos un producto y la cantidad a devolver" }));
      return arr;
    });
  };

  const itemsSeleccionados = items.filter((i) => i.cantidad > 0);
  const totalDevolucion    = itemsSeleccionados.reduce((a, i) => a + i.precio * i.cantidad, 0);

  const validateStep = (s) => {
    const e = {};
    if (s === 1 && !idPedido) {
      e.idPedido = "Debes seleccionar un pedido para registrar la devolución";
    }
    if (s === 2) {
      if (!motivo) {
        e.motivo = "Selecciona el motivo de la devolución";
      }
      if (itemsSeleccionados.length === 0) {
        e.items = "Selecciona al menos un producto y la cantidad a devolver";
      }
    }
    return e;
  };

  const handleNext = () => {
    const e = validateStep(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => s - 1);

  const handleSave = () => {
    const e = validateStep(2);
    if (Object.keys(e).length) { setErrors(e); return; }
    const payload = {
      idPedido:     pedidoSel.id,
      numeroPedido: pedidoSel.numero,
      idCliente:    pedidoSel.idCliente,
      cliente:      pedidoSel.cliente,
      motivo,
      comentario,
      productos:    itemsSeleccionados.map((i) => ({
        idProducto:     i.idProducto,
        nombre:         i.nombre,
        cantidad:       i.cantidad,
        precioUnitario: i.precio,
        subtotal:       i.precio * i.cantidad,
      })),
      totalDevuelto: totalDevolucion,
      evidencia:     evidencia || null,
    };

    onSave(payload);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Devoluciones</p>
            <h2 className="modal-header__title" style={{ color: "#c62828" }}>
              Registrar devolución
            </h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Steps */}
        <div style={{ padding: "16px 24px 0" }}>
          <StepsBar current={step} />
        </div>

        <div className="modal-body" style={{ overflowY: "auto" }}>

          {/* ── Paso 1: Pedido ── */}
          {step === 1 && (
            <>
              <p className="section-label" style={{ textTransform: "none", marginTop: 0 }}>
                Seleccionar Pedido
              </p>
              {loadError && (
                <div style={{ padding: "10px 14px", background: "#ffebee", border: "1px solid #ef9a9a", borderRadius: 10, color: "#c62828", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                  ⚠️ {loadError}
                </div>
              )}
              <div className="field-wrap">
                <label className="field-label">
                  Pedido entregado <span className="required">*</span>
                </label>
                <div className="select-wrap">
                  <select
                    className={`field-select${errors.idPedido ? " error" : ""}`}
                    value={idPedido}
                    onChange={(e) => handleSelectPedido(e.target.value)}
                  >
                    <option value="">
                      {pedidosEntregados.length === 0 && !loadError
                        ? "Cargando pedidos…"
                        : pedidosEntregados.length === 0
                        ? "Sin pedidos entregados disponibles"
                        : "Seleccione un pedido…"}
                    </option>
                    {pedidosEntregados.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.numero} — {p.cliente?.nombre}
                      </option>
                    ))}
                  </select>
                  <SelectArrow />
                </div>
                {errors.idPedido && (
                  <span className="field-error">{errors.idPedido}</span>
                )}
              </div>

              {pedidoSel && (
                <div className="info-box info-box--info" style={{ marginTop: 16 }}>
                  <span className="info-box__icon">📦</span>
                  <div className="info-box__text">
                    <span className="info-box__label">
                      {pedidoSel.numero} · {pedidoSel.cliente?.nombre}
                    </span>
                    Total pagado: {fmt(pedidoSel.total)} · {pedidoSel.metodo_pago}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Paso 2: Detalles ── */}
          {step === 2 && (
            <>
              {/* Productos */}
              <p className="section-label" style={{ textTransform: "none", marginTop: 0 }}>
                Productos a devolver
              </p>

              <div className="prod-dev-list">
                {/* Encabezado de columnas */}
                <div className="prod-dev-list__header">
                  <span>Producto</span>
                  <span style={{ textAlign: "center" }}>Cantidad</span>
                  <span style={{ textAlign: "right" }}>Subtotal</span>
                </div>

                {items.map((item, idx) => (
                  <ProdItem key={idx} item={item} idx={idx} onSet={setCantidad} />
                ))}
              </div>

              {errors.items && (
                <p className="field-error" style={{ marginTop: 6 }}>{errors.items}</p>
              )}

              {/* Total + Motivo */}
              <div className="form-grid-2" style={{ marginTop: 16 }}>
                <div className="field-wrap">
                  <label className="field-label">
                    Motivo <span className="required">*</span>
                  </label>
                  <div className="select-wrap">
                    <select
                      className={`field-select${errors.motivo ? " error" : ""}`}
                      value={motivo}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMotivo(val);
                        setErrors((prev) => ({ ...prev, motivo: val ? "" : "Selecciona el motivo de la devolución" }));
                      }}
                    >
                      <option value="">Seleccione…</option>
                      {MOTIVOS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <SelectArrow />
                  </div>
                  {errors.motivo && (
                    <span className="field-error">{errors.motivo}</span>
                  )}
                </div>

                <div className="field-wrap">
                  <label className="field-label">Total a devolver</label>
                  <div className="total-devolucion-val">
                    {fmt(totalDevolucion)}
                  </div>
                </div>
              </div>

              {/* Comentario */}
              <div className="field-wrap" style={{ marginTop: 12 }}>
                <label className="field-label">Comentario (opcional)</label>
                <textarea
                  className="field-textarea"
                  rows={2}
                  placeholder="Describe el problema con más detalle…"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                />
              </div>

              {/* Evidencia */}
              <div className="field-wrap" style={{ marginTop: 12 }}>
                <label className="field-label">Evidencia (opcional)</label>
                <EvidenciaUpload evidencia={evidencia} onEvidencia={setEvidencia} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          {step > 1 ? (
            <button className="btn-ghost" onClick={handleBack}>← Atrás</button>
          ) : (
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            {step < 2 ? (
              <button className="btn-save" onClick={handleNext}>Siguiente →</button>
            ) : (
              <button
                className="btn-save"
                style={{ background: "#c62828" }}
                onClick={handleSave}
                disabled={saving || totalDevolucion === 0}
              >
                {saving ? "Guardando…" : "Registrar"}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}