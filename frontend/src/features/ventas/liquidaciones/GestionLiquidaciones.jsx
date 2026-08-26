import { useState, useEffect, useCallback } from "react";
import { getDomicilios } from "../../../services/domiciliosService.js";
import { fmtFecha } from "../../../utils/dateUtils.js";
import { X, Calculator, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, Bike } from "lucide-react";

/* ── Formato moneda ─────────────────────────────────────── */
const fmt = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", minimumFractionDigits: 0,
  }).format(n ?? 0);

/* ── Períodos ───────────────────────────────────────────── */
const PERIODOS = [
  { id: "hoy",    label: "Hoy" },
  { id: "semana", label: "Esta semana" },
  { id: "mes",    label: "Este mes" },
  { id: "todo",   label: "Total histórico" },
];

function calcularRango(periodo) {
  const ahora = new Date();
  const hoy   = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

  if (periodo === "hoy") {
    const fin = new Date(hoy); fin.setHours(23, 59, 59, 999);
    return { desde: hoy, hasta: fin };
  }
  if (periodo === "semana") {
    const diasDesdelunes = (hoy.getDay() + 6) % 7; // lunes = 0
    const lunes  = new Date(hoy); lunes.setDate(hoy.getDate() - diasDesdelunes);
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
    domingo.setHours(23, 59, 59, 999);
    return { desde: lunes, hasta: domingo };
  }
  if (periodo === "mes") {
    const ini = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59, 999);
    return { desde: ini, hasta: fin };
  }
  return { desde: null, hasta: null };
}

function filtrarEntregadas(domicilios, periodo) {
  const entregadas = domicilios.filter((d) => d.estado === "Entregado");
  if (periodo === "todo") return entregadas;
  const { desde, hasta } = calcularRango(periodo);
  return entregadas.filter((d) => {
    const fechaStr = d.fecha_entrega_real || d.fecha_pedido;
    if (!fechaStr) return false;
    const fecha = new Date(fechaStr);
    return fecha >= desde && fecha <= hasta;
  });
}

/* ── Agrupar domicilios por repartidor ──────────────────── */
function agruparPorRepartidor(domicilios) {
  const mapa = {};
  domicilios.forEach((d) => {
    if (!d.idEmpleado) return;
    if (!mapa[d.idEmpleado]) {
      mapa[d.idEmpleado] = {
        idEmpleado: d.idEmpleado,
        nombre: d.nombre_repartidor || `Repartidor #${d.idEmpleado}`,
        todos: [],
      };
    }
    mapa[d.idEmpleado].todos.push(d);
  });
  return Object.values(mapa);
}

/* ── Toast ──────────────────────────────────────────────── */
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28,
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 20px", borderRadius: 12,
      background: toast.type === "error" ? "#c62828" : "#2e7d32",
      color: "#fff", fontSize: 14, fontWeight: 600,
      zIndex: 99999, boxShadow: "0 8px 24px rgba(0,0,0,.2)",
    }}>
      {toast.type === "error" ? <X size={16} /> : <CheckCircle2 size={16} />}
      {toast.message}
    </div>
  );
}

