import { useState, useEffect, useRef } from 'react';
import { crearDevolucion } from '../../../../services/devolucionesService.js';
import { subirImagenCloudinary } from '../../../../utils/cloudinary.js';
import { PackageMinus, AlertCircle, Image, X, Check } from 'lucide-react';

const MOTIVOS = [
  'Producto en mal estado',
  'Producto incompleto',
  'Producto equivocado',
  'Daño durante el transporte',
  'No cumple con lo descrito',
  'Otro',
];

const COP = (n) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(n);

/* ── fila de un producto ── */
function ProductRow({ item, checked, motivo, onToggle, onMotivo }) {
  return (
    <div style={{
      borderRadius: 14,
      border: `2px solid ${checked ? '#a7f3d0' : '#e5e7eb'}`,
      background: checked ? '#f0fdf4' : '#fafafa',
      padding: '12px 14px',
      transition: 'border-color .15s, background .15s',
    }}>
      {/* cabecera del producto */}
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
      }}>
        {/* checkbox custom */}
        <span
          onClick={onToggle}
          style={{
            width: 20, height: 20, borderRadius: 6, flexShrink: 0,
            border: `2px solid ${checked ? '#10b981' : '#d1d5db'}`,
            background: checked ? '#10b981' : 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all .12s',
          }}
        >
          {checked && <Check size={12} color="white" strokeWidth={3} />}
        </span>

        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: checked ? '#065f46' : '#374151' }}>
            {item.nombre}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
            {item.cantidad} {item.cantidad === 1 ? 'unidad' : 'unidades'} · {COP(item.precio * item.cantidad)}
          </p>
        </div>
      </label>

      {/* selector de motivo (visible solo si está marcado) */}
      {checked && (
        <div style={{ marginTop: 10 }}>
          <label style={{
            display: 'block', fontSize: 10, fontWeight: 700,
            color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em',
            marginBottom: 4,
          }}>
            Motivo de devolución <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            value={motivo}
            onChange={e => onMotivo(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 10,
              border: `1.5px solid ${motivo ? '#a7f3d0' : '#fca5a5'}`,
              background: 'white', fontSize: 12, fontWeight: 600,
              color: motivo ? '#065f46' : '#9ca3af',
              outline: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            <option value="">— Selecciona el motivo —</option>
            {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

/* ── componente principal ── */
const ReturnForm = ({ onSuccess, defaultIdVenta = '', orderProducts = [] }) => {
  /* estado por producto: { checked, motivo } */
  const [prodState, setProdState] = useState({});
  const [comentario, setComentario] = useState('');
  const [evidencia,  setEvidencia]  = useState(null);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const fileRef = useRef(null);

  /* reiniciar cuando cambia el pedido seleccionado */
  useEffect(() => {
    setProdState({});
    setComentario('');
    setEvidencia(null);
    setError('');
  }, [defaultIdVenta]);

  const toggle = (id) =>
    setProdState(prev => ({
      ...prev,
      [id]: { checked: !prev[id]?.checked, motivo: prev[id]?.motivo || '' },
    }));

  const setMotivo = (id, motivo) =>
    setProdState(prev => ({
      ...prev,
      [id]: { ...prev[id], motivo },
    }));

  const [uploadingEvidencia, setUploadingEvidencia] = useState(false);
  const [uploadError,        setUploadError]        = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setUploadError('');
    setUploadingEvidencia(true);
    try {
      const url = await subirImagenCloudinary(file);
      setEvidencia({ nombre: file.name, url, tipo: file.type });
    } catch (err) {
      setUploadError(err?.message || 'Error al subir el archivo. Intenta de nuevo.');
    } finally {
      setUploadingEvidencia(false);
    }
  };

  /* productos seleccionados con todos sus datos */
  const seleccionados = orderProducts
    .filter(p => prodState[p.idProducto || p.id]?.checked)
    .map(p => ({
      ...p,
      motivoProd: prodState[p.idProducto || p.id]?.motivo || '',
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (seleccionados.length === 0) {
      setError('Selecciona al menos un producto para devolver.');
      return;
    }
    const sinMotivo = seleccionados.find(p => !p.motivoProd);
    if (sinMotivo) {
      setError(`Indica el motivo de devolución para "${sinMotivo.nombre}".`);
      return;
    }

    /* construir motivo global y comentario combinado */
    const motivoGlobal =
      seleccionados.length === 1
        ? seleccionados[0].motivoProd
        : 'Múltiples productos';

    const detalleProductos = seleccionados
      .map(p => `• ${p.nombre}: ${p.motivoProd}`)
      .join('\n');

    const comentarioCombinado =
      seleccionados.length > 1
        ? `${detalleProductos}${comentario ? '\n\n' + comentario : ''}`
        : comentario;

    setLoading(true);
    setError('');
    try {
      await crearDevolucion({
        idPedido:   defaultIdVenta,
        motivo:     motivoGlobal,
        comentario: comentarioCombinado.trim(),
        evidencia,
        productos: seleccionados.map(p => ({
          idProducto:     p.idProducto || p.id,
          nombre:         p.nombre,
          cantidad:       p.cantidad,
          precioUnitario: p.precio,
        })),
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Error al enviar la solicitud. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 12, padding: '12px 14px',
        }}>
          <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#991b1b', lineHeight: 1.5 }}>{error}</p>
        </div>
      )}

      {/* lista de productos */}
      <div>
        <p style={{
          margin: '0 0 8px', fontSize: 10, fontWeight: 700,
          color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em',
        }}>
          Productos del pedido <span style={{ color: '#ef4444' }}>*</span>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orderProducts.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>
              No hay productos disponibles.
            </p>
          ) : (
            orderProducts.map(p => {
              const key = p.idProducto || p.id;
              return (
                <ProductRow
                  key={key}
                  item={p}
                  checked={!!prodState[key]?.checked}
                  motivo={prodState[key]?.motivo || ''}
                  onToggle={() => toggle(key)}
                  onMotivo={(m) => setMotivo(key, m)}
                />
              );
            })
          )}
        </div>
      </div>

      {/* evidencia */}
      <div>
        <p style={{
          margin: '0 0 6px', fontSize: 10, fontWeight: 700,
          color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em',
        }}>
          Evidencia <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'none', color: '#9ca3af' }}>(opcional · foto del producto)</span>
        </p>
        {uploadingEvidencia ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#f0fdf4', border: '1.5px solid #a7f3d0',
            borderRadius: 12, padding: '10px 12px', color: '#065f46', fontSize: 12, fontWeight: 600,
          }}>
            Subiendo imagen…
          </div>
        ) : evidencia ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#f0fdf4', border: '1.5px solid #a7f3d0',
            borderRadius: 12, padding: '10px 12px',
          }}>
            <Image size={16} color="#10b981" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {evidencia.nombre}
            </span>
            <button
              type="button"
              onClick={() => { setEvidencia(null); if (fileRef.current) fileRef.current.value = ''; }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2, display: 'flex' }}
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 6, background: '#f9fafb', border: '2px dashed #e5e7eb',
              borderRadius: 12, padding: '20px 16px', cursor: 'pointer',
              transition: 'border-color .15s, background .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#a7f3d0'; e.currentTarget.style.background = '#f0fdf4'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#f9fafb'; }}
          >
            <Image size={18} color="#d1d5db" />
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>
              Haz clic para subir una foto
            </p>
            <input
              ref={fileRef} type="file" accept="image/*"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])}
            />
          </div>
        )}
        {uploadError && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#ef4444', fontWeight: 600 }}>{uploadError}</p>
        )}
      </div>

      {/* comentario adicional */}
      <div>
        <p style={{
          margin: '0 0 6px', fontSize: 10, fontWeight: 700,
          color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em',
        }}>
          Descripción adicional <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'none', color: '#9ca3af' }}>(opcional)</span>
        </p>
        <textarea
          rows={2}
          placeholder="Cuéntanos más detalles sobre el problema…"
          value={comentario}
          onChange={e => setComentario(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 12,
            border: '1.5px solid #e5e7eb', background: '#f9fafb',
            fontSize: 12, fontWeight: 500, color: '#374151',
            outline: 'none', resize: 'none', fontFamily: 'var(--font-body)',
            transition: 'border-color .15s',
            boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = '#a7f3d0'}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

      {/* resumen de selección */}
      {seleccionados.length > 0 && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #a7f3d0',
          borderRadius: 12, padding: '10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#065f46' }}>
            {seleccionados.length} producto{seleccionados.length !== 1 ? 's' : ''} seleccionado{seleccionados.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#065f46' }}>
            {COP(seleccionados.reduce((sum, p) => sum + p.precio * p.cantidad, 0))}
          </span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || uploadingEvidencia || seleccionados.length === 0}
        style={{
          width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
          background: seleccionados.length === 0 ? '#d1d5db' : '#065f46',
          color: 'white', fontSize: 12, fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '.06em',
          cursor: seleccionados.length === 0 ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background .15s',
          fontFamily: 'var(--font-body)',
        }}
        onMouseEnter={e => { if (seleccionados.length > 0 && !loading) e.currentTarget.style.background = '#047857'; }}
        onMouseLeave={e => { if (seleccionados.length > 0) e.currentTarget.style.background = '#065f46'; }}
      >
        <PackageMinus size={15} strokeWidth={2.5} />
        {loading ? 'Enviando…' : 'Enviar solicitud de devolución'}
      </button>
    </form>
  );
};

export default ReturnForm;
