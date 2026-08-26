import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { fmtFecha } from '../../../utils/dateUtils.js';
import { getCurrentUser } from '../../client/profile/services/profileService.js';
import ReturnForm        from './components/ReturnForm';
import ReturnList        from './components/ReturnList';
import ReturnDetailModal from './components/ReturnDetailModal';
import { getMisVentas }    from '../../../services/pedidosService';
import { getMisDevoluciones } from '../../../services/devolucionesService';
import {
  RefreshCw, Leaf, PackageSearch, Package, Calendar,
  MapPin, DollarSign, ChevronRight, ArrowRight, History,
  PackageMinus, AlertCircle, ShoppingBag, Clock, Check, X
} from 'lucide-react';
import '../../../styles/Client.css';

const COP = (n) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(n);

const ReturnsPage = () => {
  const [pedidos,  setPedidos]  = useState([]);
  const [user,     setUser]     = useState(null);
  const [returns,  setReturns]  = useState([]);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [toast,    setToast]    = useState(null);
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState(null);

  const location = useLocation();
  const defaultValues = location.state || {};

  const loadReturns = () => {
    getMisDevoluciones({ porPagina: 100 }).then(data => setReturns(data.devoluciones || [])).catch(() => {});
  };

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    loadReturns();
    getMisVentas({ porPagina: 100 }).then(data => {
      setPedidos(data.pedidos || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (defaultValues.orderNumber && pedidos.length > 0) {
      const order = pedidos.find(p => p.numero === defaultValues.orderNumber);
      if (order) setSelectedOrderForReturn(order);
    }
  }, [defaultValues.orderNumber, pedidos]);

  const handleSuccess = () => {
    loadReturns();
    setSelectedOrderForReturn(null);
    setToast({ message: 'Solicitud registrada con éxito', type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const handleViewDetails = (request) => {
    setSelectedReturn(request);
    setShowModal(true);
  };

  // pedidos ya viene filtrado por usuario; solo filtramos por estado
  const deliveredOrders = pedidos.filter(p => p.estado === 'Entregado');

  return (
    <div className="toston-page min-h-screen bg-gray-50/30 pb-20">

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-8 right-8 z-[10000] animate-in slide-in-from-right duration-500">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
            }`}>
              {toast.type === 'success' ? <Check size={16} /> : <X size={16} />}
            </div>
            <p className="font-black text-xs uppercase tracking-widest">{toast.message}</p>
          </div>
        </div>
      )}

      {/* ── Hero Refinado ── */}
      <header className="page-hero">
        <div className="page-hero__inner">
          <div className="relative z-10">
            <span className="page-hero__label inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-white/10 mb-4">
              <Leaf size={12} className="text-white" /> Tostón App
            </span>
            <h1 className="page-hero__title text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
              Gestión de <em className="not-italic text-white opacity-90">Devoluciones</em>
            </h1>
            <p className="page-hero__sub text-white/70 max-w-lg font-medium">
              Reporta cualquier problema con tus productos entregados.
            </p>
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-white rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <div className="page-hero__badge relative bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shadow-lg">
                <RefreshCw size={24} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60 leading-none mb-1">Mis solicitudes</p>
                <p className="text-2xl font-black text-white leading-none">{returns.length}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="page-content max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

          {/* Columna Izquierda: Listado de pedidos entregados y Formulario */}
          <div className="xl:col-span-8 space-y-8">
            
            {/* Sección: Elegir pedido para devolución */}
            <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                  <Package size={20} />
                </div>
                <h3 className="text-xl font-black text-gray-800 tracking-tight">Seleccionar Pedido Entregado</h3>
              </div>

              {deliveredOrders.length === 0 ? (
                <div className="bg-gray-50 rounded-3xl p-10 text-center border-2 border-dashed border-gray-200">
                  <Package size={40} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">No tienes pedidos entregados aún</p>
                  <p className="text-gray-400 text-xs mt-1">Solo puedes solicitar devoluciones sobre pedidos ya recibidos.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {deliveredOrders.map(order => (
                    <div 
                      key={order.id}
                      onClick={() => setSelectedOrderForReturn(order)}
                      className={`group p-5 rounded-3xl border-2 transition-all cursor-pointer ${
                        selectedOrderForReturn?.id === order.id 
                          ? 'border-green-600 bg-green-50 shadow-lg' 
                          : 'border-gray-100 hover:border-green-200 hover:bg-green-50/30'
                      }`}
                      style={selectedOrderForReturn?.id === order.id ? { borderColor: 'var(--green-600)', background: 'var(--green-50)' } : {}}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pedido #{order.numero}</p>
                          <p className="text-[11px] font-bold text-gray-500">{fmtFecha(order.fecha_pedido)}</p>
                        </div>
                        <div className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-green-200">
                          Entregado
                        </div>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-lg font-black text-gray-900 leading-none">{COP(order.total)}</p>
                          <p className="text-[10px] font-bold text-gray-400 mt-1">{order.productosItems.length} items</p>
                        </div>
                        <button className={`p-2 rounded-xl transition-all ${
                          selectedOrderForReturn?.id === order.id ? 'bg-green-700 text-white shadow-md' : 'bg-gray-100 text-gray-400'
                        }`}
                        style={selectedOrderForReturn?.id === order.id ? { background: 'var(--green-700)' } : {}}>
                          <ArrowRight size={16} strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Formulario (Solo si hay pedido seleccionado) */}
            {selectedOrderForReturn && (
              <div className="bg-white rounded-[40px] p-8 border border-green-100 shadow-xl shadow-green-200/20 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center text-white shadow-lg">
                      <PackageMinus size={20} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-800 tracking-tight">Formulario de Devolución</h3>
                      <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Pedido #{selectedOrderForReturn.numero}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedOrderForReturn(null)}
                    className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
                
                <ReturnForm
                  onSuccess={handleSuccess}
                  defaultIdVenta={selectedOrderForReturn.id}
                  orderProducts={selectedOrderForReturn.productosItems}
                />
              </div>
            )}
          </div>

          {/* Columna Derecha: Historial de solicitudes */}
          <div className="xl:col-span-4 space-y-6">
            <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-sm flex flex-col max-h-[calc(100vh-200px)]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                    <History size={20} />
                  </div>
                  <h3 className="text-lg font-black text-gray-800 tracking-tight">Mi Historial</h3>
                </div>
                <span className="bg-green-50 text-green-700 px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-green-100">
                  {returns.length}
                </span>
              </div>

              {returns.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-gray-50/50 rounded-[32px] border-2 border-dashed border-gray-100">
                  <PackageSearch size={40} className="text-gray-200 mb-4" />
                  <p className="text-gray-400 font-bold text-xs uppercase tracking-widest leading-relaxed">
                    No tienes solicitudes registradas
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                  <ReturnList returns={returns} onViewDetails={handleViewDetails} />
                </div>
              )}
            </div>
            
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-[32px] p-6 text-white overflow-hidden relative">
               <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
               <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-4">
                    <AlertCircle size={20} className="text-green-400" />
                    <p className="text-xs font-black uppercase tracking-widest">Información importante</p>
                 </div>
                 <p className="text-xs text-gray-400 leading-relaxed font-medium">
                    Nuestro equipo revisará tu solicitud en un plazo máximo de <span className="text-green-400 font-bold">24 a 48 horas hábiles</span>. Recibirás una notificación en la aplicación una vez se tome una decisión.
                 </p>
               </div>
            </div>
          </div>
        </div>
      </main>

      {selectedReturn && (
        <ReturnDetailModal
          show={showModal}
          onClose={() => setShowModal(false)}
          request={selectedReturn}
        />
      )}
    </div>
  );
};

export default ReturnsPage;