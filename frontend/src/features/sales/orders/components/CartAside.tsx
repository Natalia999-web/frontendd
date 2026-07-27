import React, { useState, useEffect, useCallback } from 'react';
import { X, MapPin, Trash2, Plus, Minus, ShoppingBag, LogIn, Sparkles, ChevronRight, ShoppingCart, FileText, Truck } from 'lucide-react';
import { CartItem, removeFromCart, updateQuantity, clearCart, getCart } from '../services/cartService';
import { isAuthenticated } from '../../../../services/authService';
import { apiFetch } from '../../../../utils/api';
import { MUNICIPIOS_VALLE_ABURRA } from '../../../../utils/departamentosYCiudades';

const COSTO_DOMICILIO = 5000;
const HORA_APERTURA  = 8;   // 8:00 am
const HORA_CIERRE    = 20;  // 8:00 pm

interface CartAsideProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: (details: { address: string; date: string; departamento: string; municipio: string; observaciones: string; tieneDomicilio: boolean }) => void;
  onLoginRequired: () => void;
  cartUpdateToggle?: boolean;
}

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

const estaAbierto = () => {
  const h = new Date().getHours();
  return h >= HORA_APERTURA && h < HORA_CIERRE;
};

const mensajeFueraHorario = () => {
  const h = new Date().getHours();
  if (h < HORA_APERTURA) return `Abrimos a las ${HORA_APERTURA}:00 am — tu pedido se procesará en cuanto abramos.`;
  return `Cerramos a las ${HORA_CIERRE - 12}:00 pm — tu pedido se procesará mañana a las ${HORA_APERTURA}:00 am.`;
};

