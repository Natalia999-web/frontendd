export interface CartItem {
  id: number;
  nombre: string;
  precio: number;
  cantidad: number;
  imagenPreview: string | null;
  stock?: number;
  pedidoProgramado?: boolean;
  requiereProduccion?: boolean;
}

const CART_KEY = "toston_app_cart";

export const getCart = (): CartItem[] => {
  const cart = localStorage.getItem(CART_KEY);
  return cart ? JSON.parse(cart) : [];
};

export const saveCart = (cart: CartItem[]): void => {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
};

export const addToCart = (product: any): void => {
  const cart = getCart();
  const existing = cart.find((item) => item.id === product.id);

  if (existing) {
    if (!existing.requiereProduccion && existing.stock && existing.cantidad >= existing.stock) return;
    existing.cantidad += 1;
  } else {
    cart.push({
      id:                 product.id,
      nombre:             product.nombre,
      precio:             product.precio,
      cantidad:           1,
      imagenPreview:      product.imagenPreview || product.imagen || null,
      stock:              product.stock || 0,
      requiereProduccion: product.requiereProduccion ?? false,
    });
  }
  saveCart(cart);
  window.dispatchEvent(new Event('cart-updated'));
};

/**
 * Saca del carrito lo que ya no se vende.
 *
 * El carrito guarda una copia del producto en localStorage, así que un producto
 * que el admin desactiva de la tienda seguía ahí: sumaba al total, contaba en
 * el badge y viajaba dentro del pedido, aunque en el catálogo ya no apareciera.
 * Quien tiene la lista de lo que se puede comprar es el catálogo, así que al
 * cargarse limpia el carrito.
 *
 * Con la lista vacía no hace nada: eso pasa mientras los productos cargan o si
 * la petición falla, y no prueba que el carrito sobre.
 */
export const sanitizeCart = (idsVendibles: number[]): void => {
  if (!idsVendibles.length) return;
  const permitidos = new Set(idsVendibles.map(Number));
  const cart = getCart();
  const limpio = cart.filter((item) => permitidos.has(Number(item.id)));
  if (limpio.length === cart.length) return;
  saveCart(limpio);
  window.dispatchEvent(new Event('cart-updated'));
};

export const removeFromCart = (productId: number): void => {
  const cart = getCart().filter((item) => item.id !== productId);
  saveCart(cart);
  window.dispatchEvent(new Event('cart-updated'));
};

export const updateQuantity = (productId: number, quantity: number): void => {
  const cart = getCart();
  const item = cart.find((i) => i.id === productId);
  if (item) {
    const maxQty = item.requiereProduccion ? Infinity : (item.stock || Infinity);
    item.cantidad = Math.max(1, Math.min(quantity, maxQty));
    saveCart(cart);
    window.dispatchEvent(new Event('cart-updated'));
  }
};

export const clearCart = (): void => {
  localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new Event('cart-updated'));
};

export const getTotal = (): number => {
  const cart = getCart();
  return cart.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
};

export const getCartCount = (): number => {
  const cart = getCart();
  return cart.reduce((acc, item) => acc + item.cantidad, 0);
};

export const addToCartWithQty = (product: any, qty: number, pedidoProgramado = false): void => {
  const cart = getCart();
  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    existing.cantidad += qty;
    if (pedidoProgramado) existing.pedidoProgramado = true;
  } else {
    cart.push({
      id:                 product.id,
      nombre:             product.nombre,
      precio:             product.precio,
      cantidad:           qty,
      imagenPreview:      product.imagenPreview || product.imagen || null,
      stock:              product.stock ?? 0,
      pedidoProgramado,
      requiereProduccion: product.requiereProduccion ?? false,
    });
  }
  saveCart(cart);
  window.dispatchEvent(new Event('cart-updated'));
};