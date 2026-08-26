import "./BarraPorcentaje.css";

/**
 * Barra para repartir algo entre dos lados.
 *
 * Dibuja el control completo —riel con relleno, pulgar redondo y una burbuja
 * que lo sigue— porque el input de rango nativo se ve distinto en cada
 * navegador y en Windows sale con el pulgar cuadrado.
 *
 * La usan el saldo a favor (cuánto se gasta ahora) y el pago mixto (cuánto
 * va en efectivo). Todo lo que se lee sale por props: este componente no sabe
 * de plata, solo de porcentajes.
 */
export default function BarraPorcentaje({
  porcentaje,
  onPorcentaje,
  burbuja,
  izquierda,
  centro,
  derecha,
  atajos = [],
  ariaLabel,
  ariaValueText,
}) {
  // Centro del pulgar: el navegador lo mueve dentro del riel, así que en los
  // extremos no coincide con el porcentaje puro. 24px de pulgar, 12 de radio.
  const centroPulgar = `calc(${porcentaje}% + ${12 - porcentaje * 0.24}px)`;

  return (
    <div className="barra-pct">
      <div className="barra-pct__pista">
        <span className="barra-pct__burbuja" style={{ left: centroPulgar }}>
          {burbuja}
        </span>
        <input
          type="range"
          className="barra-pct__input"
          min={0}
          max={100}
          step={5}
          value={porcentaje}
          onChange={e => onPorcentaje(Number(e.target.value))}
          style={{ "--pct": `${porcentaje}%` }}
          aria-label={ariaLabel}
          aria-valuetext={ariaValueText}
        />
      </div>

      <div className="barra-pct__topes">
        <span>{izquierda}</span>
        {centro && <span className="barra-pct__resto">{centro}</span>}
        <span>{derecha}</span>
      </div>

      {atajos.length > 0 && (
        <div className="barra-pct__atajos">
          {atajos.map(a => (
            <button
              key={a.pct}
              type="button"
              className={`barra-pct__atajo${porcentaje === a.pct ? " barra-pct__atajo--activo" : ""}`}
              onClick={() => onPorcentaje(a.pct)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
