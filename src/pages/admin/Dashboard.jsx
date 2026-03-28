import React, { useState } from "react";
import { DollarSign, ShoppingBag, AlertTriangle, ArrowUpRight, ArrowDownRight, Package, Check, Calendar, XCircle, Eye, X, Receipt, Plus, Minus, Lock, BarChart3, Activity, Briefcase } from "lucide-react";

import { useStore } from "../../store/store";
import { formatPrice } from "../../utils/currency";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { cn } from "../../utils/utils";
import { useTranslation } from "../../utils/i18n";
import { calculateHistoricalStock } from "../../utils/stock";

export function OrderDetailModal({ order, onClose, currency, formatPrice }) {
  if (!order) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 font-mono text-black">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 flex-shrink-0 bg-slate-100">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Détail Ticket
          </h2>
          <button className="text-slate-500 hover:text-black transition-colors" onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 bg-white shrink">
           <div className="text-center mb-6">
             <h1 className="text-2xl font-bold mb-2">BMS APP</h1>
             <p className="text-sm text-slate-600">
               Le {new Date(order.timestamp).toLocaleDateString()} à {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
             </p>
             <p className="text-sm font-bold mt-1 text-slate-800">Commande {order.id}</p>
             {order.tableNumber && <p className="text-sm">Table {order.tableNumber}</p>}
           </div>

           <div className="border-t border-dashed border-slate-400 my-4"></div>

           <div className="space-y-3">
             {order.items.map((item, idx) => (
               <div key={idx} className="flex justify-between text-sm">
                 <div className="flex-1">
                   <span className="font-bold">{item.quantity}x</span> {item.product.name}
                 </div>
                 <div className="text-right">
                   {formatPrice(item.product.price * item.quantity, currency)}
                 </div>
               </div>
             ))}
           </div>

           <div className="border-t border-dashed border-slate-400 my-4"></div>

           <div className="flex justify-between items-center text-xl font-bold mb-2">
             <span>TOTAL</span>
             <span>{formatPrice(order.total, currency)}</span>
           </div>

           {order.status === 'cancelled' && (
             <div className="mt-6 p-3 bg-red-100 border border-red-300 rounded text-center text-red-600 font-bold uppercase tracking-widest">
               Commande Annulée
             </div>
           )}

           <div className="mt-8 text-center text-sm text-slate-500 uppercase tracking-widest border-t border-dashed border-slate-400 pt-4">
             Copie Informatique
           </div>
        </div>
      </div>
    </div>
  );
}

