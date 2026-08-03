import React, { useState, useEffect } from 'react';
import { X, CreditCard, Banknote, User, MapPin, ShoppingBag, CheckCircle2, Sparkles, ShieldCheck, UploadCloud, ChevronRight, Gift, Truck, Calendar, Phone, Save } from 'lucide-react';
import { CartItem } from '../services/cartService';
import { getUser } from '../../../../services/authService';
import { getMiCredito } from '../../../../services/pedidosService';
import { apiFetch } from '../../../../utils/api';
import { MUNICIPIOS_VALLE_ABURRA } from '../../../../utils/departamentosYCiudades';
import './CheckoutModal.css';

// Datos de la cuenta bancaria — actualiza en GestionPedidos.jsx también
const CUENTA = {
  banco:   'Nequi / Bancolombia',
  numero:  '316 453 7890',
  tipo:    'Cuenta de ahorros',
  titular: 'TostonApp S.A.S',
};

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderDetails: {
    address: string;
    municipio?: string;
    departamento?: string;
    date?: string;
    clientName: string;
    items: CartItem[];
    total: number;
    observaciones?: string;
    tieneDomicilio?: boolean;
  } | null;
  onConfirm: (paymentMethod: string, onBehalfOf: string, comprobante?: File | null, usarCredito?: boolean, deliveryInfo?: { tieneDomicilio: boolean; address: string; municipio: string; departamento: string; date: string; time: string; observaciones: string }) => void;
}

