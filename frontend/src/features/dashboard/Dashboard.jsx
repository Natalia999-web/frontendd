import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
  CartesianGrid, Legend,
} from "recharts";
import "./dashboard.css";
import { getDashboard } from "../../services/dashboardService";

const PERIODOS      = ["hoy", "semana", "mes", "custom"];
const PERIODO_LABEL = { hoy: "Hoy", semana: "Esta semana", mes: "Este mes", custom: "Rango" };

/* ── Custom Tooltip ─────────────────────────────────────── */
function CustomTooltip({ active, payload, label, prefix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, padding: "8px 14px", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", fontSize: 13 }}>
      <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#424242" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: "2px 0", color: p.fill || p.color || p.stroke || "#43a047", fontWeight: 600 }}>
          {p.name}: {prefix === "$"
            ? `$${(p.value || 0).toLocaleString("es-CO")}`
            : p.value}
        </p>
      ))}
    </div>
  );
}

/* ── Period Selector ────────────────────────────────────── */
function PeriodSelect({ value, onChange }) {
  return (
    <div className="period-select-wrap">
      <select className="period-select" value={value} onChange={e => onChange(e.target.value)}>
        {PERIODOS.map(p => <option key={p} value={p}>{PERIODO_LABEL[p]}</option>)}
      </select>
      <span className="period-arrow">▼</span>
    </div>
  );
}

/* ── KPI Card ───────────────────────────────────────────── */
function KpiCard({ icon, label, valor, delta, positive, color }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ background: color + "20", color }}>{icon}</div>
      <div className="kpi-body">
        <p className="kpi-label">{label}</p>
        <p className="kpi-valor">{valor}</p>
      </div>
      <span className={"kpi-delta" + (positive ? " kpi-delta--up" : " kpi-delta--down")}>
        {positive ? "↑" : "↓"} {delta}
      </span>
    </div>
  );
}

/* ── Chart Card desplegable ─────────────────────────────── */
function ChartCard({ title, period, onPeriod, children, defaultOpen = true, className = "" }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`chart-card${open ? " chart-card--open" : ""} ${className}`.trim()}>
      <div className="chart-card__header" onClick={() => setOpen(v => !v)}>
        <h3 className="chart-card__title">{title}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onPeriod && (
            <div onClick={e => e.stopPropagation()}>
              <PeriodSelect value={period} onChange={onPeriod} />
            </div>
          )}
          <div className="chart-card__chevron">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
      <div className="chart-card__body">{children}</div>
    </div>
  );
}

const EMPTY_DATA = { kpi: { ventas: {}, pedidos: {}, clientes: {}, ticket: {} }, graficaVentas: [], productosTop: [] };

