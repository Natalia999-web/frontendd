import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMisVentas, cancelarMiPedido, aceptarFechaProduccion, rechazarFechaProduccion } from '../../../services/pedidosService';
import { crearDevolucion } from '../../../services/devolucionesService';
import { fmtFecha } from '../../../utils/dateUtils.js';
import { getCurrentUser } from '../../client/profile/services/profileService.js';
import { descargarFacturaPedido } from '../../../utils/facturaGenerator.js';
import {
  Package, Calendar, MapPin, DollarSign, Leaf, Search,
  ChevronRight, Clock, CheckCircle2, Truck, AlertTriangle,
  XCircle, ShoppingBag, RefreshCw, ChefHat, Inbox, Store,
  Gift, Check, X, FileText, Ban, CreditCard, Building2,
  Banknote, ClipboardList, CornerUpLeft, AlertCircle, PenLine,
} from 'lucide-react';
import '../../../styles/Client.css';

/* ── Stepper de seguimiento ───────────────────────────── */
const PASOS_DOMICILIO = [
  { key: 'Pendiente',     label: 'Recibido',         Icon: Inbox },
  { key: 'En producción', label: 'Preparación',      Icon: ChefHat },
  { key: 'Confirmado',    label: 'Listo',            Icon: CheckCircle2 },
  { key: 'En camino',     label: 'En camino',        Icon: Truck },
  { key: 'Entregado',     label: 'Entregado',        Icon: Gift },
];
const PASOS_TIENDA = [
  { key: 'Pendiente',     label: 'Recibido',         Icon: Inbox },
  { key: 'En producción', label: 'Preparando',       Icon: ChefHat },
  { key: 'Confirmado',    label: 'Listo en\ntienda', Icon: Store },
  { key: 'Entregado',     label: 'Recogido',         Icon: CheckCircle2 },
];

function PedidoStepper({ estado, domicilio }) {
  const pasos = domicilio ? PASOS_DOMICILIO : PASOS_TIENDA;
  const estadoMapped = (domicilio && (estado === 'Listo' || estado === 'Asignado')) ? 'Confirmado' : estado;
  const idx = pasos.findIndex(p => p.key === estadoMapped);
  const activoIdx = idx === -1 ? 0 : idx;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 16 }}>
      {pasos.map((paso, i) => {
        const done   = i < activoIdx;
        const active = i === activoIdx;
        return (
          <div key={paso.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {i > 0 && (
              <div style={{
                position: 'absolute', top: 14, right: '50%', width: '100%', height: 2,
                background: done || active ? '#2e7d32' : '#e0e0e0', zIndex: 0,
              }} />
            )}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', zIndex: 1, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: done ? '#2e7d32' : active ? '#e8f5e9' : '#f5f5f5',
              border: `2px solid ${done ? '#2e7d32' : active ? '#2e7d32' : '#e0e0e0'}`,
              transition: 'all 0.3s',
            }}>
              {done ? <Check size={12} color="#fff" strokeWidth={3} /> : <paso.Icon size={13} />}
            </div>
            <p style={{
              fontSize: 8, fontWeight: active ? 800 : 600, marginTop: 4, textAlign: 'center',
              color: done ? '#2e7d32' : active ? '#1a1a1a' : '#9e9e9e',
              lineHeight: 1.3, whiteSpace: 'pre-line',
            }}>{paso.label}</p>
          </div>
        );
      })}
    </div>
  );
}

const COP = (n) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);

const ESTADO_CONFIG = {
  'Pendiente': {
    color: 'amber',
    icon: Clock,
    label: 'Pendiente',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700'
  },
  'En producción': {
    color: 'blue',
    icon: Package,
    label: 'En producción',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700'
  },
  'Confirmado': {
    color: 'emerald',
    icon: CheckCircle2,
    label: 'Confirmado',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700'
  },
  'Asignado': {
    color: 'purple',
    icon: Truck,
    label: 'Asignado',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700'
  },
  'Listo': {
    color: 'emerald',
    icon: CheckCircle2,
    label: 'Listo',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700'
  },
  'En camino': {
    color: 'purple',
    icon: Truck,
    label: 'En camino',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700'
  },
  'Entregado': {
    color: 'emerald',
    icon: CheckCircle2,
    label: 'Entregado',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700'
  },
  'Cancelado': {
    color: 'red',
    icon: XCircle,
    label: 'Cancelado',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700'
  },
  'Fecha propuesta': {
    color: 'indigo',
    icon: Calendar,
    label: 'Fecha propuesta',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    badge: 'bg-indigo-100 text-indigo-700'
  },
};