const CartAside: React.FC<CartAsideProps> = ({ isOpen, onClose, onCheckout, onLoginRequired }) => {
  const [cart, setCart]               = useState<CartItem[]>(() => getCart());
  const [address, setAddress]         = useState('');
  const [departamento, setDepartamento] = useState('Antioquia');
  const [municipio, setMunicipio]     = useState('');
  const [tieneDomicilio,    setTieneDomicilio]    = useState(false);
  const [observaciones,     setObservaciones]     = useState('');
  const [sinDireccionMsg,   setSinDireccionMsg]   = useState(false);
  const [confirmVaciar,     setConfirmVaciar]     = useState(false);
  const [showDeliveryInfo,  setShowDeliveryInfo]  = useState(false);
  const [total, setTotal]             = useState(() =>
    getCart().reduce((acc, i) => acc + i.precio * i.cantidad, 0)
  );
  const abierto = estaAbierto();

  const syncCart = useCallback(() => {
    const c = getCart();
    setCart(c);
    setTotal(c.reduce((acc, i) => acc + i.precio * i.cantidad, 0));
  }, []);

  useEffect(() => { syncCart(); }, [isOpen, syncCart]);
  useEffect(() => {
    window.addEventListener('cart-updated', syncCart);
    return () => window.removeEventListener('cart-updated', syncCart);
  }, [syncCart]);

  const handleQty = (id: number, delta: number) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    const newQty = item.cantidad + delta;
    if (newQty <= 0) { removeFromCart(id); return; }
    if (item.stock && !((item as any).pedidoProgramado) && newQty > item.stock) return;
    updateQuantity(id, newQty);
  };

  const handleQtyDirect = (id: number, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1) { removeFromCart(id); return; }
    const item = cart.find(i => i.id === id);
    if (item?.stock && !((item as any).pedidoProgramado) && num > item.stock) {
      updateQuantity(id, item.stock);
      return;
    }
    updateQuantity(id, num);
  };

  const usarDireccionRegistrada = async () => {
    try {
      const perfil = await apiFetch('/auth/perfil');
      const dir  = perfil?.Direccion   || '';
      const depto = perfil?.Departamento || '';
      const mun  = perfil?.Municipio   || '';
      if (!dir && !depto && !mun) {
        setSinDireccionMsg(true);
        setTimeout(() => setSinDireccionMsg(false), 3500);
        return;
      }
      if (dir)  setAddress(dir);
      if (depto) setDepartamento(depto);
      if (mun)  setMunicipio(mun);
      setSinDireccionMsg(false);
    } catch {
      setSinDireccionMsg(true);
      setTimeout(() => setSinDireccionMsg(false), 3500);
    }
  };

  const costoTotal = tieneDomicilio ? total + COSTO_DOMICILIO : total;

  const handleCheckout = () => {
    if (cart.length === 0) return alert('El carrito está vacío');
    if (tieneDomicilio) {
      if (!address)   return alert('Ingresa una dirección de entrega');
      if (!municipio) return alert('Selecciona un municipio');
    }
    if (!isAuthenticated()) { onClose(); onLoginRequired(); return; }
    onCheckout({ address, departamento, municipio, date: '', observaciones, tieneDomicilio });
  };

  if (!isOpen) return null;
  const loggedIn = isAuthenticated();

  return (
    <div className="fixed inset-0 z-[9000] overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-all duration-500 animate-in fade-in" onClick={onClose} />

      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 ease-out border-l border-emerald-100">

        {/* Header */}
        <div className="text-white px-5 py-4 relative overflow-hidden shrink-0" style={{ background: 'linear-gradient(135deg, var(--green-900) 0%, var(--green-800) 50%, var(--green-700) 100%)' }}>
          <div className="absolute top-[-20px] right-[-20px] w-48 h-48 bg-white/5 rounded-full blur-3xl animate-pulse" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-xl p-2.5 rounded-xl border border-white/20 shadow-inner">
                <ShoppingBag size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight leading-none mb-1">Tu Carrito</h2>
                <p className="text-[10px] text-emerald-200 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  {cart.length} {cart.length === 1 ? 'producto' : 'productos'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all text-white/80 hover:text-white border border-white/10">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Aviso horario */}
        {!abierto && (
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 shrink-0 flex items-start gap-2.5">
            <span className="text-lg leading-none mt-0.5">⏰</span>
            <div>
              <p className="text-xs font-black text-amber-700">Fuera del horario de atención</p>
              <p className="text-[11px] font-medium text-amber-600 mt-0.5 leading-snug">{mensajeFueraHorario()}</p>
              <p className="text-[10px] text-amber-500 mt-1">Horario: lunes a sábado · 8:00 am – 8:00 pm</p>
            </div>
          </div>
        )}

        {/* Toggle Recogida / Domicilio */}
        <div className="px-5 py-4 bg-white border-b border-gray-100 shrink-0">
          <div className="grid grid-cols-2 bg-gray-100 rounded-2xl p-1.5 gap-1.5">
            <button
              onClick={() => { setTieneDomicilio(false); setShowDeliveryInfo(false); }}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-200 ${!tieneDomicilio ? 'bg-white text-green-800 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <ShoppingBag size={16} />
              Recogida
            </button>
            <button
              onClick={() => { setTieneDomicilio(true); setShowDeliveryInfo(true); }}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-200 ${tieneDomicilio ? 'bg-white text-green-800 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Truck size={16} />
              Domicilio
            </button>
          </div>

          {/* Formulario de entrega (solo si domicilio) */}
          {tieneDomicilio && (
            <div className="mt-3 space-y-2">
              {loggedIn && (
                <div>
                  <button
                    onClick={usarDireccionRegistrada}
                    className="w-full py-2 px-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl text-xs font-black text-green-800 uppercase tracking-widest transition-all text-center"
                  >
                    📍 Usar mi dirección registrada
                  </button>
                  {sinDireccionMsg && (
                    <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
                      <span style={{ fontSize: 13 }}>⚠️</span>
                      <p className="text-xs font-bold text-amber-700 leading-tight">
                        No tienes dirección registrada. Ve a tu <strong>Perfil</strong> para agregarla.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="relative">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Dirección (Ej: Calle 10 #20-30)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 text-sm placeholder:text-gray-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all font-medium text-gray-700"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <select
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all font-medium text-gray-700"
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
              >
                <option value="">— Municipio (Valle de Aburrá) —</option>
                {MUNICIPIOS_VALLE_ABURRA.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              {!loggedIn && (
                <div className="flex items-center gap-2 py-2 px-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <LogIn size={13} className="text-amber-500 shrink-0" />
                  <p className="text-xs font-bold text-amber-700">Inicia sesión para continuar con el pedido</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/20 custom-scrollbar relative">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-emerald-50">
                <ShoppingCart size={24} className="text-emerald-200" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-800 mb-1">Carrito vacío</h3>
                <p className="text-gray-400 text-[10px] max-w-[180px] leading-relaxed font-medium">Explora nuestro menú y elige algo delicioso.</p>
              </div>
              <button onClick={onClose} className="btn-primary" style={{ padding: '8px 20px', fontSize: '11px' }}>Ver Productos</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Resumen del pedido</span>
                {confirmVaciar ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-gray-500">¿Vaciar todo?</span>
                    <button
                      onClick={() => { clearCart(); setConfirmVaciar(false); }}
                      className="text-[9px] font-black text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-md transition-colors"
                    >Sí</button>
                    <button
                      onClick={() => setConfirmVaciar(false)}
                      className="text-[9px] font-black text-gray-500 hover:text-gray-700 px-2 py-0.5 rounded-md border border-gray-200 transition-colors"
                    >No</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmVaciar(true)}
                    className="flex items-center gap-1 text-[9px] font-black text-red-400 hover:text-red-600 transition-colors uppercase tracking-widest"
                  >
                    <Trash2 size={10} /> Vaciar
                  </button>
                )}
              </div>

              <div className="grid gap-2.5">
                {cart.map((item) => (
                  <div key={item.id} className="group bg-white rounded-2xl p-2.5 border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-100 transition-all duration-300 relative overflow-hidden">
                    <div className="flex gap-2.5 relative z-10">
                      <div className="w-14 h-14 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100">
                        {(item as any).imagenPreview || (item as any).imagen ? (
                          <img src={(item as any).imagenPreview || (item as any).imagen} alt={item.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-50 text-xl">📦</div>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                        <div>
                          <h4 className="font-black text-gray-800 text-[11px] mb-0.5 truncate">{item.nombre}</h4>
                          <p className="font-black text-[10px]" style={{ color: 'var(--green-700)' }}>{COP(item.precio)}</p>
                          {(item as any).pedidoProgramado && (
                            <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">⏳ Pedido programado</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-100">
                            <button onClick={() => handleQty(item.id, -1)} className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white hover:text-red-500 transition-all text-gray-400">
                              <Minus size={9} strokeWidth={3} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.cantidad}
                              onChange={e => handleQtyDirect(item.id, e.target.value)}
                              className="w-8 text-center text-[10px] font-black text-gray-800 bg-transparent border-none outline-none"
                              style={{ appearance: 'textfield', MozAppearance: 'textfield', WebkitAppearance: 'none' } as React.CSSProperties}
                            />
                            <button onClick={() => handleQty(item.id, 1)} className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white hover:text-emerald-600 transition-all text-gray-400">
                              <Plus size={9} strokeWidth={3} />
                            </button>
                          </div>
                          <p className="text-[11px] font-black text-gray-900">{COP(item.precio * item.cantidad)}</p>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="absolute top-1.5 right-1.5 p-1 text-gray-200 hover:text-red-500 rounded-full transition-all">
                      <X size={10} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Observaciones */}
              <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText size={12} className="text-gray-400" />
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Observaciones del pedido</span>
                </div>
                <textarea
                  rows={2}
                  placeholder="Ej: Sin picante, sin cebolla, tocar timbre..."
                  className="w-full text-xs font-medium text-gray-700 placeholder:text-gray-300 resize-none outline-none bg-transparent border-none p-0"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] relative z-20 ${tieneDomicilio ? 'px-4 py-3' : 'p-4'}`}>

          {tieneDomicilio ? (
            <div className="flex items-center justify-between mb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-3 text-[11px] text-gray-400 font-medium">
                  <span>Productos <span className="font-black text-gray-700">{COP(total)}</span></span>
                  <span>+</span>
                  <span>Domicilio <span className="font-black" style={{ color: '#7b1fa2' }}>{COP(COSTO_DOMICILIO)}</span></span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total</span>
                  <span className="text-xl font-black text-gray-900 tracking-tighter leading-none">{COP(costoTotal)}</span>
                </div>
              </div>
              <div className="text-amber-400"><Sparkles size={16} /></div>
            </div>
          ) : (
            <div className="space-y-1.5 mb-4">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-gray-500 font-bold">Subtotal productos</span>
                <span className="text-gray-800 font-black">{COP(total)}</span>
              </div>
              <div className="relative py-0.5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-gray-100" /></div>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Total a pagar</span>
                  <span className="text-2xl font-black text-gray-900 tracking-tighter leading-none">{COP(costoTotal)}</span>
                </div>
                <div className="text-amber-500 pb-1"><Sparkles size={18} /></div>
              </div>
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full group relative overflow-hidden flex items-center justify-center gap-3 rounded-xl font-black text-sm transition-all duration-300 shadow-lg active:scale-[0.98] ${tieneDomicilio ? 'py-2.5' : 'py-3.5'} ${
              cart.length === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed border border-gray-200 shadow-none' : 'btn-primary shadow-emerald-200/50 hover:shadow-xl hover:-translate-y-0.5'
            }`}
            style={cart.length > 0 ? { background: 'linear-gradient(135deg, var(--green-700) 0%, var(--green-600) 100%)' } : {}}
          >
            {loggedIn ? (
              <>Finalizar Pedido <ChevronRight size={14} strokeWidth={3} /></>
            ) : (
              <><LogIn size={14} /> Identificarse</>
            )}
          </button>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
};

export default CartAside;
