/* ui.jsx — componentes compartidos del proyecto */
import { CheckCircle2, Trash2, AlertTriangle } from "lucide-react";

export function ModalOverlay({ onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  const colors = {
    success: { bg: "#2e7d32", icon: "✅" },
    error:   { bg: "#c62828", icon: "🗑️" },
    warning: { bg: "#f9a825", icon: "⚠️" },
  };
  const c = colors[toast.type] || colors.success;
  return (
    <div className="toast" style={{ background: c.bg, zIndex: 40000 }}>
      <span className="toast-icon">{c.icon}</span>
      {toast.message}
    </div>
  );
}