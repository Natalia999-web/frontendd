import { X, Package, Hash, FileText, Image, MessageSquare, Clock, CheckCircle2, XCircle, CalendarDays } from 'lucide-react';

const STATUS_CONFIG = {
  'Pendiente': { icon: Clock,        color: '#92400e', bg: '#fef3c7', border: '#fde68a',  label: 'Pendiente'  },
  'Aprobada':  { icon: CheckCircle2, color: '#166534', bg: '#dcfce7', border: '#bbf7d0',  label: 'Aprobada'   },
  'Rechazada': { icon: XCircle,      color: '#991b1b', bg: '#fee2e2', border: '#fca5a5',  label: 'Rechazada'  },
};

const InfoRow = ({ icon: Icon, label, value, muted }) => {
  if (!value) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 0',
      borderBottom: '1px solid var(--green-100)',
    }}>
      <div style={{
        width: 32, height: 32, flexShrink: 0,
        background: 'var(--green-50)',
        border: '1px solid var(--green-100)',
        borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={14} color="var(--green-700)" />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{
          margin: 0, fontSize: 11, fontWeight: 700,
          color: 'var(--gray-500)', textTransform: 'uppercase',
          letterSpacing: '.05em', fontFamily: 'var(--font-body)',
        }}>{label}</p>
        <p style={{
          margin: '3px 0 0', fontSize: 14, fontWeight: muted ? 500 : 600,
          color: muted ? 'var(--gray-500)' : 'var(--gray-900)',
          fontFamily: 'var(--font-body)', lineHeight: 1.5,
          fontStyle: muted ? 'italic' : 'normal',
        }}>{value}</p>
      </div>
    </div>
  );
};

const ReturnDetailModal = ({ show, onClose, request }) => {
  if (!show || !request) return null;

  const cfg  = STATUS_CONFIG[request.estado] || STATUS_CONFIG['Pendiente'];
  const Icon = cfg.icon;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10,30,15,.55)',
          backdropFilter: 'blur(6px)',
          zIndex: 1000,
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(520px, 92vw)',
        maxHeight: '88vh',
        overflowY: 'auto',
        background: 'var(--white)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)',
        zIndex: 1001,
        fontFamily: 'var(--font-body)',
      }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, var(--green-900), var(--green-700))',
          padding: '24px 28px',
          borderRadius: '20px 20px 0 0',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12,
        }}>
          <div>
            <p style={{
              margin: '0 0 6px', fontSize: 11, fontWeight: 700,
              color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '.08em',
            }}>Detalle de solicitud</p>
            <h2 style={{
              margin: 0, fontFamily: 'var(--font-display)',
              fontSize: '1.4rem', fontWeight: 800, color: 'white',
            }}>{request.productos?.[0]?.nombre || request.numero}</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,.15)', border: 'none',
              color: 'white', borderRadius: 10, padding: '8px',
              cursor: 'pointer', display: 'flex', flexShrink: 0,
              transition: 'background .18s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.15)'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Status banner */}
        <div style={{
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          margin: '20px 28px 0',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Icon size={18} color={cfg.color} />
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Estado actual
            </p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: cfg.color }}>
              {cfg.label}
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '8px 28px 24px' }}>
          <InfoRow icon={Hash}          label="N° de Venta"          value={request.numeroPedido || (request.idVenta ? `#${request.idVenta}` : null)} />
          <InfoRow icon={Package}       label="Producto"             value={request.productos?.[0]?.nombre || '—'} />
          <InfoRow icon={CalendarDays}  label="Fecha de solicitud"   value={request.fechaSolicitud} />
          <InfoRow icon={FileText}      label="Motivo"               value={request.motivo} />
          <InfoRow icon={Image}         label="Evidencia"            value={request.evidencia?.nombre || null} muted />
          <InfoRow icon={MessageSquare} label="Comentario adicional" value={request.comentario || null} muted />
        </div>

        {/* Footer */}
        <div style={{
          padding: '0 28px 28px',
          display: 'flex', gap: 10,
        }}>
          <button
            className="btn-primary"
            onClick={onClose}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </>
  );
};

export default ReturnDetailModal;