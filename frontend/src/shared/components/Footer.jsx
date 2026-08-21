import { useState, useEffect } from "react";
import { Leaf, Phone, MapPin, Clock3, ExternalLink, Instagram, ShoppingBag, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

/* ─────────────────────────────────────────────────────────────
   CAUSA DEL MAP VACÍO (resuelto):
   La dirección anterior no incluía ciudad → Nominatim fallaba.
   FIX: se añadió "Barranquilla" al query de geocodificación.
   FALLBACK: si Nominatim sigue fallando, se usan coords fijas.
───────────────────────────────────────────────────────────── */
const DIRECCION       = "Carrera 38A No. 80-12, Barranquilla, Colombia";
const GOOGLE_MAPS_URL = "https://www.google.com/maps/search/?api=1&query=Carrera+38A+No.+80-12+Barranquilla+Colombia";

/* Coords de respaldo (Barranquilla, zona norte — Carrera 38 / Calle 80).
   Se usan si Nominatim no responde o devuelve resultado vacío. */
const FALLBACK_COORDS = { lat: 11.016, lon: -74.825 };

/* ── Geocoder via Nominatim (OpenStreetMap) ── */
function useGeocoder(query) {
  const [state, setState] = useState(() => ({
    coords: !query ? FALLBACK_COORDS : null,
    status: !query ? "ok" : "loading",
  }));

  useEffect(() => {
    if (!query) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      ctrl.abort();
      setState({ coords: FALLBACK_COORDS, status: "ok" });
    }, 6000);

    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { signal: ctrl.signal, headers: { "User-Agent": "TostonApp/1.0" } }
    )
      .then((r) => r.json())
      .then((data) => {
        clearTimeout(timer);
        if (data?.length > 0) {
          setState({
            coords: { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) },
            status: "ok",
          });
        } else {
          setState({ coords: FALLBACK_COORDS, status: "ok" }); // sin resultados → fallback
        }
      })
      .catch(() => {
        clearTimeout(timer);
        if (!ctrl.signal.aborted) setState({ coords: FALLBACK_COORDS, status: "ok" });
      });
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query]);

  return state;
}