const normalizeComprobanteSrc = (c) => {
  if (!c) return null;
  if (typeof c !== 'string') return null;
  const s = c.trim();
  // already a data URI or absolute/relative URL
  if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/')) return s;
  // likely a raw base64 string stored in DB (no data: prefix)
  // try to detect base64: long string with only base64 chars and maybe padding
  const base64Like = /^[A-Za-z0-9+/=\n\r]+$/.test(s) && s.length > 100;
  if (base64Like) return 'data:image/jpeg;base64,' + s.replace(/\s+/g, '');
  // fallback: return as-is
  return s;
};

const DEVOLUCION_WINDOW_MS = 60 * 60 * 1000; // 1 hora

const puedeDevolver = (pedido) => {
  if (pedido.estado !== 'Entregado') return false;
  const ref = pedido.fecha_actualizacion || pedido.fecha_pedido;
  if (!ref) return false;
  return Date.now() - new Date(ref).getTime() <= DEVOLUCION_WINDOW_MS;
};

const MOTIVOS_DEV = [
  "Producto en mal estado",
  "Producto incorrecto",
  "Producto vencido",
  "No cumple con lo solicitado",
  "Error en el pedido",
  "Otro",
];

const COP_DEV = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

function SolicitarDevolucionModal({ pedido, onClose, onSuccess }) {
  const [items,      setItems]      = useState(
    (pedido.productosItems || []).map(p => ({ ...p, cantDev: 0 }))
  );
  const [motivo,     setMotivo]     = useState('');
  const [comentario, setComentario] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  const setCant = (idx, val) => {
    const n = Math.max(0, Math.min(items[idx].cantidad, Number(val) || 0));
    setItems(prev => { const a = [...prev]; a[idx] = { ...a[idx], cantDev: n }; return a; });
  };

  const seleccionados = items.filter(i => i.cantDev > 0);
  const total = seleccionados.reduce((s, i) => s + i.precio * i.cantDev, 0);

  const handleSubmit = async () => {
    if (!motivo)              { setError('Selecciona el motivo de la devolución.'); return; }
    if (seleccionados.length === 0) { setError('Selecciona al menos un producto.'); return; }
    setError('');
    setSaving(true);
    try {
      await crearDevolucion({
        idPedido:  pedido.id,
        motivo,
        comentario,
        productos: seleccionados.map(i => ({
          idProducto:     i.idProducto,
          nombre:         i.nombre,
          cantidad:       i.cantDev,
          precioUnitario: i.precio,
        })),
      });
      onSuccess();
    } catch (e) {
      setError(e.message || 'Error al enviar la solicitud.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box bg-white w-full max-w-lg shadow-2xl flex flex-col"
        style={{ borderRadius: 24, maxHeight: '90vh', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#b71c1c,#c62828)', padding: '18px 22px', borderRadius: '24px 24px 0 0', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>Devolución · Pedido #{pedido.numero}</p>
            <h2 style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 800, color: '#fff' }}>Solicitar devolución</h2>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '18px 22px' }}>
          {/* Plazo info */}
          <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#f57f17', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} style={{ flexShrink: 0 }} /> Tienes hasta <strong>1 hora</strong> desde la entrega para solicitar una devolución.
          </div>

          {/* Productos */}
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9e9e9e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>¿Qué productos deseas devolver?</p>
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: idx < items.length - 1 ? '1px solid #f5f5f5' : 'none', background: item.cantDev > 0 ? '#f9fdf9' : '#fff' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#212121' }}>{item.nombre}</div>
                  <div style={{ fontSize: 11, color: '#9e9e9e' }}>{COP_DEV(item.precio)} c/u · comprado: ×{item.cantidad}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => setCant(idx, item.cantDev - 1)} disabled={item.cantDev === 0}
                    style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #e0e0e0', background: '#fff', cursor: item.cantDev === 0 ? 'not-allowed' : 'pointer', fontSize: 16, color: '#616161', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 800, fontSize: 14, color: item.cantDev > 0 ? '#c62828' : '#bdbdbd' }}>{item.cantDev}</span>
                  <button onClick={() => setCant(idx, item.cantDev + 1)} disabled={item.cantDev >= item.cantidad}
                    style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #e0e0e0', background: '#fff', cursor: item.cantDev >= item.cantidad ? 'not-allowed' : 'pointer', fontSize: 16, color: '#616161', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
                {item.cantDev > 0 && (
                  <div style={{ minWidth: 72, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#c62828' }}>{COP_DEV(item.precio * item.cantDev)}</div>
                )}
              </div>
            ))}
            {total > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#fff3f3', borderTop: '1.5px solid #ffcdd2' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#c62828', textTransform: 'uppercase' }}>Total a devolver</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#c62828' }}>{COP_DEV(total)}</span>
              </div>
            )}
          </div>

          {/* Motivo */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#616161', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Motivo <span style={{ color: '#c62828' }}>*</span></label>
            <select value={motivo} onChange={e => setMotivo(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
              <option value="">Selecciona el motivo…</option>
              {MOTIVOS_DEV.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Comentario */}
          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#616161', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Comentario adicional (opcional)</label>
            <textarea rows={2} value={comentario} onChange={e => setComentario(e.target.value)}
              placeholder="Describe el problema con más detalle…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {error && (
            <div style={{ background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#c62828', fontWeight: 600, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={13} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: '14px 22px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #e0e0e0', background: '#fff', color: '#616161', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving || total === 0}
            style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: saving || total === 0 ? '#ef9a9a' : '#c62828', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving || total === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving ? 'Enviando…' : <><CornerUpLeft size={14} /> Solicitar devolución</>}
          </button>
        </div>
      </div>
    </div>
  );
}

const PedidosClientePage = () => {
  const [pedidos,        setPedidos]        = useState([]);
  const [user,           setUser]           = useState(null);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [filterEstado,   setFilterEstado]   = useState('todos');
  const [cancelando,     setCancelando]     = useState(false);
  const [confirmCancel,  setConfirmCancel]  = useState(false);
  const [cancelError,    setCancelError]    = useState('');
  const [accionFecha,    setAccionFecha]    = useState(null); // "aceptar" | "rechazar"
  const [accionFechaErr, setAccionFechaErr] = useState('');
  const [devModal,       setDevModal]       = useState(null);
  const [devToast,       setDevToast]       = useState(null);
  const navigate = useNavigate();

  // Ref para acceder al pedido seleccionado dentro del interval sin recrear el callback
  const selectedPedidoRef = useRef(null);
  selectedPedidoRef.current = selectedPedido;

  const fetchPedidos = useCallback(() => {
    getMisVentas({ porPagina: 100 }).then(data => {
      const lista = data.pedidos || [];
      setPedidos(lista);
      // Actualizar el modal si está abierto
      const curr = selectedPedidoRef.current;
      if (curr) {
        const actualizado = lista.find(p => p.id === curr.id);
        if (actualizado) setSelectedPedido(actualizado);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    fetchPedidos();
    // Polling cada 30s para actualizar estados
    const timer = setInterval(fetchPedidos, 30000);
    return () => clearInterval(timer);
  }, [fetchPedidos]);

  // getMisVentas ya devuelve solo los pedidos del usuario autenticado
  const userPedidos = pedidos;

  const filteredPedidos = userPedidos.filter(p => {
    const matchSearch =
      (p.numero || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.cliente?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchEstado = filterEstado === 'todos' || p.estado === filterEstado;
    return matchSearch && matchEstado;
  }).sort((a, b) => new Date(b.fecha_pedido) - new Date(a.fecha_pedido));

  const handleRequestReturn = (pedido) => {
    closeModal();
    setDevModal(pedido);
  };

  const handleCancelarPedido = async (pedido) => {
    setCancelando(true);
    setCancelError('');
    try {
      await cancelarMiPedido(pedido.id);
      setSelectedPedido(null);
      setConfirmCancel(false);
      fetchPedidos();
    } catch (err) {
      setCancelError(err.message || 'No se pudo cancelar el pedido. Intenta de nuevo.');
    } finally {
      setCancelando(false);
    }
  };

  const handleAceptarFecha = async (pedido) => {
    setAccionFecha("aceptar");
    setAccionFechaErr('');
    try {
      await aceptarFechaProduccion(pedido.id);
      fetchPedidos();
      setSelectedPedido(prev => prev ? { ...prev, estado: 'Confirmado' } : prev);
    } catch (e) {
      setAccionFechaErr(e.message || 'No se pudo aceptar la fecha');
    } finally {
      setAccionFecha(null);
    }
  };

  const handleRechazarFecha = async (pedido) => {
    setAccionFecha("rechazar");
    setAccionFechaErr('');
    try {
      await rechazarFechaProduccion(pedido.id);
      fetchPedidos();
      closeModal();
    } catch (e) {
      setAccionFechaErr(e.message || 'No se pudo rechazar la fecha');
      setAccionFecha(null);
    }
  };

  const closeModal = () => {
    setSelectedPedido(null);
    setConfirmCancel(false);
    setCancelError('');
    setAccionFechaErr('');
  };

  const openModal = (pedido) => {
    setSelectedPedido(pedido);
    setConfirmCancel(false);
    setCancelError('');
  };

  if (!user)
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50/50">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Clock className="text-green-600" size={32} />
          </div>
          <p className="font-black text-gray-400 uppercase tracking-widest text-sm">Cargando tus pedidos...</p>
        </div>
      </div>
    );

  return (
    <div className="toston-page min-h-screen bg-gray-50/30">
      {/* ── Hero Refinado ── */}
      <header className="page-hero">
        <div className="page-hero__inner">
          <div className="relative z-10">
            <span className="page-hero__label inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-white/10 mb-4">
              <Leaf size={12} className="text-white" /> Tostón App
            </span>
            <h1 className="page-hero__title text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
              Mis <em className="not-italic text-white opacity-90">Pedidos</em>
            </h1>
            <p className="page-hero__sub text-white/70 max-w-lg font-medium">
              Sigue el progreso de tus antojos en tiempo real.
            </p>
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-white rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <div className="page-hero__badge relative bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shadow-lg">
                <ShoppingBag size={24} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60 leading-none mb-1">Total pedidos</p>
                <p className="text-2xl font-black text-white leading-none">{userPedidos.length}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="page-content max-w-6xl mx-auto px-4 py-8">
        {/* Toolbar Moderna */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-green-600 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Buscar por número de pedido..."
              className="w-full bg-white border-2 border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:border-green-500 outline-none shadow-sm hover:shadow-md transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar items-center">
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border-2 border-gray-100 shadow-sm">
              <button
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterEstado === 'todos'
                    ? 'bg-green-700 text-white shadow-lg shadow-green-200'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => setFilterEstado('todos')}
              >
                Todos
              </button>
              {['Pendiente', 'En producción', 'Fecha propuesta', 'En camino', 'Entregado', 'Cancelado'].map(estado => (
                <button
                  key={estado}
                  className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    filterEstado === estado
                      ? 'bg-green-700 text-white shadow-lg shadow-green-200'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}
                  onClick={() => setFilterEstado(estado)}
                >
                  {estado}
                </button>
              ))}
            </div>

            <button
              onClick={fetchPedidos}
              data-tooltip="Actualizar pedidos"
              className="p-3 bg-white border-2 border-gray-100 rounded-2xl text-gray-400 hover:text-green-700 hover:border-green-200 transition-all shadow-sm"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Grid de Pedidos */}
        {filteredPedidos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPedidos.map(pedido => {
              const config = ESTADO_CONFIG[pedido.estado] || ESTADO_CONFIG['Pendiente'];
              const StatusIcon = config.icon;

              return (
                <div
                  key={pedido.id}
                  className="group bg-white rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden flex flex-col hover:-translate-y-1"
                >
                  {/* Card Header */}
                  <div className={`p-6 ${config.bg} border-b border-gray-100/50 flex justify-between items-start`}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pedido</span>
                        <span className="px-2 py-0.5 bg-white/60 backdrop-blur-sm rounded-lg text-[11px] font-black text-gray-800 border border-white">
                          #{pedido.numero}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Calendar size={12} />
                        <span className="text-[11px] font-bold">
                          {fmtFecha(pedido.fecha_pedido)}
                        </span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${config.badge} border border-white shadow-sm`}>
                      <StatusIcon size={12} strokeWidth={3} />
                      <span className="text-[9px] font-black uppercase tracking-widest leading-none">{config.label}</span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6 flex-1 space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 leading-none">Total</p>
                        <p className="text-2xl font-black text-gray-900 tracking-tight leading-none">
                          {COP(pedido.total || (
                            (pedido.productosItems || []).reduce((s, p) => s + p.precio * p.cantidad, 0)
                            + (pedido.domicilio ? 5000 : 0)
                            - (pedido.descuento || 0)
                          ))}
                        </p>
                      </div>
                      <div className="flex flex-col items-end">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 leading-none">Productos</p>
                        <div className="flex -space-x-2">
                           {(pedido.productosItems || []).slice(0, 3).map((_, i) => (
                             <div key={i} className="w-6 h-6 rounded-full bg-green-50 border-2 border-white flex items-center justify-center text-green-600">
                               <Package size={10} />
                             </div>
                           ))}
                           {(pedido.productosItems || []).length > 3 && (
                             <div className="w-6 h-6 rounded-full bg-gray-50 border-2 border-white flex items-center justify-center text-[8px] font-black text-gray-400">
                               +{pedido.productosItems.length - 3}
                             </div>
                           )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-50">
                      {pedido.estado === 'Fecha propuesta' && pedido.fecha_propuesta && (
                        <div style={{ background: '#e8eaf6', border: '1px solid #9fa8da', borderRadius: 10, padding: '7px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Calendar size={14} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#283593', textTransform: 'capitalize' }}>
                            {new Date(pedido.fecha_propuesta.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-gray-400 mb-4">
                        <MapPin size={14} style={{ color: 'var(--green-600)' }} />
                        <span className="text-[10px] font-bold truncate max-w-[200px]">
                          {pedido.domicilio
                            ? (pedido.direccion_entrega || 'Domicilio')
                            : 'Recogida en local'}
                        </span>
                      </div>

                      <button
                        onClick={() => openModal(pedido)}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-green-700 hover:text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 group/btn shadow-sm"
                      >
                        Ver Detalle Completo
                        <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-[40px] p-12 text-center border border-gray-100 shadow-xl max-w-lg mx-auto">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package size={48} className="text-gray-200" />
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">No hay pedidos</h3>
            <p className="text-gray-400 font-medium mb-8">
              {searchTerm || filterEstado !== 'todos'
                ? 'No encontramos pedidos con estos filtros.'
                : 'Aún no has realizado pedidos deliciosos.'}
            </p>
            <button
              className="btn-primary"
              style={{ padding: '16px 32px' }}
              onClick={() => { setSearchTerm(''); setFilterEstado('todos'); }}
            >
              Ver todos los pedidos
            </button>
          </div>
        )}
      </main>

      {/* ── Toast devolución ── */}
      {devToast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: '#2e7d32', color: '#fff', borderRadius: 14,
          padding: '14px 24px', fontSize: 14, fontWeight: 700,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Check size={16} style={{ flexShrink: 0 }} /> {devToast}
        </div>
      )}

      {/* ── Modal Detalle ── */}
      {selectedPedido && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-box relative bg-white w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border-none"
            style={{ borderRadius: 28 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header shrink-0" style={{ background: 'linear-gradient(135deg, var(--green-900) 0%, var(--green-800) 100%)', padding: '20px 24px' }}>
              <div>
                <p className="modal-header__eyebrow">Pedido #{selectedPedido.numero}</p>
                <h2 className="modal-header__title">Detalle de Compra</h2>
              </div>
              <button onClick={closeModal} className="modal-close-btn"><X size={16} /></button>
            </div>

            {/* Stepper de seguimiento */}
            <div style={{ padding: '16px 20px 0', background: '#fff', flexShrink: 0 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#9e9e9e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Seguimiento del pedido</p>
              <PedidoStepper estado={selectedPedido.estado} domicilio={selectedPedido.domicilio} />
            </div>

            {/* Body */}
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>

              {/* Aviso de producción */}
              {selectedPedido.orden_produccion && selectedPedido.estado === 'Pendiente' && (
                <div style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 12, padding: '12px 14px' }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: '#1565c0', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}><Package size={13} /> Pedido en espera de producción</p>
                  <p style={{ fontSize: 11, color: '#1976d2', lineHeight: 1.5, margin: 0 }}>
                    Uno o más productos requieren producción. El equipo te propondrá una fecha de entrega pronto.
                  </p>
                </div>
              )}

              {/* Aviso de fecha propuesta */}
              {selectedPedido.estado === 'Fecha propuesta' && (
                <div style={{ background: 'linear-gradient(135deg,#e8eaf6 0%,#ede7f6 100%)', border: '2px solid #9fa8da', borderRadius: 16, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Calendar size={20} />
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#283593', margin: 0 }}>El equipo propuso una fecha de entrega</p>
                  </div>
                  {selectedPedido.fecha_propuesta && (
                    <div style={{ background: '#fff', border: '1.5px solid #9fa8da', borderRadius: 12, padding: '10px 14px', marginBottom: 10, textAlign: 'center' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#7986cb', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 4px' }}>Fecha estimada de entrega</p>
                      <p style={{ fontSize: 17, fontWeight: 900, color: '#283593', margin: 0, lineHeight: 1.25, textTransform: 'capitalize' }}>
                        {new Date(selectedPedido.fecha_propuesta.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                  <p style={{ fontSize: 11, color: '#3949ab', marginBottom: 12, lineHeight: 1.5 }}>
                    ¿Puedes recibir tu pedido en esta fecha? Si rechazas, el pedido quedará cancelado.
                  </p>
                  {accionFechaErr && <p style={{ fontSize: 11, color: '#c62828', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={12} /> {accionFechaErr}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button disabled={!!accionFecha} onClick={() => handleAceptarFecha(selectedPedido)}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: '#2e7d32', color: '#fff', fontWeight: 800, fontSize: 13, cursor: accionFecha ? 'not-allowed' : 'pointer', opacity: accionFecha === 'rechazar' ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      {accionFecha === 'aceptar' ? 'Aceptando…' : <><Check size={14} /> Sí, acepto esta fecha</>}
                    </button>
                    <button disabled={!!accionFecha} onClick={() => handleRechazarFecha(selectedPedido)}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: '#c62828', color: '#fff', fontWeight: 800, fontSize: 13, cursor: accionFecha ? 'not-allowed' : 'pointer', opacity: accionFecha === 'aceptar' ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      {accionFecha === 'rechazar' ? 'Rechazando…' : <><X size={14} /> Rechazar fecha</>}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Sección: Información del pedido ── */}
              <div style={{ background: '#f9fdf9', border: '1px solid #e8f5e9', borderRadius: 14, padding: '14px 16px' }}>
                <p style={{ fontSize: 9, fontWeight: 800, color: '#2e7d32', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}><ClipboardList size={12} /> Información del pedido</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, color: '#9e9e9e', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 3px' }}>Número</p>
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#1a1a1a', margin: 0 }}>#{selectedPedido.numero}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, color: '#9e9e9e', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 3px' }}>Fecha del pedido</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{fmtFecha(selectedPedido.fecha_pedido) || '—'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, color: '#9e9e9e', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 3px' }}>Método de pago</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{selectedPedido.metodo_pago || '—'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, color: '#9e9e9e', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 3px' }}>Tipo de entrega</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>{selectedPedido.domicilio ? <><Truck size={14} /> Domicilio</> : <><Store size={14} /> Retiro en tienda</>}</p>
                  </div>
                  {selectedPedido.fecha_propuesta && selectedPedido.estado !== 'Fecha propuesta' && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#9e9e9e', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 3px' }}>Fecha de entrega estimada</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#283593', margin: 0, textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Calendar size={13} /> {new Date(selectedPedido.fecha_propuesta.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Sección: Entrega ── */}
              <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 14, padding: '14px 16px' }}>
                <p style={{ fontSize: 9, fontWeight: 800, color: '#424242', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {selectedPedido.domicilio ? <><Truck size={12} /> Entrega a domicilio</> : <><Store size={12} /> Retiro en tienda</>}
                </p>
                {selectedPedido.domicilio ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <p style={{ fontSize: 9, fontWeight: 700, color: '#9e9e9e', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 2px' }}>Dirección</p>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', margin: 0, lineHeight: 1.4 }}>{selectedPedido.direccion_entrega || '—'}</p>
                      </div>
                      {(selectedPedido.municipio || selectedPedido.departamento) && (
                        <div>
                          <p style={{ fontSize: 9, fontWeight: 700, color: '#9e9e9e', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 2px' }}>Ciudad</p>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{[selectedPedido.municipio, selectedPedido.departamento].filter(Boolean).join(', ')}</p>
                        </div>
                      )}
                    </div>
                    {selectedPedido.nombre_domiciliario ? (
                      <div style={{ background: '#f3e5f5', border: '1px solid #ce93d8', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Truck size={18} />
                        <div>
                          <p style={{ fontSize: 9, fontWeight: 700, color: '#6a1b9a', letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>Tu domiciliario</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{selectedPedido.nombre_domiciliario}</p>
                          <p style={{ fontSize: 10, color: '#9e9e9e', margin: 0 }}>Tiempo estimado: 30–45 min</p>
                        </div>
                      </div>
                    ) : ['Confirmado', 'Listo'].includes(selectedPedido.estado) ? (
                      <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#f57f17', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={13} /> Asignando domiciliario...
                      </div>
                    ) : null}
                    {selectedPedido.observaciones_domicilio && (
                      <div style={{ background: '#fffde7', border: '1px solid #fff176', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 8 }}>
                        <PenLine size={14} style={{ flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: 9, fontWeight: 700, color: '#f9a825', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 3px' }}>Observaciones</p>
                          <p style={{ fontSize: 12, color: '#5d4037', lineHeight: 1.5, margin: 0 }}>{selectedPedido.observaciones_domicilio}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Store size={22} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Retiro en el local</p>
                      <p style={{ fontSize: 11, color: '#9e9e9e', margin: 0 }}>Te avisaremos cuando tu pedido esté listo para recoger.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Sección: Pago ── */}
              <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 14, padding: '14px 16px' }}>
                <p style={{ fontSize: 9, fontWeight: 800, color: '#424242', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}><CreditCard size={12} /> Información del pago</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* Método + cuándo pagar */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#9e9e9e', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 2px' }}>Método</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                        {(selectedPedido.metodo_pago || '').toLowerCase().includes('transfer') ? <Building2 size={13} /> : <Banknote size={13} />} {selectedPedido.metodo_pago || '—'}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#9e9e9e', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 2px' }}>Cuándo pagar</p>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#424242', margin: 0 }}>
                        {(selectedPedido.metodo_pago || '').toLowerCase().includes('transfer')
                          ? 'Comprobante al confirmar'
                          : selectedPedido.domicilio ? 'Al recibir el domicilio' : 'Al retirar en tienda'}
                      </p>
                    </div>
                  </div>
                  {/* Desglose efectivo / transferencia para pago mixto */}
                  {(selectedPedido.metodo_pago || '').toLowerCase() === 'mixto' &&
                    (selectedPedido.monto_efectivo != null || selectedPedido.monto_transferencia != null) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: '#f9f9f9', borderRadius: 8, padding: '8px 12px' }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: '#9e9e9e', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 2px', display: 'flex', alignItems: 'center', gap: 4 }}><Banknote size={10} /> Efectivo</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
                          {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(selectedPedido.monto_efectivo ?? 0)}
                        </p>
                      </div>
                      <div style={{ background: '#f0f7ff', borderRadius: 8, padding: '8px 12px' }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: '#9e9e9e', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 2px', display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={10} /> Transferencia</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#1565c0', margin: 0 }}>
                          {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(selectedPedido.monto_transferencia ?? 0)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Estado del pago (anticipo / completo) */}
                  {(selectedPedido.anticipo_registrado || selectedPedido.pago_final_registrado || selectedPedido.sobre_stock || selectedPedido.requiere_anticipo) && (() => {
                    const montoPagado = selectedPedido.pago_final_registrado
                      ? Number(selectedPedido.total || 0)
                      : selectedPedido.anticipo_registrado
                        ? Number(selectedPedido.anticipo_monto ?? selectedPedido.anticipo_requerido ?? 0)
                        : 0;
                    const saldo = Math.max(0, Number(selectedPedido.total || 0) - montoPagado);
                    const esPagoCompleto = selectedPedido.pago_final_registrado;
                    return (
                      <div style={{ background: esPagoCompleto ? '#e8f5e9' : '#fff8e1', border: `1.5px solid ${esPagoCompleto ? '#a5d6a7' : '#ffe082'}`, borderRadius: 10, padding: '10px 12px' }}>
                        <p style={{ fontSize: 10, fontWeight: 800, color: esPagoCompleto ? '#2e7d32' : '#e65100', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
                          {esPagoCompleto ? <><Check size={11} /> Pago completo</> : selectedPedido.anticipo_registrado ? <><AlertTriangle size={11} /> Anticipo pagado</> : <><AlertTriangle size={11} /> Anticipo pendiente</>}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#5d4037' }}>Abonado:</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#2e7d32' }}>{COP(montoPagado)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#5d4037' }}>Saldo pendiente:</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: saldo > 0 ? '#c62828' : '#2e7d32' }}>{COP(saldo)}</span>
                        </div>
                        {selectedPedido.pago_final_fecha && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#5d4037' }}>Fecha del pago:</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={11} /> {fmtFecha(selectedPedido.pago_final_fecha)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Info adicional sobre_stock */}
                  {selectedPedido.sobre_stock && (
                    <div style={{ background: '#fff3e0', border: '1px solid #ffcc02', borderRadius: 10, padding: '10px 12px', fontSize: 11, color: '#e65100', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> Este pedido tiene productos por encima del stock disponible. Se requirió un anticipo del 50% para procesarlo.
                    </div>
                  )}

                  {/* Comprobante */}
                  {(() => { const mp = (selectedPedido.metodo_pago || '').toLowerCase(); return mp.includes('transfer') || mp === 'digital' || !!selectedPedido.comprobante; })() && (
                    <div>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#9e9e9e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Comprobante de pago</p>
                      {selectedPedido.comprobante ? (
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 12px' }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Check size={13} /> Comprobante adjuntado</p>
                          <img src={normalizeComprobanteSrc(selectedPedido.comprobante)} alt="Comprobante de pago"
                            style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 8, marginBottom: 6, background: '#fff' }}
                            onError={e => { e.target.style.display = 'none'; }} />
                          <a href={normalizeComprobanteSrc(selectedPedido.comprobante)} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>
                            Abrir en nueva pestaña ↗
                          </a>
                        </div>
                      ) : (
                        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#f57f17', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <AlertTriangle size={13} /> Aún no se ha adjuntado comprobante de pago
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Sección: Productos ── */}
              <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#9e9e9e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Productos</p>
              <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f9fdf9' }}>
                      <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#2e7d32', textTransform: 'uppercase' }}>Producto</th>
                      <th style={{ padding: '8px 14px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#2e7d32', textTransform: 'uppercase' }}>Cant.</th>
                      <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#2e7d32', textTransform: 'uppercase' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedPedido.productosItems || []).map((item, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '8px 14px', fontWeight: 600 }}>
                          {item.nombre}
                          <span style={{ display: 'block', fontSize: 10, color: '#9e9e9e' }}>{COP(item.precio)} c/u</span>
                        </td>
                        <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                          <span style={{ background: '#f1f8f1', border: '1px solid #c8e6c9', borderRadius: 6, padding: '1px 7px', fontSize: 11, fontWeight: 700, color: '#2e7d32' }}>×{item.cantidad}</span>
                        </td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: '#2e7d32' }}>{COP(item.precio * item.cantidad)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {selectedPedido.domicilio && (
                      <tr style={{ borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
                        <td colSpan={2} style={{ padding: '8px 14px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#9e9e9e' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Truck size={11} /> Costo de domicilio</span></td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#7b1fa2' }}>{COP(5000)}</td>
                      </tr>
                    )}
                    {(selectedPedido.descuento || 0) > 0 && (
                      <tr style={{ borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
                        <td colSpan={2} style={{ padding: '8px 14px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#1976d2' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CreditCard size={11} /> Crédito aplicado</span></td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#1565c0' }}>− {COP(selectedPedido.descuento)}</td>
                      </tr>
                    )}
                    <tr style={{ borderTop: '2px solid #e8f5e9', background: '#f9fdf9' }}>
                      <td colSpan={2} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#9e9e9e', textTransform: 'uppercase' }}>Total</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 15, fontWeight: 800, color: '#2e7d32' }}>
                        {COP(selectedPedido.total || (
                          (selectedPedido.productosItems || []).reduce((s, p) => s + p.precio * p.cantidad, 0)
                          + (selectedPedido.domicilio ? 5000 : 0)
                          - (selectedPedido.descuento || 0)
                        ))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              </div>

            </div>

            {/* Footer */}
            <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
              {confirmCancel ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', margin: 0, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                    <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> ¿Confirmar la cancelación del pedido #{selectedPedido.numero}? Esta acción no se puede deshacer.
                  </p>
                  {cancelError && (
                    <p style={{ fontSize: 11, color: '#b91c1c', background: '#fee2e2', borderRadius: 8, padding: '6px 10px', margin: 0 }}>
                      {cancelError}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                      onClick={() => { setConfirmCancel(false); setCancelError(''); }}
                    >
                      No, mantener
                    </button>
                    <button
                      style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 12, cursor: cancelando ? 'not-allowed' : 'pointer', opacity: cancelando ? 0.7 : 1 }}
                      onClick={() => handleCancelarPedido(selectedPedido)}
                      disabled={cancelando}
                    >
                      {cancelando ? 'Cancelando...' : 'Sí, cancelar pedido'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button className="btn-ghost" onClick={closeModal}>Cerrar</button>
                  <button
                    className="btn-cancel"
                    style={{ background: '#f1f8f1', color: '#2e7d32', border: '1.5px solid #c8e6c9', display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => descargarFacturaPedido(selectedPedido, user)}
                  >
                    <FileText size={14} /> Descargar factura
                  </button>
                  {selectedPedido.estado === 'Pendiente' && (
                    <button
                      className="btn-cancel"
                      style={{ background: '#fff5f5', color: '#dc2626', border: '1.5px solid #fca5a5', display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={() => setConfirmCancel(true)}
                    >
                      <Ban size={14} /> Cancelar pedido
                    </button>
                  )}
                  {puedeDevolver(selectedPedido) && (
                    <button className="btn-save" onClick={() => handleRequestReturn(selectedPedido)}>Solicitar devolución</button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── Modal solicitar devolución ── */}
      {devModal && (
        <SolicitarDevolucionModal
          pedido={devModal}
          onClose={() => setDevModal(null)}
          onSuccess={() => {
            setDevModal(null);
            setDevToast('Solicitud de devolución enviada. El equipo la revisará pronto.');
            setTimeout(() => setDevToast(null), 5000);
          }}
        />
      )}
    </div>
  );
};

export default PedidosClientePage;
