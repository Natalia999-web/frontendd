import { Package, Truck, CheckCircle2, Clock } from 'lucide-react';

const STATUS_CONFIG = {
  'Pendiente': {
    icon: Package,
    color: '#92400e',
    bg: '#fef3c7',
    border: '#fde68a',
    bar: '#f59e0b',
    label: 'Pendiente',
    desc: 'Tu pedido está siendo preparado con cariño.',
    step: 1,
  },
  'En tránsito': {
    icon: Truck,
    color: '#1e40af',
    bg: '#dbeafe',
    border: '#bfdbfe',
    bar: '#3b82f6',
    label: 'En camino',
    desc: 'El repartidor ya recogió tu pedido y va en camino.',
    step: 2,
  },
  'Entregado': {
    icon: CheckCircle2,
    color: '#166534',
    bg: '#dcfce7',
    border: '#bbf7d0',
    bar: '#22c55e',
    label: 'Entregado',
    desc: '¡Tu pedido llegó! Buen provecho.',
    step: 3,
  },
};

const STEPS = [
  { key: 'Pendiente',   icon: Package,      label: 'Preparando' },
  { key: 'En tránsito', icon: Truck,        label: 'En camino'  },
  { key: 'Entregado',   icon: CheckCircle2, label: 'Entregado'  },
];

const DeliveryStatus = ({ status }) => {
  const cfg  = STATUS_CONFIG[status] || STATUS_CONFIG['Pendiente'];
  const Icon = cfg.icon;
  const currentStep = cfg.step;

  return (
    <div>
      {/* Estado actual — card destacada */}
      <div style={{
        background: cfg.bg,
        border: `1.5px solid ${cfg.border}`,
        borderRadius: 16,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 28,
      }}>
        <div style={{
          width: 52, height: 52,
          borderRadius: 14,
          background: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,.08)',
          flexShrink: 0,
        }}>
          <Icon size={26} color={cfg.color} strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{
            margin: 0,
            fontSize: 11, fontWeight: 700,
            letterSpacing: '.06em', textTransform: 'uppercase',
            color: cfg.color, opacity: .7,
            fontFamily: 'var(--font-body)',
          }}>Estado actual</p>
          <p style={{
            margin: '2px 0 4px',
            fontSize: 18, fontWeight: 800,
            color: cfg.color,
            fontFamily: 'var(--font-display)',
          }}>{cfg.label}</p>
          <p style={{
            margin: 0, fontSize: 13,
            color: cfg.color, opacity: .8,
            fontFamily: 'var(--font-body)',
          }}>{cfg.desc}</p>
        </div>
      </div>

      {/* Stepper visual */}
      <div style={{ position: 'relative', padding: '0 8px' }}>
        {/* Línea de progreso */}
        <div style={{
          position: 'absolute',
          top: 20, left: 36, right: 36,
          height: 3,
          background: 'var(--gray-100)',
          borderRadius: 99,
          zIndex: 0,
        }} />
        <div style={{
          position: 'absolute',
          top: 20, left: 36,
          height: 3,
          width: `${((currentStep - 1) / 2) * (100 - (36 / 2))}%`,
          background: cfg.bar,
          borderRadius: 99,
          zIndex: 1,
          transition: 'width .5s ease',
        }} />

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          position: 'relative', zIndex: 2,
        }}>
          {STEPS.map((step, i) => {
            const StepIcon = step.icon;
            const done    = i + 1 <= currentStep;
            const active  = i + 1 === currentStep;

            return (
              <div key={step.key} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 8,
                flex: 1,
              }}>
                <div style={{
                  width: 40, height: 40,
                  borderRadius: '50%',
                  background: done ? cfg.bar : 'var(--gray-100)',
                  border: active ? `3px solid ${cfg.bar}` : '3px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: active ? `0 0 0 4px ${cfg.bg}` : 'none',
                  transition: 'all .3s ease',
                }}>
                  <StepIcon
                    size={18}
                    color={done ? 'white' : 'var(--gray-300)'}
                    strokeWidth={2.5}
                  />
                </div>
                <span style={{
                  fontSize: 11, fontWeight: active ? 700 : 500,
                  color: active ? cfg.color : 'var(--gray-500)',
                  fontFamily: 'var(--font-body)',
                  textAlign: 'center',
                }}>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DeliveryStatus;