import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Minus, ShoppingBag, Search, CheckCircle2, Image } from "lucide-react";
import { useStore } from "../../store/store";
import { formatPrice } from "../../utils/currency";
import { Button } from "../../components/ui/Button";
import { useTranslation } from "../../utils/i18n";

function MenuImage({ src, alt, className }) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [src]);

  if (error || !src || src.trim() === '') {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className}`}>
        <Image className="w-1/2 h-1/2 opacity-50" />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setError(true)} />;
}

export function Menu() {
  const t = useTranslation();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get("table");
  
  const { products, currency, submitWebOrder } = useStore();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [clientCart, setClientCart] = useState([]);
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);

  // Read available products
  const availableProducts = products.filter(p => p.stock > 0);
  const filteredProducts = availableProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const cartTotal = clientCart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const totalItems = clientCart.reduce((sum, item) => sum + item.quantity, 0);

  const handleAddToCart = (product) => {
    setClientCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId, delta) => {
    setClientCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty > 0 && newQty <= item.product.stock) {
          return { ...item, quantity: newQty };
        }
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const placeOrder = () => {
    if (clientCart.length === 0) return;
    submitWebOrder(Number(tableId), clientCart);
    setClientCart([]);
    setIsOrderPlaced(true);
  };

  if (isOrderPlaced) {
    return (
      <div className="flex flex-col items-center justify-center p-8 mt-20 text-center animate-in fade-in slide-in-from-bottom-8">
        <CheckCircle2 className="w-24 h-24 text-emerald-500 mb-6" />
        <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Commande Envoyée !</h2>
        <p className="text-slate-500 mb-8 max-w-sm">
          Votre commande a été transmise au bar. {tableId && `Nous vous l'apporterons à la table ${tableId} très bientôt.`}
        </p>
        <Button onClick={() => setIsOrderPlaced(false)} className="w-full max-w-xs shadow-xl shadow-amber-500/20">
          Nouvelle Commande
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 relative min-h-[calc(100vh-4rem)] pb-32">
      {tableId && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 mb-6 flex items-center justify-center">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">
            Table <span className="text-amber-500 text-lg ml-1 font-bold">{tableId}</span>
          </p>
        </div>
      )}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input 
          type="text" 
          placeholder={t('menu.search')} 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white text-slate-900 rounded-xl pl-10 pr-4 py-3 border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
        />
      </div>

      <div className="space-y-4">
        {filteredProducts.map(product => {
          const cartItem = clientCart.find(item => item.product.id === product.id);
          
          return (
            <div key={product.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-4 items-center">
              <MenuImage src={product.imageUrl} alt={product.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-500 mb-1">{product.category}</p>
                <h3 className="font-bold text-slate-900 line-clamp-1 mb-1">{product.name}</h3>
                <p className="text-sm font-medium text-slate-500">{formatPrice(product.price, currency)}</p>
              </div>
              
              <div className="shrink-0 flex items-center justify-center">
                {cartItem ? (
                  <div className="flex flex-col items-center bg-slate-50 p-1 rounded-xl border border-slate-200">
                    <button onClick={() => handleUpdateQuantity(product.id, 1)} className="p-2 hover:bg-white rounded-lg transition-colors active:scale-95" disabled={cartItem.quantity >= product.stock}>
                      <Plus className="w-4 h-4 text-slate-700" />
                    </button>
                    <span className="font-bold text-slate-900 my-1 min-w-[1.5rem] text-center">{cartItem.quantity}</span>
                    <button onClick={() => handleUpdateQuantity(product.id, -1)} className="p-2 hover:bg-white rounded-lg transition-colors active:scale-95">
                      <Minus className="w-4 h-4 text-slate-700" />
                    </button>
                  </div>
                ) : (
                  <Button size="icon" className="h-10 w-10 shadow-md shadow-amber-500/20" onClick={() => handleAddToCart(product)}>
                    <Plus className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Cart for Client */}
      {clientCart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50 transform translate-y-0 transition-transform duration-300">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-500">{totalItems} article{totalItems > 1 ? 's' : ''}</span>
              <span className="text-xl font-extrabold text-slate-900">{formatPrice(cartTotal, currency)}</span>
            </div>
            <Button size="lg" className="flex-1 shadow-lg shadow-amber-500/30" onClick={placeOrder}>
              <ShoppingBag className="w-5 h-5 mr-2" />
              {t('menu.order')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