export function CycleReportModal({ cycle, onClose }) {
  const { movements, orders, currency } = useStore();
  const cycleMovements = movements.filter(m => m.cycleId === cycle.id);
  const cycleOrders = orders.filter(m => m.cycleId === cycle.id);

  const brut = cycleOrders.reduce((sum, o) => sum + o.total, 0);
  const cancelled = cycleOrders.filter(o => o.status === 'cancelled').reduce((sum, o) => sum + o.total, 0);
  const net = brut - cancelled;

  const allProductIds = new Set([
    ...cycle.startStock.map(p => p.productId),
    ...(cycle.endStock ? cycle.endStock.map(p => p.productId) : []),
    ...cycleMovements.map(m => m.productId)
  ]);

  const productRows = Array.from(allProductIds).map(productId => {
    const startItem = cycle.startStock.find(p => p.productId === productId);
    const startQty = startItem ? startItem.stock : 0;
    
    let productName = "Inconnu";
    if (startItem) productName = startItem.name;
    else {
      const move = cycleMovements.find(m => m.productId === productId);
      if (move) productName = move.productName;
      else if (cycle.endStock) {
        const endItem = cycle.endStock.find(p => p.productId === productId);
        if (endItem) productName = endItem.name;
      }
    }

    const productMovements = cycleMovements.filter(m => m.productId === productId);
    const ins = productMovements.filter(m => m.type === 'IN').reduce((sum, m) => sum + m.quantity, 0);
    const outs = productMovements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + m.quantity, 0);

    let endQty = null;
    if (cycle.endStock) {
      const endItem = cycle.endStock.find(p => p.productId === productId);
      endQty = endItem ? endItem.stock : 0;
    } else {
      endQty = startQty + ins - outs;
    }

    if (ins === 0 && outs === 0 && startQty === endQty) return null;

    return (
      <tr key={productId} className="border-b border-slate-800 hover:bg-slate-800/50">
        <td className="p-3 text-slate-200 font-medium">{productName}</td>
        <td className="p-3 text-slate-400 font-mono text-center">{startQty}</td>
        <td className="p-3 text-emerald-500 font-mono text-center">+{ins}</td>
        <td className="p-3 text-red-500 font-mono text-center">-{outs}</td>
        <td className="p-3 text-amber-500 font-mono text-center font-bold">{endQty}</td>
      </tr>
    );
  }).filter(Boolean);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center p-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Rapport de Service <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded">{cycle.id}</span>
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Ouvert à {new Date(cycle.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} par <strong className="text-slate-300">{cycle.openedBy || "Inconnu"}</strong>
              {cycle.endTime ? (
                <> | Clôturé à {new Date(cycle.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} par <strong className="text-slate-300">{cycle.closedBy || "Inconnu"}</strong></>
              ) : (
                <> | <span className="text-amber-500">En cours</span></>
              )}
            </p>
          </div>
          <button className="text-slate-400 hover:text-white transition-colors" onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-center shadow-inner">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">CA Brut</p>
              <p className="text-lg font-bold text-slate-200">{formatPrice(brut, currency)}</p>
            </div>
            <div className="bg-slate-950 rounded-xl p-4 border border-red-900/30 text-center shadow-inner">
              <p className="text-xs font-semibold text-red-500/70 uppercase tracking-wider mb-1">Annulé</p>
              <p className="text-lg font-bold text-red-500">{formatPrice(cancelled, currency)}</p>
            </div>
            <div className="bg-slate-950 rounded-xl p-4 border border-amber-500/30 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-amber-500/5"></div>
              <p className="text-xs font-semibold text-amber-500/70 uppercase tracking-wider mb-1 relative z-10">Net Encaissé</p>
              <p className="text-2xl font-bold text-amber-500 relative z-10">{formatPrice(net, currency)}</p>
            </div>
          </div>

          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Mouvements de Stocks</h3>
          {productRows.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="p-3 text-xs font-semibold text-slate-400 uppercase">Produit</th>
                  <th className="p-3 text-xs font-semibold text-slate-400 uppercase text-center">Stock Départ</th>
                  <th className="p-3 text-xs font-semibold text-slate-400 uppercase text-center">Entrées</th>
                  <th className="p-3 text-xs font-semibold text-slate-400 uppercase text-center">Sorties</th>
                  <th className="p-3 text-xs font-semibold text-amber-500 uppercase text-center">Stock Fin</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {productRows}
              </tbody>
            </table>
          ) : (
             <div className="p-8 text-center text-slate-500">
                Aucun mouvement de stock pendant ce cycle.
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const t = useTranslation();
  const { orders, products, currency, currentCycle, openCycle, closeCycle, movements, cycles, cancelOrder, expenses, addExpense } = useStore();
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseReason, setExpenseReason] = useState("");
  const getLocalISODate = (dateVal = new Date()) => {
    const d = new Date(dateVal);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalISODate();
  const [selectedDate, setSelectedDate] = useState(todayStr); // Used only for session tab filtering if needed or general context
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [selectedCycle, setSelectedCycle] = useState(null);

  const [activeTab, setActiveTab] = useState("overview"); // overview | financials | operations | sessions
  const [isReportsUnlocked, setIsReportsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  
  // Custom Date Range for Operations Tab
  const [reportStartDate, setReportStartDate] = useState(todayStr);
  const [reportEndDate, setReportEndDate] = useState(todayStr);

  const isToday = selectedDate === todayStr;

  const isDateInPeriod = (dateStr) => {
    const dStr = getLocalISODate(dateStr);
    return dStr >= reportStartDate && dStr <= reportEndDate;
  };

  const exportToCSV = (operations, totals) => {
    const headers = ["Date & Heure", "Type", "Réf / Motif", "Opérateur", "Mode de Paiement", "Montant Encaissé", "Coût d'Achat (COGS)", "BÉNÉFICE"];
    
    const rows = operations.map(op => {
      return [
        `"${new Date(op.timestamp).toLocaleString('fr-FR')}"`,
        `"${op.type}"`,
        `"${op.ref}"`,
        `"${op.operator}"`,
        `"${op.payment}"`,
        `"${op.revenue}"`,
        `"${op.cogs}"`,
        `"${op.profit}"`
      ].join(';');
    });

    const csvContent = [
      headers.join(';'),
      ...rows,
      "",
      `"TOTAL CA NET";;;;;"${totals.revenueNet}";"";""`,
      `"TOTAL COÛT ACHAT";;;;;;"${totals.cogs}";""`,
      `"TOTAL DÉPENSES";;;;;;;"${totals.expenses}"`,
      `"BÉNÉFICE NET FINAL";;;;;;;"${totals.beneficeNet}"`
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Bilan_${reportStartDate}_au_${reportEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ----------------------------------------------------------------------
  // DATA PREPARATION FOR 'OPERATIONS' (and 'FINANCIALS') TAB
  // ----------------------------------------------------------------------
  const reportOrders = orders.filter(o => isDateInPeriod(o.timestamp || o.date) && o.status !== 'cancelled');
  const reportExpenses = (expenses || []).filter(e => isDateInPeriod(e.date));

  const repRevenueNet = reportOrders.reduce((sum, o) => sum + o.total, 0);
  const repCogs = reportOrders.reduce((sum, o) => {
    return sum + o.items.reduce((acc, item) => acc + ((item.costPrice || 0) * item.quantity), 0);
  }, 0);

  const repMargeBrute = repRevenueNet - repCogs;
  const repTotalExpenses = reportExpenses.reduce((sum, e) => sum + e.amount, 0);
  const repBeneficeNet = repMargeBrute - repTotalExpenses;

  const allOperations = [
    ...reportOrders.map(o => {
      const cogs = o.items.reduce((acc, item) => acc + ((item.costPrice || 0) * item.quantity), 0);
      return {
        id: o.id,
        timestamp: o.timestamp,
        type: 'Vente',
        ref: o.id,
        operator: 'Barman',
        payment: o.paymentMethod || 'Espèces',
        revenue: o.total,
        cogs: cogs,
        profit: o.total - cogs
      };
    }),
    ...reportExpenses.map(e => ({
      id: e.id,
      timestamp: e.date,
      type: 'Dépense',
      ref: e.reason,
      operator: 'Admin',
      payment: 'Espèces (Petite Caisse)',
      revenue: 0,
      cogs: 0,
      profit: -e.amount
    }))
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));


  // ----------------------------------------------------------------------
  // DATA PREPARATION FOR 'OVERVIEW' TAB (Only Today's KPIs)
  // ----------------------------------------------------------------------
  const filteredOrders = orders.filter(order => getLocalISODate(order.timestamp || order.date) === todayStr);
  const filteredExpenses = (expenses || []).filter(e => getLocalISODate(e.date) === todayStr);

  const totalRevenueBrut = filteredOrders.reduce((sum, order) => sum + order.total, 0);
  const totalRevenueAnnule = filteredOrders.filter(o => o.status === 'cancelled').reduce((sum, order) => sum + order.total, 0);
  const totalRevenueNet = totalRevenueBrut - totalRevenueAnnule;

  const cashRevenue = filteredOrders
    .filter(o => o.status !== 'cancelled' && (o.paymentMethod === 'Espèces' || !o.paymentMethod))
    .reduce((sum, o) => sum + o.total, 0);

  const mobileAndCardRevenue = filteredOrders
    .filter(o => o.status !== 'cancelled' && (o.paymentMethod === 'Mobile Money' || o.paymentMethod === 'Carte Bancaire'))
    .reduce((sum, o) => sum + o.total, 0);

  const totalExpensesAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netCashInDrawer = cashRevenue - totalExpensesAmount;


  // ----------------------------------------------------------------------
  // DATA PREPARATION FOR 'SESSIONS' TAB
  // ----------------------------------------------------------------------
  // Note: we can filter sessions by selectedDate or show all. Let's filter by the same selectedDate to be consistent with Inventory.
  const filteredCycles = (cycles || []).filter(c => getLocalISODate(c.startTime) === selectedDate);


  const StatCard = ({ title, value, icon: Icon, trend, trendLabel, gradient, children }) => (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between group h-full">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-slate-100">{value}</h3>
        </div>
        <div className={cn("p-4 rounded-xl shrink-0", gradient)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {(trend || children) && (
        <div className="mt-4 pt-4 border-t border-slate-800/50">
          {children}
          {trend && (
            <p className={cn("text-xs flex items-center font-medium mt-2", trend > 0 ? "text-emerald-500" : "text-slate-500")}>
              {trend > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
              {Math.abs(trend)}% {trendLabel}
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-6 flex-1 overflow-y-auto w-full no-scrollbar pb-24">
      {/* GLOBAL HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-100">{t('dashboard.title')}</h1>
      </div>

      {/* TABS TOP BAR */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4 mb-6">
         <button 
           onClick={() => setActiveTab('overview')}
           className={cn("px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2", activeTab === 'overview' ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-400 hover:text-slate-100")}
         >
           <Briefcase className="w-4 h-4" /> Vue Générale
         </button>
         <button 
           onClick={() => setActiveTab('financials')}
           className={cn("px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2", activeTab === 'financials' ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-400 hover:text-slate-100")}
         >
           <BarChart3 className="w-4 h-4" /> Rapport Financier {!isReportsUnlocked && <Lock className="w-3 h-3" />}
         </button>
         <button 
           onClick={() => setActiveTab('operations')}
           className={cn("px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2", activeTab === 'operations' ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-400 hover:text-slate-100")}
         >
           <Activity className="w-4 h-4" /> Opérations (Ventes & Dépenses)
         </button>
         <button 
           onClick={() => setActiveTab('sessions')}
           className={cn("px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2", activeTab === 'sessions' ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-400 hover:text-slate-100")}
         >
           <Calendar className="w-4 h-4" /> Rapports de Service (Z)
         </button>
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="animate-in fade-in zoom-in-95 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard 
              title="CA Net Encaissé (Aujourd'hui)" 
              value={formatPrice(totalRevenueNet, currency)}
              icon={DollarSign}
              gradient="bg-gradient-to-br from-amber-400 to-amber-600"
            >
              <div className="flex flex-col gap-1 text-[10px] mt-2">
                <div className="flex justify-between text-slate-400">
                  <span>Espèces :</span>
                  <span className="font-mono text-emerald-400">{formatPrice(cashRevenue, currency)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Mobile/CB :</span>
                  <span className="font-mono text-blue-400">{formatPrice(mobileAndCardRevenue, currency)}</span>
                </div>
              </div>
            </StatCard>
            <StatCard 
              title="Petite Caisse (Aujourd'hui)" 
              value={formatPrice(totalExpensesAmount, currency)}
              icon={Receipt}
              gradient="bg-gradient-to-br from-red-500 to-red-600"
            >
              <p className="text-[10px] text-slate-400 mt-2">Total des sorties d'argent aujourd'hui</p>
            </StatCard>
            <StatCard 
              title="SOLDE NET EN TIROIR" 
              value={formatPrice(netCashInDrawer, currency)}
              icon={Check}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
            >
              <p className="text-[10px] text-slate-100/70 mt-2 font-bold uppercase tracking-wider">Audit : Chiffre attendu en caisse</p>
            </StatCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              {currentCycle ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 flex flex-col justify-between items-start gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-amber-500 flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                      </span>
                      Service en cours
                    </h2>
                    <p className="text-slate-400 mt-1">
                      Ouvert à {new Date(currentCycle.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} par <strong className="text-amber-500">{currentCycle.openedBy || "Inconnu"}</strong>
                    </p>
                  </div>
                  <Button className="w-full text-lg py-3 px-6 bg-red-500 hover:bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all" onClick={() => {
                    if (window.confirm("Voulez-vous vraiment clôturer ce service ? Le rapport Z sera généré.")) {
                      closeCycle();
                    }
                  }}>
                    Clôturer le service
                  </Button>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between items-start gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-slate-600"></span>
                      Aucun service actif
                    </h2>
                    <p className="text-slate-400 mt-1">
                      Ouvrez un service pour commencer à enregistrer des commandes en caisse.
                    </p>
                  </div>
                  <Button variant="primary" className="w-full text-lg py-3 px-6 shadow-[0_0_15px_rgba(245,158,11,0.3)]" onClick={() => {
                    if (window.confirm("Ouvrir un nouveau service avec l'état actuel des stocks de l'inventaire ?")) {
                      openCycle();
                    }
                  }}>
                    Ouvrir le service
                  </Button>
                </div>
              )}

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-500" />
                  Enregistrer une Dépense (Petite Caisse)
                </h2>
                <form className="flex flex-col gap-4" onSubmit={(e) => {
                  e.preventDefault();
                  if(!expenseAmount || !expenseReason) return;
                  addExpense(Number(expenseAmount), expenseReason);
                  setExpenseAmount("");
                  setExpenseReason("");
                }}>
                  <input 
                    type="number" 
                    placeholder="Montant (EUR)" 
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <input 
                    type="text" 
                    placeholder="Motif (ex: Achat glaçons, Facture...)" 
                    value={expenseReason}
                    onChange={(e) => setExpenseReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <Button variant="primary" type="submit" className="w-full h-full px-8 py-3 shrink-0">
                    Valider Dépense
                  </Button>
                </form>
              </div>
            </div>

            {/* STATIC TODO LIST */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
               <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                 <Check className="w-5 h-5 text-amber-500" />
                 To-Do List du personnel
               </h2>
               <div className="space-y-3">
                 {[
                   "Vérifier le stock de glaçons",
                   "Allumer la machine à café",
                   "Nettoyer le comptoir",
                   "Compter le fond de caisse",
                   "Préparer les garnitures"
                 ].map((task, i) => (
                   <label key={i} className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                     <input type="checkbox" className="w-5 h-5 accent-amber-500 rounded border-slate-700" />
                     <span className="text-slate-300 text-sm select-none">{task}</span>
                   </label>
                 ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: FINANCIALS */}
      {activeTab === 'financials' && !isReportsUnlocked && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md mx-auto mt-10 text-center animate-in fade-in zoom-in-95">
           <Lock className="w-12 h-12 text-slate-500 mx-auto mb-4" />
           <h2 className="text-xl font-bold text-slate-100 mb-2">Accès Restreint</h2>
           <p className="text-slate-400 text-sm mb-6">Veuillez saisir le code PIN de l'administrateur pour accéder aux rapports de rentabilité.</p>
           <form onSubmit={(e) => {
             e.preventDefault();
             if (passwordInput === '0000') {
               setIsReportsUnlocked(true);
               setPasswordInput('');
             } else {
               alert('Code incorrect');
             }
           }} className="flex flex-col gap-4">
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="****"
                className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-center text-xl focus:ring-2 focus:ring-amber-500 outline-none tracking-widest"
                autoFocus
              />
              <Button type="submit" variant="primary">Déverrouiller</Button>
           </form>
        </div>
      )}

      {activeTab === 'financials' && isReportsUnlocked && (
         <div className="space-y-6 animate-in fade-in zoom-in-95">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="CA Net Ventes" value={formatPrice(repRevenueNet, currency)} icon={DollarSign} gradient="bg-gradient-to-br from-blue-500 to-blue-700" />
              <StatCard title="Coût des Achats (COGS)" value={formatPrice(repCogs, currency)} icon={Package} gradient="bg-gradient-to-br from-slate-500 to-slate-700" />
              <StatCard title="Marge Brute" value={formatPrice(repMargeBrute, currency)} icon={ArrowUpRight} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" />
              <StatCard title="Charges & Dépenses" value={formatPrice(repTotalExpenses, currency)} icon={ArrowDownRight} gradient="bg-gradient-to-br from-red-500 to-red-700" />
            </div>

            <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-6 text-center mt-6">
              <p className="text-slate-400 uppercase tracking-widest text-sm font-semibold mb-2 flex items-center justify-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-500" />
                Bénéfice Net Final de la Période
              </p>
              <h2 className={cn("text-5xl font-black mt-4", repBeneficeNet >= 0 ? "text-amber-500" : "text-red-500")}>
                {formatPrice(repBeneficeNet, currency)}
              </h2>
            </div>
         </div>
      )}

      {/* TAB: OPERATIONS */}
      {activeTab === 'operations' && (
        <div className="animate-in fade-in zoom-in-95">
          <div className="flex flex-col xl:flex-row justify-between items-start gap-4 mb-6 bg-slate-900 p-4 border border-slate-800 rounded-2xl">
             <div className="flex flex-col gap-3 w-full xl:w-auto">
               <span className="text-slate-400 font-bold uppercase text-xs tracking-wider">Aperçu & Export</span>
               <Button onClick={() => exportToCSV(allOperations, { revenueNet: repRevenueNet, cogs: repCogs, expenses: repTotalExpenses, beneficeNet: repBeneficeNet })} variant="primary" className="flex items-center gap-2 text-sm">
                 Exporter le Tableau (CSV)
               </Button>
             </div>
             <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
               <div className="flex gap-2 pb-2 sm:pb-0 overflow-x-auto no-scrollbar items-end">
                 <button onClick={() => { setReportStartDate(todayStr); setReportEndDate(todayStr); }} className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 whitespace-nowrap transition-colors border border-slate-700">Aujourd'hui</button>
                 <button onClick={() => { 
                   const d = new Date(); d.setDate(d.getDate() - 1); 
                   const yStr = getLocalISODate(d);
                   setReportStartDate(yStr); setReportEndDate(yStr); 
                 }} className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 whitespace-nowrap transition-colors border border-slate-700">Hier</button>
                 <button onClick={() => { 
                   const d = new Date(); 
                   const first = d.getDate() - d.getDay() + 1;
                   const start = new Date(d.setDate(first));
                   const end = new Date(d.setDate(start.getDate() + 6));
                   setReportStartDate(getLocalISODate(start)); 
                   setReportEndDate(getLocalISODate(end)); 
                 }} className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 whitespace-nowrap transition-colors border border-slate-700">Semaine</button>
                 <button onClick={() => { 
                   const d = new Date(); 
                   const start = new Date(d.getFullYear(), d.getMonth(), 1);
                   const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                   setReportStartDate(getLocalISODate(start)); 
                   setReportEndDate(getLocalISODate(end)); 
                 }} className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 whitespace-nowrap transition-colors border border-slate-700">Mois</button>
               </div>
               <div className="flex flex-col gap-1">
                 <span className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Date Personnalisée</span>
                 <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                   <input 
                     type="date"
                     value={reportStartDate}
                     onChange={(e) => setReportStartDate(e.target.value)}
                     className="bg-transparent border-none text-slate-100 text-sm focus:ring-0 p-1 m-0 [&::-webkit-calendar-picker-indicator]:invert cursor-pointer outline-none w-32"
                   />
                   <span className="text-slate-500">-</span>
                   <input 
                     type="date"
                     value={reportEndDate}
                     onChange={(e) => setReportEndDate(e.target.value)}
                     className="bg-transparent border-none text-slate-100 text-sm focus:ring-0 p-1 m-0 [&::-webkit-calendar-picker-indicator]:invert cursor-pointer outline-none w-32"
                   />
                 </div>
               </div>
             </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col max-h-[800px]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-slate-100 w-full flex justify-between items-center">
                Aperçu Régistre des Opérations
                <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">
                  {allOperations.length} Entrées
                </Badge>
              </h2>
            </div>
            <div className="overflow-x-auto flex-1 overflow-y-auto no-scrollbar">
              {allOperations.length === 0 ? (
                 <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                   <Receipt className="w-8 h-8 opacity-20 mb-2" />
                   Aucune opération trouvée pour cette période.
                 </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50">
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Date & Heure</th>
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Type</th>
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Réf / Motif</th>
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Opérateur</th>
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Paiement</th>
                      <th className="p-4 text-xs font-semibold text-emerald-500 uppercase text-right">CA Brut/Net</th>
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase text-right">COGS</th>
                      <th className="p-4 text-xs font-semibold text-amber-500 uppercase text-right">Bénéfice Net</th>
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {allOperations.map(op => (
                      <tr key={op.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 text-slate-400 whitespace-nowrap">{new Date(op.timestamp).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="p-4">
                          <Badge variant={op.type === 'Vente' ? 'success' : 'danger'}>{op.type}</Badge>
                        </td>
                        <td className="p-4 font-mono text-slate-200 text-xs">{op.ref}</td>
                        <td className="p-4 text-slate-400">{op.operator}</td>
                        <td className="p-4 text-slate-400 text-xs italic">{op.payment}</td>
                        <td className="p-4 font-bold text-emerald-500 text-right">{op.revenue > 0 ? formatPrice(op.revenue, currency) : '-'}</td>
                        <td className="p-4 text-slate-400 text-right">{op.cogs > 0 ? formatPrice(op.cogs, currency) : '-'}</td>
                        <td className={cn("p-4 font-bold text-right", op.profit >= 0 ? "text-amber-500" : "text-red-500")}>
                          {op.profit > 0 ? '+' : ''}{formatPrice(op.profit, currency)}
                        </td>
                        <td className="p-4 text-right">
                          {op.type === 'Vente' && (
                             <button 
                               onClick={() => setSelectedOrderDetails(orders.find(o => o.id === op.id))}
                               className="text-slate-400 hover:text-amber-500 transition-colors p-2 rounded hover:bg-amber-500/10"
                               title="Voir le ticket"
                             >
                               <Eye className="w-5 h-5" />
                             </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: SESSIONS (Z) */}
      {activeTab === 'sessions' && (
        <div className="animate-in fade-in zoom-in-95">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              Journal des Clôtures de Caisse
            </h2>
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
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
            {filteredCycles.length > 0 ? (
              filteredCycles.map(cycle => (
                <div 
                  key={cycle.id} 
                  onClick={() => setSelectedCycle(cycle)}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-amber-500/50 hover:bg-slate-800 transition-all group shadow-sm hover:shadow-lg"
                >
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant={cycle.endTime ? "outline" : "success"} className={!cycle.endTime ? "animate-pulse" : ""}>
                      {cycle.endTime ? "Clôturé" : "En cours"}
                    </Badge>
                    <span className="text-xs font-mono text-slate-500">{cycle.id}</span>
                  </div>
                  <h3 className="text-slate-200 font-bold mb-2">
                    Service du {new Date(cycle.startTime).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'})}
                  </h3>
                  <p className="text-slate-300 font-medium text-sm mb-1">
                    Ouvert à {new Date(cycle.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} par <span className="text-amber-500 font-bold px-1">{cycle.openedBy || "Inconnu"}</span>
                  </p>
                  {cycle.endTime ? (
                    <p className="text-slate-400 text-sm">
                      Clôturé à {new Date(cycle.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} par <span className="text-amber-500 font-bold px-1">{cycle.closedBy || "Inconnu"}</span>
                    </p>
                  ) : (
                    <p className="text-emerald-500 text-sm font-semibold">Service en cours</p>
                  )}
                  <div className="mt-4 text-sm text-amber-500 font-medium group-hover:translate-x-1 transition-transform">
                    Voir le rapport détaillé →
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500">
                Aucun service enregistré à cette date.
              </div>
            )}
          </div>
        </div>
      )}

      {selectedCycle && (
        <CycleReportModal cycle={selectedCycle} onClose={() => setSelectedCycle(null)} />
      )}

      <OrderDetailModal 
        order={selectedOrderDetails} 
        onClose={() => setSelectedOrderDetails(null)} 
        currency={currency} 
        formatPrice={formatPrice} 
      />
    </div>
  );
}