const COSTO_DOMICILIO = 5000;
const hoyISO = () => new Date().toISOString().split('T')[0];

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, orderDetails, onConfirm }) => {
  const [paymentMethod,      setPaymentMethod]      = useState('digital');
  const [onBehalfOf,         setOnBehalfOf]         = useState('');
  const [comprobante,        setComprobante]        = useState<File | null>(null);
  const [isConfirming,       setIsConfirming]       = useState(false);
  const [qrOpen,             setQrOpen]             = useState(false);
  const [credito,            setCredito]            = useState(0);
  const [usarCredito,        setUsarCredito]        = useState(false);
  const [tieneDomicilio,     setTieneDomicilio]     = useState(false);
  const [address,            setAddress]            = useState('');
  const [municipio,          setMunicipio]          = useState('');
  const [date,               setDate]               = useState('');
  const [time,               setTime]               = useState('');
  const [observaciones,      setObservaciones]      = useState('');
  // Teléfono
  const [telefono,           setTelefono]           = useState('');
  const [telefonoTocado,     setTelefonoTocado]     = useState(false);
  const [telefonoRegistrado, setTelefonoRegistrado] = useState(false);
  const [guardarTelefono,    setGuardarTelefono]    = useState(true);
  // Dirección guardada
  const [direccionRegistrada, setDireccionRegistrada] = useState('');
  const [guardarDireccion,    setGuardarDireccion]    = useState(true);
  const [addressTocada,       setAddressTocada]       = useState(false);
  const [municipioTocado,     setMunicipioTocado]     = useState(false);

  useEffect(() => {
    if (!isOpen || !orderDetails) return;
    const user = getUser();
    setOnBehalfOf(user?.nombre || orderDetails.clientName || '');
    setTieneDomicilio(orderDetails.tieneDomicilio ?? false);
    setAddress(orderDetails.address || '');
    setMunicipio(orderDetails.municipio || '');
    setDate(orderDetails.date || '');
    setTime('');
    setObservaciones(orderDetails.observaciones || '');
    setComprobante(null);
    setTelefonoTocado(false);
    setAddressTocada(false);
    setMunicipioTocado(false);

    // Cargar perfil para verificar teléfono y dirección
    apiFetch('/auth/perfil')
      .then((perfil: any) => {
        const tel = perfil?.Telefono || '';
        setTelefono(tel);
        setTelefonoRegistrado(!!tel);
        const dir = perfil?.Direccion || '';
        setDireccionRegistrada(dir);
        // Pre-llenar dirección si hay y no vino del carrito
        if (dir && !orderDetails.address) {
          setAddress(dir);
          setMunicipio(perfil?.Municipio || '');
        }
      })
      .catch(() => {
        setTelefonoRegistrado(false);
        setDireccionRegistrada(false);
      });

    getMiCredito()
      .then((data: any) => setCredito(data?.saldo || 0))
      .catch(() => setCredito(0));
  }, [isOpen]);

  if (!isOpen || !orderDetails) return null;

  const itemsConDeficit = (orderDetails.items || []).filter(
    (it: CartItem) => it.requiereProduccion && it.cantidad > (it.stock ?? 0)
  );

  const soloDigitos = (tel: string) => tel.replace(/\D/g, '');
  const telefonoValido = soloDigitos(telefono).length === 10;
  const telefonoError = telefonoTocado && !telefonoValido
    ? soloDigitos(telefono).length === 0 ? 'El teléfono es obligatorio' : 'Debe tener exactamente 10 dígitos'
    : null;

  const addressValida = address.trim().length >= 5 && /\d/.test(address);
  const addressError = addressTocada && !addressValida
    ? address.trim().length === 0 ? 'La dirección es obligatoria'
      : address.trim().length < 5  ? 'La dirección es demasiado corta'
      : 'Debe incluir un número (Ej: Calle 10 #20-30)'
    : null;
  const municipioValido = municipio.trim().length > 0;
  const municipioError = municipioTocado && !municipioValido ? 'Selecciona el municipio de entrega' : null;

  const user = getUser();
  const costoDomicilio = tieneDomicilio ? COSTO_DOMICILIO : 0;
  const creditoAplicar = usarCredito ? Math.min(credito, orderDetails.total + costoDomicilio) : 0;
  const totalFinal     = Math.max(0, orderDetails.total + costoDomicilio - creditoAplicar);

  const handleFinalConfirm = async () => {
    setTelefonoTocado(true);
    if (tieneDomicilio) {
      setAddressTocada(true);
      setMunicipioTocado(true);
    }
    if (!telefonoValido) return;
    if (!date) {
      alert('Indica la fecha en que necesitas el pedido');
      return;
    }
    if (tieneDomicilio && (!addressValida || !municipioValido)) return;

    setIsConfirming(true);

    // Guardar teléfono si el usuario lo pidió y no estaba registrado (o cambió)
    if (guardarTelefono && (!telefonoRegistrado || telefono !== (user as any)?.telefono)) {
      await apiFetch('/auth/perfil', {
        method: 'PUT',
        body: JSON.stringify({ Telefono: telefono }),
      }).catch(() => {});
    }

    // Guardar dirección si aplica
    if (tieneDomicilio && guardarDireccion && (!direccionRegistrada || address)) {
      await apiFetch('/auth/perfil', {
        method: 'PUT',
        body: JSON.stringify({ Direccion: address, Municipio: municipio }),
      }).catch(() => {});
    }

    onConfirm(paymentMethod, onBehalfOf, comprobante, usarCredito, {
      tieneDomicilio, address, municipio, departamento: orderDetails.departamento || 'Antioquia', date, time, observaciones,
    });
    setIsConfirming(false);
  };

  const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-sm text-gray-700 font-medium placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all";

  return (
    <div className="modal-overlay">
      <div className="modal-box relative shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border-none" style={{ maxWidth: '460px', borderRadius: '24px' }}>

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4" style={{ background: 'linear-gradient(135deg, var(--green-800) 0%, var(--green-700) 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl border border-white/20">
              <ShoppingBag size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-white leading-none mb-0.5">Confirmar Pedido</h2>
              <p className="text-white/60 text-[10px] font-bold flex items-center gap-1">
                <ShieldCheck size={9} /> Pago 100% Seguro
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full transition-all text-white/70 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 px-4 py-3 space-y-3">

          {/* Aviso de producción */}
          {itemsConDeficit.length > 0 && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3">
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                🏭 Orden de producción requerida
              </p>
              <p className="text-xs font-semibold text-blue-700 mb-2">
                Los siguientes productos no tienen suficiente stock. Se creará una orden de producción y el administrador te propondrá una fecha de entrega.
              </p>
              <ul className="space-y-1">
                {itemsConDeficit.map((it: CartItem) => (
                  <li key={it.id} className="flex justify-between text-[11px] font-bold text-blue-800">
                    <span>{it.nombre}</span>
                    <span className="text-blue-500">
                      Stock: {it.stock ?? 0} · Pedido: {it.cantidad}
                      {it.cantidad > (it.stock ?? 0) ? ` · Déficit: ${it.cantidad - (it.stock ?? 0)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quién recibe + a nombre de */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-2xl border border-gray-100 px-3 py-2.5">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Quién recibe</p>
              <div className="flex items-center gap-1.5">
                <User size={12} className="text-green-700 shrink-0" />
                <p className="text-xs font-black text-gray-800 truncate">{user?.nombre} {user?.apellidos}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 px-3 py-2.5">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">A nombre de</p>
              <input
                type="text"
                value={onBehalfOf}
                onChange={e => setOnBehalfOf(e.target.value)}
                placeholder="Nombre"
                className="w-full bg-transparent text-xs font-black text-gray-800 outline-none placeholder:text-gray-300 border-none p-0"
              />
            </div>
          </div>

          {/* Teléfono de contacto */}
          <div className={`bg-white rounded-2xl border px-3 py-3 space-y-2 ${telefonoError ? 'border-red-200' : telefonoValido ? 'border-green-200' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Phone size={10} /> Teléfono de contacto
                <span className="text-red-400">*</span>
              </p>
              {telefonoRegistrado && telefonoValido && (
                <span className="text-[9px] font-bold text-green-600 flex items-center gap-1">
                  <CheckCircle2 size={10} /> Registrado
                </span>
              )}
            </div>
            <div className="relative">
              <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="tel"
                placeholder="Ej: 300 123 4567"
                value={telefono}
                onChange={e => {
                  setTelefono(e.target.value);
                  setTelefonoTocado(true);
                }}
                onBlur={() => setTelefonoTocado(true)}
                className={inputCls + " pl-8"}
              />
            </div>
            {telefonoError && (
              <p className="text-[10px] font-bold text-red-500">{telefonoError}</p>
            )}
            {!telefonoError && telefonoValido && !telefonoRegistrado && telefono.trim() && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={guardarTelefono}
                  onChange={e => setGuardarTelefono(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-green-600"
                />
                <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                  <Save size={11} className="text-green-600" /> Guardar como teléfono principal
                </span>
              </label>
            )}
          </div>

          {/* Tipo de entrega */}
          <div className="bg-white rounded-2xl border border-gray-100 px-3 py-3 space-y-2.5">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tipo de entrega</p>
            <div className="grid grid-cols-2 bg-gray-100 rounded-xl p-1 gap-1">
              <button
                onClick={() => setTieneDomicilio(false)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-all duration-200 ${!tieneDomicilio ? 'bg-white text-green-800 shadow' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <ShoppingBag size={13} /> Recogida
              </button>
              <button
                onClick={() => setTieneDomicilio(true)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-all duration-200 ${tieneDomicilio ? 'bg-white text-green-800 shadow' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Truck size={13} /> Domicilio
              </button>
            </div>

            {!tieneDomicilio && (
              <div className="flex items-start gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
                <MapPin size={14} className="text-green-700 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-0.5">Dirección de recogida</p>
                  <p className="text-xs font-bold text-gray-700">CARRERA 38 A NO. 80 12</p>
                </div>
              </div>
            )}

            {/* Fecha y hora de entrega */}
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    min={hoyISO()}
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className={inputCls + " pl-8"}
                  />
                </div>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className={inputCls}
                />
              </div>
              <p className="text-[10px] font-bold text-amber-600 flex items-center gap-1 pl-1">
                ⏰ La hora es aproximada — pueden existir otros pedidos programados para ese momento.
              </p>
            </div>

            {tieneDomicilio && (
              <div className="space-y-2">
                <div>
                  <div className={`relative ${addressError ? 'ring-1 ring-red-300 rounded-xl' : ''}`}>
                    <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Dirección (Ej: Calle 10 #20-30)"
                      value={address}
                      onChange={e => { setAddress(e.target.value); setAddressTocada(true); }}
                      onBlur={() => setAddressTocada(true)}
                      className={inputCls + " pl-8"}
                    />
                  </div>
                  {addressError && <p className="text-[10px] font-bold text-red-500 mt-1 pl-1">{addressError}</p>}
                </div>
                <div>
                  <select
                    value={municipio}
                    onChange={e => { setMunicipio(e.target.value); setMunicipioTocado(true); }}
                    onBlur={() => setMunicipioTocado(true)}
                    className={inputCls + (municipioError ? ' border-red-300 ring-1 ring-red-200' : '')}
                  >
                    <option value="">— Municipio —</option>
                    {MUNICIPIOS_VALLE_ABURRA.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {municipioError && <p className="text-[10px] font-bold text-red-500 mt-1 pl-1">{municipioError}</p>}
                </div>
                {addressValida && address.trim() !== direccionRegistrada.trim() && (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={guardarDireccion} onChange={e => setGuardarDireccion(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-green-600" />
                    <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                      <Save size={11} className="text-green-600" />
                      {direccionRegistrada ? 'Actualizar mi dirección registrada' : 'Guardar como dirección principal'}
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Resumen productos */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Productos</span>
              <span className="text-[9px] font-black text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{orderDetails.items.length} items</span>
            </div>
            <div className="max-h-28 overflow-y-auto custom-scrollbar px-3 py-1">
              {orderDetails.items.map(item => (
                <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs font-bold text-gray-700 flex-1 truncate">{item.nombre}</span>
                  <span className="text-[10px] text-gray-400 font-black mx-2">×{item.cantidad}</span>
                  <span className="text-xs font-black text-gray-900">{COP(item.precio * item.cantidad)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Método de pago */}
          <div className="bg-white rounded-2xl border border-gray-100 px-3 py-3 space-y-2.5">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Método de pago</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'digital',  icon: <CreditCard size={14} />, label: 'Transferencia' },
                { id: 'efectivo', icon: <Banknote size={14} />,   label: 'Efectivo' },
              ].map(m => (
                <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-xs font-black ${paymentMethod === m.id ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'}`}>
                  <div className={`p-1.5 rounded-lg ${paymentMethod === m.id ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{m.icon}</div>
                  {m.label}
                </button>
              ))}
            </div>

            {paymentMethod === 'digital' && (
              <div className="space-y-2">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-3">
                  {/* QR clickable — coloca /public/qr-pago.png para que aparezca la imagen */}
                  <button
                    onClick={() => setQrOpen(true)}
                    title="Ampliar QR de pago"
                    className="w-14 h-14 shrink-0 rounded-lg border border-blue-200 bg-white overflow-hidden relative group cursor-zoom-in hover:shadow-md transition-shadow"
                    style={{ padding: 0 }}
                  >
                    <img
                      src="/qr-pago.png"
                      alt="QR de pago"
                      className="w-full h-full object-contain"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-blue-400">
                      <span style={{ fontSize: 22 }}>📱</span>
                      <span className="text-[7px] font-black uppercase mt-0.5">Nequi</span>
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="text-[8px] font-black text-white bg-black/50 px-1.5 py-0.5 rounded">Ver QR</span>
                    </div>
                  </button>
                  <div className="space-y-1">
                    {[['Banco', CUENTA.banco], ['Número', CUENTA.numero], ['Titular', CUENTA.titular]].map(([l, v]) => (
                      <div key={l} className="flex gap-2">
                        <span className="text-[9px] font-black text-blue-400 uppercase w-12 shrink-0">{l}</span>
                        <span className="text-[10px] font-black text-blue-900">{v}</span>
                      </div>
                    ))}
                    <p className="text-[9px] text-blue-300 font-bold pt-1">Toca el QR para ampliar</p>
                  </div>
                </div>
                <div className="relative group">
                  <input type="file" accept="image/*,application/pdf" onChange={e => setComprobante(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="border-2 border-dashed border-green-200 bg-white group-hover:bg-green-50 transition-all rounded-xl p-3 text-center">
                    {comprobante ? (
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle2 size={14} className="text-green-500" />
                        <p className="text-xs font-black text-green-700 truncate max-w-[160px]">{comprobante.name}</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <UploadCloud size={15} className="text-green-300" />
                        <p className="text-xs font-bold text-gray-400">Subir comprobante de pago</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Crédito (solo si hay) */}
          {credito > 0 && (
            <div onClick={() => setUsarCredito(!usarCredito)}
              className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${usarCredito ? 'border-green-500 bg-green-50' : 'border-gray-100 bg-white hover:border-green-200'}`}>
              <div className={`p-2 rounded-xl ${usarCredito ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700'}`}>
                <Gift size={14} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black text-gray-700">Usar crédito disponible</p>
                <p className="text-[10px] font-bold text-green-700">{COP(credito)} disponibles</p>
              </div>
              {usarCredito && <span className="text-xs font-black text-green-700">−{COP(creditoAplicar)}</span>}
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${usarCredito ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                {usarCredito && <CheckCircle2 size={10} className="text-white" />}
              </div>
            </div>
          )}

          {/* Observaciones */}
          <div className="bg-white rounded-2xl border border-gray-100 px-3 py-3">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Observaciones del pedido</p>
            <textarea
              rows={2}
              placeholder="Ej: Sin picante, toque el timbre, entregar después de las 5pm..."
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 font-medium placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 bg-white border-t border-gray-100 px-4 py-3">
          <div className="space-y-1 mb-3">
            <div className="flex justify-between text-xs text-gray-500 font-bold">
              <span>Subtotal</span><span>{COP(orderDetails.total)}</span>
            </div>
            {tieneDomicilio && (
              <div className="flex justify-between text-xs font-bold text-purple-700">
                <span>Domicilio</span><span>+{COP(COSTO_DOMICILIO)}</span>
              </div>
            )}
            {usarCredito && creditoAplicar > 0 && (
              <div className="flex justify-between text-xs font-bold text-green-700">
                <span>Crédito</span><span>−{COP(creditoAplicar)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total a pagar</p>
                <p className="text-2xl font-black text-gray-900 tracking-tighter leading-none">{COP(totalFinal)}</p>
              </div>
              <button
                onClick={handleFinalConfirm}
                disabled={isConfirming}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95 ${isConfirming ? 'bg-green-800 text-white' : 'text-white hover:shadow-xl hover:-translate-y-0.5'}`}
                style={!isConfirming ? { background: 'linear-gradient(135deg, var(--green-800) 0%, var(--green-700) 100%)' } : {}}
              >
                {isConfirming
                  ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando</>
                  : <>Confirmar <ChevronRight size={14} /></>}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
      `}</style>

      {/* QR ampliado */}
      {qrOpen && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 flex flex-col items-center gap-4 shadow-2xl max-w-xs w-full"
            onClick={e => e.stopPropagation()}
          >
            <p className="font-black text-gray-800 text-base">QR de Pago</p>
            <div className="relative w-56 h-56 border border-gray-100 rounded-2xl overflow-hidden flex items-center justify-center bg-gray-50">
              <img src="/qr-pago.png" alt="QR de pago ampliado" className="w-full h-full object-contain relative z-10"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <span style={{ fontSize: 40 }}>📱</span>
                <span className="text-xs font-black text-gray-400">QR no disponible</span>
                <span className="text-[10px] text-gray-300">Agrega /public/qr-pago.png</span>
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-black text-gray-700">{CUENTA.banco}</p>
              <p className="text-lg font-black text-green-700">{CUENTA.numero}</p>
              <p className="text-xs text-gray-400">{CUENTA.titular}</p>
            </div>
            <button
              onClick={() => setQrOpen(false)}
              className="px-8 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-black text-gray-600 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutModal;