/* ── Main Dashboard ─────────────────────────────────────── */
export default function Dashboard() {
  const [datos,    setDatos]    = useState(EMPTY_DATA);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [animated, setAnimated] = useState(false);
  const [periodo,  setPeriodo]  = useState("hoy");
  const [periodoCharts, setPeriodoCharts] = useState("hoy");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(t);
  }, []);

  const cargar = useCallback(async (p, desde, hasta) => {
    setLoading(true);
    setError(false);
    try {
      const d = await getDashboard(p, desde, hasta);
      setDatos(d);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (periodo !== "custom" || (fechaInicio && fechaFin)) {
      cargar(periodo, fechaInicio, fechaFin);
    }
  }, [periodo, fechaInicio, fechaFin]);

  const { kpi, graficaVentas, productosTop } = datos;
  const totalUds = productosTop.reduce((s, p) => s + p.value, 0) || 1;
  const rangoLabel = periodo === "custom" && fechaInicio && fechaFin
    ? `${fechaInicio} → ${fechaFin}`
    : PERIODO_LABEL[periodo] || "Periodo";

  // Bar chart: ventas por hora/día/semana
  const barData = graficaVentas.map(p => ({ hora: p.etiqueta, ventas: p.actual }));

  // Area chart: comparativa actual vs anterior
  const areaData = graficaVentas.map(p => ({ t: p.etiqueta, actual: p.actual, anterior: p.anterior }));

  if (loading) {
    return (
      <div className="dash-wrapper dash-wrapper--in">
        <div className="dash-inner" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
          <span style={{ color: "#9e9e9e", fontSize: 14 }}>Cargando datos…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dash-wrapper dash-wrapper--in">
        <div className="dash-inner" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 12 }}>
          <span style={{ fontSize: 32 }}>⚠️</span>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#424242" }}>No se pudieron cargar los datos del dashboard</p>
          <p style={{ margin: 0, fontSize: 13, color: "#9e9e9e" }}>Verifica tu conexión o que el servidor esté activo.</p>
          <button
            onClick={() => cargar(periodo)}
            style={{ marginTop: 8, padding: "8px 20px", borderRadius: 10, border: "1.5px solid #c8e6c9", background: "#fff", color: "#2e7d32", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`dash-wrapper${animated ? " dash-wrapper--in" : ""}`}>
      <div className="dash-inner">

        {/* Print-only header — invisible en pantalla, visible al imprimir */}
        <div className="print-report-header">
          <div>
            <p className="print-report-brand">Tostón App</p>
            <p className="print-report-sub">Dashboard de ventas</p>
          </div>
          <div>
            <p className="print-report-label">Período del reporte</p>
            <p className="print-report-dates">{rangoLabel}</p>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="kpi-strip" style={{ marginBottom: 20 }}>
          <KpiStripInner
            kpi={kpi}
            periodo={periodo}
            setPeriodo={p => {
              setPeriodo(p);
              setPeriodoCharts(p);
              if (p !== "custom") {
                setFechaInicio("");
                setFechaFin("");
              }
            }}
          />
        </div>

        {periodo === "custom" && (
          <div className="dashboard-report-toolbar">
            <div className="dashboard-report-label">
              <span>Rango personalizado</span>
              <span className="dashboard-report-range">{rangoLabel}</span>
            </div>
            <div className="dashboard-report-fields">
              <label className="dashboard-report-field">
                <span>Desde</span>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={e => setFechaInicio(e.target.value)}
                />
              </label>
              <label className="dashboard-report-field">
                <span>Hasta</span>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={e => setFechaFin(e.target.value)}
                />
              </label>
              <button
                className="report-btn"
                type="button"
                disabled={!fechaInicio || !fechaFin}
                onClick={() => cargar("custom", fechaInicio, fechaFin)}
                data-tooltip="Aplicar el rango de fechas seleccionado"
              >
                Aplicar rango
              </button>
              <button
                className="report-btn report-btn--pdf"
                type="button"
                disabled={!fechaInicio || !fechaFin}
                onClick={() => window.print()}
                data-tooltip="Exportar dashboard como PDF"
              >
                Exportar PDF
              </button>
            </div>
          </div>
        )}

        <div className="charts-row" style={{ animationDelay: "0.1s" }}>
          <ChartCard title="Flujo de Ventas" period={periodoCharts} onPeriod={p => { setPeriodoCharts(p); setPeriodo(p); }}>
            {barData.length === 0 || barData.every(d => d.ventas === 0) ? (
              <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#bdbdbd", fontSize: 13 }}>
                Sin pedidos en este período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#43a047" stopOpacity={1} />
                      <stop offset="100%" stopColor="#2e7d32" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hora" tick={{ fontSize: 11, fill: "#9e9e9e" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9e9e9e" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f8f1" }} />
                  <Bar dataKey="ventas" name="Pedidos" fill="url(#barGradient)" radius={[6,6,0,0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Top Productos — Pie Chart */}
          <ChartCard title="Top Productos">
            {productosTop.length === 0 ? (
              <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#bdbdbd", fontSize: 13 }}>
                Sin ventas en este período
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie data={productosTop} cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                      dataKey="value" paddingAngle={3} strokeWidth={0}>
                      {productosTop.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v} uds (${Math.round(v / totalUds * 100)}%)`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  {productosTop.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: "#424242", flex: 1, fontWeight: 500 }}>{p.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a" }}>{p.porcentaje}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>
        </div>

        <div className="charts-row charts-row--bottom">

          {/* Ingresos Reales */}
          <ChartCard title="Ingresos Reales" className="chart-card--stat">
            <div className="stat-big">
              <div className="stat-amount">{kpi.ventas?.valor ?? "$0"}</div>
              <div className={"stat-change" + (kpi.ventas?.positive ? " stat-change--up" : " stat-change--down")}>
                <span>{kpi.ventas?.positive ? "↑" : "↓"}</span> {kpi.ventas?.delta ?? "0%"} vs período anterior
              </div>
            </div>
            {productosTop.length > 0 && (
              <div className="stat-badges">
                {productosTop.slice(0, 3).map((p, i) => (
                  <div key={i} className="stat-badge">
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                    <span>{p.name}</span>
                    <strong>{p.value}</strong>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>

          {/* Ventas en el Tiempo — Area Chart */}
          <ChartCard title="Ventas en el Tiempo">
            {areaData.length === 0 || areaData.every(d => d.actual === 0 && d.anterior === 0) ? (
              <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#bdbdbd", fontSize: 13 }}>
                Sin datos en este período
              </div>
            ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={areaData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#43a047" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#43a047" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAnterior" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#fb8c00" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#fb8c00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 11, fill: "#9e9e9e" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9e9e9e" }} axisLine={false} tickLine={false} allowDecimals={false}
                  tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
                <Tooltip content={<CustomTooltip prefix="$" />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                <Area type="monotone" dataKey="actual"   name="Actual"   stroke="#43a047" strokeWidth={2.5} fill="url(#colorActual)"   />
                <Area type="monotone" dataKey="anterior" name="Anterior" stroke="#fb8c00" strokeWidth={2}   fill="url(#colorAnterior)" strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

      </div>
    </div>
  );
}

function KpiStripInner({ kpi, periodo, setPeriodo }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`kpi-strip-inner${open ? " kpi-strip-inner--open" : ""}`}>
      <div className="kpi-strip__top" onClick={() => setOpen(v => !v)} style={{ cursor: "pointer" }}>
        <span className="kpi-strip__label">Resumen general</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div onClick={e => e.stopPropagation()}>
            <PeriodSelect value={periodo} onChange={setPeriodo} />
          </div>
          <div className="chart-card__chevron" style={{ width: 28, height: 28 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
      <div className="kpi-strip__body">
        <div className="kpi-grid">
          <KpiCard icon="💰" label="Total ventas"    valor={kpi.ventas?.valor   ?? "$0"} delta={kpi.ventas?.delta   ?? "0%"} positive={kpi.ventas?.positive   ?? true} color="#2e7d32" />
          <KpiCard icon="📦" label="Pedidos"         valor={kpi.pedidos?.valor  ?? "0"}  delta={kpi.pedidos?.delta  ?? "0%"} positive={kpi.pedidos?.positive  ?? true} color="#fb8c00" />
          <KpiCard icon="👤" label="Clientes nuevos" valor={kpi.clientes?.valor ?? "0"}  delta={kpi.clientes?.delta ?? "0%"} positive={kpi.clientes?.positive ?? true} color="#5c6bc0" />
          <KpiCard icon="🎫" label="Ticket promedio" valor={kpi.ticket?.valor   ?? "$0"} delta={kpi.ticket?.delta   ?? "0%"} positive={kpi.ticket?.positive   ?? true} color="#26c6da" />
        </div>
      </div>
    </div>
  );
}
