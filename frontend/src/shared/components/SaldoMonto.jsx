import CampoMonto from "./CampoMonto";

const COP = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n || 0);

/**
 * Cuánto saldo a favor se aplica a este pedido.
 *
 * Se escribe en pesos, no en porcentaje: el cliente quiere gastar $5.000 de
 * los $18.400 que tiene, y con una barra de porcentajes esa cifra no existe.
 * Los atajos ofrecen montos redondos que quepan en el tope, más "Todo".
 */
export default function SaldoMonto({ saldo, maximo, monto, onMonto }) {
  const aplicado = Math.min(Math.max(Number(monto) || 0, 0), maximo);
  const restante = saldo - aplicado;

  // Montos redondos por debajo del tope. Con un tope chico quedan pocos (o
  // ninguno) y solo se ofrece "Todo", que es lo único que tiene sentido ahí.
  const atajos = [5000, 10000, 20000, 50000]
    .filter(v => v < maximo)
    .slice(-2)
    .map(v => ({ label: COP(v), valor: v }));
  atajos.push({ label: "Todo", valor: maximo });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#616161" }}>
          ¿Cuánto aplicas a este pedido?
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9e9e9e" }}>
          máx. {COP(maximo)}
        </span>
      </div>

      <CampoMonto
        valor={monto}
        onValor={onMonto}
        maximo={maximo}
        atajos={atajos}
        ariaLabel="Monto de saldo a favor que se aplica al pedido"
      />

      <p style={{ margin: "8px 0 0", fontSize: 11.5, fontWeight: 600, color: "#5d6f61", textAlign: "center" }}>
        {aplicado <= 0
          ? `Tienes ${COP(saldo)} de saldo a favor`
          : restante <= 0
            ? "Usas todo tu saldo a favor"
            : `Aplicas ${COP(aplicado)} — te quedan ${COP(restante)}`}
      </p>
    </div>
  );
}
