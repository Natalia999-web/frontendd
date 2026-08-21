import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  getValue,
  getLabel,
  placeholder = "— Seleccionar —",
  searchPlaceholder = "🔍 Buscar…",
  className = "field-input",
  error = false,
  disabled = false,
  style = {},
}) {
  const [open, setOpen]   = useState(false);
  const [q, setQ]         = useState("");
  const [pos, setPos]     = useState({ top: 0, left: 0, width: 0 });
  const triggerRef        = useRef();
  const inputRef          = useRef();

  const selected = options.find(o => String(getValue(o)) === String(value));

  const filtered = q
    ? options.filter(o => getLabel(o).toLowerCase().includes(q.toLowerCase()))
    : options;

  const updatePos = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
  };

  const handleOpen = () => {
    if (disabled) return;
    updatePos();
    setOpen(v => !v);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSelect = o => {
    onChange({ target: { value: String(getValue(o)) } });
    setOpen(false);
    setQ("");
  };

  const handleClear = e => {
    e.stopPropagation();
    onChange({ target: { value: "" } });
    setQ("");
  };

  useEffect(() => {
    if (!open) return;
    const close = e => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        !document.getElementById("ss-portal")?.contains(e.target)
      ) {
        setOpen(false);
        setQ("");
      }
    };
    const rePos = () => updatePos();
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", rePos, true);
    window.addEventListener("resize", rePos);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", rePos, true);
      window.removeEventListener("resize", rePos);
    };
  }, [open]);

  const dropdown = open && createPortal(
    <div
      id="ss-portal"
      className="ss-dropdown"
      style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
    >
      <div className="ss-dropdown__search">
        <input
          ref={inputRef}
          className="ss-dropdown__input"
          placeholder={searchPlaceholder}
          value={q}
          onChange={e => setQ(e.target.value)}
          onMouseDown={e => e.stopPropagation()}
        />
      </div>
      <ul className="ss-dropdown__list">
        {filtered.length === 0 ? (
          <li className="ss-dropdown__empty">Sin resultados</li>
        ) : filtered.map(o => {
          const val = String(getValue(o));
          const isActive = val === String(value);
          return (
            <li
              key={val}
              className={`ss-dropdown__item${isActive ? " ss-dropdown__item--active" : ""}`}
              onMouseDown={() => handleSelect(o)}
            >
              {getLabel(o)}
              {isActive && <span className="ss-dropdown__check">✓</span>}
            </li>
          );
        })}
      </ul>
    </div>,
    document.body
  );

  return (
    <div ref={triggerRef} style={{ position: "relative", ...style }}>
      <div
        className={`ss-trigger ${className}${error ? " error field-input--error" : ""}${open ? " ss-trigger--open" : ""}`}
        onClick={handleOpen}
        style={{ opacity: disabled ? 0.55 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      >
        <span className={selected ? "ss-trigger__value" : "ss-trigger__placeholder"}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <span className="ss-trigger__icons">
          {selected && !disabled && (
            <span className="ss-trigger__clear" onMouseDown={handleClear}>✕</span>
          )}
          <span className={`ss-trigger__arrow${open ? " ss-trigger__arrow--up" : ""}`}>▾</span>
        </span>
      </div>
      {dropdown}
    </div>
  );
}
