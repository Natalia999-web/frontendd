import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend,
} from "recharts";
import { getDashboard } from "../../services/dashboardService.js";
import { getHistorialPedidos } from "../../services/pedidosService.js";
import { getDevoluciones } from "../../services/devolucionesService.js";
import "./Reportes.css";
import { AlertTriangle, Banknote, Package, Users, Target, CheckCircle2, XCircle, BarChart2, CornerUpLeft } from "lucide-react";

/* ── Constantes ─────────────────────────────────────────── */
const fmt = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", minimumFractionDigits: 0,
  }).format(n ?? 0);

const PERIODOS = [
  { id: "hoy",    label: "Hoy" },
  { id: "semana", label: "Esta semana" },
  { id: "mes",    label: "Este mes" },
];

const COLORS = ["#43a047", "#ef5350", "#fb8c00", "#5c6bc0", "#26c6da", "#ec407a"];

/* ── Tooltip ────────────────────────────────────────────── */
function CustomTooltip({ active, payload, label, esDinero = false }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10,
      padding: "8px 14px", boxShadow: "0 4px 16px rgba(0,0,0,.1)", fontSize: 13,
    }}>
      <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#424242" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: "2px 0", color: p.fill || p.stroke || p.color || "#43a047", fontWeight: 600 }}>
          {p.name}: {esDinero ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

/* ── KPI Card ───────────────────────────────────────────── */
function KpiCard({ icon, label, valor, delta, positive, color, bg }) {
  return (
    <div className="rep-kpi-card">
      <div className="rep-kpi-icon" style={{ background: bg, color }}>{icon}</div>
      <div className="rep-kpi-body">
        <p className="rep-kpi-label">{label}</p>
        <p className="rep-kpi-valor">{valor}</p>
      </div>
      {delta && (
        <span className={`rep-kpi-delta ${positive ? "up" : "down"}`}>{positive ? "↑" : "↓"} {delta}</span>
      )}
    </div>
  );
}

/* ── Chart Card ─────────────────────────────────────────── */
function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rep-chart-card">
      <div className="rep-chart-card__header">
        <h3 className="rep-chart-card__title">{title}</h3>
        {subtitle && <p className="rep-chart-card__sub">{subtitle}</p>}
      </div>
      <div className="rep-chart-card__body">{children}</div>
    </div>
  );
}

