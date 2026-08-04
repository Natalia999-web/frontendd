import { apiFetch } from "../utils/api";

const COLORS = ["#43a047","#ef5350","#fb8c00","#5c6bc0","#26c6da","#ec407a","#7e57c2"];

const safeKpi = (obj) => ({
  valor:         obj?.valor         ?? 0,
  variacion_pct: obj?.variacion_pct ?? 0,
  subiendo:      obj?.subiendo      ?? false,
});

const adaptDashboard = (data) => {
  const r = data?.resumen ?? {};

  const fmtPct = (pct, subiendo) => {
    const sign = subiendo ? "+" : "";
    return `${sign}${Math.abs(pct ?? 0).toFixed(1)}%`;
  };

  const v = safeKpi(r.total_ventas);
  const p = safeKpi(r.total_pedidos);
  const c = safeKpi(r.total_clientes);
  const t = safeKpi(r.ticket_promedio);

  return {
    periodo: data?.periodo,
    kpi: {
      ventas:   { valor: `$${Math.round(Number(v.valor)).toLocaleString("es-CO")}`,   delta: fmtPct(v.variacion_pct, v.subiendo),   positive: v.subiendo   },
      pedidos:  { valor: String(Math.round(Number(p.valor))),                           delta: fmtPct(p.variacion_pct, p.subiendo),   positive: p.subiendo   },
      clientes: { valor: String(Math.round(Number(c.valor))),                           delta: fmtPct(c.variacion_pct, c.subiendo),   positive: c.subiendo   },
      ticket:   { valor: `$${Math.round(Number(t.valor)).toLocaleString("es-CO")}`,   delta: fmtPct(t.variacion_pct, t.subiendo),   positive: t.subiendo   },
    },
    graficaVentas: (data?.grafica_ventas || []).map(p => ({
      etiqueta: p.etiqueta,
      actual:   Number(p.actual   ?? 0),
      anterior: Number(p.anterior ?? 0),
    })),
    productosTop: (data?.productos_top || []).map((p, i) => ({
      name:       p.nombre,
      value:      p.cantidad,
      porcentaje: p.porcentaje,
      color:      COLORS[i % COLORS.length],
    })),
  };
};

export const getDashboard = async (periodo = "hoy", fechaInicio = "", fechaFin = "") => {
  const params = new URLSearchParams({ periodo });
  if (periodo === "custom" && fechaInicio && fechaFin) {
    params.set("fecha_inicio", fechaInicio);
    params.set("fecha_fin", fechaFin);
  }
  const data = await apiFetch(`/dashboard/?${params.toString()}`);
  return adaptDashboard(data);
};
