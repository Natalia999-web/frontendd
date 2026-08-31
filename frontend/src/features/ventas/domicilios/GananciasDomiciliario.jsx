import { useState, useEffect } from "react";
import { getUser } from "../../../services/authService";
import { getDomicilios } from "../../../services/domiciliosService";
import { fmtFecha } from "../../../utils/dateUtils.js";
import "./Domicilios.css";
import { Banknote, CheckCircle2, BarChart2 } from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

const PERIODOS = [
  { id: "hoy",   label: "Hoy" },
  { id: "semana", label: "Semana" },
  { id: "mes",    label: "Mes" },
  { id: "todo",   label: "Total histórico" },
];

function calcularRango(periodo) {
  const ahora = new Date();
  const hoyInicio = new Date(ahora); hoyInicio.setHours(0, 0, 0, 0);

  if (periodo === "hoy") {
    const fin = new Date(ahora); fin.setHours(23, 59, 59, 999);
    return { desde: hoyInicio, hasta: fin };
  }
  if (periodo === "semana") {
    const delta = hoyInicio.getDay() === 0 ? -6 : 1 - hoyInicio.getDay();
    const lunes  = new Date(hoyInicio); lunes.setDate(hoyInicio.getDate() + delta);
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6); domingo.setHours(23, 59, 59, 999);
    return { desde: lunes, hasta: domingo };
  }
  if (periodo === "mes") {
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const fin    = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59, 999);
    return { desde: inicio, hasta: fin };
  }
  return { desde: null, hasta: null };
}

function filtrarPorPeriodo(domicilios, periodo) {
  const entregados = domicilios.filter(d => d.estado === "Entregado");
  if (periodo === "todo") return entregados;

  const { desde, hasta } = calcularRango(periodo);
  return entregados.filter(d => {
    const fecha = new Date(d.fecha_entrega_real || d.fecha_pedido);
    return fecha >= desde && fecha <= hasta;
  });
}

export default function GananciasDomiciliario() {
  const user = getUser();
  const [periodo,    setPeriodo]    = useState("hoy");
  const [todos,      setTodos]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    const cargar = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getDomicilios({ porPagina: 100, idEmpleado: user.id });
        setTodos(data.domicilios || []);
      } catch (err) {
        setError(err?.message || "No se pudieron cargar tus entregas. Intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [user?.id]);

  const entregados = filtrarPorPeriodo(todos, periodo);
  const totalGanado   = entregados.reduce((s, d) => s + (d.total || 0), 0);
  const totalEntregas = entregados.length;
  const promedio      = totalEntregas > 0 ? totalGanado / totalEntregas : 0;

  // Resumen rápido de todos los periodos (para las tarjetas de resumen)
  const resumen = PERIODOS.slice(0, 3).map(p => {
    const ents = filtrarPorPeriodo(todos, p.id);
    return { label: p.label, total: ents.reduce((s, d) => s + (d.total || 0), 0), count: ents.length };
  });

  const STATS_PERIODO = [
    { label: "Total del periodo", value: fmt(totalGanado),  Icon: Banknote,      color: "#2e7d32", bg: "#e8f5e9" },
    { label: "Entregas",          value: totalEntregas,     Icon: CheckCircle2,  color: "#1565c0", bg: "#e3f2fd" },
    { label: "Promedio",          value: fmt(promedio),     Icon: BarChart2,     color: "#6a1b9a", bg: "#f3e5f5" },
  ];

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-header__title">Mis Ganancias</h1>
        <div className="page-header__line" />
      </div>

      <div className="page-inner">

        {error && (
          <div style={{ background: "#ffebee", border: "1.5px solid #ef9a9a", borderRadius: 10, padding: "12px 16px", marginBottom: 18, fontSize: 13, color: "#c62828", fontWeight: 600 }}>
            {error}
          </div>
        )}

        {/* ── Resumen rápido de los 3 periodos ── */}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 24 }}>
            {resumen.map(r => (
              <div key={r.label} style={{
                background: "#fff", borderRadius: 14, padding: "18px 16px",
                border: "1.5px solid #f0f0f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}>
                <div style={{ fontSize: 11, color: "#9e9e9e", fontWeight: 700, marginBottom: 6 }}>{r.label.toUpperCase()}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#2e7d32" }}>{fmt(r.total)}</div>
                <div style={{ fontSize: 12, color: "#bdbdbd", marginTop: 4 }}>{r.count} entrega{r.count !== 1 ? "s" : ""}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Filtro de periodo ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {PERIODOS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id)}
              style={{
                padding: "8px 18px", borderRadius: 20, cursor: "pointer",
                border: periodo === p.id ? "1.5px solid #4caf50" : "1.5px solid #e0e0e0",
                background: periodo === p.id ? "#e8f5e9" : "#fafafa",
                color: periodo === p.id ? "#2e7d32" : "#616161",
                fontWeight: periodo === p.id ? 700 : 400, fontSize: 13,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1.5px solid #f0f0f0" }}>
                {[60, 40, 80].map((w, j) => (
                  <div key={j} className="skeleton-cell" style={{ width: `${w}%`, height: 14, marginBottom: 8, borderRadius: 7 }} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* ── Stats detalle del periodo seleccionado ── */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 14, marginBottom: 24,
            }}>
              {STATS_PERIODO.map(s => (
                <div key={s.label} style={{
                  background: "#fff", borderRadius: 14, padding: "20px 18px",
                  border: `1.5px solid ${s.bg}`, boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: s.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: s.color, marginBottom: 12,
                  }}><s.Icon size={20} strokeWidth={1.5} /></div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "#9e9e9e", marginTop: 4, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* ── Lista de entregas del periodo ── */}
            {entregados.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#9e9e9e" }}>
                <div style={{ marginBottom: 12, color: "#bdbdbd", display: "flex", justifyContent: "center" }}>
                  <Banknote size={48} strokeWidth={1} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600 }}>Sin entregas en este período</p>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: "#9e9e9e", fontWeight: 700, marginBottom: 12, letterSpacing: "0.05em" }}>
                  DETALLE — {entregados.length} ENTREGA{entregados.length !== 1 ? "S" : ""}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {entregados
                    .slice()
                    .sort((a, b) => new Date(b.fecha_entrega_real || b.fecha_pedido) - new Date(a.fecha_entrega_real || a.fecha_pedido))
                    .map(dom => (
                      <div key={dom.id} style={{
                        background: "#fff", borderRadius: 12, padding: "16px 18px",
                        border: "1.5px solid #f0f0f0",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                        <div>
                          <div style={{ fontSize: 12, color: "#9e9e9e", fontWeight: 700 }}>{dom.numero}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#212121", marginTop: 2 }}>
                            {dom.cliente?.nombre || "Cliente"}
                          </div>
                          <div style={{ fontSize: 12, color: "#bdbdbd", marginTop: 3 }}>
                            {fmtFecha(dom.fecha_entrega_real || dom.fecha_pedido)}
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: "#2e7d32" }}>
                          {fmt(dom.total || 0)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
