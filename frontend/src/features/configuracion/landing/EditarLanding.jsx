import { useState } from "react";
import { Eye, Save, RotateCcw, CheckCircle2 } from "lucide-react";
import {
  getLandingConfig,
  saveLandingConfig,
  resetLandingConfig,
  LANDING_DEFAULTS,
} from "../../../services/landingConfigService";

const FIELDS = [
  {
    group: "Hero principal",
    fields: [
      { key: "heroBadge",       label: "Badge (etiqueta pequeña)",  type: "text",     placeholder: LANDING_DEFAULTS.heroBadge },
      { key: "heroTitle",       label: "Título principal",           type: "text",     placeholder: LANDING_DEFAULTS.heroTitle },
      { key: "heroDescription", label: "Descripción del hero",       type: "textarea", placeholder: LANDING_DEFAULTS.heroDescription },
    ],
  },
  {
    group: "Sección Nosotros",
    fields: [
      { key: "historyTitle",       label: "Título",       type: "text",     placeholder: LANDING_DEFAULTS.historyTitle },
      { key: "historyDescription", label: "Descripción",  type: "textarea", placeholder: LANDING_DEFAULTS.historyDescription },
    ],
  },
  {
    group: "CTA (llamada a la acción)",
    fields: [
      { key: "ctaTitle",       label: "Título CTA",       type: "text",     placeholder: LANDING_DEFAULTS.ctaTitle },
      { key: "ctaDescription", label: "Descripción CTA",  type: "textarea", placeholder: LANDING_DEFAULTS.ctaDescription },
    ],
  },
  {
    group: "Información de contacto",
    fields: [
      { key: "contactPhone1",          label: "Teléfono 1",             type: "text", placeholder: LANDING_DEFAULTS.contactPhone1 },
      { key: "contactPhone2",          label: "Teléfono 2",             type: "text", placeholder: LANDING_DEFAULTS.contactPhone2 },
      { key: "contactAddressLine",     label: "Dirección",              type: "text", placeholder: LANDING_DEFAULTS.contactAddressLine },
      { key: "contactCity",            label: "Ciudad y país",          type: "text", placeholder: LANDING_DEFAULTS.contactCity },
      { key: "contactInstagramHandle", label: "Instagram (usuario)",    type: "text", placeholder: LANDING_DEFAULTS.contactInstagramHandle },
      { key: "contactInstagramUrl",    label: "Instagram (enlace URL)", type: "text", placeholder: LANDING_DEFAULTS.contactInstagramUrl },
      { key: "horarioLunesViernes",    label: "Horario Lun – Vie",      type: "text", placeholder: LANDING_DEFAULTS.horarioLunesViernes },
      { key: "horarioSabado",          label: "Horario Sábado",         type: "text", placeholder: LANDING_DEFAULTS.horarioSabado },
    ],
  },
];

export default function EditarLanding() {
  const [form,    setForm]    = useState(() => getLandingConfig());
  const [saved,   setSaved]   = useState(false);
  const [confirm, setConfirm] = useState(false);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveLandingConfig(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    if (!confirm) { setConfirm(true); return; }
    setForm(resetLandingConfig());
    setConfirm(false);
    setSaved(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">

      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1b5e20]">Editar Landing Page</h1>
          <p className="text-sm text-gray-500 mt-1">Los cambios se aplican inmediatamente para todos los visitantes.</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            data-tooltip="Abrir la landing page en una nueva pestaña"
            className="flex items-center gap-2 px-4 py-2 bg-[#e8f5e9] text-[#1b5e20] rounded-xl font-bold text-sm hover:bg-[#c8e6c9] transition-colors"
          >
            <Eye className="w-4 h-4" />
            Ver landing
          </a>
          <button
            onClick={handleReset}
            data-tooltip={confirm ? "Confirmar restauración de valores predeterminados" : "Restaurar textos predeterminados"}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors ${
              confirm
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            {confirm ? "¿Seguro? Confirmar" : "Restaurar defecto"}
          </button>
          {confirm && (
            <button
              onClick={() => setConfirm(false)}
              data-tooltip="Cancelar restauración"
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Toast guardado */}
      {saved && (
        <div className="flex items-center gap-3 px-5 py-4 bg-[#e8f5e9] border border-[#a5d6a7] rounded-2xl text-[#1b5e20] font-bold">
          <CheckCircle2 className="w-5 h-5 text-[#4caf50]" />
          Cambios guardados correctamente
        </div>
      )}

      {/* Grupos de campos */}
      {FIELDS.map(({ group, fields }) => (
        <section key={group} className="bg-white rounded-2xl border border-[#e8f5e9] overflow-hidden shadow-sm">
          <div className="px-6 py-4 bg-[#f7faf8] border-b border-[#e8f5e9]">
            <h2 className="font-black text-[#1b5e20] text-sm uppercase tracking-wider">{group}</h2>
          </div>
          <div className="p-6 space-y-5">
            {fields.map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">{label}</label>
                {type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={form[key]}
                    onChange={e => handleChange(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#4caf50] focus:ring-2 focus:ring-[#4caf50]/20 text-sm resize-none transition"
                  />
                ) : (
                  <input
                    type="text"
                    value={form[key]}
                    onChange={e => handleChange(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#4caf50] focus:ring-2 focus:ring-[#4caf50]/20 text-sm transition"
                  />
                )}
                <p className="text-xs text-gray-400 mt-1">Por defecto: {placeholder}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Botón guardar fijo */}
      <div className="sticky bottom-0 bg-white/80 backdrop-blur-md border-t border-[#e8f5e9] -mx-6 px-6 py-4 flex justify-end">
        <button
          onClick={handleSave}
          data-tooltip="Guardar todos los cambios en la landing page"
          className="flex items-center gap-2 px-8 py-3 bg-[#1b5e20] text-white font-black rounded-2xl hover:bg-[#0d3300] transition-all shadow-lg active:scale-95"
        >
          <Save className="w-4 h-4" />
          Guardar cambios
        </button>
      </div>
    </div>
  );
}
