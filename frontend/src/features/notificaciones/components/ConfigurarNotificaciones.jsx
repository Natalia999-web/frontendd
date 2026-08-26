import { useState } from "react";
import { X, Check, Settings, Save } from "lucide-react";
import { useNotificaciones } from "../context/NotificacionesContext";

/* ══════════════════════════════════════════════════════════
   HU_01 — Configurar notificaciones automáticas del sistema
   CA_01_01 definir nivel mínimo por insumo
   CA_01_02 al alcanzar → notificación automática
   CA_01_05 no duplicadas
══════════════════════════════════════════════════════════ */
export default function ConfigurarNotificaciones({ insumos = [], onClose }) {
  const { nivelesMinimos, configurarNivelMinimo, autoActivo, setAutoActivo, generarNotifAutomaticas } = useNotificaciones();

  const [niveles, setNiveles] = useState(() => {
    const base = {};
    insumos.forEach(i => {
      base[i.id] = nivelesMinimos[i.id] !== undefined ? nivelesMinimos[i.id] : i.stockMinimo;
    });
    return base;
  });
  const [toast, setToast] = useState(false);

  const handleGuardar = () => {
    Object.entries(niveles).forEach(([id, nivel]) => {
      configurarNivelMinimo(Number(id), nivel);
    });
    setTimeout(() => generarNotifAutomaticas(), 100);
    setToast(true);
    setTimeout(() => { setToast(false); onClose(); }, 1200);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 470 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">CONFIGURACIÓN</p>
            <h2 className="modal-header__title" style={{display:"flex",alignItems:"center",gap:6}}><Settings size={16} /> Notificaciones automáticas</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} style={{display:"flex",alignItems:"center",justifyContent:"center"}}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>

          {/* Toggle sistema — CA_01_02 */}
          <div className="form-group">
            <label className="form-label">Sistema de alertas automáticas</label>
            <div className="estado-row">
              <button
                className="toggle-btn"
                style={{ background: autoActivo ? "#2e7d32" : "#e0e0e0" }}
                onClick={() => setAutoActivo(v => !v)}
              >
                <span className="toggle-thumb" style={{ left: autoActivo ? "27px" : "3px" }}>
                  <span className="toggle-label">{autoActivo ? "ON" : ""}</span>
                </span>
              </button>
              <span className="estado-label" style={{ color: autoActivo ? "#2e7d32" : "#9e9e9e" }}>
                {autoActivo ? "Alertas activadas" : "Alertas desactivadas"}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "#9e9e9e", marginTop: 6 }}>
              Cuando está activo, el sistema genera alertas automáticas al detectar insumos bajo el nivel mínimo.
            </p>
          </div>

          {/* CA_01_01 — nivel mínimo por insumo */}
          {autoActivo && (
            <>
              <div style={{ height: 1, background: "#f5f5f5", margin: "12px 0" }} />
              <label className="form-label">Nivel mínimo de stock por insumo</label>
              <p style={{ fontSize: 12, color: "#9e9e9e", marginBottom: 12 }}>
                El sistema generará una alerta cuando el stock de un insumo sea igual o menor al nivel configurado.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {insumos.filter(i => i.estado).map(ins => (
                  <div key={ins.id} className="notif-config-row">
                    <div className="notif-config-row__info">
                      <span className="notif-config-row__nombre">{ins.nombre}</span>
                      <span className="notif-config-row__stock" style={{
                        color: ins.stockActual <= (niveles[ins.id] ?? ins.stockMinimo) ? "#c62828" : "#2e7d32"
                      }}>
                        Stock actual: {ins.stockActual}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <label style={{ fontSize: 12, color: "#9e9e9e", whiteSpace: "nowrap" }}>Mínimo:</label>
                      <input
                        type="number"
                        min="0"
                        className="field-input"
                        style={{ width: 80, textAlign: "center" }}
                        value={niveles[ins.id] ?? ins.stockMinimo ?? 0}
                        onChange={e => setNiveles(prev => ({ ...prev, [ins.id]: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          {toast && (
            <span style={{ fontSize: 13, color: "#2e7d32", fontWeight: 700, marginRight: "auto" }}>
              <Check size={13} style={{marginRight:3}} /> Configuración guardada
            </span>
          )}
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-save" onClick={handleGuardar}>
            <Save size={14} /> Guardar configuración
          </button>
        </div>
      </div>
    </div>
  );
}