import { useState, useEffect } from 'react';
import { fmtFecha } from '../../../utils/dateUtils.js';
import ProfileView from './components/ProfileView.jsx';
import ProfileForm from './components/ProfileForm.jsx';
import { getCurrentUser, updateUser, eliminarCuenta } from './services/profileService.js';
import { getPedidos, getMiCredito, getMisVentas } from '../../../services/pedidosService.js';
import { UserCircle, Leaf, ShieldCheck, Package, Gift, Trash2, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../../utils/api.js';
import { useNavigate } from 'react-router-dom';
import '../../../styles/Client.css';

const COP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

const ESTADO_CONFIG = {
  'Pendiente':    { bg: '#fff8e1', color: '#f57f17', border: '#ffe082', dot: '#ffa726' },
  'Confirmado':   { bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7', dot: '#43a047' },
  'En proceso':   { bg: '#e3f2fd', color: '#1565c0', border: '#90caf9', dot: '#1976d2' },
  'En camino':    { bg: '#f3e5f5', color: '#6a1b9a', border: '#ce93d8', dot: '#8e24aa' },
  'Entregado':    { bg: '#e8f5e9', color: '#2e7d32', border: '#c8e6c9', dot: '#43a047' },
  'Cancelado':    { bg: '#ffebee', color: '#b71c1c', border: '#ef9a9a', dot: '#ef5350' },
  'Completada':   { bg: '#e8f5e9', color: '#2e7d32', border: '#c8e6c9', dot: '#43a047' },
};

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] || { bg: '#f5f5f5', color: '#757575', border: '#e0e0e0', dot: '#bdbdbd' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      fontSize: 11, fontWeight: 700,
      padding: '3px 10px', borderRadius: 99,
      fontFamily: 'var(--font-body)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {estado}
    </span>
  );
}

