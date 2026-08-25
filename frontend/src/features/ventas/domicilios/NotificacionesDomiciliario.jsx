import { useState, useEffect, useRef, useCallback } from "react";
import { getUser } from "../../../services/authService";
import { getDomicilios } from "../../../services/domiciliosService";
import "./Domicilios.css";
import { Package, CheckCircle2, XCircle, Bell, X } from "lucide-react";

const POLL_INTERVAL = 30_000; // 30 segundos
const STORAGE_KEY   = "domiciliario_notifs_visto";

const fmtFecha = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const ahora = new Date();
  const diffMs = ahora - d;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return "Ahora mismo";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `Hace ${diffH}h`;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
};

const NOTIF_ICON = {
  cancelado: <XCircle size={20} />,
  nuevo:     <Package size={20} />,
  entregado: <CheckCircle2 size={20} />,
};

function generarNotifs(domicilios) {
  const notifs = [];
  const ahora  = new Date();
  const hace7d = new Date(ahora - 7 * 24 * 60 * 60 * 1_000);

  domicilios.forEach(dom => {
    const fechaAsig = new Date(dom.fecha_pedido);
    if (fechaAsig < hace7d) return;

    if (dom.estado === "Cancelado") {
      notifs.push({
        id:      `cancelado-${dom.id}`,
        tipo:    "cancelado",
        titulo:  "Entrega cancelada",
        mensaje: `${dom.numero} · ${dom.cliente?.nombre || "Cliente"}`,
        fecha:   dom.fecha_pedido,
        color:   "#c62828",
        bg:      "#ffebee",
      });
      return;
    }

    // Órdenes asignadas recientemente (últimas 24h) que no están entregadas ni canceladas
    const hace24h = new Date(ahora - 24 * 60 * 60 * 1_000);
    if (fechaAsig >= hace24h && dom.estado !== "Entregado" && dom.estado !== "Cancelado") {
      notifs.push({
        id:      `asignado-${dom.id}`,
        tipo:    "nuevo",
        titulo:  "Nueva entrega asignada",
        mensaje: `${dom.numero} · ${dom.cliente?.nombre || "Cliente"} · ${dom.direccion_entrega || "Sin dirección"}`,
        fecha:   dom.fecha_pedido,
        color:   "#1565c0",
        bg:      "#e3f2fd",
      });
    }

    // Entregadas en las últimas 24h → notif de logro
    if (dom.estado === "Entregado" && dom.fecha_entrega_real) {
      const fechaEnt = new Date(dom.fecha_entrega_real);
      if (fechaEnt >= hace24h) {
        notifs.push({
          id:      `entregado-${dom.id}`,
          tipo:    "entregado",
          titulo:  "Entrega completada",
          mensaje: `${dom.numero} · ${dom.cliente?.nombre || "Cliente"}`,
          fecha:   dom.fecha_entrega_real,
          color:   "#2e7d32",
          bg:      "#e8f5e9",
        });
      }
    }
  });

  notifs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  return notifs;
}

function Toast({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: "#1565c0", color: "#fff", borderRadius: 12,
      padding: "14px 18px", maxWidth: 320,
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      display: "flex", alignItems: "flex-start", gap: 10,
    }}>
      <span style={{ display: "flex", alignItems: "center" }}><Package size={20} /></span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{msg.titulo}</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>{msg.mensaje}</div>
      </div>
      <button onClick={onClose}
        style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
        <X size={16} />
      </button>
    </div>
  );
}

