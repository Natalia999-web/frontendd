import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUser } from "../../../services/authService";
import { getMensajes, enviarMensaje, getDomicilio } from "../../../services/domiciliosService";
import { marcarVisto } from "../../chat/context/ChatContext";
import "./Domicilios.css";

const POLL_MS = 5_000;

const fmtHora = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
};

const TIPO_CFG = {
  domiciliario: { color: "#1565c0", bg: "#e3f2fd", label: "Repartidor" },
  cliente:      { color: "#6a1b9a", bg: "#f3e5f5", label: "Cliente" },
  admin:        { color: "#2e7d32", bg: "#e8f5e9", label: "Admin" },
};

export default function ChatConversacion() {
  const { idDomicilio } = useParams();
  const navigate        = useNavigate();
  const user            = getUser();
  const messagesEndRef  = useRef(null);
  const inputRef        = useRef(null);

  const [mensajes,  setMensajes]  = useState([]);
  const [pedido,    setPedido]    = useState(null);
  const [texto,     setTexto]     = useState("");
  const [sending,   setSending]   = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const cargarMensajes = useCallback(async () => {
    if (!idDomicilio) return;
    try {
      const data = await getMensajes(Number(idDomicilio));
      setMensajes(Array.isArray(data) ? data : []);
    } catch {
      // silent — puede fallar si no tiene acceso
    }
  }, [idDomicilio]);

  // Carga inicial del pedido + mensajes
  useEffect(() => {
    if (!idDomicilio) return;
    const init = async () => {
      setLoading(true);
      try {
        const [, dom] = await Promise.all([
          cargarMensajes(),
          getDomicilio(Number(idDomicilio)).catch(() => null),
        ]);
        if (dom) setPedido(dom);
        // Admin marca el chat como visto al abrirlo
        const u = getUser();
        if (u?.tipo === "empleado") marcarVisto(Number(idDomicilio));
      } catch {
        setError("No se pudo cargar el chat");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [idDomicilio, cargarMensajes]);

  // Polling cada 5 s
  useEffect(() => {
    const id = setInterval(cargarMensajes, POLL_MS);
    return () => clearInterval(id);
  }, [cargarMensajes]);

  // Scroll al último mensaje + marcar visto si admin
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (mensajes.length > 0 && idDomicilio) {
      const u = getUser();
      if (u?.tipo === "empleado") marcarVisto(Number(idDomicilio));
    }
  }, [mensajes, idDomicilio]);

  const handleSend = async () => {
    const contenido = texto.trim();
    if (!contenido || sending) return;
    setSending(true);
    setTexto("");
    try {
      await enviarMensaje(Number(idDomicilio), contenido);
      await cargarMensajes();
    } catch {
      setTexto(contenido); // restaurar si falla
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // "cliente" / "admin" / "domiciliario" según el usuario logueado
  const miTipo = user?.tipo === "cliente" ? "cliente"
    : user?.rol === "Admin" ? "admin" : "domiciliario";

  const esMio = (msg) => msg.Tipo_Remitente === miTipo;

  return (
    <div className="page-wrapper" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ── Header ── */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{
            background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#616161",
          }}>←</button>
          <div>
            <h1 className="page-header__title" style={{ margin: 0 }}>
              Chat {pedido ? `· ${pedido.numero}` : ""}
            </h1>
            {pedido && (
              <div style={{ fontSize: 12, color: "#9e9e9e", marginTop: 2 }}>
                {pedido.cliente?.nombre || ""} · {pedido.direccion_entrega || ""}
              </div>
            )}
          </div>
        </div>
        <div className="page-header__line" />
      </div>

      {/* ── Mensajes ── */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "16px 24px",
        display: "flex", flexDirection: "column", gap: 10,
        minHeight: 0,
      }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#9e9e9e" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
            <p>Cargando mensajes...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#c62828" }}>
            <p>{error}</p>
          </div>
        ) : mensajes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#9e9e9e" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <p style={{ fontWeight: 600 }}>Sin mensajes aún</p>
            <p style={{ fontSize: 13 }}>Sé el primero en escribir.</p>
          </div>
        ) : (
          mensajes.map((msg, i) => {
            const mio = esMio(msg);
            const cfg = TIPO_CFG[msg.Tipo_Remitente] || TIPO_CFG.domiciliario;
            return (
              <div key={msg.ID_Mensaje || i} style={{
                display: "flex",
                flexDirection: mio ? "row-reverse" : "row",
                alignItems: "flex-end", gap: 8,
              }}>
                {/* Avatar */}
                {!mio && (
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: cfg.bg, color: cfg.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800,
                  }}>
                    {(msg.Nombre_Remitente || cfg.label)[0].toUpperCase()}
                  </div>
                )}

                {/* Burbuja */}
                <div style={{ maxWidth: "70%" }}>
                  {!mio && (
                    <div style={{ fontSize: 11, color: cfg.color, fontWeight: 700, marginBottom: 3, paddingLeft: 4 }}>
                      {msg.Nombre_Remitente || cfg.label}
                    </div>
                  )}
                  <div style={{
                    padding: "10px 14px", borderRadius: mio ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background: mio ? "#1565c0" : "#f5f5f5",
                    color: mio ? "#fff" : "#212121",
                    fontSize: 14, lineHeight: 1.45,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  }}>
                    {msg.Contenido}
                  </div>
                  <div style={{ fontSize: 10, color: "#bdbdbd", marginTop: 3, textAlign: mio ? "right" : "left", paddingLeft: 4 }}>
                    {fmtHora(msg.Fecha)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div style={{
        borderTop: "1.5px solid #f0f0f0", padding: "12px 20px",
        display: "flex", gap: 10, flexShrink: 0, background: "#fff",
      }}>
        <textarea
          ref={inputRef}
          rows={1}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribe un mensaje… (Enter para enviar)"
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 12,
            border: "1.5px solid #e0e0e0", fontSize: 14,
            fontFamily: "inherit", resize: "none", outline: "none",
            lineHeight: 1.4, maxHeight: 100, overflowY: "auto",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!texto.trim() || sending}
          style={{
            padding: "0 18px", borderRadius: 12, border: "none",
            background: !texto.trim() || sending ? "#bdbdbd" : "#1565c0",
            color: "#fff", fontWeight: 700, fontSize: 20,
            cursor: !texto.trim() || sending ? "not-allowed" : "pointer",
            flexShrink: 0,
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
