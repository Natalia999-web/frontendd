import "./SaldoSlider.css";

const COP = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

const ATAJOS = [
  { pct: 25,  label: "25%" },
  { pct: 50,  label: "50%" },
  { pct: 75,  label: "75%" },
  { pct: 100, label: "Todo" },
];

/**
 * Barra para repartir el saldo a favor entre este pedido y los siguientes.
 *
 * El porcentaje corre sobre `maximo` —lo máximo aplicable, que es el saldo o
 * el total del pedido, el que sea menor—, así el extremo derecho cae justo y
 * nunca queda plata aplicada de sobra.
 *
 * La misma pieza se usa en el checkout del cliente y en el alta del admin:
 * eran dos copias distintas del mismo control.
 */
export default function SaldoSlider({ saldo, maximo, porcentaje, onPorcentaje }) {
  const aplicado = Math.round((maximo * porcentaje) / 100);

  // Centro del pulgar: el navegador lo mueve dentro del riel, así que en los
  // extremos no coincide con el porcentaje puro. 24px de pulgar, 12 de radio.
  const centro = `calc(${porcentaje}% + ${12 - porcentaje * 0.24}px)`;

  return (
    <div className="saldo-slider">
      <div className="saldo-slider__pista">
        <span className="saldo-slider__burbuja" style={{ left: centro }}>
          {COP(aplicado)}
        </span>
        <input
          type="range"
          className="saldo-slider__input"
          min={0}
          max={100}
          step={5}
          value={porcentaje}
          onChange={e => onPorcentaje(Number(e.target.value))}
          style={{ "--pct": `${porcentaje}%` }}
          aria-label="Parte del saldo a favor que se aplica al pedido"
          aria-valuetext={`${COP(aplicado)} de ${COP(maximo)}`}
        />
      </div>

      <div className="saldo-slider__topes">
        <span>$0</span>
        <span className="saldo-slider__resto">
          {aplicado >= saldo ? "Usas todo tu saldo" : `Te quedan ${COP(saldo - aplicado)}`}
        </span>
        <span>{COP(maximo)}</span>
      </div>

      <div className="saldo-slider__atajos">
        {ATAJOS.map(a => (
          <button
            key={a.pct}
            type="button"
            className={`saldo-slider__atajo${porcentaje === a.pct ? " saldo-slider__atajo--activo" : ""}`}
            onClick={() => onPorcentaje(a.pct)}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
