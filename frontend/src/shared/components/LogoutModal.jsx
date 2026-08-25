import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";
import "./LogoutModal.css";

export default function LogoutModal({ onConfirm, onCancel }) {
  return createPortal(
    <div className="lm-overlay" onClick={onCancel}>
      <div className="lm-card" onClick={(e) => e.stopPropagation()}>

        {/* Top accent bar */}
        <div className="lm-top-bar" />

        {/* Icon circle */}
        <div className="lm-icon-wrap">
          <div className="lm-icon-ring" />
          <span className="lm-icon"><LogOut size={28} /></span>
        </div>

        {/* Text */}
        <h3 className="lm-title">¿Cerrar sesión?</h3>
        <p className="lm-subtitle">Tu progreso está guardado. Podrás volver cuando quieras.</p>

        {/* Divider */}
        <div className="lm-divider" />

        {/* Buttons */}
        <div className="lm-actions">
          <button className="lm-btn lm-btn--cancel" onClick={onCancel}>
            <span>Quedarme</span>
          </button>
          <button className="lm-btn lm-btn--confirm" onClick={onConfirm}>
            <span>Sí, salir</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}