import { useState, useEffect, useRef } from "react";
import { Search, X, AlertTriangle, Package, ClipboardList, Check, Eye, PenLine, Trash2, RefreshCw, Building2, FolderOpen, ShoppingCart } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { fmtFecha } from "../../../utils/dateUtils.js";
import DateRangeFilter from "../../../shared/components/DateRangeFilter";
import {
  getOrdenes, crearOrden, editarOrden, eliminarOrden, cambiarEstadoOrden,
} from "../../../services/ordenesProduccionService.js";
import { getProducto, getProductos } from "../../../services/productosService.js";
import { getInsumos }   from "../../../services/insumosService.js";
import { cambiarEstadoVenta } from "../../../services/pedidosService.js";
import SearchableSelect from "../../../shared/components/SearchableSelect.jsx";
import "./OrdenesProduccion.css";

const PER_PAGE = 5;

const ESTADOS_ORDEN = ["Pendiente", "En proceso", "Completada", "Cancelada"];

// IDs reales en la tabla Estados del backend
const ESTADO_TO_NUM = {
  "Pendiente":  1,
  "En proceso": 13,
  "Completada": 11,
  "Cancelada":  5,
};

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ESTADO_CONFIG = {
  "Pendiente":  { dot: "#f9a825" },
  "En proceso": { dot: "#1976d2" },
  "Completada": { dot: "#43a047" },
  "Cancelada":  { dot: "#e53935" },
};

const VALID_TRANSITIONS = {
  "Pendiente":  ["En proceso", "Cancelada"],
  "En proceso": ["Completada", "Cancelada"],
  "Completada": [],
  "Cancelada":  [],
};

const fmt = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n ?? 0);

const urgenciaFecha = (fechaISO) => {
  if (!fechaISO) return "normal";
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((new Date(fechaISO + "T00:00:00") - hoy) / 86_400_000);
  if (dias < 0)  return "vencida";
  if (dias <= 1) return "urgente";
  if (dias <= 3) return "pronto";
  return "normal";
};

/* ─── Componentes base ─────────────────────────────────── */
function EstadoBadge({ estado }) {
  const COLORS = {
    "Pendiente":  { bg: "#f5f5f5", color: "#757575", border: "#e0e0e0" },
    "En proceso": { bg: "#e3f2fd", color: "#1565c0", border: "#90caf9" },
    "Pausada":    { bg: "#f3e5f5", color: "#6a1b9a", border: "#ce93d8" },
    "Completada": { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7" },
    "Cancelada":  { bg: "#ffebee", color: "#c62828", border: "#ef9a9a" },
  };
  const c = COLORS[estado] || { bg: "#f5f5f5", color: "#757575", border: "#e0e0e0" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      borderRadius: 20, padding: "3px 10px",
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
      {estado}
    </span>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 99999,
      padding: "12px 20px", borderRadius: 12, color: "#fff",
      background: toast.type === "error" ? "#c62828" : toast.type === "warn" ? "#e65100" : "#2e7d32",
      fontWeight: 600, fontSize: 13,
      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ fontSize: 15, display: "flex", alignItems: "center" }}>{toast.type === "error" ? <X size={15} /> : toast.type === "warn" ? <AlertTriangle size={13} /> : <Check size={14} />}</span>
      {toast.message}
    </div>
  );
}

function SkeletonRows() {
  return Array.from({ length: 5 }, (_, i) => (
    <tr key={i}>
      {Array.from({ length: 6 }, (_, j) => (
        <td key={j}><div className="skeleton-cell" /></td>
      ))}
    </tr>
  ));
}

/* ═══════════════════════════════════════════════════════════
   MODAL VER DETALLES
   ═══════════════════════════════════════════════════════════ */
