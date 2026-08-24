import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getUser } from "../../../services/authService";
import { getDomicilios, getResumenDia } from "../../../services/domiciliosService";
import "./Domicilios.css";


const DISPONIBILIDAD = {
  disponible:   { label: "Disponible",   color: "#2e7d32", bg: "#e8f5e9", icon: "🟢" },
  ocupado:      { label: "Ocupado",      color: "#e65100", bg: "#fff3e0", icon: "🟡" },
  desconectado: { label: "Desconectado", color: "#616161", bg: "#f5f5f5", icon: "⚫" },
};

const ESTADO_ORDEN = ["En camino", "En proceso", "Asignado", "Pendiente"];

export default function DashboardDomiciliario() {
  const user = getUser();
  const [status, setStatus] = useState(
    localStorage.getItem("domiciliario_status") || "disponible"
  );
  const [resumen, setResumen]       = useState({ activos: 0, entregados_hoy: 0, total_hoy: 0 });
  const [ordenActiva, setOrdenActiva] = useState(null);
  const [loading, setLoading]       = useState(true);

  const cambiarStatus = (val) => {
    setStatus(val);
    localStorage.setItem("domiciliario_status", val);
  };

  useEffect(() => {
    if (!user?.id) return;
    const cargar = async () => {
      setLoading(true);
      try {
        const [res, doms] = await Promise.all([
          getResumenDia(),
          getDomicilios({ porPagina: 100, idEmpleado: user.id }),
        ]);
        setResumen(res);
        const activos = (doms.domicilios || []).filter(d =>
          ["En camino", "En proceso", "Asignado", "Pendiente"].includes(d.estado)
        );
        activos.sort((a, b) => ESTADO_ORDEN.indexOf(a.estado) - ESTADO_ORDEN.indexOf(b.estado));
        setOrdenActiva(activos[0] || null);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [user?.id]);  const hoy = new Date().toLocaleDateString("es-CO", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-header__title">Mi Dashboard</h1>
        <div className="page-header__line" />
      </div>

      <div className="page-inner">
        {/* ── Hero bienvenida ── */}
        <div style={{
          background: "linear-gradient(135deg, #1b5e20, #388e3c)",
          borderRadius: 16, padding: "24px 28px", marginBottom: 24,
          color: "#fff", display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", flexWrap: "wrap", gap: 20,
        }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6, textTransform: "capitalize" }}>{hoy}</div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
              ¡Hola, {user?.nombre}! 🛵
            </h2>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
              Panel de domiciliario
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "14px 18px", minWidth: 220 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 10, fontWeight: 700, letterSpacing: "0.05em" }}>
              MI ESTADO
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(DISPONIBILIDAD).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => cambiarStatus(key)}
                  style={{
                    padding: "6px 12px", borderRadius: 20, border: "none",
                    background: status === key ? "#fff" : "rgba(255,255,255,0.2)",
                    color: status === key ? cfg.color : "rgba(255,255,255,0.9)",
                    fontWeight: 700, fontSize: 12, cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {cfg.icon} {cfg.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stats del día ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Pedidos activos",  value: resumen.activos,        color: "#1565c0", icon: "📦", bg: "#e3f2fd" },
            { label: "Entregados hoy",   value: resumen.entregados_hoy, color: "#2e7d32", icon: "✅", bg: "#e8f5e9" },
            { label: "Total del día",    value: resumen.total_hoy,      color: "#6a1b9a", icon: "📊", bg: "#f3e5f5" },
          ].map(stat => (
            <div key={stat.label} style={{
              background: "#fff", borderRadius: 14, padding: "20px 18px",
              border: `1.5px solid ${stat.bg}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: stat.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, marginBottom: 12,
              }}>
                {stat.icon}
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                {loading ? "…" : stat.value}
              </div>
              <div style={{ fontSize: 12, color: "#9e9e9e", marginTop: 6, fontWeight: 600 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Pedido en curso ── */}
        {!loading && ordenActiva && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#616161", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Pedido en curso
            </h3>
            <div style={{
              background: "#fff", borderRadius: 14, padding: 20,
              border: "1.5px solid #90caf9", boxShadow: "0 2px 12px rgba(21,101,192,0.1)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#9e9e9e", fontWeight: 700 }}>{ordenActiva.numero}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#212121", marginTop: 2 }}>
                    {ordenActiva.cliente?.nombre || "Cliente"}
                  </div>
                </div>
                <span style={{
                  padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: ordenActiva.estado === "En camino" ? "#f3e5f5" : "#e3f2fd",
                  color: ordenActiva.estado === "En camino" ? "#8e24aa" : "#1565c0",
                }}>
                  {ordenActiva.estado === "En camino"  ? "🛵 En camino" :
                   ordenActiva.estado === "En proceso" ? "🏠 En local" : "📦 Asignado"}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#616161", marginBottom: 14 }}>
                📍 {ordenActiva.direccion_entrega || "Sin dirección"}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Link to="/admin/pedido-actual" style={{
                  flex: 1, padding: "10px", borderRadius: 10, textAlign: "center",
                  background: "#1565c0", color: "#fff", fontWeight: 700,
                  fontSize: 13, textDecoration: "none",
                }}>
                  Ver pedido →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Accesos rápidos ── */}
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#616161", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Accesos rápidos
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
          {[
            { label: "Mis Entregas",    icon: "🛵", link: "/admin/mis-entregas",         desc: "Pedidos asignados" },
            { label: "Pedido Actual",   icon: "📦", link: "/admin/pedido-actual",         desc: "El pedido en curso" },
            { label: "Historial",       icon: "📋", link: "/admin/historial-entregas",    desc: "Entregas anteriores" },
            { label: "Mis Ganancias",   icon: "💰", link: "/admin/mis-ganancias",         desc: "Hoy, semana, mes" },
            { label: "Notificaciones",  icon: "🔔", link: "/admin/mis-notificaciones",    desc: "Avisos y alertas" },
            { label: "Mi Perfil",       icon: "👤", link: "/admin/mi-perfil-repartidor",  desc: "Datos personales" },
          ].map(item => (
            <Link key={item.label} to={item.link} style={{
              background: "#fff", borderRadius: 14, padding: "18px 16px",
              border: "1.5px solid #f0f0f0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              textDecoration: "none", display: "block",
              transition: "box-shadow 0.15s",
            }}>
              <div style={{ fontSize: 26, marginBottom: 10 }}>{item.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#212121", marginBottom: 3 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: "#9e9e9e" }}>{item.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
