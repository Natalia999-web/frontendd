import { useState, useEffect, useRef } from 'react';
import { crearDevolucion } from '../../../../services/devolucionesService.js';
import { PackageMinus, AlertCircle, FileText, Image, X } from 'lucide-react';

const MOTIVOS = [
  'Producto en mal estado',
  'Producto incompleto',
  'Producto equivocado',
  'Daño durante el transporte',
  'No cumple con lo descrito',
  'Otro',
];

const ReturnForm = ({ onSuccess, defaultIdVenta = '', orderProducts = [] }) => {
  const [form,  setForm]  = useState({
    idVenta:   defaultIdVenta,
    productId: '',
    motivo:    '',
    evidencia: null,
    comentario: '',
  });

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      idVenta: defaultIdVenta || prev.idVenta,
    }));
  }, [defaultIdVenta]);

  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'productId' && !value) setError('Selecciona un producto');
    else if (field === 'motivo' && !value) setError('Selecciona el motivo');
    else setError('');
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => set('evidencia', { nombre: file.name, base64: ev.target.result, tipo: file.type });
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.idVenta || !form.productId || !form.motivo) {
      setError('Completa los campos obligatorios: Producto y motivo.');
      return;
    }

    const selectedProduct = orderProducts.find(p => String(p.idProducto || p.id) === String(form.productId));
    if (!selectedProduct) { setError('Producto no encontrado.'); return; }

    setLoading(true);
    setError('');
    try {
      await crearDevolucion({
        idPedido:   form.idVenta,
        motivo:     form.motivo,
        comentario: form.comentario.trim(),
        evidencia:  form.evidencia,
        productos:  [{
          idProducto:     selectedProduct.idProducto || selectedProduct.id,
          nombre:         selectedProduct.nombre,
          cantidad:       selectedProduct.cantidad,
          precioUnitario: selectedProduct.precio,
        }],
      });
      setForm({ idVenta: defaultIdVenta, productId: '', motivo: '', evidencia: null, comentario: '' });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Error al enviar la solicitud. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 p-4 rounded-2xl animate-in fade-in zoom-in duration-300">
          <AlertCircle size={18} className="text-red-500 shrink-0" />
          <p className="text-xs font-bold text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Producto */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
            <PackageMinus size={12} className="text-emerald-500" /> Producto <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full bg-gray-50 border-2 border-transparent rounded-2xl py-3.5 px-4 text-xs font-bold text-gray-700 focus:bg-white focus:border-emerald-500 transition-all outline-none appearance-none"
            value={form.productId}
            onChange={e => set('productId', e.target.value)}
          >
            <option value="">— Elegir producto —</option>
            {orderProducts.map(p => (
              <option key={p.idProducto || p.id} value={p.idProducto || p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>

        {/* Motivo */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
            <FileText size={12} className="text-emerald-500" /> Motivo <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full bg-gray-50 border-2 border-transparent rounded-2xl py-3.5 px-4 text-xs font-bold text-gray-700 focus:bg-white focus:border-emerald-500 transition-all outline-none appearance-none"
            value={form.motivo}
            onChange={e => set('motivo', e.target.value)}
          >
            <option value="">— Elegir motivo —</option>
            {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Evidencia */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
          <Image size={12} className="text-emerald-500" /> Evidencia
          <span className="text-[9px] font-bold text-gray-300 normal-case">(Opcional: foto del producto)</span>
        </label>

        {form.evidencia ? (
          <div className="flex items-center gap-3 bg-gray-50 border-2 border-emerald-200 rounded-2xl p-3">
            <img src={form.evidencia.base64} alt="evidencia" className="w-14 h-14 object-cover rounded-xl shrink-0" />
            <p className="text-xs font-bold text-gray-600 flex-1 truncate">{form.evidencia.nombre}</p>
            <button
              type="button"
              onClick={() => { set('evidencia', null); if (fileRef.current) fileRef.current.value = ''; }}
              className="text-gray-400 hover:text-red-500 transition-colors p-1"
              data-tooltip="Quitar foto"
            >
              <X size={16} strokeWidth={3} />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl py-6 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-all"
          >
            <Image size={20} className="text-gray-300" />
            <p className="text-xs font-bold text-gray-400">Haz clic para subir una foto</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => handleFile(e.target.files[0])}
            />
          </div>
        )}
      </div>

      {/* Comentario */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
          <FileText size={12} className="text-emerald-500" /> Descripción detallada
        </label>
        <textarea
          className="w-full bg-gray-50 border-2 border-transparent rounded-2xl py-4 px-4 text-xs font-bold text-gray-700 focus:bg-white focus:border-emerald-500 transition-all outline-none resize-none"
          rows={3}
          placeholder="Explícanos brevemente qué sucedió con el producto..."
          value={form.comentario}
          onChange={e => set('comentario', e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full group relative overflow-hidden flex items-center justify-center gap-3 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-200"
      >
        <PackageMinus size={16} strokeWidth={3} />
        {loading ? 'Enviando…' : 'Enviar Solicitud de Devolución'}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
      </button>
    </form>
  );
};

export default ReturnForm;