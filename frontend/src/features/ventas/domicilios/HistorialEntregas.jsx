import { useState, useEffect } from "react";
import { getUser } from "../../../services/authService";
import { getDomicilios } from "../../../services/domiciliosService";
import "./Domicilios.css";

const fmt = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

const fmtFecha = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const FILTROS = [
  { id: "hoy",   label: "Hoy" },
  { id: "semana", label: "Semana" },
  { id: "mes",    label: "Mes" },
  { id: "todo",   label: "Todo" },
];

function getRango(filtro) {
  const ahora = new Date();
  if (filtro === "hoy") {
    const inicio = new Date(ahora); inicio.setHours(0, 0, 0, 0);
    const fin    = new Date(ahora); fin.setHours(23, 59, 59, 999);
    return { fechaInicio: inicio.toISOString(), fechaFin: fin.toISOString() };
  }
  if (filtro === "semana") {
    const dia = ahora.getDay();
    const lunesDelta = dia === 0 ? -6 : 1 - dia;
    const lunes = new Date(ahora); lunes.setDate(ahora.getDate() + lunesDelta); lunes.setHours(0, 0, 0, 0);
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6); domingo.setHours(23, 59, 59, 999);
    return { fechaInicio: lunes.toISOString(), fechaFin: domingo.toISOString() };
  }
  if (filtro === "mes") {
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const fin    = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59, 999);
    return { fechaInicio: inicio.toISOString(), fechaFin: fin.toISOString() };
  }
  return { fechaInicio: null, fechaFin: null };
}

const ESTADO_CFG = {
  "Entregado": { color: "#2e7d32", bg: "#e8f5e9", icon: "✅" },
  "Cancelado": { color: "#c62828", bg: "#ffebee", icon: "❌" },
};

export default function HistorialEntregas() {
  const user = getUser();
  const [filtro,     setFiltro]     = useState("hoy");
  const [domicilios, setDomicilios] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    const cargar = async () => {
      setLoading(true);
      setError(null);
      const { fechaInicio, fechaFin } = getRango(filtro);
      try {
        const data = await getDomicilios({
          porPagina:   100,
          idEmpleado:  user.id,
          fechaInicio,
          fechaFin,
        });
        const historial = (data.domicilios || []).filter(d =>
          d.estado === "Entregado" || d.estado === "Cancelado"
        );
        historial.sort((a, b) =>
          new Date(b.fecha_entrega_real || b.fecha_pedido) -
          new Date(a.fecha_entrega_real || a.fecha_pedido)
        );
        setDomicilios(historial);
      } catch {
        setError("Error al cargar el historial");
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [filtro, user?.id]);

  const totalEntregadas = domicilios.filter(d => d.estado === "Entregado").length;
  const totalValor      = domicilios
    .filter(d => d.estado === "Entregado")
    .reduce((s, d) => s + (d.total || 0), 0);

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-header__title">Historial de Entregas</h1>
        <div className="page-header__line" />
      </div>

      <div className="page-inner">
        {/* ── Filtros ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {FILTROS.map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              style={{
                padding: "8px 18px", borderRadius: 20,
                border: filtro === f.id ? "1.5px solid #4caf50" : "1.5px solid #e0e0e0",
                background: filtro === f.id ? "#e8f5e9" : "#fafafa",
                color: filtro === f.id ? "#2e7d32" : "#616161",
                fontWeight: filtro === f.id ? 700 : 400,
                fontSize: 13, cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Resumen ── */}
        {!loading && domicilios.length > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 12, marginBottom: 20,
          }}>
            {[
              { label: "Entregas",          value: totalEntregadas, icon: "✅", color: "#2e7d32", bg: "#e8f5e9" },
              { label: "Canceladas",         value: domicilios.length - totalEntregadas, icon: "❌", color: "#c62828", bg: "#ffebee" },
              { label: "Valor entregado",    value: fmt(totalValor), icon: "💰", color: "#2e7d32", bg: "#e8f5e9", wide: true },
            ].map(s => (
              <div key={s.label} style={{
                background: "#fff", borderRadius: 12, padding: "16px",
                border: `1.5px solid ${s.bg}`,
                gridColumn: s.wide ? "span 2" : undefined,
              }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#9e9e9e", fontWeight: 600, marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Lista ── */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1.5px solid #f0f0f0" }}>
                {[70, 50, 40].map((w, j) => (
                  <div key={j} className="skeleton-cell" style={{ width: `${w}%`, height: 14, marginBottom: 8, borderRadius: 7 }} />
                ))}
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#c62828" }}>
            <p>{error}</p>
          </div>
        ) : domicilios.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9e9e9e" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 15, fontWeight: 600 }}>Sin registros en este período</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {domicilios.map(dom => {
              const cfg = ESTADO_CFG[dom.estado] || { color: "#757575", bg: "#f5f5f5", icon: "•" };
              return (
                <div key={dom.id} style={{
                  background: "#fff", borderRadius: 14, padding: "18px 20px",
                  border: `1.5px solid ${cfg.bg}`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#9e9e9e", fontWeight: 700 }}>{dom.numero}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#212121", marginTop: 3 }}>
                        {dom.cliente?.nombre || "Cliente"}
                      </div>
                      <div style={{ fontSize: 12, color: "#757575", marginTop: 4 }}>
                        📍 {dom.direccion_entrega || "Sin dirección"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "3px 10px", borderRadius: 20,
                        background: cfg.bg, color: cfg.color,
                        fontSize: 11, fontWeight: 700,
                      }}>
                        {cfg.icon} {dom.estado}
                      </span>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#2e7d32", marginTop: 6 }}>
                        {fmt(dom.total || 0)}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: "#bdbdbd" }}>
                    {dom.estado === "Entregado"
                      ? `Entregado: ${fmtFecha(dom.fecha_entrega_real)}`
                      : `Asignado: ${fmtFecha(dom.fecha_pedido)}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