/* ── Mapa OSM ── */
function MapaEncuentranos() {
  const { coords, status } = useGeocoder(DIRECCION);

  if (status === "loading") {
    return (
      <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#81c784", fontSize: 13, fontWeight: 600 }}>
          <span style={{ width: 16, height: 16, border: "2px solid #81c784", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
          Cargando mapa…
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const d   = 0.004;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lon - d},${coords.lat - d},${coords.lon + d},${coords.lat + d}&layer=mapnik&marker=${coords.lat},${coords.lon}`;

  return (
    <iframe
      title="Ubicación Tostón App"
      src={src}
      width="100%"
      height="300"
      style={{ border: 0, display: "block" }}
      loading="lazy"
      allowFullScreen
    />
  );
}

/* ═══════════════════════════════
   FOOTER
═══════════════════════════════ */
function Footer({ onExplorar }) {
  const navigate = useNavigate();
  const h       = new Date().getHours();
  const dia     = new Date().getDay();
  const abierto = dia !== 0 && h >= 8 && h < 20;

  const horario = [
    { dias: "Lun – Vie", horas: "8:00 am – 8:00 pm", activo: true  },
    { dias: "Sábado",    horas: "8:00 am – 8:00 pm", activo: true  },
    { dias: "Domingo",   horas: "Cerrado",            activo: false },
  ];

  const navLinks = [
    { label: "Inicio",    href: "#inicio"    },
    { label: "Productos", href: "#productos" },
    { label: "Nosotros",  href: "#nosotros"  },
  ];

  const scrollTo = (href) => {
    if (href.startsWith("#")) {
      const el = document.getElementById(href.slice(1));
      el?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer style={{ background: "#1b5e20", color: "#fff", fontFamily: "inherit" }}>

      {/* ── Acento superior ── */}
      <div style={{ height: 4, background: "linear-gradient(90deg, #4caf50, #81c784, #4caf50)" }} />

      {/* ── Cuerpo principal ── */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "56px 24px 40px" }}>

        {/* ── 4 columnas ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "40px 32px",
          marginBottom: 48,
        }}>

          {/* ── Col 1: Marca ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Leaf style={{ width: 22, height: 22, color: "#81c784" }} />
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1, margin: 0 }}>Tostón App</p>
                <p style={{ fontSize: 9, fontWeight: 800, color: "#81c784", letterSpacing: "0.2em", textTransform: "uppercase", margin: "3px 0 0" }}>Sabor Natural 100%</p>
              </div>
            </div>

            <p style={{ fontSize: 13, color: "#c8e6c9", lineHeight: 1.65, fontWeight: 500, margin: 0 }}>
              Calidad premium y frescura garantizada. Cada producto hecho con pasión desde nuestra tierra colombiana.
            </p>

            {/* Instagram */}
            <a
              href="https://www.instagram.com/tostonesbroms?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", width: "fit-content", padding: "8px 14px 8px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14, transition: "background 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
            >
              <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Instagram style={{ width: 16, height: 16, color: "#fff" }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#c8e6c9" }}>@tostonesbroms</span>
            </a>

            {onExplorar && (
              <button
                onClick={onExplorar}
                style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8, padding: "11px 20px", background: "#fff", color: "#1b5e20", fontWeight: 900, fontSize: 13, borderRadius: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.2)", transition: "all 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#e8f5e9"}
                onMouseLeave={e => e.currentTarget.style.background = "#fff"}
              >
                <ShoppingBag style={{ width: 15, height: 15 }} />
                Explorar menú
              </button>
            )}
          </div>

          {/* ── Col 2: Navegación ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.35em", textTransform: "uppercase", color: "#81c784", margin: 0 }}>
              Navegación
            </p>
            <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {navLinks.map(({ label, href }) => (
                <button
                  key={label}
                  onClick={() => scrollTo(href)}
                  style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "8px 12px", margin: "0 -12px", borderRadius: 12, fontSize: 14, fontWeight: 700, color: "#c8e6c9", transition: "all 0.2s", display: "block", fontFamily: "inherit" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#c8e6c9"; }}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "#81c784", margin: "0 0 8px" }}>Mi cuenta</p>
              <button
                onClick={() => navigate("/login")}
                style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "8px 12px", margin: "0 -12px", borderRadius: 12, fontSize: 14, fontWeight: 700, color: "#c8e6c9", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#c8e6c9"; }}
              >
                <User style={{ width: 13, height: 13, flexShrink: 0 }} />
                Iniciar sesión
              </button>
            </div>
          </div>

          {/* ── Col 3: Contacto ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.35em", textTransform: "uppercase", color: "#81c784", margin: 0 }}>
              Contáctanos
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { href: "tel:3217543305", label: "Teléfono 1", value: "321 754 3305" },
                { href: "tel:3137899946", label: "Teléfono 2", value: "313 789 9946" },
              ].map(({ href, label, value }) => (
                <a
                  key={href}
                  href={href}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", margin: "0 -12px", borderRadius: 14, textDecoration: "none", transition: "background 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Phone style={{ width: 14, height: 14, color: "#81c784" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: "#81c784", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 2px" }}>{label}</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0 }}>{value}</p>
                  </div>
                </a>
              ))}

              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 12px", margin: "0 -12px" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <MapPin style={{ width: 14, height: 14, color: "#81c784" }} />
                </div>
                <div>
                  <p style={{ fontSize: 10, color: "#81c784", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 2px" }}>Dirección</p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.4 }}>Carrera 38A No. 80-12</p>
                  <p style={{ fontSize: 12, color: "#c8e6c9", margin: "2px 0 0" }}>Barranquilla, Colombia</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Col 4: Horario ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock3 style={{ width: 13, height: 13, color: "#81c784" }} />
              <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.35em", textTransform: "uppercase", color: "#81c784", margin: 0 }}>
                Horario
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {horario.map(({ dias, horas, activo }) => (
                <div
                  key={dias}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 12, padding: "10px 14px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 14,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#c8e6c9", whiteSpace: "nowrap" }}>{dias}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: activo ? "#fff" : "rgba(255,255,255,0.3)", textAlign: "right" }}>{horas}</span>
                </div>
              ))}
            </div>

            {/* Badge abierto/cerrado */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 14px", borderRadius: 20, width: "fit-content",
              background: abierto ? "rgba(76,175,80,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${abierto ? "rgba(76,175,80,0.35)" : "rgba(255,255,255,0.1)"}`,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: abierto ? "#4caf50" : "rgba(255,255,255,0.3)",
                boxShadow: abierto ? "0 0 0 3px rgba(76,175,80,0.25)" : "none",
                animation: abierto ? "pulse 2s infinite" : "none",
              }} />
              <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.6} }`}</style>
              <span style={{ fontSize: 12, fontWeight: 800, color: abierto ? "#81c784" : "rgba(255,255,255,0.4)" }}>
                {abierto ? "Abierto ahora" : "Cerrado ahora"}
              </span>
            </div>
          </div>

        </div>

        {/* ── Divisor ── */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginBottom: 32 }} />

        {/* ── Mapa "Encuéntranos" ── */}
        <div style={{ borderRadius: 24, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 12px 48px rgba(0,0,0,0.3)" }}>
          {/* Cabecera del mapa */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", background: "rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <MapPin style={{ width: 14, height: 14, color: "#81c784", flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.3em", textTransform: "uppercase", color: "#81c784" }}>
              Encuéntranos
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>·</span>
            <span style={{ fontSize: 12, color: "#c8e6c9", fontWeight: 600 }}>Carrera 38A No. 80-12, Barranquilla</span>
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#c8e6c9", textDecoration: "none", padding: "6px 12px", background: "rgba(255,255,255,0.08)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", transition: "all 0.2s", whiteSpace: "nowrap" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#c8e6c9"; }}
            >
              <ExternalLink style={{ width: 12, height: 12 }} />
              Abrir en Maps
            </a>
          </div>
          <MapaEncuentranos />
        </div>

      </div>

      {/* ── Copyright bar ── */}
      <div style={{ background: "rgba(0,0,0,0.25)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Leaf style={{ width: 14, height: 14, color: "#4caf50", flexShrink: 0 }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: "#81c784", margin: 0 }}>
              © 2026 Tostón App — Todos los derechos reservados.
            </p>
          </div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 500, margin: 0 }}>
            Hecho con pasión para compartir momentos 🍌
          </p>
        </div>
      </div>

    </footer>
  );
}

export default Footer;
