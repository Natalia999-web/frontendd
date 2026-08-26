import "./CampoMonto.css";

/**
 * Campo para escribir una cantidad de plata.
 *
 * Acepta solo dígitos, separa los miles mientras se escribe y se topa solo en
 * `maximo`. Lo usan el saldo a favor y el reparto del pago mixto: los dos
 * necesitan un monto exacto en pesos, no un porcentaje — con un pedido de
 * $22.500 no hay porcentaje que dé $3.500.
 *
 * `atajos` son botones de acceso rápido: `[{ label: 'Todo', valor: 30000 }]`.
 */
export default function CampoMonto({
  valor,
  onValor,
  maximo,
  placeholder = "0",
  atajos = [],
  error,
  ariaLabel,
}) {
  const escribir = (texto) => {
    const limpio = String(texto).replace(/\D/g, "");
    onValor(limpio === "" ? "" : Math.min(Number(limpio), maximo));
  };

  const mostrado =
    valor === "" || valor == null ? "" : Number(valor).toLocaleString("es-CO");

  return (
    <div className="campo-monto">
      <div className={`campo-monto__caja${error ? " campo-monto__caja--error" : ""}`}>
        <span className="campo-monto__signo">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={mostrado}
          onChange={e => escribir(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
        />
        {atajos.map(a => (
          <button
            key={a.label}
            type="button"
            className={`campo-monto__atajo${Number(valor) === a.valor ? " campo-monto__atajo--activo" : ""}`}
            onClick={() => onValor(a.valor)}
          >
            {a.label}
          </button>
        ))}
      </div>
      {error && <p className="campo-monto__error">{error}</p>}
    </div>
  );
}
