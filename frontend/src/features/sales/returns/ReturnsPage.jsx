import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { fmtFecha } from '../../../utils/dateUtils.js';
import { getCurrentUser } from '../../client/profile/services/profileService.js';
import ReturnForm        from './components/ReturnForm';
import ReturnList        from './components/ReturnList';
import ReturnDetailModal from './components/ReturnDetailModal';
import { getMisVentas }       from '../../../services/pedidosService';
import { getMisDevoluciones } from '../../../services/devolucionesService';
import {
  RefreshCw, Leaf, Package, Check, X, History,
  PackageMinus, AlertCircle, ChevronRight, ArrowRight,
} from 'lucide-react';
import '../../../styles/Client.css';

const COP = (n) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(n);

const ReturnsPage = () => {
  const [pedidos,                setPedidos]                = useState([]);
  const [returns,                setReturns]                = useState([]);
  const [selectedReturn,         setSelectedReturn]         = useState(null);
  const [showModal,              setShowModal]              = useState(false);
  const [toast,                  setToast]                  = useState(null);
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState(null);
  const [loadingOrders,          setLoadingOrders]          = useState(true);

  const location     = useLocation();
  const defaultValues = location.state || {};

  const loadReturns = () =>
    getMisDevoluciones({ porPagina: 100 })
      .then(data => setReturns(data.devoluciones || []))
      .catch(() => {});

  useEffect(() => {
    loadReturns();
    setLoadingOrders(true);
    getMisVentas({ porPagina: 100 })
      .then(data => setPedidos(data.pedidos || []))
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
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

  // Calcula cuánto puede devolver aún el cliente por producto,
  // descontando devoluciones anteriores no rechazadas.
  const calcRestantes = (order) => {
    const devsDelPedido = returns.filter(
      d => String(d.idVenta) === String(order.id) && d.estado !== 'Rechazada'
    );
    return (order.productosItems || [])
      .map(p => {
        const yaDevuelto = devsDelPedido.reduce((sum, dev) => {
          const found = (dev.productos || []).find(
            dp => String(dp.idProducto) === String(p.idProducto)
          );
          return sum + (found ? found.cantidad : 0);
        }, 0);
        return { ...p, cantidad: Math.max(0, p.cantidad - yaDevuelto) };
      })
      .filter(p => p.cantidad > 0);
  };

  const deliveredOrders = pedidos.filter(p =>
    p.estado === 'Entregado' && calcRestantes(p).length > 0
  );

  /* ── estilos inline compartidos ── */
  const card = {
    background: 'white',
    borderRadius: 20,
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    overflow: 'hidden',
  };

  const cardHeader = {
    padding: '18px 22px 14px',
    borderBottom: '1px solid #f3f4f6',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  };

  const iconBox = (bg, color) => ({
    width: 36, height: 36, background: bg, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    color,
  });

  return (
    <div className="toston-page min-h-screen pb-24">

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 10000,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 20px', borderRadius: 14,
          background: toast.type === 'success' ? '#065f46' : '#991b1b',
          color: 'white', boxShadow: '0 8px 32px rgba(0,0,0,.25)',
          fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-body)',
        }}>
          {toast.type === 'success' ? <Check size={15}/> : <X size={15}/>}
          {toast.message}
        </div>
      )}

      {/* ── Hero ── */}
      <header className="page-hero">
        <div className="page-hero__inner">
          <div className="relative z-10">
            <span className="page-hero__label inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-white/10 mb-4">
              <Leaf size={12} className="text-white" /> Tostón App
            </span>
            <h1 className="page-hero__title text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
              Devoluciones
            </h1>
            <p className="page-hero__sub text-white/70 max-w-lg font-medium">
              Reporta cualquier problema con tus productos entregados.
            </p>
          </div>
          <div className="page-hero__badge bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shadow-lg">
              <RefreshCw size={22} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/60 leading-none mb-1">Mis solicitudes</p>
              <p className="text-2xl font-black text-white leading-none">{returns.length}</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Contenido principal ── */}
      <main style={{ maxWidth: 1060, margin: '0 auto', padding: '28px 16px' }}>

        {/* Grid 2 columnas: lista pedidos | formulario */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: 20,
          alignItems: 'start',
        }}>

          {/* ── Col izq: Pedidos entregados ── */}
          <div style={card}>
            <div style={cardHeader}>
              <div style={iconBox('#ecfdf5', '#065f46')}>
                <Package size={17} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111827' }}>
                  Pedidos entregados
                </h3>
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>
                  {loadingOrders ? 'Cargando…' : `${deliveredOrders.length} disponibles`}
                </p>
              </div>
            </div>

            {loadingOrders ? (
              <div style={{ padding: '32px 22px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                Cargando pedidos…
              </div>
            ) : deliveredOrders.length === 0 ? (
              <div style={{ padding: '40px 22px', textAlign: 'center' }}>
                <Package size={34} color="#e5e7eb" style={{ margin: '0 auto 10px', display: 'block' }} />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#9ca3af' }}>
                  Sin pedidos entregados
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#d1d5db', fontWeight: 500 }}>
                  Solo puedes devolver pedidos ya recibidos.
                </p>
              </div>
            ) : (
              <div style={{ maxHeight: 390, overflowY: 'auto' }}>
                {deliveredOrders.map((order, idx) => {
                  const isSelected = selectedOrderForReturn?.id === order.id;
                  return (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrderForReturn(isSelected ? null : order)}
                      style={{
                        width: '100%', textAlign: 'left', cursor: 'pointer',
                        padding: '13px 22px',
                        background: isSelected ? '#f0fdf4' : 'transparent',
                        border: 'none',
                        borderBottom: idx < deliveredOrders.length - 1 ? '1px solid #f9fafb' : 'none',
                        borderLeft: `3px solid ${isSelected ? '#10b981' : 'transparent'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        transition: 'background .12s, border-left-color .12s',
                        fontFamily: 'var(--font-body)',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: isSelected ? '#065f46' : '#111827' }}>
                          Pedido #{order.numero}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
                          {fmtFecha(order.fecha_pedido)}
                          {order.productosItems?.length ? ` · ${order.productosItems.length} ítem${order.productosItems.length !== 1 ? 's' : ''}` : ''}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: isSelected ? '#065f46' : '#374151' }}>
                          {COP(order.total)}
                        </span>
                        <div style={{
                          width: 26, height: 26, borderRadius: 7,
                          background: isSelected ? '#10b981' : '#f3f4f6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'background .12s',
                        }}>
                          {isSelected
                            ? <Check size={13} color="white" strokeWidth={3}/>
                            : <ChevronRight size={13} color="#9ca3af" strokeWidth={2.5}/>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Col der: Formulario o placeholder ── */}
          <div>
            {selectedOrderForReturn ? (
              <div style={{
                ...card,
                border: '2px solid #a7f3d0',
                boxShadow: '0 4px 20px rgba(16,185,129,.12)',
              }}>
                <div style={{
                  ...cardHeader,
                  borderBottom: '1px solid #d1fae5',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={iconBox('#065f46', 'white')}>
                      <PackageMinus size={17} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111827' }}>
                        Solicitar devolución
                      </h3>
                      <p style={{ margin: 0, fontSize: 11, color: '#10b981', fontWeight: 700 }}>
                        Pedido #{selectedOrderForReturn.numero}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedOrderForReturn(null)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#9ca3af', padding: 4, display: 'flex', borderRadius: 6,
                      transition: 'color .12s',
                    }}
                    title="Cancelar selección"
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                  >
                    <X size={17} />
                  </button>
                </div>
                <div style={{ padding: '20px 22px 24px' }}>
                  <ReturnForm
                    onSuccess={handleSuccess}
                    defaultIdVenta={selectedOrderForReturn.id}
                    orderProducts={calcRestantes(selectedOrderForReturn)}
                  />
                </div>
              </div>
            ) : (
              <div style={{
                ...card,
                border: '2px dashed #e5e7eb',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '52px 32px', textAlign: 'center', minHeight: 280,
                boxShadow: 'none',
              }}>
                <div style={{
                  width: 52, height: 52, background: '#f3f4f6', borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <ArrowRight size={22} color="#d1d5db" />
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#374151', fontFamily: 'var(--font-body)' }}>
                  Selecciona un pedido
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9ca3af', fontWeight: 500, lineHeight: 1.5, fontFamily: 'var(--font-body)' }}>
                  Elige un pedido entregado de la lista<br/>para registrar tu solicitud.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Historial ── */}
        {returns.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={iconBox('#f3f4f6', '#6b7280')}>
                <History size={17} />
              </div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111827', fontFamily: 'var(--font-body)' }}>
                Mi historial
              </h3>
              <span style={{
                background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0',
                padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                fontFamily: 'var(--font-body)',
              }}>
                {returns.length}
              </span>
            </div>
            <ReturnList returns={returns} onViewDetails={handleViewDetails} />
          </div>
        )}

        {/* ── Info card ── */}
        <div style={{
          marginTop: 28,
          background: 'linear-gradient(135deg, #111827, #1f2937)',
          borderRadius: 18, padding: '18px 22px',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <AlertCircle size={17} color="#34d399" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.65, fontFamily: 'var(--font-body)' }}>
            Nuestro equipo revisará tu solicitud en un plazo máximo de{' '}
            <span style={{ color: '#34d399', fontWeight: 700 }}>24 a 48 horas hábiles</span>.
            Recibirás una notificación en la app cuando se tome una decisión.
          </p>
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
