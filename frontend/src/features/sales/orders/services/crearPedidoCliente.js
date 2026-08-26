import { crearPedido } from '../../../../services/pedidosService';
import { subirImagenCloudinary } from '../../../../utils/cloudinary.js';
import { getCart } from './cartService';
import { getUser } from '../../../../services/authService';

/**
 * Envío de un pedido hecho por el cliente.
 *
 * Existe porque el checkout se abre desde dos pantallas —la landing y "Hacer
 * pedidos"— y cada una tenía su propia copia de este envío. La de la landing se
 * quedó atrás: no subía el comprobante ni mandaba los datos del anticipo, así
 * que los pedidos llegaban sin respaldo de pago y el backend los rechazaba.
 * Con un solo camino, una mejora aquí vale para las dos pantallas.
 *
 * Sube los comprobantes a Cloudinary y arma el cuerpo que espera la API. Lanza
 * un Error con el motivo si algo falla; quien llama decide qué mostrar y qué
 * hacer después (limpiar carrito, cerrar el modal, avisar…).
 */

/**
 * Datos de entrega finales: el modal puede haberlos cambiado respecto a lo que
 * traía el carrito. También lo usa la pantalla de pedidos para ofrecer guardar
 * la dirección después de confirmar.
 */
export const resolverEntrega = (deliveryInfo, orderDetails) => ({
  tieneDomicilio: deliveryInfo?.tieneDomicilio ?? orderDetails?.tieneDomicilio ?? false,
  address:        deliveryInfo?.address        || orderDetails?.address        || '',
  municipio:      deliveryInfo?.municipio      || orderDetails?.municipio      || '',
  departamento:   deliveryInfo?.departamento   || orderDetails?.departamento   || '',
  date:           deliveryInfo?.date           || orderDetails?.date           || '',
  time:           deliveryInfo?.time           || '',
  observaciones:  deliveryInfo?.observaciones  || orderDetails?.observaciones  || null,
});

/** Método de pago tal como lo guarda la API, sin emojis ni variantes. */
const metodoPagoApi = (metodo) =>
  metodo === 'digital' ? 'Transferencia'
  : metodo === 'mixto' ? 'Mixto'
  : 'Efectivo';

/** Método del anticipo: el checkout usa 'digital' | 'efectivo' | 'credito'. */
const metodoAnticipoApi = (metodo) =>
  metodo === 'digital' ? 'Transferencia' : metodo === 'credito' ? 'Credito' : 'Efectivo';

/** Sube un archivo y garantiza que devuelve una URL utilizable. */
const subirComprobante = async (archivo, queEs) => {
  let url;
  try {
    url = await subirImagenCloudinary(archivo);
  } catch (e) {
    throw new Error(`No se pudo subir ${queEs}: ${e?.message || 'intenta de nuevo'}`);
  }
  if (!url) throw new Error(`No se pudo guardar ${queEs}. Intenta de nuevo.`);
  return url;
};

/** Fecha de entrega en el formato que espera la API, o null. */
const fechaEntregaApi = (fecha, hora) =>
  fecha ? `${fecha}T${hora || '00:00'}:00` : null;

export async function crearPedidoCliente({
  paymentMethod,
  onBehalfOf,
  comprobante,
  saldoAFavor,
  deliveryInfo,
  anticipoData,
  orderDetails,
}) {
  const usuario = getUser();
  const carrito = getCart();

  const entrega = resolverEntrega(deliveryInfo, orderDetails);

  // Comprobante del pedido: aplica cuando hay transferencia (pure o mixto).
  const comprobanteUrl = (paymentMethod === 'digital' || paymentMethod === 'mixto') && comprobante
    ? await subirComprobante(comprobante, 'el comprobante')
    : null;

  // Comprobante del anticipo: solo si el anticipo se paga por transferencia.
  const anticipoComprobanteUrl =
    anticipoData?.requiere && anticipoData.metodo === 'digital' && anticipoData.comprobante
      ? await subirComprobante(anticipoData.comprobante, 'el comprobante del anticipo')
      : null;

  // El anticipo cuenta como registrado si el crédito lo cubre, si el cliente
  // confirmó haberlo pagado en efectivo, o si adjuntó el comprobante.
  const anticipoRegistrado = !!(anticipoData?.requiere && (
    anticipoData.creditoCubreAnticipo ? true
      : anticipoData.metodo === 'efectivo' ? anticipoData.efectivo
      : !!anticipoComprobanteUrl
  ));

  const payload = {
    ID_Usuario:  usuario?.id || null,
    productos:   carrito.map(item => ({
      ID_Producto: Number(item.id),
      Cantidad:    Number(item.cantidad),
    })),
    Metodo_Pago:            metodoPagoApi(paymentMethod),
    // Solo lo mira el backend cuando el método es Mixto: cuánta plata pone el
    // cliente en efectivo. Allá se recorta contra el total real.
    pago_efectivo_monto: paymentMethod === 'mixto'
      ? (saldoAFavor?.efectivoMonto ?? 0)
      : null,
    A_Nombre_De:            onBehalfOf || null,
    usar_credito:           !!saldoAFavor?.usar,
    // Cuanto de ese saldo se aplica. El backend lo toma como tope: si el
    // cliente pide mas de lo que tiene, alla se recorta.
    credito_monto:          saldoAFavor?.usar ? (saldoAFavor.monto ?? null) : null,
    codigo_descuento:       null,
    // Con anticipo, el archivo que sube el cliente es el del anticipo y el
    // comprobante del pedido queda vacío: entonces todas las vistas dicen "sin
    // comprobante adjunto" y el pedido ni siquiera se puede marcar como
    // entregado. Es el mismo soporte de pago, así que sirve para los dos campos.
    comprobante_pago:       comprobanteUrl || anticipoComprobanteUrl,
    Fecha_entrega_esperada: fechaEntregaApi(entrega.date, entrega.time),

    requiere_anticipo:        !!anticipoData?.requiere,
    anticipo_monto:           anticipoData?.monto ?? null,
    anticipo_metodo_pago:     anticipoData?.requiere ? metodoAnticipoApi(anticipoData.metodo) : null,
    anticipo_comprobante_url: anticipoComprobanteUrl,
    anticipo_registrado:      anticipoRegistrado,

    domicilio: entrega.tieneDomicilio && entrega.address ? {
      Direccion_entrega:    entrega.address,
      Municipio_entrega:    entrega.municipio    || 'Sin municipio',
      Departamento_entrega: entrega.departamento || 'Sin departamento',
      Observaciones:        entrega.observaciones,
    } : null,
  };

  return crearPedido(payload);
}