/* ── Modal de liquidación ───────────────────────────────── */
function ModalLiquidacion({ repartidor, entregas, valorFee, periodo, onClose, onConfirmar }) {
  if (!repartidor) return null;
  const total = entregas.length * (Number(valorFee) || 0);
  const labelPeriodo = PERIODOS.find((p) => p.id === periodo)?.label || periodo;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 20, width: "90%", maxWidth: 520,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,.2)",
      }}>

        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg,#2e7d32,#43a047)",
          borderRadius: "20px 20px 0 0", padding: "20px 24px",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: "rgba(255,255,255,.7)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>
              Liquidación de pago
            </p>
            <h2 style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 800 }}>
              {repartidor.nombre}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,.7)" }}>
              Período: {labelPeriodo}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", color: "#fff", display: "flex" }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "22px 24px" }}>

          {/* Resumen */}
          <div style={{ background: "#f9fafb", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            {[
              ["Entregas en período", entregas.length],
              ["Valor por domicilio", fmt(valorFee)],
            ].map(([label, valor]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f0f0f0", fontSize: 13 }}>
                <span style={{ color: "#757575", fontWeight: 600 }}>{label}</span>
                <span style={{ fontWeight: 700 }}>{valor}</span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div style={{
            background: "#e8f5e9", borderRadius: 12, padding: "16px 18px",
            display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20,
          }}>
            <span style={{ fontWeight: 700, color: "#2e7d32", fontSize: 15 }}>Total a pagar</span>
            <span style={{ fontWeight: 800, color: "#2e7d32", fontSize: 24 }}>{fmt(total)}</span>
          </div>

          {/* Lista de entregas */}
          {entregas.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: ".06em" }}>
                Detalle — {entregas.length} entrega{entregas.length !== 1 ? "s" : ""}
              </p>
              <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {entregas.map((e) => (
                  <div key={e.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 12px", background: "#fafafa", borderRadius: 8, fontSize: 12,
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#2e7d32" }}>{e.numero}</div>
                      <div style={{ color: "#9e9e9e" }}>{e.cliente?.nombre || "—"}</div>
                    </div>
                    <div style={{ textAlign: "right", color: "#757575" }}>
                      {fmtFecha(e.fecha_entrega_real || e.fecha_pedido)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {entregas.length === 0 && (
            <p style={{ textAlign: "center", color: "#bdbdbd", fontSize: 13, marginBottom: 20 }}>
              Sin entregas en este período
            </p>
          )}

          {/* Botones */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1.5px solid #e0e0e0", background: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14, color: "#424242" }}
            >
              Cancelar
            </button>
            <button
              onClick={onConfirmar}
              disabled={entregas.length === 0}
              style={{
                flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
                background: entregas.length === 0 ? "#e0e0e0" : "#2e7d32",
                color: entregas.length === 0 ? "#9e9e9e" : "#fff",
                cursor: entregas.length === 0 ? "default" : "pointer",
                fontWeight: 700, fontSize: 14,
              }}
            >
              Registrar pago
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
   ══════════════════════════════════════════════════════════ */
export default function GestionLiquidaciones() {
  const [todosDomic,   setTodosDomic]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [periodo,      setPeriodo]      = useState("mes");
  const [valorFee,     setValorFee]     = useState(5000);
  const [expandido,    setExpandido]    = useState(null);
  const [modal,        setModal]        = useState(null); // { repartidor, entregas }
  const [toast,        setToast]        = useState(null);
  const [pagados,      setPagados]      = useState(() => {
    try { return JSON.parse(localStorage.getItem("liquidaciones_pagadas") || "{}"); }
    catch { return {}; }
  });

  const showToast = (message, type = "ok") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDomicilios({ porPagina: 500 });
      setTodosDomic(data.domicilios || []);
    } catch (err) {
      setError(err?.message || "Error al cargar domicilios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /* ── Derivados ── */
  const repartidores = agruparPorRepartidor(todosDomic).map((r) => {
    const entregasPeriodo = filtrarEntregadas(r.todos, periodo);
    const total           = entregasPeriodo.length * (Number(valorFee) || 0);
    const claveKey        = `${r.idEmpleado}_${periodo}`;
    const pagado          = !!pagados[claveKey];
    return { ...r, entregasPeriodo, total, pagado, claveKey };
  });

  const handleRegistrar = () => {
    if (!modal) return;
    const nuevos = { ...pagados, [modal.claveKey]: true };
    setPagados(nuevos);
    try { localStorage.setItem("liquidaciones_pagadas", JSON.stringify(nuevos)); } catch { /* silent */ }
    setModal(null);
    showToast(`Pago registrado para ${modal.repartidor.nombre}`);
  };

  /* ── Estilos reutilizables ── */
  const s = {
    wrapper:  { background: "linear-gradient(180deg,#e8f5e9 0%,#f5fbf5 18%,#fff 42%)", minHeight: "100vh", paddingBottom: 60, fontFamily: "'DM Sans',sans-serif" },
    inner:    { maxWidth: 1000, margin: "0 auto", padding: "0 24px", marginTop: 28 },
    title:    { margin: "0 0 10px", fontFamily: "'Nunito',sans-serif", fontSize: "clamp(26px,4.5vw,38px)", fontWeight: 800, fontStyle: "italic", color: "#2e7d32" },
    line:     { width: 52, height: 3.5, background: "#2e7d32", borderRadius: 2, margin: "0 auto" },
    label:    { fontSize: 11, fontWeight: 700, color: "#9e9e9e", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em" },
    chip:     (active) => ({
      padding: "8px 16px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 700,
      border: active ? "1.5px solid #4caf50" : "1.5px solid #e0e0e0",
      background: active ? "#e8f5e9" : "#fafafa",
      color: active ? "#2e7d32" : "#616161",
    }),
  };

  return (
    <div style={s.wrapper}>
      {/* Header */}
      <div style={{ textAlign: "center", paddingBottom: 10 }}>
        <h1 style={s.title}>Liquidación de Pagos</h1>
        <div style={s.line} />
      </div>

      <div style={s.inner}>

        {/* Controles */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end", marginBottom: 28 }}>

          {/* Período */}
          <div>
            <p style={s.label}>Período</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PERIODOS.map((p) => (
                <button key={p.id} style={s.chip(periodo === p.id)} onClick={() => setPeriodo(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Valor por domicilio */}
          <div>
            <p style={s.label}>Valor por domicilio</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#2e7d32" }}>$</span>
              <input
                type="number"
                min={0}
                step={500}
                value={valorFee}
                onChange={(e) => setValorFee(Math.max(0, Number(e.target.value)))}
                style={{
                  padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e0e0e0",
                  fontSize: 14, width: 130, fontWeight: 700, outline: "none",
                }}
              />
            </div>
          </div>

          {/* Recargar */}
          <button
            onClick={cargar}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "1.5px solid #e0e0e0", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#616161" }}
          >
            <RefreshCw size={14} /> Recargar
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "#ffebee", border: "1.5px solid #ef9a9a", borderRadius: 12, padding: "14px 18px", color: "#c62828", fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Cargando */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1.5px solid #f0f0f0" }}>
                {[70, 50, 85, 40].map((w, j) => (
                  <div key={j} style={{
                    height: 14, borderRadius: 7, marginBottom: 10, width: `${w}%`,
                    background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.4s infinite",
                  }} />
                ))}
              </div>
            ))}
          </div>
        ) : repartidores.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9e9e9e" }}>
            <Bike size={48} strokeWidth={1} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 15, fontWeight: 600 }}>No hay domiciliarios con entregas registradas</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
            {repartidores.map((r) => {
              const abierto = expandido === r.idEmpleado;
              return (
                <div key={r.idEmpleado} style={{
                  background: "#fff", borderRadius: 16, padding: "20px 20px 16px",
                  border: r.pagado ? "1.5px solid #a5d6a7" : "1.5px solid #f0f0f0",
                  boxShadow: "0 2px 10px rgba(0,0,0,.05)",
                }}>
                  {/* Encabezado tarjeta */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#212121" }}>{r.nombre}</div>
                      <div style={{ fontSize: 12, color: "#9e9e9e", marginTop: 2 }}>
                        {r.todos.length} entrega{r.todos.length !== 1 ? "s" : ""} en total
                      </div>
                    </div>
                    {r.pagado && (
                      <span style={{
                        background: "#e8f5e9", color: "#2e7d32", border: "1px solid #a5d6a7",
                        borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 700,
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <CheckCircle2 size={10} /> Pagado
                      </span>
                    )}
                  </div>

                  {/* Stats del período */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                    <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: "#9e9e9e", fontWeight: 700, marginBottom: 4 }}>ENTREGAS</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#1565c0" }}>{r.entregasPeriodo.length}</div>
                    </div>
                    <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: "#9e9e9e", fontWeight: 700, marginBottom: 4 }}>A PAGAR</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#2e7d32" }}>{fmt(r.total)}</div>
                    </div>
                  </div>

                  {/* Toggle detalle */}
                  <button
                    onClick={() => setExpandido(abierto ? null : r.idEmpleado)}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9e9e9e", fontWeight: 600, padding: 0, marginBottom: abierto ? 10 : 14 }}
                  >
                    {abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {abierto ? "Ocultar" : "Ver"} entregas del período
                  </button>

                  {/* Lista de entregas */}
                  {abierto && (
                    <div style={{ marginBottom: 14 }}>
                      {r.entregasPeriodo.length === 0 ? (
                        <p style={{ fontSize: 12, color: "#bdbdbd", margin: "0 0 8px" }}>
                          Sin entregas en este período
                        </p>
                      ) : (
                        <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
                          {r.entregasPeriodo.map((e) => (
                            <div key={e.id} style={{
                              display: "flex", justifyContent: "space-between", padding: "7px 10px",
                              background: "#f5f5f5", borderRadius: 8, fontSize: 11,
                            }}>
                              <span style={{ fontWeight: 700 }}>{e.numero}</span>
                              <span style={{ color: "#9e9e9e" }}>
                                {fmtFecha(e.fecha_entrega_real || e.fecha_pedido)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Botón liquidar */}
                  <button
                    onClick={() => setModal({ repartidor: r, entregas: r.entregasPeriodo, claveKey: r.claveKey })}
                    style={{
                      width: "100%", padding: "10px 0", borderRadius: 10, border: "none",
                      background: r.entregasPeriodo.length === 0 ? "#f5f5f5" : r.pagado ? "#e8f5e9" : "#2e7d32",
                      color: r.entregasPeriodo.length === 0 ? "#bdbdbd" : r.pagado ? "#2e7d32" : "#fff",
                      cursor: r.entregasPeriodo.length === 0 ? "default" : "pointer",
                      fontWeight: 700, fontSize: 13,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    <Calculator size={14} />
                    {r.pagado ? "Reliquidar período" : "Generar liquidación"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <ModalLiquidacion
          repartidor={modal.repartidor}
          entregas={modal.entregas}
          valorFee={valorFee}
          periodo={periodo}
          onClose={() => setModal(null)}
          onConfirmar={handleRegistrar}
        />
      )}

      <Toast toast={toast} />

      {/* Keyframe shimmer */}
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}
