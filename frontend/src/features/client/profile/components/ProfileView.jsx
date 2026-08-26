import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Phone, MapPin, CreditCard,
  Building2, Map, ShieldCheck, Edit2, LogOut, User
} from 'lucide-react';
import { clearSession } from '../../../../utils/api';
import LogoutModal from '../../../../shared/components/LogoutModal';

const InfoBlock = ({ icon: Icon, label, value, span = 1 }) => (
  <div style={{
    gridColumn: `span ${span}`,
    background: 'var(--gray-100)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 16px',
    display: 'flex', alignItems: 'flex-start', gap: 10,
  }}>
    <div style={{
      width: 32, height: 32, flexShrink: 0,
      background: 'var(--green-50)',
      border: '1px solid var(--green-100)',
      borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginTop: 2,
    }}>
      <Icon size={14} color="var(--green-700)" />
    </div>
    <div style={{ minWidth: 0 }}>
      <p style={{
        margin: 0, fontSize: 11, fontWeight: 700,
        color: 'var(--gray-500)', textTransform: 'uppercase',
        letterSpacing: '.05em', fontFamily: 'var(--font-body)',
      }}>{label}</p>
      <p style={{
        margin: '3px 0 0', fontSize: 14, fontWeight: 600,
        color: value ? 'var(--gray-900)' : 'var(--gray-300)',
        fontFamily: 'var(--font-body)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{value || '—'}</p>
    </div>
  </div>
);

const ProfileView = ({ user, totalPedidos, onEdit }) => {
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);

  const doLogout = () => { clearSession(); navigate('/login'); };

  return (
    <div>
      {showLogout && <LogoutModal onConfirm={doLogout} onCancel={() => setShowLogout(false)} />}
      {/* Avatar + nombre */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20,
        padding: '0 0 24px',
        borderBottom: '1px solid var(--green-100)',
        marginBottom: 24,
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
          background: user.fotoPerfil ? 'transparent' : 'var(--green-50)',
          border: '3px solid var(--green-100)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', fontSize: 36,
        }}>
          {user.fotoPerfil
            ? <img src={user.fotoPerfil} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <User size={36} strokeWidth={1} style={{color:"#bdbdbd"}} />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: '1.3rem', fontWeight: 800,
            color: 'var(--gray-900)',
          }}>{user.nombre} {user.apellidos}</p>
          <p style={{
            margin: '3px 0 8px', fontSize: 13,
            color: 'var(--gray-500)', fontFamily: 'var(--font-body)',
          }}>{user.correo}</p>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: user.estado !== false ? 'var(--green-100)' : '#fee2e2',
            color:      user.estado !== false ? 'var(--green-800)' : '#991b1b',
            border: `1px solid ${user.estado !== false ? 'var(--green-200)' : '#fca5a5'}`,
            fontSize: 11, fontWeight: 700, padding: '3px 10px',
            borderRadius: 99, fontFamily: 'var(--font-body)',
            textTransform: 'uppercase', letterSpacing: '.04em',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: user.estado !== false ? 'var(--green-600)' : '#ef4444',
            }} />
            {user.estado !== false ? 'Activo' : 'Inactivo'}
          </span>
        </div>

        <button className="btn-secondary" onClick={onEdit} style={{ flexShrink: 0 }}>
          <Edit2 size={14} /> Editar
        </button>
      </div>

      {/* Grid de datos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10,
      }}>
        {/* Identidad */}
        <div style={{ gridColumn: 'span 2' }}>
          <p style={{
            margin: '0 0 10px', fontSize: 11, fontWeight: 700,
            color: 'var(--gray-500)', textTransform: 'uppercase',
            letterSpacing: '.06em', fontFamily: 'var(--font-body)',
          }}>Identidad</p>
        </div>

        <InfoBlock icon={CreditCard} label="Tipo Documento"  value={user.tipoDocumento} />
        <InfoBlock icon={CreditCard} label="N° Documento"    value={user.cedula || user.documento} />

        {/* Contacto */}
        <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
          <p style={{
            margin: '0 0 10px', fontSize: 11, fontWeight: 700,
            color: 'var(--gray-500)', textTransform: 'uppercase',
            letterSpacing: '.06em', fontFamily: 'var(--font-body)',
          }}>Contacto</p>
        </div>

        <InfoBlock icon={Mail}  label="Correo"   value={user.correo}   span={2} />
        <InfoBlock icon={Phone} label="Teléfono" value={user.telefono} />
        <InfoBlock icon={ShieldCheck} label="Rol" value={user.rol || 'Cliente'} />

        {/* Ubicación */}
        <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
          <p style={{
            margin: '0 0 10px', fontSize: 11, fontWeight: 700,
            color: 'var(--gray-500)', textTransform: 'uppercase',
            letterSpacing: '.06em', fontFamily: 'var(--font-body)',
          }}>Ubicación</p>
        </div>

        <InfoBlock icon={MapPin}   label="Dirección"    value={user.direccion}    span={2} />
        <InfoBlock icon={Building2} label="Municipio"   value={user.municipio} />
        <InfoBlock icon={Map}       label="Departamento" value={user.departamento} />
      </div>

      {/* Cerrar sesión */}
      <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--gray-100)' }}>
        <button
          onClick={() => setShowLogout(true)}
          style={{
            width: '100%', padding: '11px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            borderRadius: 'var(--radius-md)',
            border: '1.5px solid #fca5a5',
            background: '#fff',
            color: '#dc2626',
            fontSize: 14, fontWeight: 700,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            transition: 'background .15s, border-color .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fff1f2'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
        >
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};

export default ProfileView;