export default function NotificacionesDomiciliario() {
  const user             = getUser();
  const [notifs, setNotifs]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [toast,   setToast]     = useState(null);
  const [leidas,  setLeidas]    = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  });
  const prevIdsRef = useRef(null);

  const cargar = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await getDomicilios({ porPagina: 100, idEmpleado: user.id });
      const doms  = data.domicilios || [];
      const nuevas = generarNotifs(doms);
      setNotifs(nuevas);

      // Detectar nuevas asignaciones para el toast
      if (prevIdsRef.current !== null) {
        const prevIds = prevIdsRef.current;
        const nuevasIds = nuevas
          .filter(n => n.tipo === "nuevo" && !prevIds.includes(n.id));
        if (nuevasIds.length > 0) {
          setToast(nuevasIds[0]);
          setTimeout(() => setToast(null), 6000);
        }
      }
      prevIdsRef.current = nuevas.filter(n => n.tipo === "nuevo").map(n => n.id);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Carga inicial
  useEffect(() => { cargar(); }, [cargar]);

  // Polling cada 30 s
  useEffect(() => {
    const id = setInterval(cargar, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [cargar]);

  const marcarTodas = () => {
    const todos = notifs.map(n => n.id);
    setLeidas(todos);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  };

  const marcarLeida = (id) => {
    const nuevas = [...new Set([...leidas, id])];
    setLeidas(nuevas);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nuevas));
  };

  const sinLeer = notifs.filter(n => !leidas.includes(n.id)).length;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="page-header__title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              Notificaciones
              {sinLeer > 0 && (
                <span style={{
                  background: "#c62828", color: "#fff", borderRadius: 20,
                  fontSize: 12, fontWeight: 700, padding: "2px 8px",
                }}>
                  {sinLeer}
                </span>
              )}
            </h1>
          </div>
          {sinLeer > 0 && (
            <button onClick={marcarTodas} style={{
              padding: "7px 16px", borderRadius: 20, border: "1.5px solid #e0e0e0",
              background: "#fff", color: "#616161", fontSize: 12, cursor: "pointer", fontWeight: 600,
            }}>
              Marcar todas como leídas
            </button>
          )}
        </div>
        <div className="page-header__line" />
      </div>

      <div className="page-inner">
        <div style={{ marginBottom: 12, fontSize: 12, color: "#9e9e9e" }}>
          Se actualiza automáticamente cada 30 segundos · últimas 24–48 h de actividad
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ background: "#fff", borderRadius: 12, padding: 18, border: "1.5px solid #f0f0f0" }}>
                {[60, 40].map((w, j) => (
                  <div key={j} className="skeleton-cell" style={{ width: `${w}%`, height: 14, marginBottom: 8, borderRadius: 7 }} />
                ))}
              </div>
            ))}
          </div>
        ) : notifs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "70px 0", color: "#9e9e9e" }}>
            <div style={{ marginBottom: 14, color: "#bdbdbd", display: "flex", justifyContent: "center" }}>
              <Bell size={52} strokeWidth={1} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#424242" }}>Sin notificaciones</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>
              Aquí aparecerán nuevas asignaciones y actualizaciones de tus entregas.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notifs.map(n => {
              const esLeida = leidas.includes(n.id);
              const IconEl = NOTIF_ICON[n.tipo] || null;
              return (
                <div
                  key={n.id}
                  onClick={() => marcarLeida(n.id)}
                  style={{
                    background: esLeida ? "#fafafa" : "#fff",
                    borderRadius: 12, padding: "16px 18px",
                    border: `1.5px solid ${esLeida ? "#f0f0f0" : n.bg}`,
                    boxShadow: esLeida ? "none" : "0 2px 8px rgba(0,0,0,0.05)",
                    cursor: "pointer",
                    display: "flex", alignItems: "flex-start", gap: 14,
                    transition: "all 0.15s",
                  }}
                >
                  {/* Icono */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: esLeida ? "#f5f5f5" : n.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: esLeida ? "#9e9e9e" : n.color,
                  }}>
                    {IconEl}
                  </div>

                  {/* Contenido */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: esLeida ? 500 : 700, fontSize: 14,
                      color: esLeida ? "#757575" : n.color,
                      marginBottom: 3,
                    }}>
                      {n.titulo}
                    </div>
                    <div style={{ fontSize: 13, color: esLeida ? "#9e9e9e" : "#424242" }}>
                      {n.mensaje}
                    </div>
                    <div style={{ fontSize: 11, color: "#bdbdbd", marginTop: 6 }}>
                      {fmtFecha(n.fecha)}
                    </div>
                  </div>

                  {/* Punto no leído */}
                  {!esLeida && (
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: n.color, flexShrink: 0, marginTop: 6,
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Toast msg={toast} onClose={() => setToast(null)} />
    </div>
  );
}
