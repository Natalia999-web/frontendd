import { useState } from "react";
import { Ban, AlertTriangle, X, Lock } from "lucide-react";

/**
 * ModalEliminarValidado
 *
 * Props:
 *  - titulo:      string
 *  - descripcion: string
 *  - validacion:  { ok: boolean, razon?: string }
 *                   ok=true  → permite eliminar (header amarillo, pide confirmación)
 *                   ok=false → bloquea (header rojo, solo muestra razón)
 *  - onClose:     () => void
 *  - onConfirm:   () => void
 */
export default function ModalEliminarValidado({ titulo, descripcion, validacion, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const bloqueado = !validacion?.ok;

  const handleConfirm = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    onConfirm();
    setLoading(false);
  };

  /* ── Paleta según modo ── */
  const palette = bloqueado
    ? { g1: "#b71c1c", g2: "#c62828", Icon: Ban,          iconBg: "rgba(255,255,255,0.15)", iconBorder: "rgba(255,255,255,0.3)", boxBg: "#ffebee", boxBorder: "#ef9a9a", boxColor: "#c62828", btnBg: "#c62828" }
    : { g1: "#e65100", g2: "#f57f17", Icon: AlertTriangle, iconBg: "rgba(255,255,255,0.15)", iconBorder: "rgba(255,255,255,0.3)", boxBg: "#fff8e1", boxBorder: "#ffe082", boxColor: "#e65100", btnBg: "#c62828" };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box modal-box--sm"
        onClick={e => e.stopPropagation()}
        style={{ overflow: "hidden", padding: 0 }}
      >
        {/* ── Cabecera con color ── */}
        <div style={{
          background: `linear-gradient(135deg, ${palette.g1} 0%, ${palette.g2} 100%)`,
          padding: "28px 24px 22px",
          textAlign: "center",
          position: "relative",
        }}>
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 12, right: 12,
              color: "rgba(255,255,255,0.8)", background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8,
              width: 30, height: 30, cursor: "pointer", fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          ><X size={14} /></button>

          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: palette.iconBg, border: `2px solid ${palette.iconBorder}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 14px",
          }}>
            <palette.Icon size={30} color="rgba(255,255,255,0.9)" />
          </div>

          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#fff", letterSpacing: -0.3 }}>
            {titulo}
          </h3>
          {descripcion && (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
              {descripcion}
            </p>
          )}
        </div>

        {/* ── Cuerpo ── */}
        <div style={{ padding: "18px 24px" }}>
          {bloqueado ? (
            <div style={{
              padding: "12px 14px", borderRadius: 10,
              background: palette.boxBg, border: `1.5px solid ${palette.boxBorder}`,
              color: palette.boxColor, fontSize: 13, fontWeight: 600, lineHeight: 1.6,
            }}>
              <span style={{display:"flex",alignItems:"center",gap:6}}><Lock size={14} />{validacion?.razon}</span>
            </div>
          ) : (
            <div style={{
              padding: "12px 14px", borderRadius: 10,
              background: palette.boxBg, border: `1.5px solid ${palette.boxBorder}`,
              color: palette.boxColor, fontSize: 13, fontWeight: 600, lineHeight: 1.6,
            }}>
              Esta acción <strong>no se puede deshacer</strong>. El registro será eliminado permanentemente.
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: "0 24px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          {!bloqueado && (
            <button
              onClick={handleConfirm}
              disabled={loading}
              style={{
                width: "100%", padding: "11px", borderRadius: 10, border: "none",
                background: palette.btnBg, color: "#fff",
                fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1, fontFamily: "inherit",
              }}
            >
              {loading ? "Eliminando…" : "Eliminar"}
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "10px", borderRadius: 10,
              border: "1.5px solid #e0e0e0", background: "#fff",
              color: "#616161", fontWeight: 700, fontSize: 13,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {bloqueado ? "Entendido" : "Cancelar"}
          </button>
        </div>
      </div>
    </div>
  );
}
