import React, { useState, useEffect } from "react";
import {
  Search, Plus, Minus, Edit2, Trash2, X, Image,
  AlertTriangle, Package, Activity, Lock, Unlock, ShieldAlert, KeyRound, Copy
} from "lucide-react";
import { useStore } from "../../store/store";
import { formatPrice } from "../../utils/currency";
import { cn } from "../../utils/utils";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useTranslation } from "../../utils/i18n";
import { calculateHistoricalStock } from "../../utils/stock";

const CFA_RATE = 655.957;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function InventoryImage({ src, alt }) {
  const [error, setError] = useState(false);
  useEffect(() => { setError(false); }, [src]);
  if (error || !src || src.trim() === '') {
    return (
      <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
        <Image className="w-6 h-6 text-slate-500 opacity-50" />
      </div>
    );
  }
  return <img src={src} alt={alt} className="w-12 h-12 rounded-lg object-cover shrink-0" onError={() => setError(true)} />;
}

// ─── Date range quick pills ───────────────────────────────────────────────────
function DatePills({ getLocalISODate, onSelect }) {
  const today = getLocalISODate();
  return (
    <div className="flex flex-wrap gap-2">
      {[
        { label: "Aujourd'hui", fn: () => onSelect(today, today) },
        { label: "Hier", fn: () => {
          const d = new Date(); d.setDate(d.getDate() - 1);
          const y = getLocalISODate(d); onSelect(y, y);
        }},
        { label: "7 derniers jours", fn: () => {
          const d = new Date(); d.setDate(d.getDate() - 6);
          onSelect(getLocalISODate(d), today);
        }},
      ].map(p => (
        <button
          key={p.label}
          onClick={p.fn}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700 whitespace-nowrap"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function Inventory() {
  const t = useTranslation();
  const { products, currency, addProduct, updateProduct, deleteProduct, adjustStock, movements } = useStore();

  const getLocalISODate = (dateVal = new Date()) => {
    const d = new Date(dateVal);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const todayStr = getLocalISODate();

  // ── Date range state ──
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const isToday = startDate === todayStr && endDate === todayStr;
  const isFuture = endDate > todayStr || startDate > todayStr;

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("stock");

  // ── Product modal state ──
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '', category: 'Cocktails',
    price: '', costPrice: '',
    stock: '20',   // ← default stock = 20
    minStock: 5, imageUrl: ''
  });

  // ── Movement modal state ──
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementData, setMovementData] = useState({
    product: null, type: 'IN', quantity: 1,
    reason: 'Livraison Fournisseur', newCostPrice: '',
    isSecured: false  // true = came through PIN unlock
  });

  // ── Stock security (PIN 0000) ──
  const [isStockUnlocked, setIsStockUnlocked] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pendingClick, setPendingClick] = useState(null); // {product, type}

  // ─── Computed products (retropolation) ─────────────────────────────────────
  const computedProducts = isToday || isFuture
    ? products
    : products.map(p => ({
        ...p,
        stock: calculateHistoricalStock(p.id, endDate, products, movements)
      }));

  const filteredProducts = computedProducts.filter(p =>
    (p.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.category ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ─── Movements filter (date range, all types) ──────────────────────────────
  const filteredMovements = (movements || []).filter(m => {
    const d = getLocalISODate(m.date);
    return d >= startDate && d <= endDate;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalIN = filteredMovements.filter(m => m.type === 'IN').reduce((s, m) => s + m.quantity, 0);
  const totalOUT = filteredMovements.filter(m => m.type === 'OUT').reduce((s, m) => s + m.quantity, 0);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleOpenAdd = () => {
    console.log('[Inventory] Ouverture modal ajout — store snapshot:', {
      restaurantId: useStore.getState().auth?.restaurant?.id,
      productsCount: useStore.getState().products?.length,
      isLoading: useStore.getState().isLoading,
    });
    setEditingProduct(null);
    setFormData({ name: '', category: 'Cocktails', price: '', costPrice: '', stock: '20', minStock: 5, imageUrl: '' });
    setIsModalOpen(true);
  };

  const handleDuplicate = (product) => {
    setEditingProduct(null); // mode ajout
    setFormData({
      name: product.name + ' (Copie)',
      category: product.category,
      price: Math.round(product.price * CFA_RATE),
      costPrice: Math.round((product.costPrice ?? 0) * CFA_RATE),
      stock: '20',  // stock par défaut
      minStock: product.minStock,
      imageUrl: product.imageUrl || ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      price: Math.round(product.price * CFA_RATE),
      costPrice: Math.round((product.costPrice ?? 0) * CFA_RATE),
      stock: product.stock,
      minStock: product.minStock,
      imageUrl: product.imageUrl || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm("Voulez-vous vraiment supprimer ce produit ?")) deleteProduct(id);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingProduct) {
      updateProduct(editingProduct.id, {
        name: formData.name,
        category: formData.category,
        price: Number(formData.price) / CFA_RATE,
        costPrice: Number(formData.costPrice) / CFA_RATE,
        minStock: Number(formData.minStock),
        imageUrl: formData.imageUrl
      });
    } else {
      addProduct({
        name: formData.name,
        category: formData.category,
        price: Number(formData.price) / CFA_RATE,
        costPrice: Number(formData.costPrice) / CFA_RATE,
        stock: Number(formData.stock) || 20,
        minStock: Number(formData.minStock),
        imageUrl: formData.imageUrl
      });
    }
    setIsModalOpen(false);
  };

  // ── Stock security: clicking +/- ──────────────────────────────────────────
  const handleStockAdjustClick = (product, type) => {
    if (!isStockUnlocked) {
      // Need PIN first
      setPendingClick({ product, type });
      setPinInput('');
      setPinError(false);
      setPinModalOpen(true);
    } else {
      // Already unlocked — open movement modal with secured reason
      setMovementData({
        product, type, quantity: 1,
        reason: 'Correction Manuelle (Code Sécurité)',
        newCostPrice: '', isSecured: true
      });
      setMovementModalOpen(true);
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === '0000') {
      setIsStockUnlocked(true);
      setPinModalOpen(false);
      setPinError(false);
      if (pendingClick) {
        const { product, type } = pendingClick;
        setMovementData({
          product, type, quantity: 1,
          reason: 'Correction Manuelle (Code Sécurité)',
          newCostPrice: '', isSecured: true
        });
        setMovementModalOpen(true);
        setPendingClick(null);
      }
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const handleMovementSubmit = (e) => {
    e.preventDefault();
    const newCostPriceEUR = movementData.type === 'IN' && movementData.newCostPrice
      ? Number(movementData.newCostPrice) / CFA_RATE
      : null;
    adjustStock(movementData.product.id, movementData.type, Number(movementData.quantity), movementData.reason, newCostPriceEUR);
    setMovementModalOpen(false);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 flex flex-col bg-slate-950 overflow-y-auto w-full no-scrollbar pb-24 min-h-full">

      {/* ── HEADER ── */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100">{t('inventory.title')}</h1>
            {/* Stock lock status badge */}
            <button
              onClick={() => { if (!isStockUnlocked) { setPinInput(''); setPinError(false); setPinModalOpen(true); } }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all",
                isStockUnlocked
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 cursor-pointer"
              )}
              title={isStockUnlocked ? "Ajustements déverrouillés pour cette session" : "Cliquer pour déverrouiller les ajustements de stock"}
            >
              {isStockUnlocked
                ? <><Unlock className="w-3 h-3" /> Déverrouillé</>
                : <><Lock className="w-3 h-3" /> Verrouillé</>
              }
            </button>
          </div>
        </div>

        {/* Date range selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <DatePills
              getLocalISODate={getLocalISODate}
              onSelect={(s, e) => { setStartDate(s); setEndDate(e); }}
            />
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
              <input
                type="date" value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent text-slate-100 text-sm focus:ring-0 p-1 [&::-webkit-calendar-picker-indicator]:invert cursor-pointer outline-none w-28"
              />
              <span className="text-slate-500">→</span>
              <input
                type="date" value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent text-slate-100 text-sm focus:ring-0 p-1 [&::-webkit-calendar-picker-indicator]:invert cursor-pointer outline-none w-28"
              />
            </div>
            {!isToday && (
              <button
                onClick={() => { setStartDate(todayStr); setEndDate(todayStr); }}
                className="text-xs text-amber-500 hover:text-amber-400 font-semibold transition-colors whitespace-nowrap"
              >
                ← Aujourd'hui
              </button>
            )}
          </div>
          {!isToday && !isFuture && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Package className="w-3 h-3" />
              Stock rétropolé au {endDate} — valeurs calculées à partir de l'historique des mouvements.
            </p>
          )}
          {isFuture && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              Période future détectée — affichage du stock actuel uniquement.
            </p>
          )}
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-2 border-b border-slate-800 pb-4 mb-6">
        <button
          onClick={() => setActiveTab('stock')}
          className={cn("px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 text-sm",
            activeTab === 'stock' ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-400 hover:text-slate-100")}
        >
          <Package className="w-4 h-4" /> État des Stocks
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={cn("px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 text-sm",
            activeTab === 'movements' ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-400 hover:text-slate-100")}
        >
          <Activity className="w-4 h-4" /> Mouvements de Stock
        </button>
      </div>

      {/* ══════════════════════════════════════════════
          TAB: ÉTAT DES STOCKS
      ══════════════════════════════════════════════ */}
      {activeTab === 'stock' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden mb-8">
          {/* Search + Add */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text" placeholder={t('pos.search')} value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 text-slate-100 rounded-lg pl-10 pr-4 py-2 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              />
            </div>
            {isToday && (
              <Button variant="primary" className="shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.3)]" onClick={handleOpenAdd}>
                <Plus className="w-5 h-5 md:mr-2" />
                <span className="hidden md:inline">{t('inventory.new')}</span>
              </Button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase w-16">Image</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Nom</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Catégorie</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Prix Vente</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Coût Achat</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase">
                    {isToday ? "Stock Actuel" : `Stock au ${endDate}`}
                  </th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Statut</th>
                  {isToday && <th className="p-4 text-xs font-semibold text-slate-400 uppercase text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredProducts.map(product => {
                  const isOutOfStock = product.stock === 0;
                  const isLowStock = product.stock > 0 && product.stock <= product.minStock;
                  return (
                    <tr key={product.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                      <td className="p-4"><InventoryImage src={product.imageUrl} alt={product.name} /></td>
                      <td className="p-4 font-bold text-slate-200">{product.name}</td>
                      <td className="p-4 text-slate-400">{product.category}</td>
                      <td className="p-4 font-mono text-slate-300">{formatPrice(product.price, currency)}</td>
                      <td className="p-4 font-mono text-slate-400 text-xs">
                        {product.costPrice != null && product.costPrice > 0
                          ? formatPrice(product.costPrice)
                          : (
                            <span className="inline-flex items-center gap-1 text-amber-500" title="Coût d'achat non saisi — la marge et le CUMP seront incorrects">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              Non défini
                            </span>
                          )
                        }
                      </td>
                      <td className="p-4 font-mono">
                        <span className={isOutOfStock ? "text-red-500" : isLowStock ? "text-amber-500" : "text-emerald-500"}>
                          {product.stock}
                        </span>
                        <span className="text-slate-500 text-xs ml-1">/ min {product.minStock}</span>
                      </td>
                      <td className="p-4">
                        {isOutOfStock ? <Badge variant="danger">Rupture</Badge>
                          : isLowStock ? <Badge variant="warning">Faible</Badge>
                          : <Badge variant="success">En Stock</Badge>}
                      </td>
                      {isToday && (
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* +/- buttons — locked until PIN */}
                            <Button
                              variant="ghost" size="icon"
                              className={cn(
                                "h-8 w-8 transition-all",
                                isStockUnlocked
                                  ? "text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10"
                                  : "text-slate-600 hover:text-amber-500 hover:bg-amber-500/10"
                              )}
                              title={isStockUnlocked ? "Entrée de stock" : "Déverrouiller pour ajuster le stock"}
                              onClick={() => handleStockAdjustClick(product, 'IN')}
                            >
                              {isStockUnlocked ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className={cn(
                                "h-8 w-8 transition-all",
                                isStockUnlocked
                                  ? "text-slate-400 hover:text-red-500 hover:bg-red-500/10"
                                  : "text-slate-600 hover:text-amber-500 hover:bg-amber-500/10"
                              )}
                              title={isStockUnlocked ? "Sortie de stock" : "Déverrouiller pour ajuster le stock"}
                              onClick={() => handleStockAdjustClick(product, 'OUT')}
                            >
                              {isStockUnlocked ? <Minus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                            </Button>
                            <div className="w-px h-4 bg-slate-800 mx-1" />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10"
                              title="Dupliquer ce produit" onClick={() => handleDuplicate(product)}>
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-amber-500" onClick={() => handleOpenEdit(product)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleDelete(product.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={isToday ? 8 : 7} className="p-8 text-center text-slate-500">
                      Aucun produit trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB: MOUVEMENTS DE STOCK
      ══════════════════════════════════════════════ */}
      {activeTab === 'movements' && (
        <div className="space-y-4 animate-in fade-in zoom-in-95">

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Total Entrées</p>
                <p className="text-2xl font-black text-emerald-400">+{totalIN}</p>
                <p className="text-[10px] text-slate-500">unités sur la période</p>
              </div>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                <Minus className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Total Sorties</p>
                <p className="text-2xl font-black text-red-400">-{totalOUT}</p>
                <p className="text-[10px] text-slate-500">unités sur la période</p>
              </div>
            </div>
          </div>

          {/* Movements table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-500" />
                Journal des Mouvements
              </h2>
              <Badge className="bg-slate-800 text-slate-400">{filteredMovements.length} entrées</Badge>
            </div>
            <div className="overflow-x-auto min-h-[300px] max-h-[550px] overflow-y-auto no-scrollbar">
              {filteredMovements.length > 0 ? (
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50 sticky top-0">
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Date / Heure</th>
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Produit</th>
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Opération</th>
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Motif</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {filteredMovements.map(m => (
                      <tr key={m.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 text-slate-400 whitespace-nowrap text-xs">
                          {new Date(m.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                          {' '}
                          {new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4 font-bold text-slate-200">{m.productName}</td>
                        <td className="p-4">
                          <Badge variant={m.type === 'IN' ? 'success' : 'danger'} className="flex items-center gap-1 w-fit">
                            {m.type === 'IN' ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                            {m.type === 'IN' ? '+' : '-'}{m.quantity}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-300 text-sm">
                          {m.reason}
                          {m.reason === 'Correction Manuelle (Code Sécurité)' && (
                            <span className="ml-2 text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded px-1.5 py-0.5">🔒 Sécurisé</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-12 text-slate-500">
                  <Activity className="w-12 h-12 opacity-20 mb-4" />
                  <p>Aucun mouvement de stock sur cette période.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODAL: PIN de Sécurité Stock
      ══════════════════════════════════════════════ */}
      {pinModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-100 mb-1">Accès Sécurisé</h2>
              <p className="text-slate-400 text-sm mb-6">
                Entrez le code de sécurité pour débloquer les ajustements de stock pour cette session.
              </p>
              <form onSubmit={handlePinSubmit} className="space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pinInput}
                  onChange={e => { setPinInput(e.target.value); setPinError(false); }}
                  placeholder="• • • •"
                  autoFocus
                  className={cn(
                    "w-full bg-slate-950 border rounded-xl px-4 py-3 text-slate-100 text-center text-2xl tracking-[0.5em] focus:ring-2 focus:ring-amber-500 outline-none transition-all",
                    pinError ? "border-red-500 focus:ring-red-500" : "border-slate-700"
                  )}
                />
                {pinError && (
                  <p className="text-red-400 text-sm font-semibold flex items-center justify-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Accès refusé — Code incorrect.
                  </p>
                )}
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setPinModalOpen(false); setPendingClick(null); }}>
                    Annuler
                  </Button>
                  <Button type="submit" variant="primary" className="flex-1">
                    <KeyRound className="w-4 h-4 mr-2" /> Déverrouiller
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODAL: Ajout / Édition Produit
      ══════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center p-4 border-b border-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-100">{editingProduct ? "Modifier le produit" : "Ajouter un produit"}</h2>
              <button className="text-slate-400 hover:text-white transition-colors" onClick={() => setIsModalOpen(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto no-scrollbar">
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Nom *</label>
                  <input required type="text" value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Catégorie</label>
                    <select required value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none">
                      {/* value = anglais (filtrage interne), texte = français (affichage) */}
                      <option value="Cocktails">Cocktails</option>
                      <option value="Beers">Bières</option>
                      <option value="Spirits">Spiritueux</option>
                      <option value="Softs">Boissons Gazeuses</option>
                      <option value="Snacks">Nourriture</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Prix de Vente (FCFA) *</label>
                    <input required type="number" min="0" value={formData.price}
                      onChange={e => setFormData({ ...formData, price: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Coût d'Achat (FCFA) *</label>
                    <input required type="number" min="0" value={formData.costPrice}
                      onChange={e => setFormData({ ...formData, costPrice: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Stock Min (Alerte)</label>
                    <input required type="number" min="0" value={formData.minStock}
                      onChange={e => setFormData({ ...formData, minStock: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none" />
                  </div>
                </div>

                {!editingProduct && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Stock Initial <span className="text-slate-600 text-xs font-normal">(défaut : 20)</span>
                    </label>
                    <input type="number" min="0" value={formData.stock}
                      onChange={e => setFormData({ ...formData, stock: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none" />
                  </div>
                )}

                {editingProduct && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-400 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    Pour modifier le stock, utilisez les boutons 🔒 dans la liste (code de sécurité requis).
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">URL de l'image (Optionnel)</label>
                  <input type="url" value={formData.imageUrl}
                    onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
              </div>

              <div className="mt-auto p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900 shrink-0">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Annuler</Button>
                <Button type="submit" variant="primary">Enregistrer</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODAL: Mouvement de Stock (Sécurisé)
      ══════════════════════════════════════════════ */}
      {movementModalOpen && movementData.product && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center p-4 border-b border-slate-800 shrink-0">
              <h2 className={cn("text-xl font-bold flex items-center gap-2",
                movementData.type === 'IN' ? 'text-emerald-500' : 'text-red-500')}>
                {movementData.type === 'IN' ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                {movementData.type === 'IN' ? 'Entrée de Stock' : 'Sortie de Stock'}
              </h2>
              <button className="text-slate-400 hover:text-white" onClick={() => setMovementModalOpen(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleMovementSubmit} className="flex flex-col flex-1">
              <div className="p-4 space-y-4">
                {/* Product info */}
                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <InventoryImage src={movementData.product.imageUrl} alt={movementData.product.name} />
                  <div>
                    <p className="font-bold text-slate-200">{movementData.product.name}</p>
                    <p className="text-xs text-slate-500">Stock actuel : <strong className="text-slate-300">{movementData.product.stock}</strong></p>
                    {movementData.product.costPrice > 0 && (
                      <p className="text-xs text-slate-500">Dernier coût : <strong className="text-amber-400">{formatPrice(movementData.product.costPrice, 'CFA')}</strong></p>
                    )}
                  </div>
                </div>

                {/* Type toggle (only for non-secured movements — but still editable here) */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Type d'opération</label>
                  <div className="flex gap-2">
                    {['IN', 'OUT'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setMovementData(prev => ({ ...prev, type: t }))}
                        className={cn(
                          "flex-1 py-2 rounded-lg font-semibold text-sm border transition-all",
                          movementData.type === t
                            ? t === 'IN' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-red-500/20 text-red-400 border-red-500/40"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600"
                        )}
                      >
                        {t === 'IN' ? '➕ Entrée' : '➖ Sortie'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Quantité à {movementData.type === 'IN' ? 'ajouter' : 'retirer'}
                  </label>
                  <input required type="number" min="1" value={movementData.quantity}
                    onChange={e => setMovementData({ ...movementData, quantity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>

                {/* Reason — locked if secured */}
                {movementData.isSecured ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-xs text-amber-400 font-semibold">Motif verrouillé</p>
                      <p className="text-sm text-slate-300">Correction Manuelle (Code Sécurité)</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Motif</label>
                    {movementData.type === 'IN' ? (
                      <select required value={movementData.reason}
                        onChange={e => setMovementData({ ...movementData, reason: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none">
                        <option value="Livraison Fournisseur">Livraison Fournisseur</option>
                        <option value="Retour Client">Retour Client</option>
                        <option value="Ajustement Manuel">Ajustement Manuel</option>
                        <option value="Autre">Autre</option>
                      </select>
                    ) : (
                      <select required value={movementData.reason}
                        onChange={e => setMovementData({ ...movementData, reason: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none">
                        <option value="Casse">Casse / Perte</option>
                        <option value="Péremption">Péremption</option>
                        <option value="Offert au client">Offert au client</option>
                        <option value="Consommation Interne">Consommation Personnel</option>
                        <option value="Ajustement Manuel">Ajustement Manuel</option>
                      </select>
                    )}
                  </div>
                )}

                {/* New cost price — only for IN */}
                {movementData.type === 'IN' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Nouveau Coût d'Achat Unitaire (FCFA)
                    </label>
                    <input type="number" min="0" value={movementData.newCostPrice}
                      placeholder={`Actuel : ${Math.round((movementData.product.costPrice ?? 0) * CFA_RATE)} FCFA`}
                      onChange={e => setMovementData({ ...movementData, newCostPrice: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none" />
                    <p className="text-xs text-slate-500 mt-1">Laissez vide pour conserver le coût actuel.</p>
                  </div>
                )}
              </div>

              <div className="mt-auto p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900 rounded-b-2xl shrink-0">
                <Button type="button" variant="outline" onClick={() => setMovementModalOpen(false)}>Annuler</Button>
                <Button type="submit" variant="primary">Confirmer</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
