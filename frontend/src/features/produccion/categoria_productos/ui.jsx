import { Check, X } from "lucide-react";
import { C } from "./theme.js";

export const Toggle = ({ value, onChange }) => (
  <button
    onClick={() => onChange(!value)}
    className="toggle-btn"
    style={{
      background: value ? C.sage : "#d6d0c8",
      boxShadow: value ? `0 2px 6px ${C.sage}55` : "inset 0 1px 3px rgba(0,0,0,0.1)",
    }}
  >
    <span className="toggle-thumb" style={{ left: value ? 22 : 3 }} />
  </button>
);

export const StatusPill = ({ active }) => (
  <span
    className="status-pill"
    style={{
      background: active ? C.sageLight : "#f2eee8",
      color: active ? C.sageDark : C.textLight,
      border: `1px solid ${active ? "#c4d8c6" : "#ddd8cf"}`,
    }}
  >
    <span
      className="status-dot"
      style={{ background: active ? C.sage : "#b8b0a4" }}
    />
    {active ? "Activo" : "Inactivo"}
  </span>
);

export const FieldInput = ({ value, onChange, placeholder, multiline, error, disabled }) => {
  const borderColor = error ? C.red : C.border;
  const focusColor = C.sage;

  return multiline ? (
    <textarea
      rows={3}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`field-input${error ? " field-input--error" : ""}${disabled ? " field-input--disabled" : ""}`}
      style={{ borderColor, resize: "vertical" }}
      onFocus={e => !disabled && (e.target.style.borderColor = focusColor)}
      onBlur={e => (e.target.style.borderColor = borderColor)}
    />
  ) : (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`field-input${error ? " field-input--error" : ""}${disabled ? " field-input--disabled" : ""}`}
      style={{ borderColor }}
      onFocus={e => !disabled && (e.target.style.borderColor = focusColor)}
      onBlur={e => (e.target.style.borderColor = borderColor)}
    />
  );
};

export const Toast = ({ toast }) =>
  toast ? (
    <div
      className="toast"
      style={{
        background: toast.type === "success" ? C.sageDark : C.red,
      }}
    >
      <span className="toast-icon">{toast.type === "success" ? <Check size={14} /> : <X size={14} />}</span>
      {toast.message}
    </div>
  ) : null;

export const ModalOverlay = ({ onClose, children }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-box" onClick={e => e.stopPropagation()}>
      {children}
    </div>
  </div>
);