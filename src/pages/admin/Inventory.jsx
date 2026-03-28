import React, { useState, useEffect } from "react";
import { Search, Plus, Minus, Edit2, Trash2, X, Image, Calendar, AlertTriangle, Package, Activity } from "lucide-react";
import { useStore } from "../../store/store";
import { formatPrice } from "../../utils/currency";
import { cn } from "../../utils/utils";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useTranslation } from "../../utils/i18n";
import { calculateHistoricalStock } from "../../utils/stock";

const CFA_RATE = 655.957;

function InventoryImage({ src, alt }) {
  const [error, setError] = useState(false);
  
  useEffect(() => {
    setError(false);
  }, [src]);

  if (error || !src || src.trim() === '') {
    return (
      <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
        <Image className="w-6 h-6 text-slate-500 opacity-50" />
      </div>
    );
  }
  return (
    <img 
      src={src} 
      alt={alt} 
      className="w-12 h-12 rounded-lg object-cover shrink-0" 
      onError={() => setError(true)} 
    />
  );
}

export function Inventory() {
  const t = useTranslation();
  const { products, currency, addProduct, updateProduct, deleteProduct, adjustStock, movements } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  
  const getLocalISODate = (dateVal = new Date()) => {
    const d = new Date(dateVal);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalISODate();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const isToday = selectedDate === todayStr;

  const [activeTab, setActiveTab] = useState("stock"); // "stock" | "movements"

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Cocktails',
    price: '',
    stock: '',
    minStock: 5,
    imageUrl: '',
    unitCost: ''
  });
  const [movementData, setMovementData] = useState({
    product: null,
    type: 'IN',
    quantity: 1,
    reason: 'Livraison Fournisseur',
    unitCost: ''
  });

  const computedProducts = isToday ? products : products.map(p => {
    return {
      ...p,
      stock: calculateHistoricalStock(p.id, selectedDate, products, movements)
    };
  });

  const filteredProducts = computedProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredManualMovements = (movements || []).filter(m => 
    getLocalISODate(m.date) === selectedDate && 
    !m.reason.startsWith('Vente') && 
    !m.reason.startsWith('Annulation Commande')
  );

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({ name: '', category: 'Cocktails', price: '', stock: '', minStock: 5, imageUrl: '', unitCost: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      price: Math.round(product.price * CFA_RATE), // Display in CFA
      stock: product.stock,
      minStock: product.minStock,
      imageUrl: product.imageUrl || '',
      unitCost: '' // Not used in edit
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm("Voulez-vous vraiment supprimer ce produit ?")) {
      deleteProduct(id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingProduct) {
      updateProduct(editingProduct.id, {
        ...formData,
        price: Number(formData.price) / CFA_RATE, // Convert back to EUR
        stock: Number(formData.stock),
        minStock: Number(formData.minStock)
      });
    } else {
      addProduct({
        ...formData,
        price: Number(formData.price) / CFA_RATE, // Convert back to EUR
        stock: Number(formData.stock),
        minStock: Number(formData.minStock),
        unitCost: Number(formData.unitCost) / CFA_RATE // Convert back to EUR
      });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="p-4 md:p-8 flex flex-col h-full bg-slate-950 overflow-y-auto w-full no-scrollbar pb-24">
      
      {/* GLOBAL HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-100">{t('inventory.title')}</h1>
          {isToday ? (
            <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 hidden sm:inline-flex">Aujourd'hui</Badge>
          ) : (
            <button onClick={() => setSelectedDate(todayStr)} className="hidden sm:inline-flex items-center outline-none">
              <Badge variant="outline" className="text-slate-400 border-slate-700 cursor-pointer hover:text-amber-500 hover:border-amber-500/50 transition-colors">
                Retour à aujourd'hui
              </Badge>
            </button>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {/* Global Date Filter for Inventory */}
          <label className={cn(
            "flex items-center gap-3 transition-colors border rounded-xl px-4 py-2 cursor-pointer focus-within:ring-2 focus-within:ring-amber-500 flex-1 md:flex-none h-[42px]",
            isToday ? "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20" : "bg-slate-900 border-slate-800 hover:bg-slate-800"
          )}>
            <Calendar className={cn("w-5 h-5 shrink-0", isToday ? "text-amber-500" : "text-slate-400")} />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-slate-100 font-medium focus:ring-0 p-0 m-0 [&::-webkit-calendar-picker-indicator]:invert cursor-pointer outline-none"
            />
          </label>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex gap-2 border-b border-slate-800 pb-4 mb-6">
         <button 
           onClick={() => setActiveTab('stock')}
           className={cn("px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2", activeTab === 'stock' ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-400 hover:text-slate-100")}
         >
           <Package className="w-4 h-4" />
           État des Stocks
         </button>
         <button 
           onClick={() => setActiveTab('movements')}
           className={cn("px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2", activeTab === 'movements' ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-400 hover:text-slate-100")}
         >
           <Activity className="w-4 h-4" />
           Mouvements de Stock
         </button>
      </div>

      {/* TAB CONTENT: STOCK */}
      {activeTab === 'stock' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col flex-none mb-8 overflow-hidden relative max-h-[70vh]">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input 
                type="text" 
                placeholder={t('pos.search')} 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 text-slate-100 rounded-lg pl-10 pr-4 py-2 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              />
            </div>
            {isToday && (
              <Button variant="primary" className="shadow-[0_0_15px_rgba(245,158,11,0.3)] shrink-0" onClick={handleOpenAdd}>
                <Plus className="w-5 h-5 md:mr-2" />
                <span className="hidden md:inline">{t('inventory.new')}</span>
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase w-16">Image</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Nom</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Catégorie</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Prix</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase">
                    {isToday ? "Stock Actuel" : "Stock Rétropolé"}
                  </th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Statut</th>
                  {isToday && <th className="p-4 text-xs font-semibold text-slate-400 uppercase text-right">Actions Manuelles</th>}
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredProducts.map(product => {
                  const isOutOfStock = product.stock === 0;
                  const isLowStock = product.stock > 0 && product.stock <= product.minStock;

                  return (
                    <tr key={product.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                      <td className="p-4">
                        <InventoryImage src={product.imageUrl} alt={product.name} />
                      </td>
                      <td className="p-4 font-bold text-slate-200">{product.name}</td>
                      <td className="p-4 text-slate-400">{product.category}</td>
                      <td className="p-4 font-mono text-slate-300">{formatPrice(product.price, currency)}</td>
                      <td className="p-4 font-mono">
                        <span className={isOutOfStock ? "text-red-500" : isLowStock ? "text-amber-500" : "text-emerald-500"}>
                          {product.stock}
                        </span>
                        <span className="text-slate-500 text-xs ml-1">/ min {product.minStock}</span>
                      </td>
                      <td className="p-4">
                        {isOutOfStock ? (
                          <Badge variant="danger">Rupture</Badge>
                        ) : isLowStock ? (
                          <Badge variant="warning">Faible</Badge>
                        ) : (
                          <Badge variant="success">En Stock</Badge>
                        )}
                      </td>
                      {isToday && (
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 hover:border hover:border-emerald-500/20" 
                                    title="Entrée de stock" 
                                    onClick={() => {
                                      setMovementData({ product, type: 'IN', quantity: 1, reason: 'Livraison Fournisseur', unitCost: '' });
                                      setMovementModalOpen(true);
                                    }}>
                              <Plus className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-500/10 hover:border hover:border-red-500/20" 
                                    title="Sortie de stock" 
                                    onClick={() => {
                                      setMovementData({ product, type: 'OUT', quantity: 1, reason: 'Casse' });
                                      setMovementModalOpen(true);
                                    }}>
                              <Minus className="w-4 h-4" />
                            </Button>
                            <div className="w-px h-4 bg-slate-800 mx-1"></div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-amber-500" onClick={() => handleOpenEdit(product)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-500/10 hover:border hover:border-red-500/20" onClick={() => handleDelete(product.id)}>
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
                    <td colSpan={isToday ? 7 : 6} className="p-8 text-center text-slate-500">
                      Aucun produit trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: MOVEMENTS */}
      {activeTab === 'movements' && (
        <div className="animate-in fade-in zoom-in-95">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
               <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                 <AlertTriangle className="w-5 h-5 text-amber-500"/>
                 Mouvements Manuels et Corrections
               </h2>
               <Badge className="bg-slate-800 text-slate-400">{filteredManualMovements.length} Mouvements</Badge>
            </div>
            
            <div className="overflow-x-auto min-h-[400px]">
              {filteredManualMovements.length > 0 ? (
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50">
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Heure</th>
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Produit</th>
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Opération</th>
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Motif</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {filteredManualMovements.map(m => (
                      <tr key={m.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 text-slate-400 whitespace-nowrap">{new Date(m.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                        <td className="p-4 font-bold text-slate-200">{m.productName}</td>
                        <td className="p-4">
                          <Badge variant={m.type === 'IN' ? 'success' : 'danger'} className="flex items-center gap-1 w-fit">
                            {m.type === 'IN' ? <Plus className="w-3 h-3"/> : <Minus className="w-3 h-3"/>}
                            {m.quantity}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-300">{m.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-12 text-slate-500">
                  <Activity className="w-12 h-12 opacity-20 mb-4" />
                  <p>Aucun ajustement manuel enregistré à cette date.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center p-4 border-b border-slate-800">
              <h2 className="text-xl font-bold text-slate-100">{editingProduct ? "Modifier le produit" : "Ajouter un produit"}</h2>
              <button className="text-slate-400 hover:text-white transition-colors" onClick={() => setIsModalOpen(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Nom *</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Catégorie</label>
                    <select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500">
                      <option value="Cocktails">Cocktails</option>
                      <option value="Beers">Beers</option>
                      <option value="Spirits">Spirits</option>
                      <option value="Softs">Softs</option>
                      <option value="Snacks">Snacks</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Prix de Vente (FCFA) *</label>
                    <input required type="number" min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Stock Actuel {editingProduct && <span className="text-amber-500 text-xs ml-2">(Lecture Seule)</span>}</label>
                    <input 
                      required 
                      type="number" 
                      min="0" 
                      value={formData.stock} 
                      onChange={e => setFormData({...formData, stock: e.target.value})} 
                      readOnly={!!editingProduct}
                      className={cn(
                        "w-full rounded-lg p-3 text-slate-100 border focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors",
                        editingProduct ? "bg-slate-900 border-slate-800 opacity-70 cursor-not-allowed" : "bg-slate-950 border-slate-800"
                      )} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Stock Min (Alerte)</label>
                    <input required type="number" min="0" value={formData.minStock} onChange={e => setFormData({...formData, minStock: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                  </div>
                </div>

                {!editingProduct && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Coût d'Achat Unitaire (FCFA) *</label>
                    <input required type="number" min="0" value={formData.unitCost} onChange={e => setFormData({...formData, unitCost: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">URL de l'image (Optionnel)</label>
                  <input type="url" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} placeholder="https://..." className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                  {formData.imageUrl && (
                    <div className="mt-2 text-xs text-slate-500">
                      Aperçu: <InventoryImage src={formData.imageUrl} alt="preview" />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-auto p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Annuler</Button>
                <Button type="submit" variant="primary">Enregistrer</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Stock Movement Modal */}
      {movementModalOpen && movementData.product && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center p-4 border-b border-slate-800">
              <h2 className={cn("text-xl font-bold flex items-center gap-2", movementData.type === 'IN' ? 'text-emerald-500' : 'text-red-500')}>
                {movementData.type === 'IN' ? <Plus className="w-5 h-5"/> : <Minus className="w-5 h-5"/>}
                {movementData.type === 'IN' ? 'Entrée de Stock' : 'Sortie de Stock'}
              </h2>
              <button className="text-slate-400 hover:text-white transition-colors" onClick={() => setMovementModalOpen(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              adjustStock(movementData.product.id, movementData.type, Number(movementData.quantity), movementData.reason, Number(movementData.unitCost || 0) / CFA_RATE);
              setMovementModalOpen(false);
            }} className="flex flex-col flex-1">
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <img src={movementData.product.imageUrl} alt="" className="w-10 h-10 rounded-md object-cover bg-slate-800"/>
                  <div>
                    <p className="font-bold text-slate-200">{movementData.product.name}</p>
                    <p className="text-xs text-slate-500">Stock actuel : {movementData.product.stock}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Quantité à {movementData.type === 'IN' ? 'ajouter' : 'retirer'}</label>
                  <input required type="number" min="1" value={movementData.quantity} onChange={e => setMovementData({...movementData, quantity: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500" />
                </div>
                
                {movementData.type === 'IN' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Coût d'Achat Unitaire (FCFA) *</label>
                    <input required type="number" min="0" value={movementData.unitCost} onChange={e => setMovementData({...movementData, unitCost: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Motif</label>
                  {movementData.type === 'IN' ? (
                    <select required value={movementData.reason} onChange={e => setMovementData({...movementData, reason: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500">
                      <option value="Livraison Fournisseur">Livraison Fournisseur</option>
                      <option value="Retour Client">Retour Client</option>
                      <option value="Ajustement Manuel">Ajustement Manuel</option>
                      <option value="Autre">Autre</option>
                    </select>
                  ) : (
                    <select required value={movementData.reason} onChange={e => setMovementData({...movementData, reason: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500">
                      <option value="Casse">Casse / Perte</option>
                      <option value="Péremption">Péremption</option>
                      <option value="Offert au client">Offert au client</option>
                      <option value="Consommation Interne">Consommation Personnel</option>
                      <option value="Ajustement Manuel">Ajustement Manuel</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="mt-auto p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900 rounded-b-2xl">
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
