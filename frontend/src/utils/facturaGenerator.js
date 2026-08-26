const COP = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n ?? 0);

const fmtFechaLarga = (str) => {
  if (!str) return new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  return new Date(str).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
};

function buildHTML({ numero, fecha, estado, cliente, entrega, metodoPago, items, subtotal, costoEntrega, descuento, total, anticipo = 0, pagoFinalRegistrado = false }) {
  const saldoPendiente = pagoFinalRegistrado ? 0 : Math.max(0, total - anticipo);
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura #${numero} — Tostón App</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Nunito',sans-serif;background:#edf7ee;color:#1a1a1a;padding:40px 20px;-webkit-print-color-adjust:exact;print-color-adjust:exact}

    /* PAGE */
    .page{max-width:780px;margin:0 auto;background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 24px 64px rgba(46,125,50,.18)}

    /* HEADER */
    .hd{background:linear-gradient(135deg,#1b5e20 0%,#2e7d32 55%,#43a047 100%);padding:44px 52px 36px;display:flex;justify-content:space-between;align-items:flex-start;position:relative;overflow:hidden}
    .hd::before{content:'';position:absolute;top:-80px;right:-80px;width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,.06)}
    .hd::after{content:'';position:absolute;bottom:-60px;left:28%;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.04)}
    .brand{position:relative;z-index:1}
    .brand-row{display:flex;align-items:center;gap:12px;margin-bottom:8px}
    .brand-icon{width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:26px}
    .brand-name{font-size:28px;font-weight:900;color:#fff;letter-spacing:-.5px}
    .brand-sub{font-size:11px;color:rgba(255,255,255,.6);font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-left:64px}
    .inv{text-align:right;position:relative;z-index:1}
    .inv-label{font-size:11px;font-weight:800;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:2px;margin-bottom:6px}
    .inv-num{font-size:36px;font-weight:900;color:#fff;letter-spacing:-1px;line-height:1;margin-bottom:8px}
    .inv-date{font-size:13px;color:rgba(255,255,255,.75);font-weight:700}
    .inv-badge{display:inline-block;margin-top:10px;padding:5px 16px;border-radius:20px;background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.25);font-size:11px;font-weight:800;color:#fff;letter-spacing:1px;text-transform:uppercase}

    /* WAVE */
    .wave{height:36px;background:#fff;clip-path:ellipse(55% 100% at 50% 100%)}

    /* BODY */
    .body{padding:4px 52px 52px}

    /* INFO CARDS */
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:32px 0}
    .icard{background:#f9fdf9;border:1.5px solid #c8e6c9;border-radius:18px;padding:22px}
    .icard-lbl{font-size:10px;font-weight:800;color:#2e7d32;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;display:flex;align-items:center;gap:6px}
    .icard-val{font-size:14px;font-weight:800;color:#1a1a1a;line-height:1.5}
    .icard-sub{font-size:12px;color:#9e9e9e;margin-top:4px;font-weight:600}
    .pay-badge{display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:4px 12px;border-radius:20px;background:#e8f5e9;border:1px solid #c8e6c9;font-size:12px;font-weight:800;color:#2e7d32}

    /* SECTION TITLE */
    .sec{display:flex;align-items:center;gap:10px;font-size:11px;font-weight:800;color:#2e7d32;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:16px}
    .sec::after{content:'';flex:1;height:1.5px;background:linear-gradient(90deg,#c8e6c9,transparent)}

    /* TABLE */
    .tbl-wrap{border-radius:16px;overflow:hidden;border:1.5px solid #e8f5e9;margin-bottom:6px}
    table{width:100%;border-collapse:collapse}
    thead tr{background:linear-gradient(135deg,#2e7d32,#43a047)}
    th{padding:13px 18px;font-size:10px;font-weight:800;color:rgba(255,255,255,.95);text-transform:uppercase;letter-spacing:1px;text-align:left}
    th.r{text-align:right}
    th.c{text-align:center}
    tbody tr{border-bottom:1px solid #f0faf0}
    tbody tr:last-child{border-bottom:none}
    td{padding:14px 18px;font-size:13px;vertical-align:middle}
    .td-name{font-weight:800;color:#1a1a1a}
    .td-name span{display:block;font-size:11px;color:#9e9e9e;font-weight:600;margin-top:2px}
    .td-c{text-align:center}
    .td-r{text-align:right;font-weight:800;color:#2e7d32;font-size:14px}
    .td-price{text-align:center;color:#616161;font-weight:700}
    .qty{display:inline-block;padding:3px 10px;border-radius:20px;background:#e8f5e9;border:1px solid #c8e6c9;color:#2e7d32;font-size:12px;font-weight:900}

    /* TOTALS */
    .totals{background:#f9fdf9;border:1.5px solid #c8e6c9;border-radius:18px;padding:22px 26px;margin-top:22px}
    .t-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:13px}
    .t-row .lbl{color:#616161;font-weight:700}
    .t-row .val{font-weight:800;color:#1a1a1a}
    .t-row.disc .val{color:#c62828}
    .t-div{height:1.5px;background:#c8e6c9;margin:12px 0}
    .t-total{padding-top:14px}
    .t-total .lbl{font-size:15px;font-weight:900;color:#1a1a1a;text-transform:uppercase;letter-spacing:.5px}
    .t-total .val{font-size:26px;font-weight:900;color:#2e7d32}
    .t-row.anticipo-row .lbl{color:#2e7d32;font-weight:700}
    .t-row.anticipo-row .val{color:#2e7d32}
    .t-row.saldo-row{padding:10px 0}
    .t-row.saldo-pending .lbl{font-size:14px;font-weight:900;color:#e65100;text-transform:uppercase;letter-spacing:.4px}
    .t-row.saldo-pending .val{font-size:22px;font-weight:900;color:#e65100}
    .t-row.saldo-paid .lbl{font-size:14px;font-weight:900;color:#2e7d32;text-transform:uppercase;letter-spacing:.4px}
    .t-row.saldo-paid .val{font-size:18px;font-weight:900;color:#2e7d32}

    /* FOOTER */
    .footer{background:linear-gradient(135deg,#1b5e20,#2e7d32);padding:32px 52px;text-align:center;margin-top:40px}
    .footer-msg{font-size:18px;font-weight:900;color:#fff;margin-bottom:6px}
    .footer-sub{font-size:12px;color:rgba(255,255,255,.6);font-weight:700;letter-spacing:.5px}
    .footer-dots{display:flex;justify-content:center;gap:6px;margin-top:16px}
    .footer-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.3)}
    .footer-dot.active{background:rgba(255,255,255,.8)}

    /* PRINT BTN */
    .print-btn{display:block;width:100%;padding:16px;margin-top:28px;background:linear-gradient(135deg,#2e7d32,#43a047);color:#fff;border:none;border-radius:16px;font-family:'Nunito',sans-serif;font-size:15px;font-weight:900;cursor:pointer;letter-spacing:.3px;box-shadow:0 6px 20px rgba(46,125,50,.3)}
    .print-btn:hover{filter:brightness(1.08);transform:translateY(-1px)}

    /* PRINT */
    @media print{
      body{background:#fff;padding:0}
      .page{border-radius:0;box-shadow:none}
      .print-btn{display:none!important}
      .hd,.footer{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    }
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="hd">
    <div class="brand">
      <div class="brand-row">
        <div class="brand-icon">🌿</div>
        <span class="brand-name">Tostón App</span>
      </div>
      <div class="brand-sub">Sabor de Origen</div>
    </div>
    <div class="inv">
      <div class="inv-label">Factura de venta</div>
      <div class="inv-num">#${numero}</div>
      <div class="inv-date">${fecha}</div>
      <div class="inv-badge">${estado}</div>
    </div>
  </div>
  <div class="wave"></div>

  <!-- BODY -->
  <div class="body">

    <!-- Info -->
    <div class="info-grid">
      <div class="icard">
        <div class="icard-lbl">👤 Cliente</div>
        <div class="icard-val">${cliente.nombre}</div>
        ${cliente.correo  ? `<div class="icard-sub">✉️ ${cliente.correo}</div>`  : ''}
        ${cliente.telefono? `<div class="icard-sub">📞 ${cliente.telefono}</div>`: ''}
      </div>
      <div class="icard">
        <div class="icard-lbl">${costoEntrega > 0 ? '🛵 Entrega a domicilio' : '🏪 Retiro en local'}</div>
        <div class="icard-val">${entrega}</div>
        <div class="icard-sub">
          <span class="pay-badge">💳 ${metodoPago}</span>
        </div>
      </div>
    </div>

    <!-- Productos -->
    <div class="sec">📦 Detalle de productos</div>
    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th class="c">Precio unit.</th>
            <th class="c">Cant.</th>
            <th class="r">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(it => `
          <tr>
            <td class="td-name">${it.nombre}</td>
            <td class="td-price">${COP(it.precio)}</td>
            <td class="td-c"><span class="qty">×${it.cantidad}</span></td>
            <td class="td-r">${COP(it.precio * it.cantidad)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <!-- Totales -->
    <div class="totals">
      <div class="t-row">
        <span class="lbl">Subtotal productos</span>
        <span class="val">${COP(subtotal)}</span>
      </div>
      ${costoEntrega > 0 ? `
      <div class="t-row">
        <span class="lbl">🛵 Costo de domicilio</span>
        <span class="val">${COP(costoEntrega)}</span>
      </div>` : ''}
      ${descuento > 0 ? `
      <div class="t-row disc">
        <span class="lbl">🎁 Descuento / crédito aplicado</span>
        <span class="val">-${COP(descuento)}</span>
      </div>` : ''}
      <div class="t-div"></div>
      <div class="t-row t-total">
        <span class="lbl">${anticipo > 0 ? 'Total del pedido' : 'Total pagado'}</span>
        <span class="val">${COP(total)}</span>
      </div>
      ${anticipo > 0 ? `
      <div class="t-div"></div>
      <div class="t-row anticipo-row">
        <span class="lbl">- Anticipo recibido</span>
        <span class="val">-${COP(anticipo)}</span>
      </div>
      <div class="t-row saldo-row ${saldoPendiente > 0 ? 'saldo-pending' : 'saldo-paid'}">
        <span class="lbl">${saldoPendiente > 0 ? 'Saldo pendiente al entregar' : 'Saldo — PAGADO'}</span>
        <span class="val">${COP(saldoPendiente)}</span>
      </div>` : ''}
    </div>

    <button class="print-btn" onclick="window.print()">🖨️ &nbsp;Guardar como PDF / Imprimir</button>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-msg">¡Gracias por tu pedido! 🌿</div>
    <div class="footer-sub">Tostón App &nbsp;·&nbsp; Sabor de Origen &nbsp;·&nbsp; ${year}</div>
    <div class="footer-dots">
      <div class="footer-dot active"></div>
      <div class="footer-dot"></div>
      <div class="footer-dot active"></div>
    </div>
  </div>

</div>
</body>
</html>`;
}

function abrirFactura(html) {
  const win = window.open('', '_blank', 'width=920,height=760,scrollbars=yes');
  if (!win) { alert('Activa las ventanas emergentes para descargar la factura.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
}

/* ── Para PedidosClientePage ──────────────────────────── */
export function descargarFacturaPedido(pedido, usuario) {
  const items    = pedido.productosItems || [];
  const subtotal = items.reduce((s, p) => s + p.precio * p.cantidad, 0);
  const costo    = pedido.domicilio ? 5000 : 0;
  const desc     = pedido.descuento || 0;
  const total    = pedido.total ?? (subtotal + costo - desc);

  const anticipoMonto = pedido.anticipo_registrado
    ? Number(pedido.anticipo_monto ?? 0)
    : 0;
  const pagoFinalRegistrado = !!pedido.pago_final_registrado;

  const html = buildHTML({
    numero:       pedido.numero,
    fecha:        fmtFechaLarga(pedido.fecha_pedido),
    estado:       pedido.estado || 'Procesado',
    cliente: {
      nombre:    `${usuario?.nombre || 'Cliente'} ${usuario?.apellidos || ''}`.trim(),
      correo:    usuario?.correo  || '',
      telefono:  usuario?.telefono || '',
    },
    entrega:      pedido.domicilio ? (pedido.direccion_entrega || 'Domicilio') : 'Retiro en el local',
    metodoPago:   pedido.metodo_pago || 'Efectivo',
    items,
    subtotal,
    costoEntrega: costo,
    descuento:    desc,
    total,
    anticipo:            anticipoMonto,
    pagoFinalRegistrado,
  });

  abrirFactura(html);
}

/* ── Para DeliveryPage (datos mock) ───────────────────── */
export function descargarFacturaEntrega(order) {
  const items    = (order.items || []).map(i => ({ nombre: i.name, precio: i.price, cantidad: i.quantity }));
  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

  const html = buildHTML({
    numero:       order.id,
    fecha:        order.date || fmtFechaLarga(null),
    estado:       order.status || 'Procesado',
    cliente: {
      nombre:   order.clientName || 'Cliente',
      correo:   order.clientEmail || '',
      telefono: order.clientPhone || '',
    },
    entrega:      order.address || 'Domicilio',
    metodoPago:   order.paymentMethod || 'Efectivo',
    items,
    subtotal,
    costoEntrega: order.deliveryCost ?? (order.total - subtotal > 0 ? order.total - subtotal : 0),
    descuento:    0,
    total:        order.total ?? subtotal,
  });

  abrirFactura(html);
}
