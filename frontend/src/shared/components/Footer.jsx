import { Leaf, Phone, MapPin, ExternalLink, Clock3 } from "lucide-react";

function Footer({ onExplorar }) {
  const h       = new Date().getHours();
  const dia     = new Date().getDay();
  const abierto = dia !== 0 && h >= 8 && h < 20;

  const horario = [
    { dias: "Lun – Vie", horas: "8:00 am – 8:00 pm", abierto: true  },
    { dias: "Sábado",    horas: "8:00 am – 8:00 pm", abierto: true  },
    { dias: "Domingo",   horas: "Cerrado",            abierto: false },
  ];

  return (
    <footer className="bg-[#1b5e20] text-white">

      {/* ── Cuerpo principal ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">

        {/* Grilla 2 columnas */}
        <div className="grid lg:grid-cols-2 gap-12 mb-12">

          {/* Columna izquierda — Marca + CTA */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                <Leaf className="w-6 h-6 text-[#81c784]" />
              </div>
              <div>
                <p className="text-2xl font-black tracking-tighter leading-none">Tostón App</p>
                <p className="text-sm font-semibold text-[#81c784] mt-0.5">Hecho con pasión y buena energía</p>
              </div>
            </div>

            <p className="text-[#c8e6c9] font-medium leading-relaxed max-w-sm">
              Calidad premium y frescura garantizada para los amantes del buen sabor colombiano.
            </p>

            {onExplorar && (
              <button
                onClick={onExplorar}
                className="self-start flex items-center gap-2 px-7 py-3.5 bg-white text-[#1b5e20] font-black rounded-2xl hover:bg-[#e8f5e9] transition-all shadow-lg active:scale-95 text-sm"
              >
                Explorar menú
                <span className="text-base leading-none">→</span>
              </button>
            )}
          </div>

          {/* Columna derecha — Contacto */}
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#81c784] mb-5">
              Contáctanos
            </p>
            <div className="space-y-1">
              <a
                href="tel:3217543305"
                className="flex items-center gap-3 group rounded-2xl px-2 py-2.5 transition-colors hover:bg-white/10"
              >
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
                  <Phone size={14} className="text-[#81c784]" />
                </div>
                <span className="text-sm font-bold text-[#c8e6c9] group-hover:text-white transition-colors">
                  321 754 3305
                </span>
              </a>

              <a
                href="tel:3137899946"
                className="flex items-center gap-3 group rounded-2xl px-2 py-2.5 transition-colors hover:bg-white/10"
              >
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
                  <Phone size={14} className="text-[#81c784]" />
                </div>
                <span className="text-sm font-bold text-[#c8e6c9] group-hover:text-white transition-colors">
                  313 789 9946
                </span>
              </a>

              <div className="flex items-start gap-3 rounded-2xl px-2 py-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin size={14} className="text-[#81c784]" />
                </div>
                <span className="text-sm font-bold text-[#c8e6c9] leading-snug pt-1">
                  Carrera 38A No. 80-12
                </span>
              </div>

              <a
                href="https://www.instagram.com/tostonesbroms?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 group rounded-2xl px-2 py-2.5 transition-colors hover:bg-white/10"
              >
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
                  <ExternalLink size={14} className="text-[#81c784]" />
                </div>
                <span className="text-sm font-bold text-[#c8e6c9] group-hover:text-white transition-colors">
                  @tostonesbroms
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* ── Horario — fila horizontal ── */}
        <div className="border-t border-white/10 pt-8 mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
              <Clock3 size={13} className="text-[#81c784]" />
            </div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#81c784]">
              Horario de atención
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {horario.map(({ dias, horas, abierto: ab }) => (
              <div
                key={dias}
                className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-2xl px-4 py-2.5"
              >
                <span className="text-sm font-bold text-[#c8e6c9]">{dias}</span>
                <span className="text-white/25 font-light">·</span>
                <span className={`text-sm font-bold ${ab ? "text-white" : "text-white/40"}`}>
                  {horas}
                </span>
              </div>
            ))}

            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-black ${
                abierto
                  ? "bg-[#4caf50]/20 border-[#4caf50]/30 text-[#81c784]"
                  : "bg-white/5 border-white/10 text-white/40"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  abierto ? "bg-[#4caf50] animate-pulse" : "bg-white/30"
                }`}
              />
              {abierto ? "Abierto ahora" : "Cerrado ahora"}
            </div>
          </div>
        </div>

        {/* ── Mapa integrado ── */}
        <div className="rounded-[28px] overflow-hidden border border-white/15 shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
          {/* Cabecera del mapa */}
          <div className="flex items-center gap-2 px-6 py-4 bg-white/10 border-b border-white/10">
            <MapPin size={13} className="text-[#81c784]" />
            <span className="text-xs font-black uppercase tracking-[0.35em] text-[#81c784]">
              Encuéntranos
            </span>
          </div>
          <iframe
            title="Ubicación Tostón App"
            src="https://maps.google.com/maps?q=Carrera+38A+No.+80-12&output=embed&z=16&hl=es"
            width="100%"
            height="280"
            style={{ border: 0, display: "block" }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>

      {/* ── Copyright bar ── */}
      <div className="bg-[#0d3300] border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 text-center">
          <p className="text-sm font-bold text-[#81c784]">
            © 2026 Tostón App — Hecho con pasión para compartir momentos.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