function ModalDetallesOrden({ orden, onClose }) {
  const navigate = useNavigate();
  const [fichaInsumos, setFichaInsumos] = useState(null);
  const [fichaLoading, setFichaLoading] = useState(false);
  const [fichaError, setFichaError] = useState("");
  const [insumosDataMap, setInsumosDataMap] = useState({});
  const [multiplier, setMultiplier] = useState(Number(orden?.cantidad || 1));
  const [showInsumos, setShowInsumos] = useState(true);

  useEffect(() => {
    setMultiplier(Number(orden?.cantidad || 1));
    setShowInsumos(false);
  }, [orden?.cantidad, orden?.idFicha]);

  useEffect(() => {
    let active = true;
    if (!orden?.idFicha || !orden?.idProducto) {
      setFichaInsumos(null);
      setFichaError("");
      setFichaLoading(false);
      return () => { active = false; };
    }

    setFichaLoading(true);
    setFichaError("");
    setFichaInsumos(null);

    getProducto(orden.idProducto)
      .then(prod => {
        if (!active) return;
        const ficha = prod?.ficha_tecnica;
        if (!ficha || !Array.isArray(ficha.insumos)) {
          setFichaInsumos([]);
          return;
        }
        const mapped = ficha.insumos.map(i => ({
          id: i.ID_Ficha_Insumo || `${Date.now()}-${Math.random()}`,
          idInsumo: i.ID_Insumo || null,
          nombre: i.nombre_insumo || "",
          cantidad: Number(i.Cantidad ?? 0),
          unidad: i.Unidad || "",
          stockActual: i.Stock_Actual ?? null,
        }));
        setFichaInsumos(mapped);

        // Cargar stock y precio de insumos (max 100 por límite del backend)
        getInsumos({ porPagina: 100 })
          .then(res => {
            if (!active) return;
            const map = {};
            (res.insumos || []).forEach(ins => {
              map[ins.ID_Insumo] = {
                stock:  ins.Stock_Actual ?? ins.Stock ?? 0,
                precio: ins.precio_unitario ?? 0,
              };
            });
            setInsumosDataMap(map);
          })
          .catch(() => { if (active) setInsumosDataMap({}); });
      })
      .catch(() => {
        if (!active) return;
        setFichaError("No se pudo cargar la ficha técnica.");
      })
      .finally(() => { if (active) setFichaLoading(false); });

    return () => { active = false; };
  }, [orden?.idFicha, orden?.idProducto]);

  if (!orden) return null;

  const costoDisplay = orden.costo > 0 ? fmt(orden.costo) : "—";
  const costoConProblemas = (orden.costoDetalle || []).some(d => d.error);
  const detalleCostoPorNombre = Object.fromEntries(
    (orden.costoDetalle || []).map(d => [d.nombre, d])
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        style={{ maxWidth: 480, width: "100%" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Producción</p>
            <h2 className="modal-header__title">Orden #{orden.id}</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <EstadoBadge estado={orden.estado} />
            <button className="modal-close-btn" onClick={onClose} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
          </div>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Cantidad",   value: orden.cantidad, bg: "#e8f5e9", color: "#2e7d32" },
              { label: "Costo est.", value: costoDisplay,   bg: "#f5f5f5", color: "#616161" },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          {costoConProblemas && (
            <div style={{ background: "#fff3e0", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#e65100", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Algunos insumos no tienen precio de compra registrado o tienen unidades incompatibles. El costo puede estar incompleto — revisa el detalle de insumos.</span>
            </div>
          )}

          {/* Producto */}
          <div className="field-input field-input--disabled" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Package size={18} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: 1 }}>Producto</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>
                {orden.nombreProducto || "—"} <span style={{ color: "#2e7d32" }}>×{orden.cantidad}</span>
              </div>
            </div>
          </div>

          {/* Fechas — siempre visible, antes del bloque de insumos */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field-input field-input--disabled" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: 1 }}>Inicio</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtFecha(orden.fechaInicio)}</div>
            </div>
            <div className="field-input field-input--disabled" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#2e7d32", textTransform: "uppercase", letterSpacing: 1 }}>Entrega</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2e7d32" }}>{fmtFecha(orden.fechaEntrega)}</div>
            </div>
          </div>

          {(orden.idFicha || orden.nombreInsumo) && (
            <div style={{ display: "grid", gap: 10 }}>
              <div className="field-input field-input--disabled" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {orden.idFicha ? <FolderOpen size={18} /> : <Package size={18} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: 1 }}>
                    {orden.idFicha ? "Insumos de ficha técnica" : "Insumo"}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#424242" }}>
                    {orden.idFicha ? "Los insumos de esta orden se extraen de la ficha técnica asociada." : orden.nombreInsumo || "—"}
                  </div>
                </div>
              </div>

              {orden.idFicha ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowInsumos(v => !v)}
                    style={{
                      width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between",
                      alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12,
                      border: "1px solid #e0e0e0", background: showInsumos ? "#e8f5e9" : "#fff",
                      cursor: "pointer", fontSize: 13, fontWeight: 700,
                    }}
                  >
                    <span>Ver insumos de la ficha técnica</span>
                    <span style={{ fontSize: 12, color: "#2e7d32" }}>{showInsumos ? "Ocultar" : "Mostrar"}</span>
                  </button>
                  {showInsumos && (
                    <div style={{ overflowX: "auto", padding: "6px 0" }}>
                      {fichaLoading ? (
                        <p style={{ margin: 0, color: "#616161" }}>Cargando insumos de la ficha técnica…</p>
                      ) : fichaError ? (
                        <p style={{ margin: 0, color: "#c62828" }}>{fichaError}</p>
                      ) : fichaInsumos?.length > 0 ? (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 8, alignItems: "center" }}>
                            <div style={{ fontSize: 12, color: "#616161" }}>Escala</div>
                            <select value={multiplier} onChange={e => setMultiplier(Number(e.target.value))} style={{ padding: "6px 8px", borderRadius: 6 }}>
                              {(() => {
                                const opts = [];
                                for (let i = 1; i <= 10; i++) opts.push(i);
                                if (!opts.includes(Number(orden?.cantidad || 0))) opts.push(Number(orden?.cantidad || 1));
                                return opts.sort((a,b)=>a-b).map(n => (
                                  <option key={n} value={n}>×{n}</option>
                                ));
                              })()}
                            </select>
                          </div>
                          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: "left", padding: "10px", fontSize: 12, color: "#616161" }}>Insumo</th>
                                <th style={{ textAlign: "right", padding: "10px", fontSize: 12, color: "#616161" }}>Necesario</th>
                                <th style={{ textAlign: "right", padding: "10px", fontSize: 12, color: "#616161" }}>Stock</th>
                                <th style={{ textAlign: "right", padding: "10px", fontSize: 12, color: "#616161" }}>Costo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {fichaInsumos.map((item, index) => {
                                const requerido = Number(item.cantidad || 0) * Number(multiplier || 1);
                                const stock = item.stockActual !== null ? item.stockActual : (item.idInsumo ? (insumosDataMap[item.idInsumo]?.stock ?? null) : null);
                                const agotado = stock !== null ? (stock < requerido) : null;
                                const detalleItem = detalleCostoPorNombre[item.nombre] || null;
                                const costoItem = detalleItem && !detalleItem.error
                                  ? (detalleItem.costo / Math.max(1, orden.cantidad)) * Number(multiplier || 1)
                                  : null;
                                return (
                                  <tr key={item.id} style={{ background: index % 2 === 0 ? "#fafafa" : "#fff" }}>
                                    <td style={{ padding: "10px", fontSize: 13, color: "#1a1a1a" }}>{item.nombre || "—"}</td>
                                    <td style={{ padding: "10px", textAlign: "right", fontSize: 13, color: "#424242" }}>{requerido} {item.unidad || ""}</td>
                                    <td style={{ padding: "10px", textAlign: "right", fontSize: 13 }}>
                                      {stock === null || stock === undefined ? (
                                        <span style={{ color: "#9e9e9e" }}>—</span>
                                      ) : (
                                        <span style={{ fontWeight: 700, color: agotado ? "#c62828" : "#2e7d32" }}>{stock}{" "}{item.unidad || ""}</span>
                                      )}
                                    </td>
                                    <td style={{ padding: "10px", textAlign: "right", fontSize: 13 }}>
                                      {detalleItem?.error ? (
                                        <span title={detalleItem.error} style={{ color: "#e65100", cursor: "help", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 3 }}><AlertTriangle size={12} /> S/P</span>
                                      ) : costoItem != null ? (
                                        <span style={{ fontWeight: 700, color: "#616161" }}>{fmt(costoItem)}</span>
                                      ) : (
                                        <span style={{ color: "#9e9e9e" }}>—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p style={{ margin: 0, color: "#616161" }}>No hay insumos registrados en la ficha técnica.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : orden.nombreInsumo && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", background: "#fafafa", borderRadius: 12 }}>
                  <div style={{ fontSize: 13, color: "#424242" }}>{orden.nombreInsumo}</div>
                  {orden.stockInsumo !== null && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: orden.stockInsumo >= orden.cantidad ? "#2e7d32" : "#c62828" }}>
                      Disponible: {orden.stockInsumo}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Lote — solo si la orden está completada */}
          {orden.lote && (
            <div style={{ background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#2e7d32", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                Lote generado
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#616161", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Nº Lote</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{orden.lote.numeroLote}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#616161", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Cantidad</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#2e7d32" }}>{orden.lote.cantidad}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#616161", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Producción</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{fmtFecha(orden.lote.fechaProduccion)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#616161", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Vencimiento</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{fmtFecha(orden.lote.fechaVencimiento)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {orden.idFicha && (
          <div style={{ background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <ClipboardList size={20} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#2e7d32", marginBottom: 2 }}>Ficha técnica disponible</div>
              <div style={{ fontSize: 12, color: "#388e3c" }}>Consulta los insumos, cantidades y procedimiento detallado del producto.</div>
            </div>
            <button
              onClick={() => { onClose(); navigate("/admin/products", { state: { openFicha: orden.idProducto } }); }}
              style={{ background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
              Ver ficha
            </button>
          </div>
        )}
        <div className="modal-footer" style={{ justifyContent: "flex-end" }}>
          <button className="btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL CAMBIAR ESTADO
   ═══════════════════════════════════════════════════════════ */
const ESTADO_COLORS = {
  "Pendiente":  { bg: "#f5f5f5", color: "#757575", border: "#e0e0e0" },
  "En proceso": { bg: "#e3f2fd", color: "#1565c0", border: "#90caf9" },
  "Completada": { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7" },
  "Cancelada":  { bg: "#ffebee", color: "#c62828", border: "#ef9a9a" },
};

// Factores a unidad base: lb=500g (convención de mercado colombiano)
const FACTOR_CONV = { g:1, kg:1000, lb:500, ml:1, l:1000, unidad:1, uds:1, und:1, u:1, unidades:1 };

function ModalCambiarEstado({ orden, onClose, onConfirm, saving }) {
  const navigate = useNavigate();
  const [estadoSel,        setEstadoSel]        = useState(null);
  const [confirmStep,      setConfirmStep]      = useState(false);
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [stockCheck,       setStockCheck]       = useState(null);
  const [stockLoading,     setStockLoading]     = useState(false);

  const today = localToday();

  useEffect(() => {
    const necesitaCheck = estadoSel === "En proceso" || estadoSel === "Completada";
    if (!necesitaCheck || !confirmStep || !orden?.idFicha || !orden?.idProducto) {
      setStockCheck(null);
      return;
    }
    let active = true;
    setStockLoading(true);
    Promise.all([
      getProducto(orden.idProducto),
      getInsumos({ porPagina: 100 }),
    ]).then(([prod, insData]) => {
      if (!active) return;
      const fichaInsumos = (prod?.ficha_tecnica?.insumos || []).map(i => ({
        idInsumo:    i.ID_Insumo || null,
        nombre:      i.nombre_insumo || "",
        cantidadUnitaria: Number(i.Cantidad ?? 0),
        unidad:      i.Unidad || "",
        stockActual: i.Stock_Actual ?? null,  // ya viene del backend en getProducto
      }));

      // Mapa: idInsumo → { stock, simbolo } — solo para símbolo y respaldo de stock
      const stockMap = {};
      (insData.insumos || []).forEach(ins => {
        stockMap[ins.ID_Insumo] = {
          stock:   ins.Stock_Actual ?? ins.Stock ?? 0,
          simbolo: ins.simbolo_unidad || "",
        };
      });

      const cantidadOrden = Number(orden.cantidad || 1);

      // Calcula necesario con conversión a unidad base (misma lógica que el backend)
      const fichaConCheck = fichaInsumos.map(item => {
        const entry = stockMap[item.idInsumo] || {};
        // Stock_Actual del producto tiene prioridad; getInsumos como respaldo
        const stock = item.stockActual !== null ? item.stockActual : (entry.stock ?? 0);
        const simIns   = (entry.simbolo || "").toLowerCase();
        const simFicha = (item.unidad  || "").toLowerCase();
        const fi = FACTOR_CONV[simFicha] ?? 1;
        const fu = FACTOR_CONV[simIns]   ?? 1;
        const necesarioBase = item.cantidadUnitaria * cantidadOrden * fi;
        const necesario     = fu > 0 ? necesarioBase / fu : necesarioBase;
        const faltante      = Math.max(0, necesario - stock);
        return { ...item, stock, necesario, faltante, simboloInsumo: entry.simbolo || item.unidad };
      });
      const insuficientes = fichaConCheck.filter(i => i.faltante > 0.0001);
      setStockCheck({ insuficientes, fichaConCheck, stockMap, cantidadOrden });

      // Fecha vencimiento automática solo al completar
      if (estadoSel === "Completada") {
        const vidaUtil = prod?.Vida_Util || prod?.vida_util_dias || prod?.vida_util || 0;
        if (vidaUtil && !fechaVencimiento) {
          const venc = new Date(today + "T00:00:00");
          venc.setDate(venc.getDate() + Number(vidaUtil));
          setFechaVencimiento(venc.toISOString().split("T")[0]);
        }
      }
    }).catch(() => { if (active) setStockCheck(null); })
      .finally(() => { if (active) setStockLoading(false); });
    return () => { active = false; };
  }, [estadoSel, confirmStep, orden?.idFicha, orden?.idProducto]);

  if (!orden) return null;

  const transicionesValidas = VALID_TRANSITIONS[orden.estado] || [];

  const handleConfirm = () => {
    const loteData = {};
    if (estadoSel === "Completada") {
      loteData.Fecha_Produccion = today;
      if (fechaVencimiento) loteData.Fecha_Vencimiento = fechaVencimiento;
    }
    onConfirm(orden.id, estadoSel, loteData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Producción</p>
            <h2 className="modal-header__title">Cambiar Estado</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
        </div>

        <div className="modal-body">
          {!confirmStep ? (
            <>
              <p className="section-label" style={{ marginTop: 0 }}>Orden #{orden.id} — selecciona el nuevo estado</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ESTADOS_ORDEN.map(est => {
                  const c = ESTADO_COLORS[est] || {};
                  const isCurrent = est === orden.estado;
                  const isValid   = transicionesValidas.includes(est);
                  const isDisabled = isCurrent || !isValid;
                  return (
                    <button
                      key={est}
                      disabled={isDisabled}
                      onClick={() => { setEstadoSel(est); setConfirmStep(true); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "11px 14px", borderRadius: 10,
                        border: `1.5px solid ${isCurrent ? c.border : isValid ? "#e0e0e0" : "#f0f0f0"}`,
                        background: isCurrent ? c.bg : "#fff",
                        cursor: isDisabled ? "default" : "pointer",
                        opacity: !isCurrent && !isValid ? 0.35 : 1,
                        fontFamily: "inherit", width: "100%", textAlign: "left",
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: !isValid && !isCurrent ? "#ccc" : c.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: isCurrent ? c.color : !isValid ? "#bdbdbd" : "#1a1a1a", flex: 1 }}>{est}</span>
                      {isCurrent  && <span style={{ fontSize: 10, fontWeight: 700, color: "#2e7d32", textTransform: "uppercase" }}>Actual</span>}
                      {!isCurrent && isValid  && <span style={{ color: "#bdbdbd", fontSize: 16 }}>›</span>}
                      {!isCurrent && !isValid && <span style={{ fontSize: 10, color: "#bdbdbd" }}>No disponible</span>}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 12, padding: "14px", textAlign: "center" }}>
                <div style={{ marginBottom: 6, display: "flex", justifyContent: "center" }}><AlertTriangle size={26} style={{ color: "#f9a825" }} /></div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#6d4c00", marginBottom: 4 }}>¿Confirmar cambio de estado?</div>
                <div style={{ fontSize: 12, color: "#9a6400" }}>Esta acción actualizará el flujo de producción.</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", background: "#fafafa", borderRadius: 10, padding: "14px", border: "1px solid #e0e0e0" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", marginBottom: 6 }}>Actual</div>
                  <EstadoBadge estado={orden.estado} />
                </div>
                <span style={{ fontSize: 20, color: "#bdbdbd" }}>→</span>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", marginBottom: 6 }}>Nuevo</div>
                  <EstadoBadge estado={estadoSel} />
                </div>
              </div>

              {/* Stock check — solo al pasar a "En proceso" (aquí se descuentan los insumos) */}
              {estadoSel === "En proceso" && orden.idFicha && (
                stockLoading ? (
                  <div style={{ fontSize: 12, color: "#616161", padding: "8px 0" }}>Verificando disponibilidad de insumos…</div>
                ) : stockCheck ? (
                  stockCheck.insuficientes.length > 0 ? (
                    <div style={{ background: "#ffebee", border: "1px solid #ef9a9a", borderRadius: 12, padding: "14px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#c62828", marginBottom: 10 }}>
                        Insumos insuficientes ({stockCheck.insuficientes.length})
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                        {stockCheck.insuficientes.map((item, i) => (
                          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", background: "#fff5f5", borderRadius: 8, padding: "8px 10px" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#b71c1c" }}>{item.nombre}</div>
                              <div style={{ fontSize: 11, color: "#9e9e9e", marginTop: 2 }}>
                                Stock: <strong style={{ color: "#c62828" }}>{item.stock.toFixed(2)} {item.simboloInsumo}</strong>
                                {" · "}Necesario: <strong>{item.necesario.toFixed(2)} {item.simboloInsumo}</strong>
                              </div>
                            </div>
                            <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                              <div style={{ fontSize: 10, color: "#9e9e9e", textTransform: "uppercase" }}>Faltante</div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: "#c62828" }}>{item.faltante.toFixed(2)} {item.simboloInsumo}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ background: "#fff3e0", border: "1px solid #ffcc80", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#e65100" }}>¿Faltan materias primas?</div>
                          <div style={{ fontSize: 11, color: "#bf360c", marginTop: 2 }}>Registra una compra al proveedor para reponer el stock.</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { onClose(); navigate("/admin/compras"); }}
                          style={{ background: "#e65100", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                        >
                          Ir a Compras →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#2e7d32", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      <Check size={14} /> Todos los insumos tienen stock suficiente
                    </div>
                  )
                ) : null
              )}

              {/* Configuración del lote al completar */}
              {estadoSel === "Completada" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#2e7d32", marginBottom: 2 }}>Se generará un lote automáticamente</div>
                    <div style={{ fontSize: 11, color: "#388e3c" }}>Código: L-{today.replace(/-/g, "")} · Fecha producción: {today}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#616161", display: "block", marginBottom: 4 }}>Fecha de vencimiento del lote</label>
                    <input type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)}
                      style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: confirmStep ? "space-between" : "flex-end" }}>
          {confirmStep
            ? <>
                <button className="btn-ghost" onClick={() => { setConfirmStep(false); setStockCheck(null); }}>← Volver</button>
                <button
                  className="btn-save"
                  onClick={handleConfirm}
                  disabled={saving || stockLoading || (estadoSel === "En proceso" && stockCheck?.insuficientes?.length > 0)}
                >
                  {saving ? "Guardando…" : "Confirmar cambio"}
                </button>
              </>
            : <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          }
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL ERROR — CAMBIO DE ESTADO
   ═══════════════════════════════════════════════════════════ */
function ModalErrorEstado({ mensaje, orden, onClose }) {
  const navigate = useNavigate();
  if (!mensaje) return null;

  const esFichaTecnica      = /ficha t[eé]cnica/i.test(mensaje);
  const esStockInsuficiente = /stock insuficiente/i.test(mensaje);
  const esTimeout           = /procesándose|procesandose|recarga/i.test(mensaje);

  const titulo = esStockInsuficiente
    ? "Stock insuficiente"
    : esFichaTecnica
    ? "Ficha técnica requerida"
    : esTimeout
    ? "La operación tardó demasiado"
    : "No se pudo cambiar el estado";

  const irAFicha = () => {
    onClose();
    navigate("/admin/products", { state: { openFicha: orden?.idProducto } });
  };
  const irACompras = () => { onClose(); navigate("/admin/compras"); };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()}>
        <div style={{ padding: "28px 24px 18px", textAlign: "center" }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "#ffebee", border: "1px solid #ef9a9a",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, margin: "0 auto 14px",
          }}><AlertTriangle size={24} style={{ color: "#c62828" }} /></div>
          <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700, color: "#1a1a1a" }}>
            {titulo}
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#616161", lineHeight: 1.5 }}>
            {mensaje}
          </p>
          {esFichaTecnica && orden && (
            <div style={{
              background: "#e8f5e9", border: "1px solid #a5d6a7",
              borderRadius: 10, padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 10,
              textAlign: "left", marginBottom: 8,
            }}>
              <ClipboardList size={20} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#2e7d32", marginBottom: 2 }}>
                  Producto: {orden.nombreProducto}
                </div>
                <div style={{ fontSize: 11, color: "#388e3c" }}>
                  Puedes crear o editar la ficha técnica desde Gestión de Productos.
                </div>
              </div>
              <button
                onClick={irAFicha}
                style={{
                  background: "#2e7d32", color: "#fff", border: "none",
                  borderRadius: 8, padding: "7px 14px",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                Ir a ficha técnica
              </button>
            </div>
          )}
          {esStockInsuficiente && (
            <div style={{
              background: "#fff3e0", border: "1px solid #ffcc80",
              borderRadius: 10, padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 10,
              textAlign: "left", marginBottom: 8,
            }}>
              <ShoppingCart size={20} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#e65100", marginBottom: 2 }}>
                  ¿Faltan materias primas?
                </div>
                <div style={{ fontSize: 11, color: "#bf360c" }}>
                  Registra una compra al proveedor para reponer el stock de los insumos que faltan.
                </div>
              </div>
              <button
                onClick={irACompras}
                style={{
                  background: "#e65100", color: "#fff", border: "none",
                  borderRadius: 8, padding: "7px 14px",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                Ir a Compras
              </button>
            </div>
          )}
        </div>
        <div className="modal-footer modal-footer--center">
          <button className="btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL ELIMINAR ORDEN
   ═══════════════════════════════════════════════════════════ */
function ModalEliminarOrden({ orden, onClose, onConfirm }) {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (!orden) return null;

  const handleConfirm = async () => {
    if (String(confirmText).toUpperCase().trim() !== "ELIMINAR") return;
    try {
      setSubmitting(true);
      await onConfirm(orden.id);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()}>
        <div style={{ padding: "28px 24px 18px", textAlign: "center" }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "#ffebee", border: "1px solid #ef9a9a",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, margin: "0 auto 14px",
          }}><Trash2 size={24} style={{ color: "#c62828" }} /></div>
          <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "#1a1a1a" }}>Eliminar orden</h3>
          <p style={{ margin: "0 0 4px", fontSize: 14, color: "#616161" }}>
            ¿Estás seguro de que deseas eliminar la orden <strong>#{orden.id}</strong>?
          </p>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#9e9e9e" }}>
            <strong>{orden.nombreProducto}</strong> × {orden.cantidad}
          </p>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#9e9e9e" }}>Esta operación es definitiva y no podrá ser revertida.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            <div style={{ fontSize: 12, color: "#616161" }}>Para confirmar escribe <strong>ELIMINAR</strong> en la casilla:</div>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="Escribe ELIMINAR para confirmar"
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13 }}
            />
          </div>
        </div>
        <div className="modal-footer modal-footer--center">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={submitting || String(confirmText).toUpperCase().trim() !== "ELIMINAR"}
            style={{
              padding: "9px 20px", borderRadius: 9, border: "none",
              background: "#c62828", color: "#fff",
              fontWeight: 700, fontSize: 13, cursor: submitting ? "default" : "pointer",
              fontFamily: "inherit", opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Eliminando…" : "Sí, eliminar orden"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL FORMULARIO — CREAR / EDITAR ORDEN
   ═══════════════════════════════════════════════════════════ */
function ModalFormOrden({ orden, productos, insumos, onClose, onSave }) {
  const [form, setForm] = useState({
    idProducto:   orden?.idProducto   ?? "",
    cantidad:     orden?.cantidad     ?? 1,
    fechaInicio:  orden?.fechaInicio  ?? "",
    fechaEntrega: orden?.fechaEntrega ?? "",
    estado:       orden?.estado       ?? "Pendiente",
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productLoading, setProductLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const loadProduct = async (productId) => {
    if (!productId) {
      setSelectedProduct(null);
      return;
    }
    setProductLoading(true);
    try {
      const product = await getProducto(Number(productId));
      setSelectedProduct(product);
    } catch (err) {
      setSelectedProduct(null);
    } finally {
      setProductLoading(false);
    }
  };

  useEffect(() => {
    if (form.idProducto) {
      loadProduct(form.idProducto);
    } else {
      setSelectedProduct(null);
    }
  }, [form.idProducto]);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: "" }));
  };

  const handleSave = async () => {
    const today = localToday();
    const e = {};
    if (!form.idProducto)                    e.idProducto = "Seleccione un producto";
    if (!form.cantidad || form.cantidad < 1) e.cantidad   = "Ingrese una cantidad válida";
    if (!orden) {
      if (!form.fechaEntrega)             e.fechaEntrega = "La fecha de entrega es obligatoria";
      else if (form.fechaEntrega < today) e.fechaEntrega = "La fecha no puede ser anterior al día de hoy";
    } else if (form.fechaEntrega && form.fechaEntrega < today) {
      e.fechaEntrega = "La fecha no puede ser anterior al día de hoy";
    }
    const minFechaInicio = orden ? (orden.fechaInicio || today) : today;
    if (form.fechaInicio && form.fechaInicio < minFechaInicio) {
      e.fechaInicio = orden
        ? "No puede ser anterior a la fecha de inicio original de la orden"
        : "La fecha de inicio no puede ser anterior al día de hoy";
    }
    if (form.fechaInicio && form.fechaEntrega && form.fechaInicio > form.fechaEntrega) e.fechaInicio = "La fecha de inicio no puede ser después de la entrega";
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    const payload = {
      ID_Producto: Number(form.idProducto),
      Cantidad:    Number(form.cantidad),
    };
    if (form.fechaEntrega)                     payload.Fecha_Entrega = form.fechaEntrega;
    if (selectedProduct?.ficha_tecnica?.ID_Ficha) payload.ID_Ficha  = selectedProduct.ficha_tecnica.ID_Ficha;
    if (form.fechaInicio)                      payload.Fecha_inicio  = form.fechaInicio;

    try {
      if (orden?.id) {
        await editarOrden(orden.id, payload);
        if (form.estado !== orden.estado) {
          const estadoNum = ESTADO_TO_NUM[form.estado];
          const loteData = form.estado === "Completada" ? { Fecha_Produccion: today } : {};
          await cambiarEstadoOrden(orden.id, estadoNum, loteData);
          // Si se completa y hay pedido asociado, moverlo a "Listo" automáticamente
          if (form.estado === "Completada" && orden.idVenta) {
            try { await cambiarEstadoVenta(orden.idVenta, 11); } catch (_) {}
          }
        }
      } else {
        await crearOrden(payload);
      }
      onSave();
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
      <div className="modal-box" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Producción</p>
            <h2 className="modal-header__title">{orden ? `Editar Orden #${orden.id}` : "Nueva Orden"}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Producto */}
          <div className="form-group">
            <label className="form-label">Producto <span className="required">*</span></label>
            <SearchableSelect
              options={productos}
              value={form.idProducto}
              onChange={e => set("idProducto", e.target.value)}
              getValue={p => p.id}
              getLabel={p => p.nombre}
              placeholder="Seleccione un producto…"
              searchPlaceholder="Buscar producto…"
              error={!!errors.idProducto}
            />
            {errors.idProducto && <span className="field-error">{errors.idProducto}</span>}
          </div>

          {/* Ficha técnica */}
          <div className="form-group">
            <label className="form-label">Ficha técnica</label>
            <div className="field-input field-input--disabled" style={{ padding: "11px 14px", minHeight: 42, display: "flex", alignItems: "center", gap: 8 }}>
              {productLoading ? (
                <span style={{ color: "#616161" }}>Cargando ficha…</span>
              ) : selectedProduct?.ficha_tecnica ? (
                <span style={{ color: "#2e7d32", fontWeight: 700 }}>Sí — versión {selectedProduct.ficha_tecnica.Version || "1.0"}</span>
              ) : form.idProducto ? (
                <span style={{ color: "#c62828", fontWeight: 600 }}>No disponible</span>
              ) : (
                <span style={{ color: "#616161" }}>Selecciona un producto para ver la ficha</span>
              )}
            </div>
          </div>

          {/* Cantidad */}
          <div className="form-group">
            <label className="form-label">Cantidad <span className="required">*</span></label>
            <input
              type="number"
              min={1}
              className={`field-input${errors.cantidad ? " error" : ""}`}
              value={form.cantidad}
              onChange={e => set("cantidad", e.target.value)}
            />
            {errors.cantidad && <span className="field-error">{errors.cantidad}</span>}
          </div>

          {/* Estado — solo al editar */}
          {orden && (
            <div className="form-group">
              <label className="form-label">Estado</label>
              {(VALID_TRANSITIONS[orden.estado] || []).length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <EstadoBadge estado={orden.estado} />
                  <span style={{ fontSize: 11, color: "#9e9e9e" }}>Estado final, sin cambios posibles</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Preview de la transición */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 28 }}>
                    <EstadoBadge estado={orden.estado} />
                    {form.estado !== orden.estado && (
                      <>
                        <span style={{ color: "#bdbdbd", fontSize: 18, lineHeight: 1 }}>→</span>
                        <EstadoBadge estado={form.estado} />
                      </>
                    )}
                  </div>
                  {/* Pills seleccionables */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[orden.estado, ...(VALID_TRANSITIONS[orden.estado] || [])].map(est => {
                      const c = ESTADO_COLORS[est] || { bg: "#f5f5f5", color: "#757575", border: "#e0e0e0" };
                      const sel = form.estado === est;
                      return (
                        <button
                          key={est}
                          type="button"
                          onClick={() => set("estado", est)}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "7px 14px", borderRadius: 20,
                            border: `2px solid ${sel ? c.color : c.border}`,
                            background: sel ? c.bg : "#fff",
                            color: sel ? c.color : "#9e9e9e",
                            fontSize: 12, fontWeight: sel ? 700 : 500,
                            cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
                          }}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: sel ? c.color : "#bdbdbd", flexShrink: 0 }} />
                          {est}
                          {est === orden.estado && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 2 }}>actual</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fechas */}
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Fecha de inicio</label>
              <input
                type="date"
                className={`field-input${errors.fechaInicio ? " error" : ""}`}
                min={orden ? (orden.fechaInicio || localToday()) : localToday()}
                max={form.fechaEntrega || undefined}
                value={form.fechaInicio}
                onChange={e => set("fechaInicio", e.target.value)}
              />
              {errors.fechaInicio && <span className="field-error">{errors.fechaInicio}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de entrega <span className="required">*</span></label>
              <input
                type="date"
                className={`field-input${errors.fechaEntrega ? " error" : ""}`}
                min={form.fechaInicio || localToday()}
                value={form.fechaEntrega}
                onChange={e => set("fechaEntrega", e.target.value)}
              />
              {errors.fechaEntrega && <span className="field-error">{errors.fechaEntrega}</span>}
            </div>
          </div>

          {errors._api && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              background: "#ffebee", border: "1.5px solid #ef9a9a",
              borderRadius: 10, padding: "12px 14px",
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#c62828", marginBottom: 2 }}>
                  Error al guardar
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#b71c1c", lineHeight: 1.4 }}>
                  {errors._api}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : orden ? "Guardar cambios" : "Crear orden"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════ */
export default function GestionOrdenesProduccion() {
  const location      = useLocation();
  const initialSearch = new URLSearchParams(location.search).get("search") || "";

  const [ordenes,      setOrdenes]      = useState([]);
  const [productos,    setProductos]    = useState([]);
  const [insumos,      setInsumos]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState(initialSearch);
  const [filterEstado, setFilterEstado] = useState("todos");
  const [filterDesde,  setFilterDesde]  = useState("");
  const [filterHasta,  setFilterHasta]  = useState("");
  const [showFilter,   setShowFilter]   = useState(false);
  const [page,         setPage]         = useState(1);
  const [modal,        setModal]        = useState(null);
  const [toast,        setToast]        = useState(null);
  const [actionSaving, setActionSaving] = useState(false);
  const filterRef = useRef();

  const showToast = (msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [ordenesData, pData, iData] = await Promise.all([
        getOrdenes(),
        getProductos().catch(() => ({ productos: [] })),
        getInsumos().catch(() => ({ insumos: [] })),
      ]);
      setOrdenes([...(ordenesData || [])].sort((a, b) => b.id - a.id));
      setProductos(
        (pData.productos || [])
          .filter(p => p.Estado !== 0)
          .map(p => ({ id: p.ID_Producto, nombre: p.nombre || p.Nombre || "" }))
      );
      setInsumos(
        (iData.insumos || [])
          .filter(i => i.Estado !== 0)
          .map(i => ({ id: i.ID_Insumo, nombre: i.Nombre }))
      );
    } catch (e) {
      showToast(e.message || "Error al cargar órdenes", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  useEffect(() => {
    const h = e => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = ordenes.filter(o => {
    const q = search.toLowerCase();
    const matchQ = [
      String(o.id ?? ""),
      o.nombreProducto ?? "",
      o.nombreInsumo   ?? "",
    ].some(v => v.toLowerCase().includes(q));
    const matchE = filterEstado === "todos" || o.estado === filterEstado;

    let matchFecha = true;
    if (filterDesde || filterHasta) {
      const fechaRaw = String(o.fechaInicio || "").slice(0, 10);
      const fecha = fechaRaw ? new Date(`${fechaRaw}T00:00:00`) : null;
      if (!fecha) matchFecha = false;
      if (filterDesde && fecha && new Date(`${filterDesde}T00:00:00`) > fecha) matchFecha = false;
      if (filterHasta && fecha && new Date(`${filterHasta}T00:00:00`) < fecha) matchFecha = false;
    }
    return matchQ && matchE && matchFecha;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);

  const paged      = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  useEffect(() => setPage(1), [search, filterEstado, filterDesde, filterHasta]);

  const handleSaveOrder = async () => {
    await cargarDatos();
    showToast(modal?.orden ? "Orden actualizada" : "Orden creada");
    setModal(null);
  };

  const handleCambiarEstado = async (idOrden, nuevoEstado, loteData = {}) => {
    const estadoNum = ESTADO_TO_NUM[nuevoEstado];
    const ordenActual = ordenes.find(o => o.id === idOrden);
    setActionSaving(true);
    try {
      await cambiarEstadoOrden(idOrden, estadoNum, loteData);

      // Si la orden se completa y tiene pedido asociado, pasar el pedido a "Listo" (estado 11)
      if (nuevoEstado === "Completada" && ordenActual?.idVenta) {
        try {
          await cambiarEstadoVenta(ordenActual.idVenta, 11);
        } catch (_) { /* Si falla no interrumpir el flujo normal */ }
      }

      showToast(`Estado cambiado a "${nuevoEstado}"`);
      setModal(null);
      await cargarDatos();
    } catch (e) {
      const isApiError = typeof e.statusCode === "number";
      const errorMsg = isApiError
        ? (e.message || "Error al cambiar estado")
        : "La operación puede estar procesándose en el servidor. Recarga la página antes de reintentar para evitar aplicar el cambio dos veces.";
      setModal({ type: "errorEstado", mensaje: errorMsg, orden: ordenActual });
    } finally {
      setActionSaving(false);
    }
  };

  const handleEliminar = async (idOrden) => {
    try {
      await eliminarOrden(idOrden);
      showToast("Orden eliminada", "warn");
      await cargarDatos();
    } catch (e) {
      showToast(e.message || "Error al eliminar", "error");
    }
    setModal(null);
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-header__title">Órdenes de Producción</h1>
        <div className="page-header__line" />
      </div>

      <div className="page-inner">
        <div className="toolbar">
          <div className="search-wrap">
            <span className="search-icon" style={{ display: "flex", alignItems: "center" }}><Search size={15} /></span>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar orden, producto…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div ref={filterRef} style={{ position: "relative", zIndex: 200 }}>
            <button
              className={`filter-icon-btn${filterEstado !== "todos" || filterDesde || filterHasta ? " has-filter" : ""}`}
              onClick={() => setShowFilter(v => !v)}
              data-tooltip="Filtrar órdenes"
            >▼</button>
            {showFilter && (
              <div className="filter-dropdown" style={{ minWidth: 220, zIndex: 200 }}>
                <p className="filter-section-title">Estado</p>
                {["todos", ...ESTADOS_ORDEN].map(f => (
                  <button
                    key={f}
                    className={`filter-option${filterEstado === f ? " active" : ""}`}
                    onClick={() => { setFilterEstado(f); setPage(1); setShowFilter(false); }}
                  >
                    <span className="filter-dot" style={{ background: ESTADO_CONFIG[f]?.dot || "#bdbdbd" }} />
                    {f === "todos" ? "Todos" : f}
                  </button>
                ))}
                <div style={{ height: 1, background: "#f0f0f0", margin: "8px 0" }} />
                <DateRangeFilter
                  desde={filterDesde}
                  hasta={filterHasta}
                  label="Fecha de inicio"
                  onApply={({ desde, hasta }) => {
                    setFilterDesde(desde || "");
                    setFilterHasta(hasta || "");
                  }}
                  onClear={() => {
                    setFilterDesde("");
                    setFilterHasta("");
                  }}
                />
              </div>
            )}
          </div>

          {(filterEstado !== "todos" || filterDesde || filterHasta || search) && (
            <button className="btn-limpiar" onClick={() => { setSearch(""); setFilterEstado("todos"); setFilterDesde(""); setFilterHasta(""); }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <X size={14} /> Limpiar
            </button>
          )}

          <button className="btn-agregar" onClick={() => setModal({ type: "form" })} data-tooltip="Crear nueva orden de producción">
            Agregar Orden <span style={{ fontSize: 18 }}>+</span>
          </button>
        </div>

        <div className="card">
          <div className="tbl-wrapper">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>Nº</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Entrega</th>
                  <th>Costo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <div className="empty-state__icon"><Building2 size={32} strokeWidth={1} style={{ color: "#bdbdbd" }} /></div>
                        <p className="empty-state__text">
                          {search || filterEstado !== "todos" ? "Sin órdenes que coincidan." : "No hay órdenes registradas."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : paged.map((orden, idx) => (
                  <tr key={orden.id} className="tbl-row">
                    <td>
                      <span className="row-num">
                        {String((safePage - 1) * PER_PAGE + idx + 1).padStart(2, "0")}
                      </span>
                    </td>
                    <td>
                      <div className="orden-num" style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>
                        {orden.nombreProducto || "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "#9e9e9e" }}>#{orden.id}</div>
                    </td>
                    <td style={{ fontSize: 14, fontWeight: 700, color: "#2e7d32" }}>{orden.cantidad}</td>
                    <td>
                      <span className={`date-badge${urgenciaFecha(orden.fechaEntrega) === "urgente" ? " date-badge--urgente" : urgenciaFecha(orden.fechaEntrega) === "pronto" ? " date-badge--pronto" : ""}`}>
                        {fmtFecha(orden.fechaEntrega)}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 700 }}>
                      {orden.costo > 0 ? fmt(orden.costo) : <span style={{ color: "#9e9e9e" }}>—</span>}
                    </td>
                    <td><EstadoBadge estado={orden.estado} /></td>
                    <td>
                      <div className="actions-cell">
                        <button className="act-btn act-btn--view"   data-tooltip="Ver detalles"   onClick={() => setModal({ type: "detalles", orden })}><Eye size={15} /></button>
                        <button className="act-btn act-btn--edit"   data-tooltip="Editar"         onClick={() => setModal({ type: "form",     orden })}><PenLine size={15} /></button>
                        <button className="act-btn act-btn--status" data-tooltip="Cambiar estado" onClick={() => setModal({ type: "estado",   orden })} disabled={actionSaving}><RefreshCw size={15} /></button>
                        <button className="act-btn act-btn--delete" data-tooltip="Eliminar"       onClick={() => setModal({ type: "eliminar", orden })}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <span className="pagination-count">
              {filtered.length} {filtered.length === 1 ? "orden" : "órdenes"} en total
            </span>
            <div className="pagination-btns">
              <button className="pg-btn-arrow" onClick={() => setPage(1)} disabled={safePage === 1}>«</button>
              <button className="pg-btn-arrow" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
              <span className="pg-pill">Página {safePage} de {totalPages}</span>
              <button className="pg-btn-arrow" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
              <button className="pg-btn-arrow" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>»</button>
            </div>
          </div>
        </div>
      </div>

      {modal?.type === "form" && (
        <ModalFormOrden
          orden={modal.orden}
          productos={productos}
          insumos={insumos}
          onClose={() => setModal(null)}
          onSave={handleSaveOrder}
        />
      )}
      {modal?.type === "detalles" && (
        <ModalDetallesOrden orden={modal.orden} onClose={() => setModal(null)} />
      )}
      {modal?.type === "estado" && (
        <ModalCambiarEstado
          orden={modal.orden}
          saving={actionSaving}
          onClose={() => setModal(null)}
          onConfirm={handleCambiarEstado}
        />
      )}
      {modal?.type === "eliminar" && (
        <ModalEliminarOrden orden={modal.orden} onClose={() => setModal(null)} onConfirm={handleEliminar} />
      )}
      {modal?.type === "errorEstado" && (
        <ModalErrorEstado
          mensaje={modal.mensaje}
          orden={modal.orden}
          onClose={() => setModal(null)}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
