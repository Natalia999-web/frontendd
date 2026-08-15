
import React, { useState } from 'react';
import { ShoppingCart, Plus, Heart } from 'lucide-react';

interface ProductCardProps {
  product: {
    id: number;
    nombre: string;
    descripcion?: string;
    precio: number;
    stock: number;
    imagenPreview: string | null;
    requiereProduccion?: boolean;
  };
  onAddToCart: (product: any) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const [isLiked, setIsLiked] = useState(false);

  return (
    <div className="group relative overflow-hidden rounded-3xl bg-white shadow-md hover:shadow-2xl transition-all duration-500 flex flex-col border border-emerald-100/50 hover:border-emerald-300/60">
      {/* Image Container */}
      <div className="relative h-56 overflow-hidden bg-gradient-to-br from-emerald-50 to-white">
        {product.imagenPreview ? (
          <img
            src={product.imagenPreview}
            alt={product.nombre}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-7xl">🍌</div>
        )}

        {/* Gradient Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Like Button */}
        <button
          onClick={() => setIsLiked(!isLiked)}
          className="absolute top-4 right-4 p-2.5 rounded-full bg-white/95 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border border-emerald-100 group-hover:border-emerald-300"
        >
          <Heart
            size={20}
            className={`transition-all duration-300 ${
              isLiked 
                ? 'fill-red-500 text-red-500' 
                : 'text-gray-400 group-hover:text-red-400'
            }`}
          />
        </button>

        {/* Availability Badge */}
        <div className="absolute top-4 left-4 flex flex-col gap-1">
          {product.stock > 0 ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-bold shadow-lg border border-emerald-400/50">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Disponible
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold shadow-lg border border-amber-400/50">
              <span className="w-2 h-2 rounded-full bg-white" />
              Bajo pedido
            </div>
          )}
          {product.requiereProduccion && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600/90 text-white text-xs font-bold shadow-md">
              🏭 Producción
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex-1 flex flex-col">
        <div className="mb-3 flex-1">
          <h3 className="text-lg font-bold text-gray-900 line-clamp-2 group-hover:text-emerald-700 transition-colors">
            {product.nombre}
          </h3>
          <p className="text-gray-500 text-sm line-clamp-2 h-10 mt-2 leading-5">
            {product.descripcion || "Producto fresco y delicioso preparado con los mejores ingredientes."}
          </p>
        </div>

        {/* Price & Button */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Precio</span>
            <span className="text-2xl font-black text-emerald-700 leading-none">
              ${product.precio.toLocaleString('es-CO')}
            </span>
          </div>

          <button
            onClick={() => onAddToCart(product)}
            className="ml-auto flex-shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group/btn hover:scale-110 active:scale-95"
            data-tooltip="Añadir al carrito"
          >
            <div className="relative">
              <ShoppingCart
                size={24}
                className="group-hover/btn:scale-125 transition-transform duration-300"
              />
              <Plus
                size={12}
                className="absolute -top-0.5 -right-0.5 stroke-[3px] group-hover/btn:rotate-90 transition-transform duration-300"
              />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
