import BarraPorcentaje from "./BarraPorcentaje";

const COP = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

const ATAJOS = [
  { pct: 10, label: "10%" },
  { pct: 25, label: "25%" },
  { pct: 50, label: "Mitad" },
  { pct: 75, label: "75%" },
];

/**
 * Reparto de un pedido entre efectivo y transferencia.
 *
 * La barra mueve la parte en EFECTIVO; lo que queda va por transferencia. Los
 * montos que se ven aquí son una vista previa: el backend rehace el reparto
 * sobre el total real y le carga el redondeo a la transferencia, para que las
 * dos partes sumen exactamente el total.
 */
export default function SplitPagoSlider({ total, porcentajeEfectivo, onPorcentaje }) {
  const efectivo      = Math.round((total * porcentajeEfectivo) / 100);
  const transferencia = total - efectivo;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#9e9e9e", letterSpacing: "0.04em" }}>EFECTIVO</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#2e7d32" }}>{COP(efectivo)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#9e9e9e", letterSpacing: "0.04em" }}>TRANSFERENCIA</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#1565c0" }}>{COP(transferencia)}</div>
        </div>
      </div>

      <BarraPorcentaje
        porcentaje={porcentajeEfectivo}
        onPorcentaje={onPorcentaje}
        burbuja={`${porcentajeEfectivo}% en efectivo`}
        izquierda="Todo transferencia"
        derecha="Todo efectivo"
        atajos={ATAJOS}
        ariaLabel="Parte del pedido que se paga en efectivo"
        ariaValueText={`${COP(efectivo)} en efectivo y ${COP(transferencia)} por transferencia`}
      />
    </div>
  );
}
