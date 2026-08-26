import { useEffect, useState } from "react";
import { X, Check, AlertCircle } from "lucide-react";
import { useNotificaciones, TIPO_ICONS, TIPO_COLORS } from "../context/NotificacionesContext";
import "./notificaciones.css";

/* ══════════════════════════════════════════════════════════
   BANNER DE ALERTA AL ENTRAR A LA PÁGINA
   Muestra notificaciones críticas no leídas cuando el
   usuario accede al sistema (HU_01 CA_01_02 / HU_02 CA_02_01)
══════════════════════════════════════════════════════════ */
export default function AlertaBanner({ onVerTodas }) {
  const { criticas, bannerVisto, setBannerVisto, marcarLeida } = useNotificaciones();
  const [visible, setVisible] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    if (!bannerVisto && criticas.length > 0) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, [bannerVisto, criticas.length]);

  const cerrar = () => {
    setSaliendo(true);
    setTimeout(() => {
      setVisible(false);
      setSaliendo(false);
      setBannerVisto(true);
    }, 300);
  };

  const handleVerTodas = () => {
    cerrar();
    if (onVerTodas) onVerTodas();
  };

  if (!visible || criticas.length === 0) return null;

  // Mostrar máximo 3 alertas críticas
  const mostrar = criticas.slice(0, 3);

  return (
    <div className={`alerta-banner ${saliendo ? "alerta-banner--out" : ""}`}>
      <div className="alerta-banner__inner">

        {/* Icono y título */}
        <div className="alerta-banner__header">
          <span className="alerta-banner__icon-main"><AlertCircle size={24} /></span>
          <div>
            <p className="alerta-banner__titulo">
              {criticas.length === 1
                ? "1 alerta crítica requiere tu atención"
                : `${criticas.length} alertas críticas requieren tu atención`}
            </p>
            <p className="alerta-banner__sub">Revisa los insumos o lotes con problemas urgentes</p>
          </div>
          <button className="alerta-banner__close" onClick={cerrar} data-tooltip="Cerrar alerta" style={{display:"flex",alignItems:"center",justifyContent:"center"}}><X size={16} /></button>
        </div>

        {/* Lista de alertas */}
        <div className="alerta-banner__list">
          {mostrar.map(n => {
            const color = TIPO_COLORS[n.tipo] || "#c62828";
            return (
              <div key={n.id} className="alerta-banner__item" style={{ "--ac": color }}>
                <span className="alerta-banner__item-icon">{(() => { const Icon = TIPO_ICONS[n.tipo]; return Icon ? <Icon size={15} /> : null; })()}</span>
                <div className="alerta-banner__item-text">
                  <strong>{n.titulo}</strong>
                  <span>{n.mensaje}</span>
                </div>
                <button
                  className="alerta-banner__item-read"
                  onClick={() => marcarLeida(n.id)}
                  data-tooltip="Marcar como leída"
                >
                  <Check size={13} />
                </button>
              </div>
            );
          })}
          {criticas.length > 3 && (
            <p className="alerta-banner__more">
              +{criticas.length - 3} alerta{criticas.length - 3 > 1 ? "s" : ""} más...
            </p>
          )}
        </div>

        {/* Acciones */}
        <div className="alerta-banner__actions">
          <button className="alerta-banner__btn-ver" onClick={handleVerTodas}>
            Ver todas las notificaciones
          </button>
          <button className="alerta-banner__btn-cerrar" onClick={cerrar}>
            Ignorar por ahora
          </button>
        </div>
      </div>
    </div>
  );
}