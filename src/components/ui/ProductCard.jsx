import React, { useState, useEffect } from "react";
import { Plus, Image } from "lucide-react";
import { useStore } from "../../store/store";
import { formatPrice } from "../../utils/currency";
import { Button } from "./Button";
import { Badge } from "./Badge";

export function ProductCard({ product }) {
  const { addToCart, currency } = useStore();
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [product.imageUrl]);
  
  // stock null/undefined (ex: nouveau compte sans data stock) = non limité (Infinity)
  const safeStock = product.stock != null ? Number(product.stock) : Infinity;
  const minStock  = Number(product.minStock) || 0;
  
  const isOutOfStock = safeStock <= 0;
  // n'afficher 'Faible' que si le stock réel est un nombre défini
  const isLowStock   = Number.isFinite(safeStock) && safeStock > 0 && safeStock <= minStock;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 transition-all hover:border-slate-700 hover:shadow-lg hover:shadow-black/50">
      <div className="relative h-16 md:h-24 overflow-hidden bg-slate-800 flex items-center justify-center">
        {!imgError && product.imageUrl && product.imageUrl.trim() !== '' ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 ${isOutOfStock ? 'opacity-50 grayscale' : ''}`}
            onError={() => setImgError(true)}
          />
        ) : (
          <Image className="h-8 w-8 md:h-12 md:w-12 text-slate-600 opacity-50" />
        )}
        <div className="absolute top-1 left-1 flex gap-1">
          {isOutOfStock && <Badge variant="danger" className="text-[9px] md:text-xs px-1 py-0 md:px-2 md:py-1">Rupture</Badge>}
          {isLowStock && <Badge variant="warning" className="text-[9px] md:text-xs px-1 py-0 md:px-2 md:py-1">Faible</Badge>}
        </div>
      </div>
      
      <div className="flex flex-1 flex-col p-2 md:p-4">
        <div className="mb-1 md:mb-2">
          <p className="hidden md:block text-xs font-medium text-slate-400">{product.category}</p>
          <h3 className="line-clamp-1 text-xs md:text-sm font-bold text-slate-100">{product.name}</h3>
        </div>
        
        <div className="mt-auto flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs md:text-xl font-bold text-amber-500">
              {formatPrice(product.price, currency)}
            </span>
            <span className="text-[9px] md:text-xs text-slate-500">Stock: {product.stock}</span>
          </div>
          
          <Button 
            variant="primary" 
            size="icon" 
            className="rounded-full h-6 w-6 md:h-12 md:w-12 shrink-0 transition-transform active:scale-90"
            disabled={isOutOfStock}
            onClick={() => addToCart(product)}
          >
            <Plus className="h-4 w-4 md:h-6 md:w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
