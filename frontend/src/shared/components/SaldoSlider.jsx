import BarraPorcentaje from "./BarraPorcentaje";

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

  return (
    <BarraPorcentaje
      porcentaje={porcentaje}
      onPorcentaje={onPorcentaje}
      burbuja={COP(aplicado)}
      izquierda="$0"
      centro={aplicado >= saldo ? "Usas todo tu saldo" : `Te quedan ${COP(saldo - aplicado)}`}
      derecha={COP(maximo)}
      atajos={ATAJOS}
      ariaLabel="Parte del saldo a favor que se aplica al pedido"
      ariaValueText={`${COP(aplicado)} de ${COP(maximo)}`}
    />
  );
}
