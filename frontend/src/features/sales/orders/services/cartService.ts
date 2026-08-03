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