function PedidoCard({ pedido }) {
  const cfg = ESTADO_CONFIG[pedido.estado] || {};
  const borderColor = cfg.border || '#e0e0e0';
  const productos = pedido.productosItems || [];
  const resumen = productos.slice(0, 2).map(p => p.nombre).join(', ')
    + (productos.length > 2 ? ` +${productos.length - 2} más` : '');

  return (
    <div style={{
      borderRadius: 12,
      border: `1px solid ${borderColor}`,
      borderLeft: `4px solid ${cfg.dot || '#e0e0e0'}`,
      background: cfg.bg || '#fafafa',
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{
            margin: 0, fontWeight: 800, fontSize: 13,
            color: 'var(--gray-900)', fontFamily: 'var(--font-body)',
            letterSpacing: '.01em',
          }}>
            {pedido.numero}
          </p>
          <p style={{
            margin: '2px 0 0', fontSize: 11, color: 'var(--gray-500)',
            fontFamily: 'var(--font-body)',
          }}>
            {fmtFecha(pedido.fecha_pedido)}
          </p>
        </div>
        <EstadoBadge estado={pedido.estado} />
      </div>

      {resumen && (
        <p style={{
          margin: 0, fontSize: 12, color: 'var(--gray-600)',
          fontFamily: 'var(--font-body)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {resumen}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {pedido.domicilio && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px',
              borderRadius: 99, background: '#e3f2fd', color: '#1565c0',
              border: '1px solid #90caf9', fontFamily: 'var(--font-body)',
            }}>
              🛵 Domicilio
            </span>
          )}
          {pedido.metodo_pago && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 7px',
              borderRadius: 99, background: 'var(--gray-100)', color: 'var(--gray-600)',
              border: '1px solid var(--gray-300)', fontFamily: 'var(--font-body)',
            }}>
              {pedido.metodo_pago === 'Transferencia' ? '🏦' : '💵'} {pedido.metodo_pago}
            </span>
          )}
        </div>
        <p style={{
          margin: 0, fontWeight: 800, fontSize: 15,
          color: 'var(--green-800)', fontFamily: 'var(--font-body)',
        }}>
          {COP(pedido.total)}
        </p>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ nombre, onConfirm, onCancel, loading }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20,
        padding: '32px 28px', width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        textAlign: 'center',
        animation: 'fadeIn .2s ease',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: '#ffebee', border: '2px solid #ef9a9a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <AlertTriangle size={28} color="#c62828" />
        </div>

        <p style={{
          margin: '0 0 8px', fontFamily: 'var(--font-display)',
          fontSize: '1.3rem', fontWeight: 800, color: '#b71c1c',
        }}>
          ¿Eliminar tu cuenta?
        </p>
        <p style={{
          margin: '0 0 24px', fontSize: 13, color: 'var(--gray-600)',
          fontFamily: 'var(--font-body)', lineHeight: 1.6,
        }}>
          Hola <strong>{nombre}</strong>, esta acción desactivará tu cuenta permanentemente.
          Ya no podrás iniciar sesión ni hacer pedidos.
          Si cambias de opinión, contáctanos.
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 12,
              border: '1.5px solid var(--gray-300)', background: '#fff',
              color: 'var(--gray-700)', fontFamily: 'var(--font-body)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 12,
              border: 'none', background: loading ? '#ef9a9a' : '#c62828',
              color: '#fff', fontFamily: 'var(--font-body)',
              fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              transition: 'background .2s',
            }}
          >
            <Trash2 size={15} />
            {loading ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizarPerfil(data) {
  let localUser = null;
  try { localUser = JSON.parse(localStorage.getItem('usuario')); } catch {}
  return {
    id:             data.id,
    nombre:         data.Nombre         || '',
    apellidos:      data.Apellidos      || '',
    correo:         data.Correo         || '',
    cedula:         data.Cedula         || '',
    tipoDocumento:  data.Tipo_Documento || '',
    telefono:       data.Telefono       || '',
    direccion:      data.Direccion      || '',
    municipio:      data.Municipio      || '',
    departamento:   data.Departamento   || '',
    fotoPerfil:     data.Foto_perfil    || localUser?.fotoPerfil || localUser?.Foto_perfil || '',
    rol:            data.rol            || 'Cliente',
    estado:         data.Estado !== 2,
  };
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const [pedidos,      setPedidos]      = useState([]);
  const [user,         setUser]         = useState(null);
  const [perfil,       setPerfil]       = useState(null);
  const [isEditing,    setIsEditing]    = useState(false);
  const [toast,        setToast]        = useState(null);
  const [credito,      setCredito]      = useState(0);
  const [loadingPerfil, setLoadingPerfil] = useState(true);
  const [showDelete,   setShowDelete]   = useState(false);
  const [deletingAcc,  setDeletingAcc]  = useState(false);

  const cargarPerfil = () => {
    setLoadingPerfil(true);
    return apiFetch('/auth/perfil')
      .then(data => { const n = normalizarPerfil(data); setPerfil(n); return n; })
      .catch(() => {})
      .finally(() => setLoadingPerfil(false));
  };

  useEffect(() => {
    setUser(getCurrentUser());
    cargarPerfil();
    getMisVentas({ porPagina: 100 })
      .then(data => setPedidos(data.pedidos || []))
      .catch(() => getPedidos({ porPagina: 100 }).then(data => setPedidos(data.pedidos || [])).catch(() => {}));
    getMiCredito().then(d => setCredito(d?.saldo || 0)).catch(() => {});
  }, []);

  const handleSave = async (updatedData) => {
    try {
      await updateUser(updatedData);
      await cargarPerfil();
      setIsEditing(false);
      showToast('¡Datos actualizados correctamente!', 'success');
    } catch {
      showToast('Ocurrió un error al actualizar los datos.', 'error');
    }
  };

  const handleEliminarCuenta = async () => {
    setDeletingAcc(true);
    try {
      await eliminarCuenta();
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      navigate('/');
    } catch {
      showToast('Error al eliminar la cuenta. Intenta de nuevo.', 'error');
      setShowDelete(false);
    } finally {
      setDeletingAcc(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  if (loadingPerfil && !perfil) return (
    <div className="toston-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', color: 'var(--gray-500)', fontFamily: 'var(--font-body)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⌛</div>
        <p style={{ fontWeight: 600 }}>Cargando perfil...</p>
      </div>
    </div>
  );

  const perfilMostrar = perfil || { nombre: user?.nombre || '', apellidos: user?.apellidos || '', rol: user?.rol || 'Cliente' };
  const esCliente = perfilMostrar.rol === 'Cliente' || perfilMostrar.rol === 'cliente';

  return (
    <div className="toston-page">

      {showDelete && (
        <ConfirmDeleteModal
          nombre={perfilMostrar.nombre}
          onConfirm={handleEliminarCuenta}
          onCancel={() => setShowDelete(false)}
          loading={deletingAcc}
        />
      )}

      {toast && (
        <div className="toast-wrap">
          <div className={`toast ${toast.type === 'error' ? 'toast--error' : ''}`}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.message}
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <header className="page-hero">
        <div className="page-hero__inner">
          <div>
            <span className="page-hero__label">
              <Leaf size={11} /> Tostón App
            </span>
            <h1 className="page-hero__title">
              Mi <em>Perfil</em>
            </h1>
            <p className="page-hero__sub">
              Mantén tus datos actualizados para recibir tus pedidos sin inconvenientes.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="page-hero__badge">
              <span className="page-hero__badge-icon">
                <UserCircle size={18} color="white" />
              </span>
              {perfilMostrar.nombre || 'Mi cuenta'}
            </div>
            {!isEditing && (
              <button className="btn-primary" onClick={() => setIsEditing(true)} style={{ justifyContent: 'center' }}>
                Editar perfil
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="page-content">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
          alignItems: 'start',
        }}>

          {/* Card principal */}
          <div className="card" style={{ padding: 32 }}>
            <p className="section-title">
              {isEditing ? 'Editar información' : 'Información personal'}
            </p>
            {isEditing ? (
              <ProfileForm user={perfilMostrar} onSave={handleSave} onCancel={() => setIsEditing(false)} />
            ) : (
              <ProfileView user={perfilMostrar} totalPedidos={pedidos.length} onEdit={() => setIsEditing(true)} />
            )}

            {/* Zona peligrosa — solo clientes */}
            {esCliente && !isEditing && (
              <div style={{
                marginTop: 28,
                padding: '18px 20px',
                borderRadius: 14,
                border: '1.5px solid #ef9a9a',
                background: '#fff8f8',
              }}>
                <p style={{
                  margin: '0 0 4px',
                  fontSize: 12, fontWeight: 800,
                  color: '#b71c1c', textTransform: 'uppercase',
                  letterSpacing: '.06em', fontFamily: 'var(--font-body)',
                }}>
                  Zona peligrosa
                </p>
                <p style={{
                  margin: '0 0 14px', fontSize: 12,
                  color: 'var(--gray-500)', fontFamily: 'var(--font-body)',
                  lineHeight: 1.5,
                }}>
                  Al eliminar tu cuenta perderás acceso a tus pedidos y no podrás iniciar sesión nuevamente.
                </p>
                <button
                  onClick={() => setShowDelete(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '9px 18px', borderRadius: 10,
                    border: '1.5px solid #ef9a9a', background: '#fff',
                    color: '#c62828', fontSize: 13, fontWeight: 700,
                    fontFamily: 'var(--font-body)', cursor: 'pointer',
                    transition: 'all .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#ffebee'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                >
                  <Trash2 size={14} />
                  Eliminar mi cuenta
                </button>
              </div>
            )}
          </div>

          {/* Columna derecha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Card de resumen */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                paddingBottom: 16, borderBottom: '1px solid var(--green-100)',
                marginBottom: 16,
              }}>
                <div style={{
                  width: 44, height: 44,
                  background: 'var(--green-50)', borderRadius: 'var(--radius-md)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--green-700)',
                }}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--gray-900)' }}>
                    Cuenta verificada
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--gray-500)', fontFamily: 'var(--font-body)' }}>
                    Tus datos están protegidos
                  </p>
                </div>
                <span className="badge badge--green" style={{ marginLeft: 'auto' }}>Activa</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Miembro desde',        value: '2024' },
                  { label: 'Pedidos realizados',   value: pedidos.length || '—' },
                  { label: 'Última sesión',         value: 'Hoy' },
                  { label: '🎁 Crédito disponible', value: credito > 0 ? COP(credito) : 'Sin crédito', highlight: credito > 0 },
                ].map(item => (
                  <div key={item.label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 13, fontFamily: 'var(--font-body)',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--gray-100)',
                  }}>
                    <span style={{ color: 'var(--gray-500)' }}>{item.label}</span>
                    <span style={{ fontWeight: 700, color: item.highlight ? '#7b1fa2' : 'var(--gray-900)' }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card de pedidos — mejorada */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                paddingBottom: 16, borderBottom: '1px solid var(--green-100)',
                marginBottom: 16,
              }}>
                <div style={{
                  width: 44, height: 44,
                  background: 'var(--green-50)', borderRadius: 'var(--radius-md)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--green-700)',
                }}>
                  <Package size={22} />
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--gray-900)' }}>
                    Mis Pedidos
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--gray-500)', fontFamily: 'var(--font-body)' }}>
                    {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} en total
                  </p>
                </div>
                {pedidos.length > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    background: 'var(--green-100)', color: 'var(--green-800)',
                    fontSize: 12, fontWeight: 800,
                    padding: '4px 12px', borderRadius: 99,
                    fontFamily: 'var(--font-body)',
                  }}>
                    {pedidos.length}
                  </span>
                )}
              </div>

              {pedidos.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '28px 16px',
                  background: 'var(--gray-50)', borderRadius: 12,
                  border: '1.5px dashed var(--gray-300)',
                }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🛒</div>
                  <p style={{
                    margin: 0, fontWeight: 700, fontSize: 14,
                    color: 'var(--gray-700)', fontFamily: 'var(--font-body)',
                  }}>
                    Aún no tienes pedidos
                  </p>
                  <p style={{
                    margin: '6px 0 0', fontSize: 12,
                    color: 'var(--gray-400)', fontFamily: 'var(--font-body)',
                  }}>
                    Explora el catálogo y haz tu primer pedido
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 460, overflowY: 'auto' }}>
                  {pedidos.map(pedido => (
                    <PedidoCard key={pedido.id} pedido={pedido} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
