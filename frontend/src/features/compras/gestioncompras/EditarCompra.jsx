import { useState, useEffect } from "react";
import { getProveedores } from "../../../services/proveedoresService.js";
import { getInsumos, getLotesInsumo } from "../../../services/insumosService.js";
import { fmtFecha } from "../../../utils/dateUtils";
import "./compras.css";

const CANT_MAX  = 10_000;
const TOTAL_MIN = 1_000;
const TOTAL_MAX = 50_000_000;

const METODOS_PAGO = [
  { value: "efectivo",      label: "Efectivo",      icon: "💵" },
  { value: "transferencia", label: "Transferencia", icon: "🏦" },
];

const COP = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

const calcularTotal = (items) =>
  (items || []).reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.precioUnd) || 0), 0);

const sumarDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + Number(n));
  return d.toISOString().split("T")[0];
};

const diasHasta = (fecha) => {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(fecha) - hoy) / (1000 * 60 * 60 * 24));
};

const UNIDADES = [
  { id: 1, nombre: "Kilogramo", simbolo: "kg"   },
  { id: 2, nombre: "Gramo",     simbolo: "g"    },
  { id: 3, nombre: "Litro",     simbolo: "L"    },
  { id: 4, nombre: "Mililitro", simbolo: "ml"   },
  { id: 5, nombre: "Unidad",    simbolo: "uds." },
  { id: 6, nombre: "Libra",     simbolo: "lb"   },
];

const GRUPO_UNIDAD = { 1: "masa", 2: "masa", 6: "masa", 3: "vol", 4: "vol", 5: "und" };

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

/* ── Panel de lotes ─────────────────────────────────────── */
export function LotesInsumoPanel() {
  return (
    <div className="lotes-empty">
      <span>📦</span>
      <p>No hay lotes registrados para este insumo todavía.</p>
      <p className="lotes-empty__sub">Los lotes se crean automáticamente al completar una compra.</p>
    </div>
  );
}

