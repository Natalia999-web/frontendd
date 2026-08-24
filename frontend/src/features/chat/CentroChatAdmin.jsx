import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useChat } from "./context/ChatContext";
import { RefreshCw, MessageSquare, ChevronRight, Users, Clock } from "lucide-react";
import "./Chat.css";

const fmtHora = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const hoy = new Date();
  const diff = Math.floor((hoy - d) / 60000);
  if (diff < 1)    return "Ahora";
  if (diff < 60)   return `Hace ${diff}m`;
  if (diff < 1440) return `Hace ${Math.floor(diff / 60)}h`;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
};

const estadoClass = {
  "En camino":  "en-camino",
  "Asignado":   "asignado",
  "En proceso": "en-proceso",
  "Pendiente":  "pendiente",
};

const FILTROS = [
  { key: "todos",          label: "Todos" },
  { key: "no_leidos",     label: "Sin leer" },
  { key: "con_mensajes",  label: "Con mensajes" },
];

export default function CentroChatAdmin() {
  const navigate = useNavigate();
  const { conversaciones, totalNoLeidos, refetch } = useChat();

  const [filtro,     setFiltro]     = useState("todos");
  const [cargando,   setCargando]   = useState(false);
  const [firstLoad,  setFirstLoad]  = useState(true);

  // Primera carga
  useEffect(() => {
    if (conversaciones.length > 0 || !firstLoad) return;
    setCargando(true);
    refetch().finally(() => { setCargando(false); setFirstLoad(false); });
  }, []); // eslint-disable-line

  const handleRefresh = async () => {
    setCargando(true);
    await refetch();
    setCargando(false);
  };

  const filtered = conversaciones.filter(c => {
    if (filtro === "no_leidos")    return c.noLeidos > 0;
    if (filtro === "con_mensajes") return c.mensajes.length > 0;
    return true;
  });

  const conMensajes = conversaciones.filter(c => c.mensajes.length > 0).length;

  return (
    <div className="chat-center">
      {/* Header */}
      <div className="chat-center__header">
        <h1 className="chat-center__title">
          <MessageSquare size={22} />
          Centro de Chats
          {totalNoLeidos > 0 && (
            <span style={{
              background: "#e53935", color: "#fff",
              fontSize: 12, fontWeight: 800,
              padding: "2px 9px", borderRadius: 10,
            }}>
              {totalNoLeidos > 99 ? "99+" : totalNoLeidos} nuevo{totalNoLeidos !== 1 ? "s" : ""}
            </span>
          )}
        </h1>
        <p className="chat-center__subtitle">
          Conversaciones con clientes y domiciliarios en entregas activas
        </p>
        <div className="chat-center__line" />
      </div>

      {/* Resumen */}
      <div className="chat-summary-bar">
        <div className="chat-summary-chip">
          <Users size={14} />
          Activos: <span>{conversaciones.length}</span>
        </div>
        <div className="chat-summary-chip">
          <MessageSquare size={14} />
          Con mensajes: <span>{conMensajes}</span>
        </div>
        {totalNoLeidos > 0 && (
          <div className="chat-summary-chip red">
            <Clock size={14} />
            Sin leer: <span>{totalNoLeidos}</span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="chat-center__toolbar">
        <div className="chat-filter-tabs">
          {FILTROS.map(f => (
            <button
              key={f.key}
              className={`chat-filter-tab ${filtro === f.key ? "active" : ""}`}
              onClick={() => setFiltro(f.key)}
            >
              {f.label}
              {f.key === "no_leidos" && totalNoLeidos > 0 && (
                <span style={{
                  marginLeft: 5, background: "#e53935", color: "#fff",
                  borderRadius: 8, padding: "0 5px", fontSize: 10, fontWeight: 800,
                }}>
                  {totalNoLeidos}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          className={`chat-refresh-btn ${cargando ? "spinning" : ""}`}
          onClick={handleRefresh}
          disabled={cargando}
        >
          <RefreshCw size={14} />
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {/* Lista */}
      <div className="chat-list">
        {cargando && filtered.length === 0 ? (
          <div className="chat-loading">
            <div className="chat-loading__spinner" />
            Cargando conversaciones…
          </div>
        ) : filtered.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty__icon">💬</div>
            <p className="chat-empty__title">
              {filtro === "no_leidos"
                ? "Todo al día"
                : filtro === "con_mensajes"
                  ? "Sin mensajes aún"
                  : "Sin entregas activas"}
            </p>
            <p className="chat-empty__desc">
              {filtro === "no_leidos"
                ? "No hay mensajes pendientes de leer."
                : filtro === "con_mensajes"
                  ? "Ninguna entrega activa tiene mensajes todavía."
                  : "Cuando haya domicilios activos aparecerán aquí."}
            </p>
          </div>
        ) : (
          filtered.map(conv => {
            const { idDomicilio, domicilio, noLeidos, ultimoMensaje } = conv;
            const inicial = (domicilio.cliente?.nombre || "?")[0].toUpperCase();
            const timeLabel = ultimoMensaje ? fmtHora(ultimoMensaje.Fecha) : "";
            const preview = ultimoMensaje
              ? `${ultimoMensaje.Tipo_Remitente === "admin" ? "Tú: " : ""}${ultimoMensaje.Contenido}`
              : "Sin mensajes aún";
            const ecls = estadoClass[domicilio.estado] || "pendiente";

            return (
              <div
                key={idDomicilio}
                className={`chat-card ${noLeidos > 0 ? "unread" : ""}`}
                onClick={() => navigate(`/admin/chat/${idDomicilio}`)}
              >
                {/* Avatar */}
                <div className="chat-card__avatar">
                  {inicial}
                  {noLeidos > 0 && <div className="chat-card__unread-dot" />}
                </div>

                {/* Cuerpo */}
                <div className="chat-card__body">
                  <div className="chat-card__top">
                    <span className="chat-card__name">
                      {domicilio.cliente?.nombre || "Cliente"} · DOM-{idDomicilio}
                    </span>
                    <span className="chat-card__time">{timeLabel}</span>
                  </div>

                  <div className="chat-card__bottom">
                    <span className={`chat-card__preview ${noLeidos > 0 ? "bold" : ""}`}>
                      {preview.length > 55 ? preview.slice(0, 55) + "…" : preview}
                    </span>
                    {noLeidos > 0 && (
                      <span className="chat-card__badge">
                        {noLeidos > 99 ? "99+" : noLeidos}
                      </span>
                    )}
                  </div>

                  <div className="chat-card__meta">
                    <span className={`chat-card__estado ${ecls}`}>{domicilio.estado}</span>
                    {domicilio.direccion_entrega && (
                      <span className="chat-card__address">
                        {domicilio.direccion_entrega.length > 40
                          ? domicilio.direccion_entrega.slice(0, 40) + "…"
                          : domicilio.direccion_entrega}
                      </span>
                    )}
                  </div>
                </div>

                {/* Flecha */}
                <div className="chat-card__arrow">
                  <ChevronRight size={18} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
