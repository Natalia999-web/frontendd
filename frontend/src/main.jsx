import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import AppRouter from "./routes/AppRouter";
import { AppProvider } from "./AppContext.jsx";
import { NotificacionesProvider } from "./features/notificaciones/context/NotificacionesContext";
import { PrivilegiosProvider } from "./context/PrivilegiosContext.jsx";
import ErrorBoundary from "./shared/components/ErrorBoundary.jsx";
import { getUser } from "./services/authService.js";
import { getCompras } from "./services/comprasService.js";
import { updateActivity, isInactive, isNearlyInactive, clearSession } from "./utils/api.js";
import "./shared/index.css";

/* ── Tooltip global con position:fixed ───────────────────────
   Escapa cualquier overflow:hidden/auto, funciona dentro de
   tarjetas, tablas, modales y paneles laterales.
──────────────────────────────────────────────────────────── */
;(function initTooltips() {
  let tip = null;
  let raf = null;

  function getTip() {
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "g-tooltip";
      document.body.appendChild(tip);
    }
    return tip;
  }

  function show(target) {
    const text = target.getAttribute("data-tooltip");
    if (!text || target.disabled) return;

    const t = getTip();
    t.textContent = text;
    t.style.display = "block";
    t.style.opacity = "0";

    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r  = target.getBoundingClientRect();
      const tr = t.getBoundingClientRect();
      const pos = target.getAttribute("data-tooltip-pos") || "top";
      const gap = 8;
      let top, left;

      if (pos === "bottom") {
        top  = r.bottom + gap;
        left = r.left + r.width / 2 - tr.width / 2;
      } else if (pos === "right") {
        top  = r.top + r.height / 2 - tr.height / 2;
        left = r.right + gap;
      } else if (pos === "left") {
        top  = r.top + r.height / 2 - tr.height / 2;
        left = r.left - tr.width - gap;
      } else {
        /* top — si no cabe arriba, aparece abajo */
        top  = r.top - tr.height - gap;
        if (top < 6) top = r.bottom + gap;
        left = r.left + r.width / 2 - tr.width / 2;
      }

      /* mantener dentro del viewport */
      const vw = window.innerWidth, vh = window.innerHeight;
      if (left < 6)                  left = 6;
      if (left + tr.width > vw - 6)  left = vw - tr.width - 6;
      if (top  < 6)                  top  = 6;
      if (top  + tr.height > vh - 6) top  = vh - tr.height - 6;

      t.style.top  = top  + "px";
      t.style.left = left + "px";
      t.style.opacity = "1";
    });
  }

  function hide() {
    if (!tip) return;
    tip.style.opacity = "0";
    if (raf) cancelAnimationFrame(raf);
    /* ocultar completamente tras la transición */
    clearTimeout(tip._hideTimer);
    tip._hideTimer = setTimeout(() => {
      if (tip && tip.style.opacity === "0") tip.style.display = "none";
    }, 160);
  }

  document.addEventListener("mouseenter", e => {
    const el = e.target.closest("[data-tooltip]");
    if (el) show(el);
  }, true);

  document.addEventListener("mouseleave", e => {
    if (e.target.closest("[data-tooltip]")) hide();
  }, true);

  /* ocultar al hacer scroll o cambiar tamaño de ventana */
  document.addEventListener("scroll", hide, { capture: true, passive: true });
  window.addEventListener("resize", hide, { passive: true });
})();

function ModalSesionExpira({ onContinuar }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.55)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '36px 32px',
        maxWidth: 380, width: '90%', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>⏱️</div>
        <h3 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: '#1b5e20' }}>
          Sesión por cerrar
        </h3>
        <p style={{ margin: '0 0 24px', color: '#616161', fontSize: 14, lineHeight: 1.6 }}>
          Tu sesión cerrará en unos minutos por inactividad.
          ¿Deseas continuar navegando?
        </p>
        <button
          onClick={onContinuar}
          style={{
            width: '100%', padding: '14px', borderRadius: 12,
            background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
            color: '#fff', fontWeight: 800, fontSize: 15, border: 'none',
            cursor: 'pointer', letterSpacing: '0.02em',
          }}
        >
          Continuar sesión
        </button>
      </div>
    </div>
  );
}

function InactivityGuard({ children }) {
  const [avisoVisible, setAvisoVisible] = useState(false);

  useEffect(() => {
    const onActivity = () => {
      updateActivity();
      setAvisoVisible(false);
    };
    ["click", "keydown", "mousemove", "touchstart", "scroll"].forEach(ev =>
      document.addEventListener(ev, onActivity, { passive: true })
    );

    const interval = setInterval(() => {
      if (!localStorage.getItem("token")) { setAvisoVisible(false); return; }
      if (isInactive()) {
        clearSession();
        window.location.href = "/login";
      } else if (isNearlyInactive()) {
        setAvisoVisible(true);
      }
    }, 30_000);

    return () => {
      ["click", "keydown", "mousemove", "touchstart", "scroll"].forEach(ev =>
        document.removeEventListener(ev, onActivity)
      );
      clearInterval(interval);
    };
  }, []);

  const continuar = () => { updateActivity(); setAvisoVisible(false); };

  return (
    <>
      {children}
      {avisoVisible && <ModalSesionExpira onContinuar={continuar} />}
    </>
  );
}

// Carga datos reales de la API para alimentar las notificaciones automáticas.
// Solo carga si hay sesión de empleado/admin activa.
function NotificacionesWrapper({ children }) {
  const [notifData, setNotifData] = useState({ insumos: [], lotes: [], compras: [] });

  const cargar = async () => {
    const user = getUser();
    if (!user || user.tipo !== "empleado") {
      setNotifData({ insumos: [], lotes: [], compras: [] });
      return;
    }

    // Solo cargamos compras — las notificaciones de stock/lotes vienen
    // del backend vía fetchAPINotifs (stock_agotado_insumo, stock_minimo_insumo, etc.)
    try {
      const res    = await getCompras({ porPagina: 100 });
      const compras = res?.compras || [];
      setNotifData({ insumos: [], lotes: [], compras });
    } catch {
      // silencioso
    }
  };

  useEffect(() => {
    const id    = setTimeout(cargar, 0);
    const retry = setTimeout(cargar, 10000);
    window.addEventListener("session-changed", cargar);
    window.addEventListener("notif-reload", cargar);
    return () => {
      clearTimeout(id);
      clearTimeout(retry);
      window.removeEventListener("session-changed", cargar);
      window.removeEventListener("notif-reload", cargar);
    };
  }, []);

  return (
    <NotificacionesProvider
      insumos={notifData.insumos}
      lotes={notifData.lotes}
      compras={notifData.compras}
      pedidos={[]}
    >
      {children}
    </NotificacionesProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Si algo revienta al renderizar, React desmonta todo y queda una
        pantalla en blanco. Esto la reemplaza por el mensaje del error. */}
    <ErrorBoundary>
      <PrivilegiosProvider>
        <AppProvider>
          <InactivityGuard>
            <NotificacionesWrapper>
              <AppRouter />
            </NotificacionesWrapper>
          </InactivityGuard>
        </AppProvider>
      </PrivilegiosProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