/* ── Modal anular ───────────────────────────────────────── */
export function AnularCompraModal({ compra, onClose, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const [checked,    setChecked]    = useState(false);

  const handleConfirm = async () => {
    if (!checked) return;
    setConfirming(true);
    await onConfirm(compra.id);
    setConfirming(false);
  };

  const yaCompletada = compra.stockAplicado === true || compra.estado === "completada";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()}>
        <div style={{ padding: "28px 24px 18px", textAlign: "center" }}>
          <div className="delete-icon-wrap">🚫</div>
          <h3 className="delete-title">Anular compra #{compra.id}</h3>
          {yaCompletada ? (
            <div className="stock-aviso stock-aviso--block" style={{ marginTop: 12, textAlign: "left" }}>
              <p style={{ margin: "0 0 6px" }}>
                ⚠️ Esta compra ya fue <strong>completada</strong> y su stock fue aplicado al inventario.
                Al anularla, el sistema intentará <strong>revertir el stock</strong> de cada insumo.
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#b71c1c" }}>
                Si algún insumo ya fue consumido en producción, la anulación será bloqueada para evitar inventario negativo.
              </p>
            </div>
          ) : (
            <p className="delete-body" style={{ marginTop: 8 }}>
              La compra está <strong>pendiente</strong> — el stock aún no fue aplicado.
              La anulación no afectará el inventario.
            </p>
          )}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 18, textAlign: "left", cursor: "pointer", fontSize: 13, color: "#424242" }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              style={{ marginTop: 2, accentColor: "#c62828", flexShrink: 0 }}
            />
            Entiendo las consecuencias y confirmo la anulación.
          </label>
        </div>
        <div className="modal-footer modal-footer--center">
          <button className="btn-ghost" onClick={onClose} disabled={confirming}>Cancelar</button>
          <button
            className="btn-danger"
            onClick={handleConfirm}
            disabled={!checked || confirming}
          >
            {confirming ? "Anulando…" : "Confirmar Anulación"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── EditarCompra / VerCompra ───────────────────────────── */
export default function EditarCompra({ compra, mode, onClose, onSave }) {
  const [proveedores,    setProveedores]    = useState([]);
  const [insumosActivos, setInsumosActivos] = useState([]);

  useEffect(() => {
    getProveedores({ porPagina: 100 })
      .then(d => setProveedores(d.proveedores || d || []))
      .catch(() => {});
    getInsumos({ porPagina: 100 })
      .then(d => {
        const lista = (d.insumos || d || []).map(i => ({
          id:       i.ID_Insumo || i.id,
          nombre:   i.Nombre    || i.nombre || "",
          unidad:   i.simbolo_unidad || i.unidad || "",
          idUnidad: i.Unidad_Medida  || i.idUnidad || null,
          estado:   i.Estado !== 0,
        }));
        setInsumosActivos(lista.filter(i => i.estado));
      })
      .catch(() => {});
  }, []);

  const getInsumoById    = (id) => insumosActivos.find(i => i.id === Number(id)) || null;
  const getProveedorById = (id) => proveedores.find(p => (p.ID_Proveedor || p.id) === id || (p.ID_Proveedor || p.id) === Number(id)) || null;

  const isView   = mode === "view";
  const isLocked = compra.stockAplicado === true;

  // Estado para el tab del detalle (solo se usa en isView)
  const [viewTab,      setViewTab]      = useState("resumen");
  const [lotesMap,     setLotesMap]     = useState({});
  const [lotesLoading, setLotesLoading] = useState(false);

  useEffect(() => {
    if (!isView || viewTab !== "lotes") return;
    if (Object.keys(lotesMap).length > 0) return;
    const ids = (compra.items || []).map(i => i.idInsumo).filter(Boolean);
    if (!ids.length) return;
    setLotesLoading(true);
    Promise.all(
      ids.map(id =>
        getLotesInsumo(id)
          .then(d => ({ id, lotes: Array.isArray(d) ? d : (d.lotes || []) }))
          .catch(() => ({ id, lotes: [] }))
      )
    )
      .then(res => {
        const map = {};
        res.forEach(({ id, lotes }) => { map[id] = lotes; });
        setLotesMap(map);
      })
      .finally(() => setLotesLoading(false));
  }, [viewTab, isView]);

  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    idProveedor:   compra.idProveedor  || "",
    fecha:         compra.fecha        || "",
    estado:        compra.estado       || "pendiente",
    metodoPago:    compra.metodoPago   || "",
    notas:         String(compra.notas || ""),
    fecha_llegada: compra.fecha_llegada || "",
  });

  const [comprobante, setComprobante] = useState(null);

  const [detalles, setDetalles] = useState(
    (compra.items || []).map(d => ({
      ...d,
      _key:             d.idInsumo || Date.now() + Math.random(),
      vencimientoTipo:  "fecha",
      vencimientoValor: "30",
      isExpanded:       false,
    }))
  );

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    let err = "";
    if (k === "idProveedor" && !v) err = "Selecciona un proveedor";
    if (k === "fecha" && !v) err = "Ingresa la fecha";
    if (k === "metodoPago" && !v) err = "Selecciona el método de pago";
    setErrors(e => ({ ...e, [k]: err }));
  };

  const setDetalle = (key, field, value) =>
    setDetalles(ds => ds.map((d, i) => {
      if (d._key !== key) return d;
      const updated = { ...d, [field]: value };
      let err = "";
      if (field === "idInsumo" && !value) err = "Selecciona un insumo";
      if (field === "cantidad") {
        const n = Number(value);
        const grupo = GRUPO_UNIDAD[Number(updated.idUnidad)];
        const soloEntero = grupo === "und";
        if (!value || n <= 0) err = "Cantidad inválida";
        else if (soloEntero && !Number.isInteger(n)) err = "La cantidad debe ser un número entero";
        else if (n > CANT_MAX) err = `Máximo ${CANT_MAX.toLocaleString("es-CO")} por línea`;
      }
      if (field === "precioUnd") {
        if (!value || Number(value) <= 0) err = "El precio unitario debe ser mayor a $0";
      }
      const errKey = field === "idInsumo" ? `ins_${i}`
        : field === "cantidad" ? `cant_${i}`
        : field === "precioUnd" ? `precio_${i}`
        : null;
      if (errKey) {
        setErrors(prev => ({ ...prev, [errKey]: err }));
      }
      return updated;
    }));
  const toggleExpand = (key) =>
    setDetalles(ds => ds.map(d => d._key === key ? { ...d, isExpanded: !d.isExpanded } : d));
  const addDetalle   = () =>
    setDetalles(ds => [...ds.map(d => ({ ...d, isExpanded: false })), emptyDetalle()]);
  const removeDetalle = (key) =>
    setDetalles(ds => ds.filter(d => d._key !== key));

  const idsSeleccionados = detalles.map(d => String(d.idInsumo)).filter(Boolean);

  const totalActual = calcularTotal(
    detalles.map(d => ({ cantidad: Number(d.cantidad) || 0, precioUnd: Number(d.precioUnd) || 0 }))
  );

  const handleNextStep = () => {
    const e = {};
    if (!form.idProveedor) e.idProveedor = "Selecciona un proveedor";
    if (!form.fecha)       e.fecha       = "Ingresa la fecha";
    if (!form.metodoPago)  e.metodoPago  = "Selecciona el método de pago";
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setStep(2);
  };

  const handleSave = async () => {
    if (saving) return;
    const errores = {};
    detalles.forEach((d, i) => {
      const n = Number(d.cantidad);
      const grupo = GRUPO_UNIDAD[Number(d.idUnidad)];
      const soloEntero = grupo === "und";
      if (!d.cantidad || n <= 0)
        errores[`cant_${i}`] = "Cantidad inválida";
      else if (soloEntero && !Number.isInteger(n))
        errores[`cant_${i}`] = "La cantidad debe ser un número entero";
      else if (n > CANT_MAX)
        errores[`cant_${i}`] = `Máximo ${CANT_MAX.toLocaleString("es-CO")} por línea`;
      if (!d.precioUnd || Number(d.precioUnd) <= 0)
        errores[`precio_${i}`] = "El precio unitario debe ser mayor a $0";
    });

    // Validar total incluyendo los gastos existentes de la compra
    const subtotalItems = detalles.reduce(
      (s, d) => s + (Number(d.cantidad) || 0) * (Number(d.precioUnd) || 0), 0
    );
    const transporte = Number(compra.transporte) || 0;
    const ivaPct     = Number(compra.ivaPorcentaje) || 0;
    const descPct    = Number(compra.descuentoPorcentaje) || 0;
    const otros      = Number(compra.otros) || 0;
    const valorIva   = subtotalItems * ivaPct / 100;
    const valorDesc  = subtotalItems * descPct / 100;
    const totalFinal = subtotalItems + transporte + valorIva - valorDesc + otros;

    if (totalFinal < TOTAL_MIN)
      errores.total = `El total (${COP(totalFinal)}) debe ser al menos ${COP(TOTAL_MIN)} COP`;
    else if (totalFinal > TOTAL_MAX)
      errores.total = `El total (${COP(totalFinal)}) supera el máximo permitido de ${COP(TOTAL_MAX)} COP`;

    if (Object.keys(errores).length) { setErrors(errores); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    const detallesLimpios = detalles.map(d => ({
      id:               d.id,
      idInsumo:         Number(d.idInsumo),
      idUnidad:         d.idUnidad ? Number(d.idUnidad) : null,
      cantidad:         Number(d.cantidad),
      precioUnd:        Number(d.precioUnd),
      notas:            d.notas?.trim() || "",
      fechaVencimiento: d.vencimientoTipo === "dias"
        ? sumarDias(d.vencimientoValor)
        : d.fechaVencimiento || "",
    }));
    onSave({
      ...compra,
      ...form,
      comprobante:  comprobante || compra.comprobante || null,
      detalles:     detallesLimpios,
    });
  };

  const modalStyle = {
    maxWidth: 860,
    width: "95vw",
    display: "flex",
    flexDirection: "column",
    maxHeight: "92vh",
    overflow: "hidden",
  };

  /* ── Vista detalle ── */
  if (isView) {
    const _prov = getProveedorById(compra.idProveedor);
    const provNombre = compra.proveedor || _prov?.Responsable || _prov?.responsable || "—";
    const metodo = METODOS_PAGO.find(m => m.value === compra.metodoPago);

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card modal-card--compra-det" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="modal-header" style={{ flexShrink: 0, padding: "16px 24px" }}>
            <div>
              <p className="modal-header__eyebrow">Compra #{compra.id}</p>
              <h2 className="modal-header__title">Detalle de Compra</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className={`estado-chip estado-chip--${compra.estado}`}>
                {String(compra.estado || "").charAt(0).toUpperCase() + String(compra.estado || "").slice(1)}
              </span>
              <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="compra-det-tabs">
            <button
              className={`compra-det-tab${viewTab === "resumen" ? " compra-det-tab--active" : ""}`}
              onClick={() => setViewTab("resumen")}
            >
              📋 Resumen
            </button>
            {compra.stockAplicado && (
              <button
                className={`compra-det-tab${viewTab === "lotes" ? " compra-det-tab--active" : ""}`}
                onClick={() => setViewTab("lotes")}
              >
                📦 Lotes generados
              </button>
            )}
          </div>

          <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

            {/* ── Tab: Resumen ── */}
            {viewTab === "resumen" && (
              <>
                <p className="section-label" style={{ marginTop: 0 }}>Información general</p>
                <div className="compra-det-info-grid">
                  <div className="compra-det-info-card compra-det-info-card--prov">
                    <div className="compra-det-info-card__lbl">Proveedor</div>
                    <div className="compra-det-info-card__val">🏭 {provNombre}</div>
                  </div>
                  <div className="compra-det-info-card">
                    <div className="compra-det-info-card__lbl">Fecha de compra</div>
                    <div className="compra-det-info-card__val">📅 {fmtFecha(compra.fecha)}</div>
                  </div>
                  <div className="compra-det-info-card">
                    <div className="compra-det-info-card__lbl">Método de pago</div>
                    <div className="compra-det-info-card__val">{metodo?.icon || "💳"} {metodo?.label || compra.metodoPago || "—"}</div>
                  </div>
                  {compra.fecha_llegada && (
                    <div className="compra-det-info-card">
                      <div className="compra-det-info-card__lbl">Fecha de llegada</div>
                      <div className="compra-det-info-card__val">📦 {fmtFecha(compra.fecha_llegada)}</div>
                    </div>
                  )}
                </div>

                {compra.notas && (
                  <div className="compra-det-notas">📝 {compra.notas}</div>
                )}

                <p className="section-label">Insumos comprados</p>
                <div className="compra-det-insumos">
                  <div className="compra-det-insumos__header">
                    <span>Insumo</span>
                    <span>Cantidad</span>
                    <span>Precio/u</span>
                    <span>Subtotal</span>
                    <span>Vencimiento</span>
                  </div>
                  {(compra.items || []).length === 0 ? (
                    <div className="compra-det-insumos__empty">Sin insumos registrados en esta compra</div>
                  ) : (
                    (compra.items || []).map((d, idx) => {
                      const ins  = insumosActivos.find(i => i.id === Number(d.idInsumo));
                      const uni  = d.unidad || ins?.unidad || "";
                      const dias = diasHasta(d.fechaVencimiento);
                      return (
                        <div key={d.idInsumo || idx} className="compra-det-insumos__row">
                          <span className="compra-det-insumos__name">
                            {d.nombre || ins?.nombre || "—"}
                          </span>
                          <span className="compra-det-insumos__qty">{d.cantidad} {uni}</span>
                          <span className="compra-det-insumos__pu">{COP(d.precioUnd)}</span>
                          <span className="compra-det-insumos__sub">{COP(d.cantidad * d.precioUnd)}</span>
                          <span className={`compra-det-insumos__venc${dias !== null && dias < 0 ? " venc-danger" : dias !== null && dias <= 7 ? " venc-warn" : ""}`}>
                            {d.fechaVencimiento ? fmtFecha(d.fechaVencimiento) : "—"}
                            {dias !== null && dias < 0 && " ⚠️"}
                            {dias !== null && dias >= 0 && dias <= 7 && ` (${dias}d)`}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                <p className="section-label">Desglose de costos</p>
                {(() => {
                  const subtotal  = (compra.items || []).reduce((s, d) => s + d.cantidad * d.precioUnd, 0);
                  const transporte = compra.transporte || 0;
                  const ivaPct     = compra.ivaPorcentaje || 0;
                  const descPct    = compra.descuentoPorcentaje || 0;
                  const otros      = compra.otros || 0;
                  const valorIva   = subtotal * ivaPct / 100;
                  const valorDesc  = subtotal * descPct / 100;
                  return (
                    <div className="compra-det-costos">
                      <div className="compra-det-costos__row">
                        <span>Subtotal insumos</span><span>{COP(subtotal)}</span>
                      </div>
                      {transporte > 0 && (
                        <div className="compra-det-costos__row">
                          <span>🚚 Transporte</span><span>{COP(transporte)}</span>
                        </div>
                      )}
                      {valorIva > 0 && (
                        <div className="compra-det-costos__row">
                          <span>🧾 IVA ({ivaPct}%)</span><span>{COP(valorIva)}</span>
                        </div>
                      )}
                      {valorDesc > 0 && (
                        <div className="compra-det-costos__row compra-det-costos__row--desc">
                          <span>🏷️ Descuento ({descPct}%)</span><span>−{COP(valorDesc)}</span>
                        </div>
                      )}
                      {otros > 0 && (
                        <div className="compra-det-costos__row">
                          <span>➕ Otros costos</span><span>{COP(otros)}</span>
                        </div>
                      )}
                      <div className="compra-det-costos__total">
                        <span>Total final</span><span>{COP(compra.total)}</span>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            {/* ── Tab: Lotes generados ── */}
            {viewTab === "lotes" && (
              <>
                <p className="section-label" style={{ marginTop: 0 }}>Lotes generados</p>
                <div className="compra-det-lotes-info">
                  ✅ Compra completada el {fmtFecha(compra.fecha_llegada || compra.fecha)}. Stock aplicado al inventario.
                </div>

                {lotesLoading ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#9e9e9e", fontSize: 13 }}>
                    Cargando lotes…
                  </div>
                ) : (
                  (compra.items || []).map((d, idx) => {
                    const ins    = insumosActivos.find(i => i.id === Number(d.idInsumo));
                    const uni    = d.unidad || ins?.unidad || "";
                    const nombre = d.nombre || ins?.nombre || "Insumo";
                    const lotes  = lotesMap[d.idInsumo] || [];

                    return (
                      <div key={d.idInsumo || idx} className="compra-det-lote-grupo">
                        <div className="compra-det-lote-grupo__header">
                          <span>📦 {nombre}</span>
                          <span className="compra-det-lote-grupo__qty">{d.cantidad} {uni} comprados</span>
                        </div>

                        {lotes.length === 0 ? (
                          <div className="compra-det-lotes-empty">
                            Sin lotes registrados para este insumo
                          </div>
                        ) : (
                          lotes.map(l => {
                            const idCompraLote = l.id_compra || l.ID_Compra || null;
                            return (
                              <div key={l.id} className={`compra-det-lote-item${l.vencido ? " compra-det-lote-item--vencido" : ""}`}>
                                <div className="compra-det-lote-item__main">
                                  <div className="compra-det-lote-item__num">
                                    Lote #{l.id}
                                    {l.numero_lote && (
                                      <span className="compra-det-lote-item__ref">{l.numero_lote}</span>
                                    )}
                                    {l.vencido && (
                                      <span className="compra-det-lote-badge--vencido">Vencido</span>
                                    )}
                                  </div>
                                  <div className="compra-det-lote-item__meta">
                                    {l.fecha_produccion && `Producción: ${fmtFecha(l.fecha_produccion)}`}
                                    {l.fecha_produccion && l.fecha_vencimiento && " · "}
                                    {l.fecha_vencimiento && `Vence: ${fmtFecha(l.fecha_vencimiento)}`}
                                  </div>
                                  {idCompraLote && Number(idCompraLote) !== Number(compra.id) && (
                                    <div className="compra-det-lote-item__origen">
                                      ℹ️ Generado por compra #{idCompraLote}
                                    </div>
                                  )}
                                </div>
                                <div className="compra-det-lote-item__qty">
                                  <span className="compra-det-lote-item__qty-num">
                                    {l.cantidad ?? l.cantidad_inicial ?? "—"}
                                  </span>
                                  <span className="compra-det-lote-item__qty-unit">{uni || "uds."}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn-ghost" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Modo editar ── */
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={modalStyle}>

        <div className="modal-header" style={{ flexShrink: 0, padding: "18px 28px" }}>
          <div>
            <p className="modal-header__eyebrow">Compras · {compra.id}</p>
            <h2 className="modal-header__title">Editar Compra</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={`estado-chip estado-chip--${compra.estado}`}>
              {compra.estado.toUpperCase()}
            </span>
            <button type="button" className="modal-close-btn" onClick={onClose} style={{ flexShrink: 0 }}>✕</button>
          </div>
        </div>

        {isLocked ? (
          <>
            <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
              <div className="stock-aviso stock-aviso--info" style={{ marginBottom: 16 }}>
                ℹ️ Esta compra ya fue <strong>completada y su stock fue aplicado</strong>. Solo puedes editar las notas y el método de pago.
              </div>
              <div className="field-grid-2">
                <div className="field-wrap">
                  <label className="field-label">Método de pago</label>
                  <div className="select-wrap">
                    <select
                      className="field-select"
                      value={form.metodoPago}
                      onChange={e => { set("metodoPago", e.target.value); setComprobante(null); }}
                    >
                      {METODOS_PAGO.map(m => (
                        <option key={m.value} value={m.value}>{m.icon} {m.label}</option>
                      ))}
                    </select>
                    <span className="select-arrow">▾</span>
                  </div>
                </div>
                <div />
              </div>

              {form.metodoPago === "transferencia" && (
                <div className="field-wrap comprobante-wrap">
                  <label className="field-label">Comprobante de transferencia</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <label className="comprobante-upload-btn" style={{ flex: 1 }}>
                      <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => setComprobante(e.target.files?.[0] || null)} />
                      <span className="comprobante-upload-icon">📎</span>
                      {comprobante
                        ? <span className="comprobante-filename">{comprobante.name}</span>
                        : compra.comprobante
                          ? <span className="comprobante-filename">{compra.comprobante.name || "Comprobante existente"}</span>
                          : <span>Adjuntar comprobante (imagen o PDF)</span>
                      }
                    </label>
                    {(comprobante || compra.comprobante) && (
                      <button
                        type="button"
                        onClick={e => { e.preventDefault(); setComprobante(null); }}
                        style={{ flexShrink: 0, padding: "0 12px", height: 36, borderRadius: 8, border: "1.5px solid #ef5350", background: "#fff", color: "#c62828", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        ✕ Quitar
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="field-wrap">
                <label className="field-label">Notas</label>
                <textarea className="field-input field-textarea" rows={3} value={form.notas} onChange={e => set("notas", e.target.value)} />
              </div>
              <div className="field-wrap" style={{ marginTop: 8 }}>
                <label className="field-label">Fecha de llegada</label>
                <input
                  type="date"
                  className="field-input"
                  value={form.fecha_llegada || ""}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => set("fecha_llegada", e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn-save" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando…" : "Guardar Cambios"}
              </button>
            </div>
          </>
        ) : (
          <>
            <StepsBar current={step} />

            <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "22px 28px" }}>

              {step === 1 && (
                <>
                  <div className="field-wrap">
                    <label className="field-label">Proveedor <span className="required">*</span></label>
                    <div className="select-wrap">
                      <select
                        className={`field-select ${errors.idProveedor ? "error" : ""}`}
                        value={form.idProveedor}
                        onChange={e => set("idProveedor", e.target.value)}
                      >
                        <option value="">— Seleccionar proveedor —</option>
                        {proveedores.map(p => (
                          <option key={p.ID_Proveedor || p.id} value={p.ID_Proveedor || p.id}>
                            {p.Responsable || p.responsable} · {p.Municipio || p.ciudad}
                          </option>
                        ))}
                      </select>
                      <span className="select-arrow">▾</span>
                    </div>
                    {errors.idProveedor && <span className="field-error">{errors.idProveedor}</span>}
                  </div>

                  <div className="field-grid-2">
                    <div className="field-wrap">
                      <label className="field-label">Fecha de compra <span className="required">*</span></label>
                      <input
                        type="date"
                        className={`field-input ${errors.fecha ? "error" : ""}`}
                        value={form.fecha}
                        onChange={e => set("fecha", e.target.value)}
                      />
                      {errors.fecha && <span className="field-error">{errors.fecha}</span>}
                    </div>
                    <div className="field-wrap">
                      <label className="field-label">Estado</label>
                      <div className="estado-toggle-wrap">
                        {["pendiente", "completada"].map(est => (
                          <button
                            key={est}
                            type="button"
                            className={`estado-toggle-btn ${form.estado === est ? `estado-toggle-btn--${est}` : ""}`}
                            onClick={() => set("estado", est)}
                          >
                            {est === "pendiente" ? "⏳" : "✅"} {est.charAt(0).toUpperCase() + est.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="field-wrap">
                    <label className="field-label">Método de pago <span className="required">*</span></label>
                    <div className="select-wrap">
                      <select
                        className={`field-select ${errors.metodoPago ? "error" : ""}`}
                        value={form.metodoPago}
                        onChange={e => { set("metodoPago", e.target.value); setComprobante(null); }}
                      >
                        <option value="">— Seleccionar método —</option>
                        {METODOS_PAGO.map(m => (
                          <option key={m.value} value={m.value}>{m.icon} {m.label}</option>
                        ))}
                      </select>
                      <span className="select-arrow">▾</span>
                    </div>
                    {errors.metodoPago && <span className="field-error">{errors.metodoPago}</span>}
                  </div>

                  <div className="field-wrap">
                    <label className="field-label">Notas</label>
                    <textarea
                      className="field-input field-textarea"
                      rows={2}
                      placeholder="Observaciones…"
                      value={form.notas}
                      onChange={e => set("notas", e.target.value)}
                    />
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#616161" }}>Insumos comprados</p>
                    {errors.detalles && <span className="field-error">{errors.detalles}</span>}
                  </div>

                  {detalles.map((d, i) => {
                    const insumoSel = getInsumoById(d.idInsumo) || insumosActivos.find(ins => String(ins.id) === String(d.idInsumo));

                    if (!d.isExpanded) {
                      return (
                        <div
                          key={d._key}
                          className="detalle-row detalle-row--collapsed"
                          onClick={() => toggleExpand(d._key)}
                        >
                          <div className="detalle-summary">
                            <div className="detalle-summary__info">
                              <span className="detalle-num">{String(i + 1).padStart(2, "0")}</span>
                              <span className="insumo-icon">📦</span>
                              <div>
                                <span className="detalle-summary__name">{insumoSel?.nombre || d.nombre || "Insumo"}</span>
                                <div className="detalle-summary__meta">
                                  {d.cantidad ? `${d.cantidad} ${insumoSel?.unidad || ""}` : "Sin cantidad"} ·{" "}
                                  {d.precioUnd ? COP(d.precioUnd) : "—"}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div className="detalle-summary__price">
                                {d.cantidad && d.precioUnd ? COP(Number(d.cantidad) * Number(d.precioUnd)) : "$0"}
                              </div>
                              <button
                                className="detalle-remove-btn"
                                type="button"
                                onClick={e => { e.stopPropagation(); removeDetalle(d._key); }}
                              >✕</button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={d._key} className="detalle-row">
                        <span
                          className="detalle-num"
                          onClick={() => toggleExpand(d._key)}
                          style={{ cursor: "pointer", marginTop: 4, flexShrink: 0 }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>

                        <div className="detalle-fields" style={{ flex: 1 }}>
                          <div className="field-wrap" style={{ gridColumn: "1 / -1" }}>
                            <div className="select-wrap">
                              <select
                                className={`field-select ${errors[`ins_${i}`] ? "error" : ""}`}
                                value={d.idInsumo}
                                onChange={e => {
                                  const selectedId = e.target.value;
                                  const ins = insumosActivos.find(ins => String(ins.id) === selectedId);
                                  setDetalles(ds => ds.map(det =>
                                    det._key === d._key
                                      ? { ...det, idInsumo: selectedId, idUnidad: ins?.idUnidad ? String(ins.idUnidad) : "" }
                                      : det
                                  ));
                                }}
                              >
                                <option value="">— Seleccionar insumo —</option>
                                {insumosActivos.map(ins => (
                                  <option
                                    key={ins.id}
                                    value={ins.id}
                                    disabled={
                                      idsSeleccionados.includes(String(ins.id)) &&
                                      String(ins.id) !== String(d.idInsumo)
                                    }
                                  >
                                    {ins.nombre}
                                  </option>
                                ))}
                              </select>
                              <span className="select-arrow">▾</span>
                            </div>
                            {errors[`ins_${i}`] && <span className="field-error">{errors[`ins_${i}`]}</span>}
                          </div>

                          <div className="field-wrap" style={{ gridColumn: "span 1" }}>
                            <label className="field-label">Cantidad</label>
                            <div style={{ display: "flex", gap: 4 }}>
                              <input
                                type="number"
                                className={`field-input ${errors[`cant_${i}`] ? "error" : ""}`}
                                placeholder="0"
                                min="0.001"
                                max={CANT_MAX}
                                step={GRUPO_UNIDAD[Number(d.idUnidad)] === "und" ? "1" : "0.001"}
                                value={d.cantidad}
                                onChange={e => setDetalle(d._key, "cantidad", e.target.value)}
                                style={{ flex: 1, minWidth: 0 }}
                              />
                              {(() => {
                                const opciones = insumoSel ? unidadesDelGrupo(insumoSel.idUnidad) : [];
                                if (opciones.length <= 1) {
                                  return insumoSel?.unidad
                                    ? <span style={{ display: "flex", alignItems: "center", padding: "0 8px", background: "#f5f5f5", border: "1.5px solid #e8e8e8", borderRadius: 7, fontSize: 11, color: "#555", fontWeight: 700, flexShrink: 0 }}>{insumoSel.unidad}</span>
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
                          <div className="field-wrap" style={{ gridColumn: "span 2" }}>
                            <label className="field-label">Precio unitario</label>
                            <input
                              type="number"
                              className={`field-input ${errors[`precio_${i}`] ? "error" : ""}`}
                              placeholder="$ 0"
                              value={d.precioUnd}
                              onChange={e => setDetalle(d._key, "precioUnd", e.target.value)}
                            />
                          </div>

                          <div className="field-wrap" style={{ gridColumn: "1 / -1" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <label className="field-label">Vencimiento</label>
                              <div className="venc-toggle">
                                {["dias", "fecha"].map(t => (
                                  <button
                                    key={t}
                                    type="button"
                                    className={`venc-toggle-btn ${d.vencimientoTipo === t ? "active" : ""}`}
                                    onClick={() => setDetalle(d._key, "vencimientoTipo", t)}
                                  >
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {d.vencimientoTipo === "dias" ? (
                              <input
                                type="number"
                                className="field-input"
                                value={d.vencimientoValor}
                                onChange={e => setDetalle(d._key, "vencimientoValor", e.target.value)}
                              />
                            ) : (
                              <input
                                type="date"
                                className="field-input"
                                value={d.fechaVencimiento}
                                onChange={e => setDetalle(d._key, "fechaVencimiento", e.target.value)}
                              />
                            )}
                          </div>
                        </div>

                        <button
                          className="detalle-remove-btn"
                          type="button"
                          onClick={() => removeDetalle(d._key)}
                        >✕</button>
                      </div>
                    );
                  })}

                  <button className="btn-add-detalle" type="button" onClick={addDetalle}>
                    + Agregar insumo
                  </button>
                </>
              )}
            </div>

            <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px 20px", borderTop: "1px solid #f5f5f5" }}>
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
                {step === 2
                  ? <button className="btn-ghost" onClick={() => setStep(1)}>← Volver</button>
                  : <button className="btn-ghost" onClick={onClose}>Cancelar</button>
                }
                <button
                  className="btn-save"
                  onClick={step === 1 ? handleNextStep : handleSave}
                  disabled={saving}
                >
                  {saving ? "Guardando…" : step === 1 ? "Siguiente →" : "Guardar Cambios"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
