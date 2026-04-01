import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Plus, Minus, ShoppingBag, Search, CheckCircle2, Image, Coffee, Loader2 } from "lucide-react";
import { insforge } from "../../lib/insforge";
import { formatPrice } from "../../utils/currency";

function MenuImage({ src, alt, className }) {
  const [error, setError] = useState(false);

  useEffect(() => { setError(false); }, [src]);

  if (error || !src || src.trim() === '') {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className}`}>
        <Image className="w-1/2 h-1/2 opacity-50" />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setError(true)} />;
}

export function PublicMenu() {
  const { restaurantId } = useParams();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get("table");

  const [products, setProducts] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [clientCart, setClientCart] = useState([]);
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [{ data: prods }, { data: restos }] = await Promise.all([
          insforge.database.from('products').select('*').eq('restaurant_id', restaurantId).eq('archived', false),
          insforge.database.from('restaurants').select('*').eq('id', restaurantId)
        ]);
        setProducts((prods || []).filter(p => p.stock > 0));
        setRestaurant(restos?.[0] || null);
      } catch (err) {
        console.error(err);
        setError("Impossible de charger le menu.");
      } finally {
        setLoading(false);
      }
    }
    if (restaurantId) fetchData();
  }, [restaurantId]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categories = [...new Set(filteredProducts.map(p => p.category))];
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
        if (newQty <= 0) return { ...item, quantity: 0 };
        if (newQty <= item.product.stock) return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const placeOrder = async () => {
    if (clientCart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const newOrder = {
        id: 'WEB-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        items: clientCart,
        total: cartTotal,
        table_number: tableId ? Number(tableId) : null,
        status: 'pending',
        timestamp: new Date().toISOString(),
        restaurant_id: restaurantId
      };
      await insforge.database.from('orders').insert([newOrder]);
      if (tableId) {
        await insforge.database.from('tables').update({ status: 'service_demande' }).eq('number', Number(tableId)).eq('restaurant_id', restaurantId);
      }
      setClientCart([]);
      setIsOrderPlaced(true);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'envoi de la commande.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
        <p className="mt-4 text-slate-500">Chargement du menu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <p className="text-red-500 text-lg">{error}</p>
      </div>
    );
  }

  if (isOrderPlaced) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <CheckCircle2 className="w-24 h-24 text-emerald-500 mb-6" />
        <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Commande Envoyee !</h2>
        <p className="text-slate-500 mb-8 max-w-sm">
          Votre commande a ete transmise. {tableId && `Nous vous l'apporterons a la table ${tableId}.`}
        </p>
        <button
          onClick={() => setIsOrderPlaced(false)}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-8 py-3 rounded-xl shadow-lg transition-all active:scale-95"
        >
          Nouvelle Commande
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center justify-center h-16 px-4 max-w-lg mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-slate-950">
              <Coffee className="w-6 h-6" />
            </div>
            <h1 className="font-extrabold text-2xl tracking-tight text-slate-900">
              {restaurant?.nom || "Menu"}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 pb-32">
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
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white text-slate-900 rounded-xl pl-10 pr-4 py-2.5 border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
          />
        </div>

        {categories.map(category => (
          <div key={category} className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-3 px-1">{category}</h2>
            <div className="space-y-3">
              {filteredProducts.filter(p => p.category === category).map(product => {
                const cartItem = clientCart.find(item => item.product.id === product.id);
                return (
                  <div key={product.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-4 items-center">
                    <MenuImage src={product.image_url} alt={product.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 line-clamp-1 mb-1">{product.name}</h3>
                      <p className="text-sm font-medium text-slate-500">{formatPrice(product.price, 'CFA')}</p>
                    </div>
                    <div className="shrink-0">
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
                        <button onClick={() => handleAddToCart(product)} className="h-10 w-10 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-md flex items-center justify-center transition-all active:scale-95">
                          <Plus className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {products.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <Coffee className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>Aucun produit disponible pour le moment.</p>
          </div>
        )}
      </main>

      {/* Floating Bottom Cart */}
      {clientCart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-500">{totalItems} article{totalItems > 1 ? 's' : ''}</span>
              <span className="text-xl font-extrabold text-slate-900">{formatPrice(cartTotal, 'CFA')}</span>
            </div>
            <button
              onClick={placeOrder}
              disabled={isSubmitting}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold px-6 py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <ShoppingBag className="w-5 h-5" />
              {isSubmitting ? 'Envoi...' : 'Commander'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
