import React, { useState, useEffect } from "react";
import { Search, ShoppingCart, X, Plus, Minus, Trash2, Printer, Image, Lock, Edit2, Check, Power } from "lucide-react";
import { useStore } from "../../store/store";
import { formatPrice } from "../../utils/currency";
import { Button } from "../../components/ui/Button";
import { ProductCard } from "../../components/ui/ProductCard";
import { cn } from "../../utils/utils";
import { useTranslation } from "../../utils/i18n";
import { LockScreen } from "../../components/admin/LockScreen";

const CFA_RATE = 655.957;

function CartImage({ src, alt, className }) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [src]);

  if (error || !src || typeof src !== 'string' || src.trim() === '') {
    return (
      <div className={cn("flex items-center justify-center bg-slate-800 text-slate-500", className)}>
        <Image className="w-1/2 h-1/2 opacity-50" />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setError(true)} />;
}

export function POS() {
  const t = useTranslation();
  const { products, cart, removeFromCart, updateCartQuantity, clearCart, checkout, tables, currency, currentCycle, updateCartItemPrice, openCycle, closeCycle } = useStore();

  // ── Sécurité au démarrage : verrouillage par staff actif ─────────────────
  const activeStaff = useStore(state => state.activeStaff);
  const lockScreen  = useStore(state => state.lockScreen);
  const staff       = useStore(state => state.staff);
  const isLoading   = useStore(state => state.isLoading);

  // ── Tous les useState AVANT les retours conditionnels (règle des hooks) ───
  const [searchTerm, setSearchTerm] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState("");
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [tempPrice, setTempPrice] = useState("");

  // staffExists : null pendant le chargement initial du store, boolean ensuite
  const staffExists = isLoading ? null : staff.length > 0;

  // Pendant le chargement initial du store → spinner neutre
  if (staffExists === null) {
    return (
      <div className="flex h-[100dvh] bg-slate-950 items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Si des serveurs existent ET qu'aucun n'est actif → LockScreen (sécurité démarrage)
  if (staffExists && activeStaff === null) {
    return <LockScreen />;
  }

  if (!currentCycle) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] bg-slate-950 p-8 text-center flex-1 w-full">
        <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-800 shadow-2xl">
          <Lock className="w-10 h-10 text-slate-500" />
        </div>
        <h1 className="text-3xl font-bold text-slate-100 mb-4">La Caisse est Fermée</h1>
        <p className="text-slate-400 max-w-md text-lg mb-8">
          Inaccessible : Aucun service n'est actuellement en cours. La grille des produits est verrouillée.
        </p>
        <Button 
          variant="primary" 
          size="lg" 
          className="px-8 py-4 text-lg font-bold shadow-[0_0_20px_rgba(245,158,11,0.4)]"
          onClick={() => {
            if (window.confirm("Ouvrir un nouveau service maintenant en caisse avec l'état actuel des stocks ?")) {
              openCycle();
            }
          }}
        >
          Ouvrir le service maintenant
        </Button>
      </div>
    );
  }

  const filteredProducts = (products ?? []).filter(p =>
    (p?.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p?.category ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const cartTotal  = (cart ?? []).reduce((sum, item) => sum + (Number(item.sellingPrice) || 0) * (Number(item.quantity) || 0), 0);
  const totalItems = (cart ?? []).reduce((sum, item) => sum + (Number(item.quantity)     || 0), 0);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setIsPaymentModalOpen(true);
  };

  const processFinalCheckout = (paymentMethod) => {
    const newOrder = {
      items: [...cart],
      total: cartTotal,
      table: selectedTable,
      paymentMethod: paymentMethod,
      id: Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
      date: new Date()
    };

    checkout(Number(selectedTable) || null, paymentMethod);
    setIsCartOpen(false);
    setSelectedTable("");
    setIsPaymentModalOpen(false);
    setReceiptOrder(newOrder);
  };

  return (
    <div className="flex h-[100dvh] bg-slate-950 overflow-hidden relative">
      
      {/* LEFT: Products Grid */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 border-b border-slate-800 bg-slate-900 z-10">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <h1 className="text-2xl font-bold text-slate-100 hidden md:block">{t('pos.title')}</h1>

            {/* Serveur actif + bouton Changer */}
            {activeStaff && (
              <button
                onClick={lockScreen}
                data-slot="lock-pos-btn"
                className="flex items-center gap-2 bg-slate-800 hover:bg-amber-500/10 hover:border-amber-500/30 border border-slate-700 text-slate-300 hover:text-amber-400 text-sm px-3 py-2 rounded-lg transition-all active:scale-95"
                title="Verrouiller / Changer de serveur"
              >
                <Lock className="w-4 h-4" />
                <span className="hidden md:inline font-medium">{activeStaff.name}</span>
                <span className="hidden md:inline text-slate-500 text-xs">· Changer</span>
              </button>
            )}

            <button 
              onClick={() => {
                if(window.confirm("Voulez-vous vraiment clôturer ce service ? Toutes les écritures de ce cycle seront formellement validées et le stock réel figé.")) {
                  closeCycle();
                }
              }}
              className="group flex-1 md:flex-none flex items-center justify-center md:justify-start gap-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 text-sm p-2 rounded-lg transition-all border border-transparent hover:border-red-500/20 active:scale-95"
              title="Clôturer la Caisse"
            >
              <Power className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="hidden md:inline font-medium uppercase tracking-wider text-xs">Clôturer la Caisse</span>
            </button>
          </div>
          
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input 
              type="text" 
              placeholder={t('pos.search')} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 text-slate-100 rounded-lg pl-10 pr-4 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Product Grid Area */}
        <div className="flex-1 overflow-y-auto p-2 md:p-4 z-0 no-scrollbar">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 pb-24 md:pb-4">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-500">
                Aucun produit trouvé.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Cart Sidebar / Drawer */}
      {/* Mobile Backdrop */}
      {isCartOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[90] lg:hidden"
          onClick={() => setIsCartOpen(false)}
        />
      )}

      {/* The Cart Panel - High z-index to clear the navigation on mobile */}
      <div className={cn(
        "fixed lg:static inset-y-0 right-0 w-full md:w-96 bg-slate-900 border-l border-slate-800 z-[100] flex flex-col transition-transform duration-300 ease-in-out lg:transform-none lg:h-full h-[100dvh]",
        isCartOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-amber-500" />
            {t('pos.cart')}
          </h2>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setIsCartOpen(false)}>
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
              <ShoppingCart className="h-16 w-16 opacity-20" />
              <p>{t('pos.empty_cart')}</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <CartImage src={item.product.imageUrl} alt={item.product.name} className="h-16 w-16 rounded-lg object-cover bg-slate-800 shrink-0" />
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold text-sm line-clamp-1">{item.product.name}</h4>
                    <button 
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-slate-500 hover:text-red-500 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    {editingPriceId === item.product.id ? (
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          value={tempPrice} 
                          onChange={(e) => setTempPrice(e.target.value)} 
                          className="w-16 bg-slate-950 border border-slate-800 rounded p-1 text-xs text-amber-500 focus:outline-none focus:border-amber-500 font-bold"
                          autoFocus
                        />
                        <button onClick={() => {
                          updateCartItemPrice(item.product.id, Number(tempPrice) / CFA_RATE);
                          setEditingPriceId(null);
                        }} className="text-emerald-500 hover:bg-emerald-500/10 p-1 rounded transition-colors"><Check className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 group/price">
                        <span className="text-amber-500 font-bold text-sm">
                          {formatPrice(item.sellingPrice * item.quantity, currency)}
                        </span>
                        <div className="text-[10px] text-slate-500 ml-1">({formatPrice(item.sellingPrice, currency)}/u)</div>
                        <button onClick={() => {
                          setEditingPriceId(item.product.id);
                          setTempPrice(Math.round(item.sellingPrice * CFA_RATE));
                        }} className="text-slate-500 lg:opacity-0 group-hover/price:opacity-100 transition-opacity p-1 z-10 hover:text-amber-500">
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center space-x-2 bg-slate-900 rounded-lg p-1 border border-slate-800">
                      <button 
                        onClick={() => updateCartQuantity(item.product.id, -1)}
                        className="text-slate-400 hover:text-white p-1"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-semibold w-6 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateCartQuantity(item.product.id, 1)}
                        className="bg-slate-800 text-slate-100 hover:text-white rounded p-1 disabled:opacity-50"
                        disabled={item.quantity >= item.product.stock}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout Section - Adjusted padding for mobile to clear the Bottom Bar */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 rounded-t-3xl lg:rounded-none shrink-0 pb-[max(env(safe-area-inset-bottom,1rem),1rem)] lg:pb-6">
          {/* Table Details */}
          <div className="mb-4">
            <label className="text-sm text-slate-400 mb-2 block">Associer une Table (Optionnel)</label>
            <select 
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">{t('pos.table_select')}</option>
              {tables.map(t => (
                <option key={t.id} value={t.number}>Table {t.number} ({t.status})</option>
              ))}
            </select>
          </div>

          <div className="flex justify-between mb-4">
            <span className="text-slate-400">{t('pos.total')} ({totalItems} articles)</span>
            <span className="text-2xl font-bold text-amber-500">{formatPrice(cartTotal, currency)}</span>
          </div>
          
          <Button 
            variant="primary" 
            size="lg" 
            className="w-full relative overflow-hidden group py-4 text-lg font-bold"
            disabled={cart.length === 0}
            onClick={handleCheckout}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <Printer className="h-5 w-5" /> {t('pos.checkout')}
            </span>
            <div className="absolute inset-0 bg-amber-400 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-lg duration-300" />
          </Button>
        </div>
      </div>

      {/* Floating Action Button for Mobile Cart */}
      {!isCartOpen && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="lg:hidden fixed bottom-6 right-4 h-16 w-16 bg-amber-500 text-slate-950 rounded-full shadow-[0_4px_20px_rgba(245,158,11,0.5)] flex items-center justify-center z-[80] transition-transform active:scale-90"
        >
          <div className="relative">
            <ShoppingCart className="h-7 w-7" />
            {totalItems > 0 && (
              <span className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center border-2 border-slate-950 animate-bounce">
                {totalItems}
              </span>
            )}
          </div>
        </button>
      )}

      {/* PAYMENT METHOD MODAL - Even higher z-index */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-100 uppercase tracking-wider">Mode de Paiement</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'Espèces', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' },
                { id: 'Mobile Money', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20' },
                { id: 'Carte Bancaire', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20' }
              ].map((method) => (
                <button
                  key={method.id}
                  onClick={() => processFinalCheckout(method.id)}
                  className={cn(
                    "flex items-center justify-between p-5 rounded-2xl border transition-all text-lg font-bold group active:scale-95",
                    method.color
                  )}
                >
                  <span>{method.id}</span>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                    <Plus className="h-5 w-5" />
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center">
              <span className="text-slate-400 font-medium">Total à payer</span>
              <span className="text-2xl font-black text-white">{formatPrice(cartTotal, currency)}</span>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL FOR PREVIEW AND PRINT */}
      {receiptOrder && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm no-print" style={{ pointerEvents: 'auto' }}>
          <div className="relative bg-white shadow-2xl rounded-2xl flex flex-col w-[350px] animate-in fade-in zoom-in-95 overflow-hidden">

            <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-100 no-print">
              <h3 className="font-bold text-slate-800">Apercu du ticket</h3>
              <button onClick={() => setReceiptOrder(null)} className="text-slate-400 hover:text-red-500 no-print">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[70vh] no-scrollbar p-6 flex justify-center bg-slate-50">

              <div id="printable-receipt" className="font-mono text-sm leading-tight text-black bg-white shadow-sm w-[300px] shrink-0 p-4" style={{ fontFamily: "'Courier New', Courier, monospace" }}>

                <div className="text-center mb-2">
                  <h1 className="font-bold text-lg uppercase mb-1">{restaurant?.nom || 'MBS APP'}</h1>
                  <p className="text-[10px]">
                    {receiptOrder.date.toLocaleDateString('fr-FR')} - {receiptOrder.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-[10px] mt-1">Ticket N: {receiptOrder.id}</p>
                  {receiptOrder.table && <p className="text-[10px] font-bold mt-1">Table {receiptOrder.table}</p>}
                </div>

                <div className="text-center text-[10px] tracking-widest my-1 select-none receipt-separator">
                  ================================
                </div>

                <div className="flex flex-col space-y-0.5 my-2">
                  {receiptOrder.items.map(item => (
                    <div key={item.product.id}>
                      <div className="flex justify-between items-start text-[11px]">
                        <span className="flex-1 pr-2">
                          {item.quantity}x {item.product.name}
                        </span>
                        <span className="font-bold shrink-0">
                          {formatPrice(item.sellingPrice * item.quantity, currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-center text-[10px] tracking-widest my-1 select-none receipt-separator">
                  ================================
                </div>

                <div className="flex justify-between items-center my-2">
                  <span className="text-sm font-extrabold uppercase">TOTAL</span>
                  <span className="text-base font-extrabold">{formatPrice(receiptOrder.total, currency)}</span>
                </div>

                <div className="text-center text-[10px] mt-1 uppercase font-bold">
                  Paiement : {receiptOrder.paymentMethod || 'Especes'}
                </div>

                <div className="text-center text-[10px] mt-4 mb-1">
                  <p className="receipt-separator">--------------------------------</p>
                  <p className="mt-1">Merci de votre visite !</p>
                  <p className="font-bold">A bientot</p>
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-100 no-print">
              <Button onClick={() => window.print()} className="w-full flex justify-center py-3 no-print" variant="primary">
                <Printer className="w-5 h-5 mr-2" /> Imprimer le ticket
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
