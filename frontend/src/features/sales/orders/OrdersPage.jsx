import { useState, useEffect, useCallback } from 'react';
import { addToCart, getCart, getCartCount, clearCart } from './services/cartService';
import { getProductos } from '../../../services/productosService';
import { getCategorias } from '../../../services/categoriasProductosService';
import ProductCard from './components/ProductCard';
import {
  Search, SlidersHorizontal, ShoppingBag, Leaf,
  X, CheckCircle2, ShoppingCart
} from 'lucide-react';
import { getUser } from '../../../services/authService';
import { updateUser } from '../../client/profile/services/profileService.js';
import CartAside from './components/CartAside';
import CheckoutModal from './components/CheckoutModal';
import { crearPedidoCliente, resolverEntrega } from './services/crearPedidoCliente';
import '../../../styles/Client.css';

/* ─── OrdersPage principal ────────────────────────────── */
const OrdersPage = () => {
  const [productos,   setProductos]   = useState([]);
  const [categorias,  setCategorias]  = useState([]);
  const [searchTerm,       setSearchTerm]       = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeProducts,   setActiveProducts]   = useState([]);
  const [cartCount,        setCartCount]        = useState(0);
  const [cartOpen,           setCartOpen]           = useState(false);
  const [checkoutOpen,       setCheckoutOpen]       = useState(false);
  const [orderDetails,       setOrderDetails]       = useState(null);
  const [toast,              setToast]              = useState(null);
  const [saveAddressPrompt,  setSaveAddressPrompt]  = useState(null);

  useEffect(() => {
    getProductos({ porPagina: 100 }).then(data => {
      const lista = (data.productos || data || []).map(p => ({
        id:                 p.ID_Producto || p.id,
        nombre:             p.Nombre      || p.nombre      || "",
        precio:             p.Precio_venta || p.Precio_Venta || p.precio || 0,
        stock:              p.Stock       || p.stock       || 0,
        idCategoria:        p.ID_Categoria|| p.idCategoria || null,
        publicado:          !!p.Publicado,
        imagen:             p.Imagen      || p.imagen      || null,
        requiereProduccion: !!p.Requiere_Produccion,
      }));
      setProductos(lista.filter(p => p.publicado));
    }).catch(() => {});
    getCategorias({ porPagina: 100 }).then(data => {
      const lista = (data.categorias || data || []).map(c => ({
        id:    c.ID_Categoria || c.id,
        nombre:c.Nombre       || c.nombre || "",
        estado:c.Estado !== 0,
      }));
      setCategorias(lista.filter(c => c.estado));
    }).catch(() => {});
  }, []);

  /* Sincroniza el contador del carrito */
  const syncCount = useCallback(() => setCartCount(getCartCount()), []);
  useEffect(() => {
    syncCount();
    window.addEventListener('cart-updated', syncCount);
    return () => window.removeEventListener('cart-updated', syncCount);
  }, [syncCount]);

  /* Filtra productos */
  useEffect(() => {
    const activeCatIds = new Set((categorias || []).map(c => Number(c.id)));
    const filtered = (productos || []).filter(p =>
      (activeCatIds.size === 0 || activeCatIds.has(Number(p.idCategoria))) &&
      (p.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) &&
      (selectedCategory === 'all' || Number(p.idCategoria) === Number(selectedCategory))
    );
    setActiveProducts(filtered);
  }, [productos, categorias, searchTerm, selectedCategory]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddToCart = (product) => {
    addToCart(product);
    showToast(`${product.nombre} agregado al carrito ✓`);
  };

  const COSTO_DOMICILIO = 5000;

  const handleCheckout = (details) => {
    const user = getUser();
    const subtotal = getCart().reduce((a, i) => a + i.precio * i.cantidad, 0);
    setOrderDetails({
      ...details,
      clientName:    user?.nombre || '',
      items:         getCart(),
      total:         subtotal + (details.tieneDomicilio ? COSTO_DOMICILIO : 0),
      observaciones: details.observaciones || '',
      tieneDomicilio: details.tieneDomicilio || false,
    });
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  // El envío vive en crearPedidoCliente para que la landing use exactamente el
  // mismo camino: allá se había quedado una copia vieja que no mandaba el
  // comprobante ni el anticipo.
  const handleConfirmOrder = async (paymentMethod, onBehalfOf, comprobante, saldoAFavor, deliveryInfo, anticipoData) => {
    const entrega = resolverEntrega(deliveryInfo, orderDetails);
    try {
      await crearPedidoCliente({
        paymentMethod, onBehalfOf, comprobante, saldoAFavor,
        deliveryInfo, anticipoData, orderDetails,
      });
      clearCart();
      setCheckoutOpen(false);
      showToast('¡Pedido creado exitosamente! 🎉');
      // Ofrecer guardar la dirección si es un domicilio
      if (entrega.tieneDomicilio && entrega.address) {
        setSaveAddressPrompt({
          direccion:    entrega.address,
          municipio:    entrega.municipio,
          departamento: entrega.departamento,
        });
      }
    } catch (err) {
      showToast(err.message || 'Error al crear el pedido', 'error');
    }
  };

  return (
    <div className="toston-page">

      {/* ── Toast ── */}
      {toast && (
        <div className="toast-wrap">
          <div className={`toast ${toast.type === 'error' ? 'toast--error' : ''}`}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* ── Botón flotante del carrito ── */}
      <button
        onClick={() => setCartOpen(true)}
        style={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          zIndex: 40,
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #065f46, #10b981)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(16,185,129,0.4)',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        data-tooltip="Ver carrito de compras"
      >
        <ShoppingBag size={26} />
        {cartCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: '#f97316',
            color: 'white',
            fontSize: 11,
            fontWeight: 900,
            width: 22,
            height: 22,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid white',
          }}>
            {cartCount > 99 ? '99+' : cartCount}
          </span>
        )}
      </button>

      {/* ── Hero ── */}
      <header className="page-hero">
        <div className="page-hero__inner">
          <div>
            <span className="page-hero__label">
              <Leaf size={11} /> Tostón App
            </span>
            <h1 className="page-hero__title">
              Realiza tu <em>Pedido</em>
            </h1>
            <p className="page-hero__sub">
              Plátano fresco, delicioso y artesanal — directo a la puerta de tu casa.
            </p>
          </div>

          <button
            className="page-hero__badge"
            onClick={() => setCartOpen(true)}
            style={{ cursor: 'pointer', background: cartCount > 0 ? 'rgba(249,115,22,0.2)' : undefined }}
          >
            <span className="page-hero__badge-icon">
              <ShoppingBag size={18} color="white" />
            </span>
            {cartCount > 0 ? `${cartCount} en carrito` : `${activeProducts.length} producto${activeProducts.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="page-content">

        {/* Toolbar */}
        <div className="toolbar">
          <div className="search-wrap">
            <Search size={16} />
            <input
              className="search-input"
              type="text"
              placeholder="Buscar por nombre de producto..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="chips">
            <button
              className={`chip ${selectedCategory === 'all' ? 'chip--active' : 'chip--default'}`}
              onClick={() => setSelectedCategory('all')}
            >
              Todos
            </button>
            {(categorias || []).map(cat => (
              <button
                key={cat.id}
                className={`chip ${selectedCategory === cat.id ? 'chip--active' : 'chip--default'}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span>{cat.icon}</span> {cat.nombre}
              </button>
            ))}
          </div>

          <button className="btn-secondary" style={{ padding: '12px 14px' }} data-tooltip="Filtrar productos">
            <SlidersHorizontal size={16} />
          </button>
        </div>

        {/* Grid */}
        {activeProducts.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 24 }}>
            {activeProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state__icon"><Search size={32} /></div>
            <h3 className="empty-state__title">No encontramos productos</h3>
            <p className="empty-state__text">Intenta con otra búsqueda o selecciona una categoría diferente.</p>
            <button className="btn-primary" onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}>
              Ver todos los productos
            </button>
          </div>
        )}
      </main>

      {/* ── CartAside ── */}
      <CartAside
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={handleCheckout}
        onLoginRequired={() => navigate('/login')}
      />

      {/* ── CheckoutModal ── */}
      {orderDetails && (
        <CheckoutModal
          isOpen={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          orderDetails={orderDetails}
          onConfirm={handleConfirmOrder}
        />
      )}

      {/* ── Prompt guardar dirección ── */}
      {saveAddressPrompt && (
        <div style={{
          position: 'fixed', bottom: 32, right: 32, zIndex: 50,
          background: '#fff', border: '2px solid #c8e6c9', borderRadius: 20,
          padding: '16px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          maxWidth: 320, animation: 'fadeInUp 0.3s ease',
        }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>
            📍 ¿Guardar esta dirección?
          </p>
          <p style={{ fontSize: 11, color: '#757575', marginBottom: 14, lineHeight: 1.4 }}>
            {saveAddressPrompt.direccion}
            {saveAddressPrompt.municipio ? `, ${saveAddressPrompt.municipio}` : ''}
            {saveAddressPrompt.departamento ? `, ${saveAddressPrompt.departamento}` : ''}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setSaveAddressPrompt(null)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid #e0e0e0', background: '#fafafa', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#757575' }}
            >
              No, gracias
            </button>
            <button
              onClick={async () => {
                try {
                  await updateUser({
                    Direccion:    saveAddressPrompt.direccion,
                    Municipio:    saveAddressPrompt.municipio,
                    Departamento: saveAddressPrompt.departamento,
                  });
                  setSaveAddressPrompt(null);
                  showToast('Dirección guardada como predeterminada ✓');
                } catch {
                  setSaveAddressPrompt(null);
                }
              }}
              style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: '#2e7d32', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;