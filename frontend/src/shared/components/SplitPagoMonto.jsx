import CampoMonto from "./CampoMonto";
import "./SplitPagoMonto.css";

const COP = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n || 0);

/**
 * Reparto de un pedido entre efectivo y transferencia.
 *
 * El monto en efectivo se escribe en pesos, no como porcentaje: el cliente
 * pone la plata que tiene encima. Con un pedido de $22.500 y $3.500 en el
 * bolsillo no hay porcentaje que dé ese número.
 *
 * Lo que se ve aquí es una vista previa; el backend rehace el reparto sobre
 * el total real y recorta el monto si se pasa.
 */
export default function SplitPagoMonto({ total, montoEfectivo, onMonto, error }) {
  const efectivo      = Math.min(Math.max(Number(montoEfectivo) || 0, 0), total);
  const transferencia = total - efectivo;

  return (
    <div className="split-pago">
      <label className="split-pago__label">¿Cuánto vas a pagar en efectivo?</label>

      <CampoMonto
        valor={montoEfectivo}
        onValor={onMonto}
        maximo={total}
        atajos={[{ label: "Mitad", valor: Math.round(total / 2) }]}
        error={error}
        ariaLabel="Monto que se paga en efectivo"
      />

      <div className="split-pago__reparto">
        <div>
          <span className="split-pago__caption">EFECTIVO</span>
          <span className="split-pago__monto split-pago__monto--efectivo">{COP(efectivo)}</span>
        </div>
        <span className="split-pago__mas">+</span>
        <div style={{ textAlign: "right" }}>
          <span className="split-pago__caption">TRANSFERENCIA</span>
          <span className="split-pago__monto split-pago__monto--transfer">{COP(transferencia)}</span>
        </div>
      </div>

      <div className="split-pago__barra" aria-hidden="true">
        <div
          className="split-pago__barra-efectivo"
          style={{ width: total > 0 ? `${(efectivo / total) * 100}%` : "0%" }}
        />
      </div>

      <p className="split-pago__pie">Suman {COP(total)}, el total del pedido</p>
    </div>
  );
}
