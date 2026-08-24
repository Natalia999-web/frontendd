import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getDomicilios, getMensajes } from "../../../services/domiciliosService";

const ChatContext = createContext(null);

const ACTIVE_STATES = ["Asignado", "En camino", "En proceso", "Pendiente"];
const POLL_MS = 30_000;
const LS_PREFIX = "chat_visto_";

const getVistaDate = (idDom) => {
  try {
    const v = localStorage.getItem(`${LS_PREFIX}${idDom}`);
    return v ? new Date(v) : null;
  } catch { return null; }
};

export const marcarVisto = (idDom) => {
  try {
    localStorage.setItem(`${LS_PREFIX}${idDom}`, new Date().toISOString());
    window.dispatchEvent(new CustomEvent("chat-visto", { detail: { idDom: Number(idDom) } }));
  } catch {}
};

const calcNoLeidos = (mensajes, idDom) => {
  const visto = getVistaDate(idDom);
  if (!visto) {
    // Nunca visto: mensajes de clientes/domiciliarios son no leídos
    return mensajes.filter(m => m.Tipo_Remitente !== "admin").length;
  }
  return mensajes.filter(m => m.Tipo_Remitente !== "admin" && new Date(m.Fecha) > visto).length;
};

export function ChatProvider({ children }) {
  const [conversaciones, setConversaciones] = useState([]);
  const [totalNoLeidos, setTotalNoLeidos] = useState(0);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("usuario") || "null"); } catch { return null; }
  });

  useEffect(() => {
    const sync = () => {
      try { setUser(JSON.parse(localStorage.getItem("usuario") || "null")); } catch { setUser(null); }
    };
    window.addEventListener("session-changed", sync);
    return () => window.removeEventListener("session-changed", sync);
  }, []);

  const isAdmin = !!(
    user?.tipo === "empleado" &&
    (user?.rol?.toLowerCase() === "admin" || user?.rol?.toLowerCase() === "administrador")
  );

  const fetchConversaciones = useCallback(async () => {
    if (!user || !isAdmin) return;
    try {
      const res = await getDomicilios({ porPagina: 100 });
      const activos = (res?.domicilios || []).filter(d => ACTIVE_STATES.includes(d.estado));

      const resultados = [];
      for (const dom of activos) {
        try {
          const mensajes = await getMensajes(dom.id);
          const noLeidos = calcNoLeidos(mensajes, dom.id);
          const ultimoMensaje = mensajes.length > 0 ? mensajes[mensajes.length - 1] : null;
          resultados.push({ idDomicilio: dom.id, domicilio: dom, mensajes, noLeidos, ultimoMensaje });
        } catch {
          resultados.push({ idDomicilio: dom.id, domicilio: dom, mensajes: [], noLeidos: 0, ultimoMensaje: null });
        }
        // pequeño delay para no saturar el backend
        await new Promise(r => setTimeout(r, 150));
      }

      const sorted = resultados.sort((a, b) => {
        if (b.noLeidos !== a.noLeidos) return b.noLeidos - a.noLeidos;
        const fa = a.ultimoMensaje?.Fecha || "";
        const fb = b.ultimoMensaje?.Fecha || "";
        return fb.localeCompare(fa);
      });

      setConversaciones(sorted);
      setTotalNoLeidos(sorted.reduce((s, c) => s + c.noLeidos, 0));
    } catch {}
  }, [user, isAdmin]);

  // Polling principal
  useEffect(() => {
    if (!isAdmin) {
      setConversaciones([]);
      setTotalNoLeidos(0);
      return;
    }
    fetchConversaciones();
    const id = setInterval(fetchConversaciones, POLL_MS);
    return () => clearInterval(id);
  }, [isAdmin, fetchConversaciones]);

  // Actualizar unread al marcar visto (sin esperar próximo poll)
  useEffect(() => {
    const handler = (e) => {
      const idDom = e.detail?.idDom;
      if (!idDom) return;
      setConversaciones(prev => {
        const updated = prev.map(c => {
          if (c.idDomicilio !== idDom) return c;
          return { ...c, noLeidos: calcNoLeidos(c.mensajes, idDom) };
        });
        setTotalNoLeidos(updated.reduce((s, c) => s + c.noLeidos, 0));
        return updated;
      });
    };
    window.addEventListener("chat-visto", handler);
    return () => window.removeEventListener("chat-visto", handler);
  }, []);

  return (
    <ChatContext.Provider value={{ conversaciones, totalNoLeidos, marcarVisto, refetch: fetchConversaciones }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat debe usarse dentro de ChatProvider");
  return ctx;
}
