import { useState, useEffect } from 'react';
import { deliveryService } from './services/deliveryService';
import { descargarFacturaEntrega } from '../../../utils/facturaGenerator.js';
import DeliveryStatus   from './components/DeliveryStatus';
import DeliveryDetails  from './components/DeliveryDetails';
import DeliveryTimeline from './components/DeliveryTimeline';
import { MapPin, Leaf, Clock, Bike } from 'lucide-react';
import '../../../styles/Client.css';

const DeliveryPage = () => {
  const [order,   setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const orders       = deliveryService.getOrders();
    const currentOrder = orders.find(o => o.id === 'PED-001') || orders[0];
    setOrder(currentOrder);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!order || order.status === 'Entregado') return;

    const timer = setInterval(() => {
      setOrder(prev => {
        if (!prev) return null;
        const map = {
          'Pendiente':   { next: 'En tránsito', desc: 'El repartidor ha recogido su pedido y va en camino.' },
          'En tránsito': { next: 'Entregado',   desc: '¡Buen provecho! Su pedido ha sido entregado.' },
        };
        const transition = map[prev.status];
        if (!transition) return prev;
        return deliveryService.updateOrderStatus(prev.id, transition.next, transition.desc);
      });
    }, 15000);

    return () => clearInterval(timer);
  }, [order]);

  const handleDownloadReceipt = () => {
    if (!order) return;
    descargarFacturaEntrega(order);
  };

  if (loading) return (
    <div className="toston-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', color: 'var(--gray-500)', fontFamily: 'var(--font-body)' }}>
        <Bike size={40} strokeWidth={1} style={{ marginBottom: 12 }} />
        <p style={{ fontWeight: 600, margin: 0 }}>Cargando seguimiento...</p>
      </div>
    </div>
  );

  if (!order) return (
    <div className="toston-page">
      <div className="page-content" style={{ paddingTop: 40 }}>
        <div className="empty-state">
          <div className="empty-state__icon"><MapPin size={28} /></div>
          <h3 className="empty-state__title">Pedido no encontrado</h3>
          <p className="empty-state__text">No pudimos localizar ningún pedido activo.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="toston-page">

      {/* ── Hero ── */}
      <header className="page-hero">
        <div className="page-hero__inner">
          <div>
            <span className="page-hero__label">
              <Leaf size={11} /> Tostón App
            </span>
            <h1 className="page-hero__title">
              Seguimiento de <em>Pedido</em>
            </h1>
            <p className="page-hero__sub">
              Consulta el estado de tu domicilio en tiempo real.
            </p>
          </div>

          <div className="page-hero__badge">
            <span className="page-hero__badge-icon">
              <MapPin size={18} color="white" />
            </span>
            Pedido #{order.id}
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="page-content">

        {/* Banner simulación */}
        <div style={{
          background: 'linear-gradient(90deg, #fef3c7, #fffbeb)',
          border: '1.5px solid #fde68a',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 20px',
          marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, fontWeight: 600, color: '#92400e',
          fontFamily: 'var(--font-body)',
        }}>
          <Clock size={15} />
          <span><strong>Modo Simulación:</strong> El estado se actualizará automáticamente cada 15 segundos.</span>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 24,
          alignItems: 'start',
        }}>
          {/* Columna izquierda */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card" style={{ padding: 28 }}>
              <p className="section-title">Estado del pedido</p>
              <DeliveryStatus status={order.status} />
            </div>

            <div className="card" style={{ padding: 28 }}>
              <p className="section-title">Detalles del pedido</p>
              <DeliveryDetails order={order} onDownload={handleDownloadReceipt} />
            </div>
          </div>

          {/* Columna derecha */}
          <div className="card" style={{ padding: 28 }}>
            <p className="section-title">Historial de estados</p>
            <DeliveryTimeline history={order.history} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default DeliveryPage;