/* ── Skeleton KPIs ──────────────────────────────────────── */
function SkeletonKpi() {
  return (
    <div className="rep-kpi-card">
      <div style={{ width: 44, height: 44, borderRadius: 12, background: "#f0f0f0", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="rep-skeleton" style={{ width: "60%", height: 12, marginBottom: 8 }} />
        <div className="rep-skeleton" style={{ width: "40%", height: 22 }} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
   ══════════════════════════════════════════════════════════ */
export default function Reportes() {
  const [periodo,      setPeriodo]      = useState("mes");
  const [dashboard,    setDashboard]    = useState(null);
  const [ventas,       setVentas]       = useState([]);
  const [devoluciones, setDevoluciones] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [errores,      setErrores]      = useState({});

  const cargar = useCallback(async (p) => {
    setLoading(true);
    setErrores({});

    const nuevosErrores = {};

    const [dashResult, ventasResult, devsResult] = await Promise.allSettled([
      getDashboard(p),
      getHistorialPedidos({ porPagina: 100 }),
      getDevoluciones({ porPagina: 100 }),
    ]);

    if (dashResult.status === "fulfilled") {
      setDashboard(dashResult.value);
    } else {
      nuevosErrores.dashboard = dashResult.reason?.message || "Error al cargar dashboard";
      setDashboard(null);
    }

    if (ventasResult.status === "fulfilled") {
      setVentas(ventasResult.value?.pedidos || []);
    } else {
      nuevosErrores.ventas = ventasResult.reason?.message || "Error al cargar ventas";
      setVentas([]);
    }

    if (devsResult.status === "fulfilled") {
      setDevoluciones(devsResult.value?.devoluciones || []);
    } else {
      nuevosErrores.devoluciones = devsResult.reason?.message || "Error al cargar devoluciones";
      setDevoluciones([]);
    }

    setErrores(nuevosErrores);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(periodo); }, [cargar, periodo]);

  /* ── Datos derivados ── */
  const ventasEntregadas = ventas.filter((v) => v.estado === "Entregado");
  const ventasCanceladas = ventas.filter((v) => v.estado === "Cancelado");
  const totalFacturado   = ventasEntregadas.reduce((s, v) => s + (v.total || 0), 0);
  const ticketPromedio   = ventasEntregadas.length > 0 ? totalFacturado / ventasEntregadas.length : 0;

  const estadosPie = [
    { name: "Entregadas", value: ventasEntregadas.length, color: "#43a047" },
    { name: "Canceladas", value: ventasCanceladas.length, color: "#ef5350" },
  ].filter((e) => e.value > 0);

  const devEstados = ["Pendiente", "Reembolsada", "Rechazada"].map((estado, i) => ({
    name: estado,
    value: devoluciones.filter((d) => d.estado === estado).length,
    color: COLORS[i],
  })).filter((d) => d.value > 0);

  const recentVentas = [...ventasEntregadas]
    .sort((a, b) => new Date(b.fecha_pedido) - new Date(a.fecha_pedido))
    .slice(0, 6);

  const kpis = dashboard?.kpi;

  return (
    <div className="rep-wrapper">
      <div className="rep-header">
        <h1 className="rep-title">Reportes e Indicadores</h1>
      </div>

      <div className="rep-inner">

        {/* Selector de período */}
        <div className="rep-period-row">
          <span style={{ fontSize: 11, fontWeight: 700, color: "#9e9e9e", letterSpacing: ".06em", textTransform: "uppercase" }}>Período</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                className={`rep-period-btn${periodo === p.id ? " active" : ""}`}
                onClick={() => setPeriodo(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error banner dashboard */}
        {errores.dashboard && (
          <div style={{ background: "#ffebee", border: "1.5px solid #ef9a9a", borderRadius: 12, padding: "12px 16px", color: "#c62828", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            {errores.dashboard}
          </div>
        )}

        {/* KPIs */}
        <div className="rep-kpi-grid">
          {loading ? (
            [1, 2, 3, 4].map((i) => <SkeletonKpi key={i} />)
          ) : (
            <>
              <KpiCard
                icon={<Banknote size={20} />} label="Ventas del período"
                valor={kpis?.ventas?.valor || "—"}
                delta={kpis?.ventas?.delta} positive={kpis?.ventas?.positive}
                color="#2e7d32" bg="#e8f5e9"
              />
              <KpiCard
                icon={<Package size={20} />} label="Pedidos del período"
                valor={kpis?.pedidos?.valor || "—"}
                delta={kpis?.pedidos?.delta} positive={kpis?.pedidos?.positive}
                color="#1565c0" bg="#e3f2fd"
              />
              <KpiCard
                icon={<Users size={20} />} label="Clientes atendidos"
                valor={kpis?.clientes?.valor || "—"}
                delta={kpis?.clientes?.delta} positive={kpis?.clientes?.positive}
                color="#6a1b9a" bg="#f3e5f5"
              />
              <KpiCard
                icon={<Target size={20} />} label="Ticket promedio"
                valor={kpis?.ticket?.valor || "—"}
                delta={kpis?.ticket?.delta} positive={kpis?.ticket?.positive}
                color="#e65100" bg="#fff3e0"
              />
            </>
          )}
        </div>

        {/* Fila 1 — Evolución de ventas + Productos top */}
        <div className="rep-charts-row">

          <ChartCard title="Evolución de Ventas" subtitle="Período actual vs. anterior">
            {loading ? (
              <div className="rep-skeleton" style={{ height: 220 }} />
            ) : dashboard?.graficaVentas?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dashboard.graficaVentas} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#43a047" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#43a047" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradAnterior" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#5c6bc0" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#5c6bc0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: "#9e9e9e" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#9e9e9e" }} />
                  <Tooltip content={<CustomTooltip esDinero />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="actual"   name="Actual"   stroke="#43a047" fill="url(#gradActual)"   strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="anterior" name="Anterior" stroke="#5c6bc0" fill="url(#gradAnterior)" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="rep-empty">Sin datos para este período</div>
            )}
          </ChartCard>

          <ChartCard title="Productos más vendidos" subtitle="Top del período seleccionado">
            {loading ? (
              <div className="rep-skeleton" style={{ height: 220 }} />
            ) : dashboard?.productosTop?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dashboard.productosTop} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#9e9e9e" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#616161" }} width={110} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Unidades" radius={[0, 6, 6, 0]}>
                    {dashboard.productosTop.map((entry, i) => (
                      <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="rep-empty">Sin datos de productos para este período</div>
            )}
          </ChartCard>
        </div>

        {/* Fila 2 — Ventas por estado + Devoluciones */}
        <div className="rep-charts-row">

          <ChartCard title="Ventas por estado" subtitle="Distribución histórica total">
            {loading ? (
              <div className="rep-skeleton" style={{ height: 180 }} />
            ) : estadosPie.length > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={estadosPie} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3}>
                      {estadosPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => v} />
                  </PieChart>
                </ResponsiveContainer>
                <div>
                  {estadosPie.map((e) => (
                    <div key={e.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: e.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#424242" }}>{e.name}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: e.color }}>{e.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rep-empty">Sin datos de ventas históricas</div>
            )}
          </ChartCard>

          <ChartCard title="Devoluciones por estado" subtitle="Distribución total registrada">
            {loading ? (
              <div className="rep-skeleton" style={{ height: 180 }} />
            ) : devEstados.length > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={devEstados} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3}>
                      {devEstados.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => v} />
                  </PieChart>
                </ResponsiveContainer>
                <div>
                  {devEstados.map((e) => (
                    <div key={e.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: e.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#424242" }}>{e.name}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: e.color }}>{e.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rep-empty">Sin devoluciones registradas</div>
            )}
          </ChartCard>
        </div>

        {/* Tabla de últimas ventas */}
        <ChartCard title="Últimas ventas entregadas" subtitle="6 más recientes en histórico">
          {loading ? (
            <div className="rep-skeleton" style={{ height: 160 }} />
          ) : recentVentas.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["N° Venta", "Cliente", "Fecha", "Método pago", "Total"].map((h) => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 800, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "1px solid #f0f0f0" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentVentas.map((v) => (
                    <tr key={v.id} style={{ borderBottom: "1px solid #f8f8f8" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "#2e7d32", fontSize: 13 }}>{v.numero}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13 }}>{v.cliente?.nombre || "—"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#757575" }}>
                        {v.fecha_pedido ? new Date(v.fecha_pedido).toLocaleDateString("es-CO") : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 13 }}>{v.metodo_pago || "—"}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, fontSize: 13 }}>{fmt(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rep-empty">Sin ventas entregadas aún</div>
          )}
        </ChartCard>

        {/* Indicadores adicionales */}
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Indicadores adicionales (histórico total)
          </p>
          <div className="rep-indicators">
            {[
              {
                label: "Tasa de entrega",
                value: ventas.length > 0 ? `${((ventasEntregadas.length / ventas.length) * 100).toFixed(1)}%` : "—",
                desc: `${ventasEntregadas.length} de ${ventas.length} pedidos`,
                Icon: CheckCircle2, color: "#2e7d32", bg: "#e8f5e9",
              },
              {
                label: "Tasa de cancelación",
                value: ventas.length > 0 ? `${((ventasCanceladas.length / ventas.length) * 100).toFixed(1)}%` : "—",
                desc: `${ventasCanceladas.length} de ${ventas.length} pedidos`,
                Icon: XCircle, color: "#c62828", bg: "#ffebee",
              },
              {
                label: "Ingreso promedio / venta",
                value: fmt(ticketPromedio),
                desc: "Sobre ventas entregadas",
                Icon: BarChart2, color: "#1565c0", bg: "#e3f2fd",
              },
              {
                label: "Total devoluciones",
                value: devoluciones.length,
                desc: "Registradas históricamente",
                Icon: CornerUpLeft, color: "#e65100", bg: "#fff3e0",
              },
            ].map((ind) => (
              <div key={ind.label} className="rep-ind-card" style={{ border: `1.5px solid ${ind.bg}` }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: ind.bg, color: ind.color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <ind.Icon size={16} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: ind.color }}>{loading ? "—" : ind.value}</div>
                <div style={{ fontSize: 11, color: "#9e9e9e", marginTop: 3, fontWeight: 700 }}>{ind.label}</div>
                <div style={{ fontSize: 11, color: "#bdbdbd", marginTop: 2 }}>{ind.desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
