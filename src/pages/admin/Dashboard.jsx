import React, { useState } from "react";
import {
  DollarSign, ShoppingBag, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Package, Check, Calendar, XCircle, Eye, X, Receipt, Plus, Minus,
  Lock, BarChart3, Activity, Briefcase, Printer, Globe, TrendingUp,
  ShoppingCart, Users, Star, FileText, Wallet, Tag, Trash2, ChevronDown, ChevronUp
} from "lucide-react";
import { useStore } from "../../store/store";
import { formatPrice } from "../../utils/currency";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { cn } from "../../utils/utils";
import { useTranslation } from "../../utils/i18n";
import { calculateHistoricalStock } from "../../utils/stock";

const CFA_RATE = 655.957;

// ─── Order Detail Modal ───────────────────────────────────────────────────────
export function OrderDetailModal({ order, onClose, currency }) {
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
                  {formatPrice(item.sellingPrice * item.quantity, currency)}
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

// ─── Cycle Report Modal ───────────────────────────────────────────────────────
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
            <div className="overflow-x-auto">
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
                <tbody className="text-sm">{productRows}</tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">Aucun mouvement de stock pendant ce cycle.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Date range quick-select pills ───────────────────────────────────────────
function DateRangePills({ onSelect, getLocalISODate }) {
  const today = getLocalISODate();
  return (
    <div className="flex flex-wrap gap-2">
      {[
        { label: "Aujourd'hui", action: () => onSelect(today, today) },
        { label: "Hier", action: () => {
          const d = new Date(); d.setDate(d.getDate() - 1);
          const y = getLocalISODate(d);
          onSelect(y, y);
        }},
        { label: "7 derniers jours", action: () => {
          const d = new Date(); d.setDate(d.getDate() - 6);
          onSelect(getLocalISODate(d), today);
        }},
        { label: "Ce mois", action: () => {
          const d = new Date();
          const start = new Date(d.getFullYear(), d.getMonth(), 1);
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          onSelect(getLocalISODate(start), getLocalISODate(end));
        }},
      ].map(pill => (
        <button
          key={pill.label}
          onClick={pill.action}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700 whitespace-nowrap"
        >
          {pill.label}
        </button>
      ))}
    </div>
  );
}

function DateRangeInput({ startDate, endDate, onStartChange, onEndChange }) {
  return (
    <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartChange(e.target.value)}
        className="bg-transparent text-slate-100 text-sm focus:ring-0 p-1 [&::-webkit-calendar-picker-indicator]:invert cursor-pointer outline-none w-32"
      />
      <span className="text-slate-500 text-sm">→</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndChange(e.target.value)}
        className="bg-transparent text-slate-100 text-sm focus:ring-0 p-1 [&::-webkit-calendar-picker-indicator]:invert cursor-pointer outline-none w-32"
      />
    </div>
  );
}

// ─── Main Dashboard Component ─────────────────────────────────────────────────
export function Dashboard() {
  const t = useTranslation();
  const { orders, products, currency, currentCycle, movements, cycles, cancelOrder, expenses, addExpense } = useStore();

  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseReason, setExpenseReason] = useState("");
  const [expenseType, setExpenseType] = useState("Charges Variables");

  const getLocalISODate = (dateVal = new Date()) => {
    const d = new Date(dateVal);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const todayStr = getLocalISODate();

  const [activeTab, setActiveTab] = useState("overview");
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [expandedOpId, setExpandedOpId] = useState(null);

  // ── Financials tab date range ──
  const [finStartDate, setFinStartDate] = useState(todayStr);
  const [finEndDate, setFinEndDate] = useState(todayStr);

  // ── Operations tab date range ──
  const [reportStartDate, setReportStartDate] = useState(todayStr);
  const [reportEndDate, setReportEndDate] = useState(todayStr);

  // ── Point Global tab date range ──
  const [pgStartDate, setPgStartDate] = useState(todayStr);
  const [pgEndDate, setPgEndDate] = useState(todayStr);

  // ── Dépenses tab date range ──
  const [depStartDate, setDepStartDate] = useState(todayStr);
  const [depEndDate, setDepEndDate] = useState(todayStr);

  // PIN for Financials
  const [isReportsUnlocked, setIsReportsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  const isToday = selectedDate === todayStr;

  // ─── Helper: is date in period ──────────────────────────────────────────────
  const inPeriod = (dateStr, start, end) => {
    const d = getLocalISODate(dateStr);
    return d >= start && d <= end;
  };

  // ─── TODAY data (Overview tab) ───────────────────────────────────────────────
  const filteredOrders = orders.filter(o => getLocalISODate(o.timestamp || o.date) === todayStr);
  const filteredExpenses = (expenses || []).filter(e => getLocalISODate(e.date) === todayStr);

  const totalRevenueBrut = filteredOrders.reduce((sum, o) => sum + o.total, 0);
  const totalRevenueAnnule = filteredOrders.filter(o => o.status === 'cancelled').reduce((sum, o) => sum + o.total, 0);
  const totalRevenueNet = totalRevenueBrut - totalRevenueAnnule;

  const cashRevenue = filteredOrders
    .filter(o => o.status !== 'cancelled' && (o.paymentMethod === 'Espèces' || !o.paymentMethod))
    .reduce((sum, o) => sum + o.total, 0);
  const mobileAndCardRevenue = filteredOrders
    .filter(o => o.status !== 'cancelled' && (o.paymentMethod === 'Mobile Money' || o.paymentMethod === 'Carte Bancaire'))
    .reduce((sum, o) => sum + o.total, 0);
  const totalExpensesAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netCashInDrawer = cashRevenue - totalExpensesAmount;

  // ─── FINANCIALS data ─────────────────────────────────────────────────────────
  const finOrders = orders.filter(o => inPeriod(o.timestamp || o.date, finStartDate, finEndDate) && o.status !== 'cancelled');
  const finExpenses = (expenses || []).filter(e => inPeriod(e.date, finStartDate, finEndDate));

  const finRevenueNet = finOrders.reduce((sum, o) => sum + o.total, 0);
  const finCogs = finOrders.reduce((sum, o) =>
    sum + o.items.reduce((acc, item) => acc + ((item.costPrice || 0) * item.quantity), 0), 0);
  const finMargeBrute = finRevenueNet - finCogs;
  const finFixedExpenses = finExpenses.filter(e => e.category === 'Charges Fixes').reduce((sum, e) => sum + e.amount, 0);
  const finVariableExpenses = finExpenses.filter(e => e.category !== 'Charges Fixes').reduce((sum, e) => sum + e.amount, 0);
  const finTotalExpenses = finExpenses.reduce((sum, e) => sum + e.amount, 0);
  const finBeneficeNet = finMargeBrute - finTotalExpenses;
  const finTotalArticles = finOrders.reduce((sum, o) => sum + o.items.reduce((acc, i) => acc + i.quantity, 0), 0);
  const finPanierMoyen = finOrders.length > 0 ? finRevenueNet / finOrders.length : 0;

  // Bestsellers
  const productSalesMap = {};
  finOrders.forEach(order => {
    order.items.forEach(item => {
      const name = item.product?.name || 'Inconnu';
      if (!productSalesMap[name]) productSalesMap[name] = { qty: 0, revenue: 0, profit: 0 };
      productSalesMap[name].qty += item.quantity;
      productSalesMap[name].revenue += item.sellingPrice * item.quantity;
      productSalesMap[name].profit += (item.sellingPrice - (item.costPrice || 0)) * item.quantity;
    });
  });
  const bestsellers = Object.entries(productSalesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 15);
  const maxQty = bestsellers[0]?.qty || 1;

  // ─── OPERATIONS data ─────────────────────────────────────────────────────────
  const reportOrders = orders.filter(o => inPeriod(o.timestamp || o.date, reportStartDate, reportEndDate) && o.status !== 'cancelled');
  const reportExpenses = (expenses || []).filter(e => inPeriod(e.date, reportStartDate, reportEndDate));
  const repRevenueNet = reportOrders.reduce((sum, o) => sum + o.total, 0);
  const repCogs = reportOrders.reduce((sum, o) =>
    sum + o.items.reduce((acc, item) => acc + ((item.costPrice || 0) * item.quantity), 0), 0);
  const repTotalExpenses = reportExpenses.reduce((sum, e) => sum + e.amount, 0);
  const repBeneficeNet = repRevenueNet - repCogs - repTotalExpenses;

  const allOperations = [
    ...reportOrders.map(o => {
      const cogs = o.items.reduce((acc, item) => acc + ((item.costPrice || 0) * item.quantity), 0);
      return { id: o.id, timestamp: o.timestamp, type: 'Vente', ref: o.id, operator: 'Barman', payment: o.paymentMethod || 'Espèces', revenue: o.total, cogs, profit: o.total - cogs, items: o.items };
    }),
    ...reportExpenses.map(e => ({
      id: e.id, timestamp: e.date, type: 'Dépense', ref: e.reason, operator: 'Admin',
      payment: 'Espèces (Petite Caisse)', revenue: 0, cogs: 0, profit: -e.amount
    }))
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const exportToCSV = () => {
    const headers = ["Date & Heure", "Type", "Réf / Motif", "Opérateur", "Mode de Paiement", "Montant Encaissé", "Coût d'Achat (COGS)", "BÉNÉFICE"];
    const rows = allOperations.map(op => [
      `"${new Date(op.timestamp).toLocaleString('fr-FR')}"`,
      `"${op.type}"`, `"${op.ref}"`, `"${op.operator}"`, `"${op.payment}"`,
      `"${op.revenue}"`, `"${op.cogs}"`, `"${op.profit}"`
    ].join(';'));
    const csvContent = [
      headers.join(';'), ...rows, "",
      `"TOTAL CA NET";;;;;"${repRevenueNet}";"";""`,
      `"TOTAL COÛT ACHAT";;;;;;"${repCogs}";""`,
      `"TOTAL DÉPENSES";;;;;;;"${repTotalExpenses}"`,
      `"BÉNÉFICE NET FINAL";;;;;;;"${repBeneficeNet}"`
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `Operations_${reportStartDate}_au_${reportEndDate}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // ─── POINT GLOBAL data ────────────────────────────────────────────────────────
  const pgOrders = orders.filter(o => inPeriod(o.timestamp || o.date, pgStartDate, pgEndDate));
  const pgCompletedOrders = pgOrders.filter(o => o.status !== 'cancelled');
  const pgExpenses = (expenses || []).filter(e => inPeriod(e.date, pgStartDate, pgEndDate));
  const pgMovements = movements.filter(m => inPeriod(m.date, pgStartDate, pgEndDate));

  const pgCaBrut = pgCompletedOrders.reduce((sum, o) => sum + o.total, 0);
  const pgTotalExpenses = pgExpenses.reduce((sum, e) => sum + e.amount, 0);
  const pgCogs = pgCompletedOrders.reduce((sum, o) =>
    sum + o.items.reduce((acc, i) => acc + ((i.costPrice || 0) * i.quantity), 0), 0);
  const pgBeneficeNet = pgCaBrut - pgCogs - pgTotalExpenses;
  const pgNbTickets = pgCompletedOrders.length;
  const pgPanierMoyen = pgNbTickets > 0 ? pgCaBrut / pgNbTickets : 0;

  const pgCashRevenue = pgCompletedOrders.filter(o => o.paymentMethod === 'Espèces' || !o.paymentMethod).reduce((sum, o) => sum + o.total, 0);
  const pgMobileRevenue = pgCompletedOrders.filter(o => o.paymentMethod === 'Mobile Money').reduce((sum, o) => sum + o.total, 0);
  const pgCardRevenue = pgCompletedOrders.filter(o => o.paymentMethod === 'Carte Bancaire').reduce((sum, o) => sum + o.total, 0);
  const pgCashExpenses = pgExpenses.reduce((sum, e) => sum + e.amount, 0);
  const pgSoldeTheorique = pgCashRevenue - pgCashExpenses;

  // Top 5 produits (Point Global)
  const pgProductMap = {};
  pgCompletedOrders.forEach(o => {
    o.items.forEach(item => {
      const name = item.product?.name || 'Inconnu';
      if (!pgProductMap[name]) pgProductMap[name] = { qty: 0, revenue: 0 };
      pgProductMap[name].qty += item.quantity;
      pgProductMap[name].revenue += item.sellingPrice * item.quantity;
    });
  });
  const pgTop5 = Object.entries(pgProductMap)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Stock audit (Point Global)
  const pgAllProductIds = [...new Set(pgMovements.map(m => m.productId))];
  const pgStockAudit = pgAllProductIds.map(productId => {
    const product = products.find(p => p.id === productId);
    const name = product?.name || pgMovements.find(m => m.productId === productId)?.productName || productId;

    // Stock at start of period = calculateHistoricalStock at day before pgStartDate
    const dayBefore = new Date(pgStartDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const stockInit = calculateHistoricalStock(productId, getLocalISODate(dayBefore), products, movements);

    const periodMov = pgMovements.filter(m => m.productId === productId);
    const entries = periodMov.filter(m => m.type === 'IN').reduce((s, m) => s + m.quantity, 0);
    const exits = periodMov.filter(m => m.type === 'OUT').reduce((s, m) => s + m.quantity, 0);
    const stockFinalTheo = Math.max(0, stockInit + entries - exits);

    return { name, stockInit, entries, exits, stockFinalTheo };
  }).filter(row => row.entries > 0 || row.exits > 0);

  // Journal détaillé (Point Global)
  const pgJournal = [
    ...pgOrders.map(o => ({
      date: o.timestamp,
      type: o.status === 'cancelled' ? 'Annulation' : 'Vente',
      ref: o.id,
      detail: `${o.items?.reduce((s, i) => s + i.quantity, 0) || 0} article(s)${o.tableNumber ? ` · Table ${o.tableNumber}` : ''}`,
      amount: o.status === 'cancelled' ? null : o.total,
      payment: o.paymentMethod || 'Espèces',
      isNegative: o.status === 'cancelled'
    })),
    ...pgExpenses.map(e => ({
      date: e.date,
      type: 'Dépense',
      ref: e.id,
      detail: e.reason,
      amount: e.amount,
      payment: 'Petite Caisse',
      isNegative: true
    })),
    ...pgMovements.filter(m => m.type === 'IN').map(m => ({
      date: m.date,
      type: 'Entrée Stock',
      ref: m.id,
      detail: `${m.quantity}× ${m.productName} — ${m.reason || ''}`,
      amount: null,
      payment: '—',
      isNegative: false
    }))
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  // ─── Sessions tab ────────────────────────────────────────────────────────────
  const filteredCycles = (cycles || []).filter(c => getLocalISODate(c.startTime) === selectedDate);

  // ─── StatCard ─────────────────────────────────────────────────────────────────
  const StatCard = ({ title, value, icon: Icon, gradient, children }) => (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between group h-full">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1 uppercase tracking-wide">{title}</p>
          <h3 className="text-2xl font-bold text-slate-100">{value}</h3>
        </div>
        <div className={cn("p-3 rounded-xl shrink-0", gradient)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      {children && (
        <div className="mt-3 pt-3 border-t border-slate-800/50">
          {children}
        </div>
      )}
    </div>
  );

  // ─── Tabs config ─────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'overview',    icon: Briefcase,  label: 'Vue Générale' },
    { id: 'depenses',    icon: Wallet,     label: 'Dépenses' },
    { id: 'financials',  icon: BarChart3,  label: 'Rapport Financier', lock: !isReportsUnlocked },
    { id: 'operations',  icon: Activity,   label: 'Opérations' },
    { id: 'pointglobal', icon: Globe,      label: 'Point Global' },
    { id: 'sessions',    icon: Calendar,   label: 'Sessions (Z)' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 flex-1 overflow-y-auto w-full no-scrollbar pb-24">

      {/* Header */}
      <div className="no-print flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">{t('dashboard.title')}</h1>
      </div>

      {/* Tabs */}
      <div className="no-print flex flex-wrap gap-2 border-b border-slate-800 pb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-3 py-2 rounded-xl font-bold transition-colors flex items-center gap-1.5 text-sm",
              activeTab === tab.id
                ? "bg-amber-500 text-slate-950"
                : "bg-slate-900 text-slate-400 hover:text-slate-100"
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.lock && <Lock className="w-3 h-3 opacity-60" />}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: OVERVIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="animate-in fade-in zoom-in-95 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="CA Net Encaissé (Aujourd'hui)"
              value={formatPrice(totalRevenueNet, currency)}
              icon={DollarSign}
              gradient="bg-gradient-to-br from-amber-400 to-amber-600"
            >
              <div className="flex flex-col gap-1 text-[10px]">
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
              <p className="text-[10px] text-slate-400">Total des sorties d'argent aujourd'hui</p>
            </StatCard>
            <StatCard
              title="SOLDE NET EN TIROIR"
              value={formatPrice(netCashInDrawer, currency)}
              icon={Check}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
            >
              <p className="text-[10px] text-slate-100/70 font-bold uppercase tracking-wider">Chiffre attendu en caisse</p>
            </StatCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expense quick summary — click to go to Dépenses tab */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-red-400" />
                Dépenses du Jour
              </h2>
              <div className="space-y-2 mb-4">
                {filteredExpenses.length === 0 ? (
                  <p className="text-slate-500 text-sm">Aucune dépense enregistrée aujourd'hui.</p>
                ) : filteredExpenses.slice(0, 4).map(e => (
                  <div key={e.id} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="text-slate-300">{e.reason}</span>
                      <span className={cn("ml-2 text-[10px] px-1.5 py-0.5 rounded font-semibold",
                        e.category === 'Charges Fixes' ? "bg-blue-500/10 text-blue-400" : "bg-orange-500/10 text-orange-400"
                      )}>
                        {e.category === 'Charges Fixes' ? 'Fixe' : 'Variable'}
                      </span>
                    </div>
                    <span className="text-red-400 font-mono font-bold">{formatPrice(e.amount, currency)}</span>
                  </div>
                ))}
                {filteredExpenses.length > 4 && (
                  <p className="text-slate-500 text-xs">+ {filteredExpenses.length - 4} autre(s)</p>
                )}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setActiveTab('depenses')}
              >
                <Plus className="w-4 h-4 mr-2" /> Ajouter / Voir tout
              </Button>
            </div>

            {/* Service status (read-only) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-500" />
                Statut du Service
              </h2>
              {currentCycle ? (
                <div className="flex items-start gap-3">
                  <span className="relative flex h-3 w-3 mt-1 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </span>
                  <div>
                    <p className="font-bold text-amber-500">Service en cours</p>
                    <p className="text-slate-400 text-sm mt-1">
                      Ouvert à {new Date(currentCycle.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {currentCycle.openedBy && <> par <strong className="text-amber-400">{currentCycle.openedBy}</strong></>}
                    </p>
                    <p className="text-slate-500 text-xs mt-2">Pour clôturer, rendez-vous dans l'onglet <span className="text-amber-500 font-semibold">Caisse (POS)</span>.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <span className="w-3 h-3 rounded-full bg-slate-600 mt-1 shrink-0"></span>
                  <div>
                    <p className="font-bold text-slate-300">Aucun service actif</p>
                    <p className="text-slate-400 text-sm mt-1">
                      La caisse est fermée. Rendez-vous dans l'onglet <span className="text-amber-500 font-semibold">Caisse (POS)</span> pour ouvrir un service.
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Commandes aujourd'hui</span>
                  <span className="font-bold text-slate-200">{filteredOrders.filter(o => o.status !== 'cancelled').length}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-slate-400">Dépenses aujourd'hui</span>
                  <span className="font-bold text-red-400">{formatPrice(totalExpensesAmount, currency)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: DÉPENSES
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'depenses' && (
        <div className="animate-in fade-in zoom-in-95 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Expense form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-5 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-500" />
                Enregistrer une Dépense
              </h2>
              <form className="flex flex-col gap-4" onSubmit={(e) => {
                e.preventDefault();
                if (!expenseAmount || !expenseReason) return;
                addExpense(Number(expenseAmount) / CFA_RATE, expenseReason, expenseType);
                setExpenseAmount(""); setExpenseReason("");
              }}>

                {/* Type Fixe / Variable */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Type de charge *</label>
                  <div className="flex gap-2">
                    {[
                      { val: 'Charges Fixes', label: 'Fixe', color: 'blue' },
                      { val: 'Charges Variables', label: 'Variable', color: 'orange' }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setExpenseType(opt.val)}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl font-semibold text-sm border transition-all",
                          expenseType === opt.val
                            ? opt.color === 'blue'
                              ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                              : "bg-orange-500/20 text-orange-400 border-orange-500/40"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Suggestions rapides */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Suggestions rapides</label>
                  <div className="flex flex-wrap gap-2">
                    {(expenseType === 'Charges Fixes'
                      ? ['Loyer', 'CIE', 'SODECI', 'Internet', 'Salaires', 'Taxes']
                      : ['Glace', 'Charbon', 'Marché (Condiments)', 'Gaz', 'Transport', 'Entretien']
                    ).map(suggestion => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setExpenseReason(suggestion)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                          expenseReason === suggestion
                            ? "bg-amber-500 text-slate-950 border-amber-500"
                            : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500 hover:text-white"
                        )}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Motif libre */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Motif *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Achat glaçons, Réparation..."
                    value={expenseReason}
                    onChange={e => setExpenseReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                {/* Montant */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Montant (FCFA) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ex: 5000"
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <Button variant="primary" type="submit" className="w-full py-3 font-bold">
                  <Check className="w-4 h-4 mr-2" /> Valider la Dépense
                </Button>
              </form>
            </div>

            {/* Expense list — with date filter */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              {/* Date filter for expenses */}
              <div className="mb-4 space-y-3">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-amber-500" />
                  Historique des Dépenses
                </h2>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <DateRangePills
                    onSelect={(s, e) => { setDepStartDate(s); setDepEndDate(e); }}
                    getLocalISODate={getLocalISODate}
                  />
                  <DateRangeInput
                    startDate={depStartDate} endDate={depEndDate}
                    onStartChange={setDepStartDate} onEndChange={setDepEndDate}
                  />
                </div>
              </div>

              {(() => {
                const depExpenses = (expenses || []).filter(e => inPeriod(e.date, depStartDate, depEndDate));
                const depTotal = depExpenses.reduce((s, e) => s + e.amount, 0);
                return (
                  <>
                    {/* Summary by type */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                        <p className="text-xs text-blue-400 font-semibold uppercase mb-1">Fixes</p>
                        <p className="text-lg font-bold text-blue-300">
                          {formatPrice(depExpenses.filter(e => e.category === 'Charges Fixes').reduce((s, e) => s + e.amount, 0), currency)}
                        </p>
                      </div>
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-center">
                        <p className="text-xs text-orange-400 font-semibold uppercase mb-1">Variables</p>
                        <p className="text-lg font-bold text-orange-300">
                          {formatPrice(depExpenses.filter(e => e.category !== 'Charges Fixes').reduce((s, e) => s + e.amount, 0), currency)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 mb-3">
                      {depExpenses.length} dépense(s)
                    </Badge>

                    {/* Expense list */}
                    <div className="space-y-2 max-h-[350px] overflow-y-auto no-scrollbar">
                      {depExpenses.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          <Wallet className="w-10 h-10 opacity-20 mx-auto mb-2" />
                          <p className="text-sm">Aucune dépense sur cette période.</p>
                        </div>
                      ) : (
                        depExpenses.map(e => (
                          <div key={e.id} className="flex justify-between items-center p-3 bg-slate-950 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-2">
                              <span className={cn("w-2 h-2 rounded-full shrink-0",
                                e.category === 'Charges Fixes' ? "bg-blue-400" : "bg-orange-400"
                              )} />
                              <div>
                                <p className="text-slate-200 text-sm font-medium">{e.reason}</p>
                                <p className="text-slate-500 text-[10px]">
                                  {new Date(e.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' })}
                                  {' '}
                                  {new Date(e.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  {' · '}
                                  <span className={e.category === 'Charges Fixes' ? "text-blue-400" : "text-orange-400"}>
                                    {e.category === 'Charges Fixes' ? 'Fixe' : 'Variable'}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <span className="text-red-400 font-mono font-bold text-sm shrink-0">{formatPrice(e.amount, currency)}</span>
                          </div>
                        ))
                      )}
                    </div>

                    {depExpenses.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                        <span className="text-slate-400 font-medium text-sm">Total période</span>
                        <span className="text-red-400 font-black text-xl">{formatPrice(depTotal, currency)}</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: FINANCIALS (PIN locked)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'financials' && !isReportsUnlocked && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md mx-auto mt-10 text-center animate-in fade-in zoom-in-95">
          <Lock className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-100 mb-2">Accès Restreint</h2>
          <p className="text-slate-400 text-sm mb-6">Saisissez le code PIN administrateur pour accéder aux rapports de rentabilité.</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (passwordInput === '0000') { setIsReportsUnlocked(true); setPasswordInput(''); }
            else alert('Code incorrect');
          }} className="flex flex-col gap-4">
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="****"
              className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-center text-xl focus:ring-2 focus:ring-amber-500 outline-none tracking-widest"
              autoFocus />
            <Button type="submit" variant="primary">Déverrouiller</Button>
          </form>
        </div>
      )}

      {activeTab === 'financials' && isReportsUnlocked && (
        <div className="space-y-6 animate-in fade-in zoom-in-95">
          {/* Date range selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">Période d'analyse</p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <DateRangePills
                onSelect={(s, e) => { setFinStartDate(s); setFinEndDate(e); }}
                getLocalISODate={getLocalISODate}
              />
              <DateRangeInput
                startDate={finStartDate} endDate={finEndDate}
                onStartChange={setFinStartDate} onEndChange={setFinEndDate}
              />
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="CA Net Ventes" value={formatPrice(finRevenueNet, currency)} icon={DollarSign} gradient="bg-gradient-to-br from-blue-500 to-blue-700" />
            <StatCard title="Coût Achats (COGS)" value={formatPrice(finCogs, currency)} icon={Package} gradient="bg-gradient-to-br from-slate-500 to-slate-700" />
            <StatCard title="Marge Brute" value={formatPrice(finMargeBrute, currency)} icon={ArrowUpRight} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" />
            <StatCard title="Articles Vendus" value={finTotalArticles.toString()} icon={ShoppingBag} gradient="bg-gradient-to-br from-purple-500 to-purple-700" />
          </div>

          {/* Charges split */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1">Charges Fixes</p>
              <p className="text-2xl font-bold text-blue-300">{formatPrice(finFixedExpenses, currency)}</p>
              <p className="text-[10px] text-slate-500 mt-1">Loyer, CIE, Salaires…</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5">
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-1">Charges Variables</p>
              <p className="text-2xl font-bold text-orange-300">{formatPrice(finVariableExpenses, currency)}</p>
              <p className="text-[10px] text-slate-500 mt-1">Glace, Charbon, Transport…</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-1">Total Charges</p>
              <p className="text-2xl font-bold text-red-300">{formatPrice(finTotalExpenses, currency)}</p>
              <p className="text-[10px] text-slate-500 mt-1">Fixes + Variables</p>
            </div>
          </div>

          {/* Panier moyen */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Panier Moyen</p>
              <p className="text-2xl font-bold text-cyan-400">{formatPrice(finPanierMoyen, currency)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">{finOrders.length} commande(s)</p>
              <p className="text-xs text-slate-500">{finTotalArticles} article(s)</p>
            </div>
          </div>

          {/* Bénéfice Net */}
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-6 text-center">
            <p className="text-slate-400 uppercase tracking-widest text-sm font-semibold mb-2 flex items-center justify-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              Bénéfice Net Final de la Période
            </p>
            <h2 className={cn("text-5xl font-black mt-4", finBeneficeNet >= 0 ? "text-amber-500" : "text-red-500")}>
              {formatPrice(finBeneficeNet, currency)}
            </h2>
            <p className="text-slate-500 text-xs mt-2">{finOrders.length} commande(s) — {finOrders.length > 0 ? finTotalArticles : 0} article(s)</p>
          </div>

          {/* Bestsellers */}
          {bestsellers.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                Palmarès des Produits
                <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 ml-auto">
                  Top {bestsellers.length}
                </Badge>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse mb-6">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="pb-3 text-xs text-slate-400 uppercase font-semibold">#</th>
                      <th className="pb-3 text-xs text-slate-400 uppercase font-semibold">Produit</th>
                      <th className="pb-3 text-xs text-slate-400 uppercase font-semibold text-right">Qté</th>
                      <th className="pb-3 text-xs text-slate-400 uppercase font-semibold text-right">CA</th>
                      <th className="pb-3 text-xs text-amber-500 uppercase font-semibold text-right">Marge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestsellers.map((item, i) => (
                      <tr key={item.name} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 text-slate-500 text-sm w-8">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="font-mono text-xs">{i + 1}</span>}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-200 font-medium text-sm">{item.name}</span>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden w-full max-w-[200px]">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${(item.qty / maxQty) * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-right font-bold text-slate-200">{item.qty}</td>
                        <td className="py-3 text-right text-emerald-400 font-mono text-sm">{formatPrice(item.revenue, currency)}</td>
                        <td className="py-3 text-right font-bold text-amber-500 font-mono text-sm">{formatPrice(item.profit, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: OPERATIONS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'operations' && (
        <div className="animate-in fade-in zoom-in-95 space-y-4">
          {/* Filter bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">Filtrer par période</p>
            <div className="flex flex-col gap-3">
              <DateRangePills
                onSelect={(s, e) => { setReportStartDate(s); setReportEndDate(e); }}
                getLocalISODate={getLocalISODate}
              />
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <DateRangeInput
                  startDate={reportStartDate} endDate={reportEndDate}
                  onStartChange={setReportStartDate} onEndChange={setReportEndDate}
                />
                <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2 text-sm shrink-0">
                  Exporter CSV ({allOperations.length})
                </Button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="font-bold text-slate-100">Registre des Opérations</h2>
              <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">
                {allOperations.length} entrées
              </Badge>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto no-scrollbar">
              {allOperations.length === 0 ? (
                <div className="p-10 text-center text-slate-500 flex flex-col items-center">
                  <Receipt className="w-8 h-8 opacity-20 mb-2" />
                  Aucune opération pour cette période.
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50 sticky top-0">
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Date & Heure</th>
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Type</th>
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Réf / Motif</th>
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Paiement</th>
                      <th className="p-4 text-xs font-semibold text-emerald-500 uppercase text-right">CA</th>
                      <th className="p-4 text-xs font-semibold text-amber-500 uppercase text-right">Bénéfice</th>
                      <th className="p-4 text-xs font-semibold text-slate-400 uppercase text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {allOperations.map(op => (
                      <React.Fragment key={op.id}>
                        <tr className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                          <td className="p-4 text-slate-400 whitespace-nowrap text-xs">
                            {new Date(op.timestamp).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="p-4">
                            <Badge variant={op.type === 'Vente' ? 'success' : 'danger'}>{op.type}</Badge>
                          </td>
                          <td className="p-4 font-mono text-slate-200 text-xs max-w-[120px] truncate">{op.ref}</td>
                          <td className="p-4 text-slate-400 text-xs italic">{op.payment}</td>
                          <td className="p-4 font-bold text-emerald-500 text-right whitespace-nowrap">
                            {op.revenue > 0 ? formatPrice(op.revenue, currency) : '—'}
                          </td>
                          <td className={cn("p-4 font-bold text-right whitespace-nowrap", op.profit >= 0 ? "text-amber-500" : "text-red-500")}>
                            {op.profit > 0 ? '+' : ''}{formatPrice(op.profit, currency)}
                          </td>
                          <td className="p-4 text-right flex items-center justify-end gap-1">
                            {op.type === 'Vente' && (
                              <>
                                <button
                                  onClick={() => setExpandedOpId(expandedOpId === op.id ? null : op.id)}
                                  className={cn(
                                    "transition-colors p-1.5 rounded",
                                    expandedOpId === op.id
                                      ? "text-cyan-400 bg-cyan-500/10"
                                      : "text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10"
                                  )}
                                  title="Détails de rentabilité"
                                >
                                  {expandedOpId === op.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => setSelectedOrderDetails(orders.find(o => o.id === op.id))}
                                  className="text-slate-400 hover:text-amber-500 transition-colors p-1.5 rounded hover:bg-amber-500/10"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                        {/* ── Expandable margin detail row ── */}
                        {expandedOpId === op.id && op.type === 'Vente' && op.items && (
                          <tr className="bg-slate-950/60">
                            <td colSpan={7} className="p-0">
                              <div className="px-6 py-4 space-y-2 border-b border-cyan-500/20">
                                <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">Détails de Rentabilité — {op.ref}</p>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-slate-500">
                                      <th className="text-left pb-2 font-semibold">Qté</th>
                                      <th className="text-left pb-2 font-semibold">Article</th>
                                      <th className="text-right pb-2 font-semibold">C.A. (Coût)</th>
                                      <th className="text-right pb-2 font-semibold">P.V. (Vente)</th>
                                      <th className="text-right pb-2 font-semibold">Marge</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {op.items.map((item, idx) => {
                                      const itemCost = item.costPrice || 0;
                                      const itemSell = item.sellingPrice || item.product?.price || 0;
                                      const itemMargin = (itemSell - itemCost) * item.quantity;
                                      return (
                                        <tr key={idx} className="border-t border-slate-800/50">
                                          <td className="py-2 text-slate-300 font-mono">{item.quantity}x</td>
                                          <td className="py-2 text-slate-200">{item.product?.name || 'Inconnu'}</td>
                                          <td className="py-2 text-right text-slate-400">{formatPrice(itemCost, currency)}</td>
                                          <td className="py-2 text-right text-slate-300">{formatPrice(itemSell, currency)}</td>
                                          <td className={cn("py-2 text-right font-bold", itemMargin >= 0 ? "text-emerald-400" : "text-red-400")}>
                                            {itemMargin > 0 ? '+' : ''}{formatPrice(itemMargin, currency)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot>
                                    <tr className="border-t-2 border-slate-700">
                                      <td colSpan={4} className="py-2 text-right font-bold text-slate-300 pr-4">Bénéfice Net :</td>
                                      <td className={cn("py-2 text-right font-black text-sm", op.profit >= 0 ? "text-amber-400" : "text-red-400")}>
                                        {op.profit > 0 ? '+' : ''}{formatPrice(op.profit, currency)}
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: POINT GLOBAL (Z-Report / Audit)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pointglobal' && (
        <div className="animate-in fade-in zoom-in-95 space-y-6">
          {/* Controls */}
          <div className="no-print bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div className="flex flex-col gap-3 flex-1">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Période du bilan</p>
              <DateRangePills
                onSelect={(s, e) => { setPgStartDate(s); setPgEndDate(e); }}
                getLocalISODate={getLocalISODate}
              />
              <DateRangeInput
                startDate={pgStartDate} endDate={pgEndDate}
                onStartChange={setPgStartDate} onEndChange={setPgEndDate}
              />
            </div>
            <button
              onClick={() => window.print()}
              className="no-print flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-sm transition-colors border border-slate-700 shrink-0"
            >
              <Printer className="w-4 h-4" />
              Imprimer le Bilan
            </button>
          </div>

          {/* ─── Printable content ─── */}
          <div id="pg-printable" className="space-y-6">

            {/* Print header (only shown in print) */}
            <div className="hidden print:block text-center mb-4 border-b-2 border-black pb-4">
              <h1 className="text-xl font-black uppercase">BMS APP — Point Global</h1>
              <p className="text-sm">Période : {pgStartDate} → {pgEndDate}</p>
              <p className="text-xs text-gray-500">Imprimé le {new Date().toLocaleString('fr-FR')}</p>
            </div>

            {/* Section 1 — KPIs financiers */}
            <section>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2 print:text-black">
                <DollarSign className="w-4 h-4 text-amber-500 print:hidden" />
                Situation Financière
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: 'CA Brut', value: formatPrice(pgCaBrut, currency), color: 'text-emerald-400' },
                  { label: 'Total Dépenses', value: formatPrice(pgTotalExpenses, currency), color: 'text-red-400' },
                  { label: 'Bénéfice Net', value: formatPrice(pgBeneficeNet, currency), color: pgBeneficeNet >= 0 ? 'text-amber-500' : 'text-red-500' },
                  { label: 'Nb Tickets', value: pgNbTickets.toString(), color: 'text-blue-400' },
                  { label: 'Panier Moyen', value: formatPrice(pgPanierMoyen, currency), color: 'text-purple-400' },
                ].map(kpi => (
                  <div key={kpi.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 print:border print:border-gray-300 print:bg-white print:rounded-none">
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1 print:text-gray-500">{kpi.label}</p>
                    <p className={cn("text-lg font-bold", kpi.color, "print:text-black")}>{kpi.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 2 — Caisse physique */}
            <section>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2 print:text-black">
                <Receipt className="w-4 h-4 text-amber-500 print:hidden" />
                Caisse Physique
              </h2>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 print:border print:border-gray-300 print:bg-white print:rounded-none">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Espèces encaissées', value: formatPrice(pgCashRevenue, currency), color: 'text-emerald-400' },
                    { label: 'Mobile Money', value: formatPrice(pgMobileRevenue, currency), color: 'text-amber-400' },
                    { label: 'Carte Bancaire', value: formatPrice(pgCardRevenue, currency), color: 'text-blue-400' },
                  ].map(item => (
                    <div key={item.label} className="text-center">
                      <p className="text-xs text-slate-500 mb-1 print:text-gray-500">{item.label}</p>
                      <p className={cn("text-xl font-bold", item.color, "print:text-black")}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center print:border-gray-300">
                  <span className="text-sm font-bold text-slate-300 print:text-black">Solde de Caisse Théorique (Espèces - Dépenses)</span>
                  <span className={cn("text-xl font-black", pgSoldeTheorique >= 0 ? "text-emerald-400" : "text-red-400", "print:text-black")}>
                    {formatPrice(pgSoldeTheorique, currency)}
                  </span>
                </div>
              </div>
            </section>

            {/* Section 3 — Top 5 */}
            {pgTop5.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2 print:text-black">
                  <Star className="w-4 h-4 text-amber-500 print:hidden" />
                  Palmarès — Top 5 Articles
                </h2>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden print:border print:border-gray-300 print:bg-white print:rounded-none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/50 print:bg-gray-100">
                          <th className="p-3 text-xs font-semibold text-slate-400 uppercase print:text-black">#</th>
                          <th className="p-3 text-xs font-semibold text-slate-400 uppercase print:text-black">Produit</th>
                          <th className="p-3 text-xs font-semibold text-slate-400 uppercase text-right print:text-black">Quantité</th>
                          <th className="p-3 text-xs font-semibold text-slate-400 uppercase text-right print:text-black">CA</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {pgTop5.map((item, i) => (
                          <tr key={item.name} className="border-b border-slate-800 print:border-gray-200">
                            <td className="p-3 text-slate-500 print:text-black">{i + 1}</td>
                            <td className="p-3 font-medium text-slate-200 print:text-black">{item.name}</td>
                            <td className="p-3 text-right font-bold text-amber-500 print:text-black">{item.qty}</td>
                            <td className="p-3 text-right text-emerald-400 print:text-black">{formatPrice(item.revenue, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Section 4 — Stock Audit */}
            {pgStockAudit.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2 print:text-black">
                  <Package className="w-4 h-4 text-amber-500 print:hidden" />
                  Audit Stock (Anti-Écart)
                </h2>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden print:border print:border-gray-300 print:bg-white print:rounded-none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/50 print:bg-gray-100">
                          <th className="p-3 text-xs font-semibold text-slate-400 uppercase print:text-black">Produit</th>
                          <th className="p-3 text-xs font-semibold text-slate-400 uppercase text-center print:text-black">Stock Initial</th>
                          <th className="p-3 text-xs font-semibold text-emerald-500 uppercase text-center print:text-black">Entrées (+)</th>
                          <th className="p-3 text-xs font-semibold text-red-500 uppercase text-center print:text-black">Sorties (-)</th>
                          <th className="p-3 text-xs font-semibold text-amber-500 uppercase text-center print:text-black">Stock Théorique</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {pgStockAudit.map(row => (
                          <tr key={row.name} className="border-b border-slate-800 hover:bg-slate-800/30 print:border-gray-200">
                            <td className="p-3 font-medium text-slate-200 print:text-black">{row.name}</td>
                            <td className="p-3 text-center text-slate-400 font-mono print:text-black">{row.stockInit}</td>
                            <td className="p-3 text-center text-emerald-500 font-mono font-bold print:text-black">+{row.entries}</td>
                            <td className="p-3 text-center text-red-500 font-mono font-bold print:text-black">-{row.exits}</td>
                            <td className="p-3 text-center text-amber-500 font-mono font-bold print:text-black">{row.stockFinalTheo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Section 5 — Journal détaillé */}
            <section>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2 print:text-black">
                <FileText className="w-4 h-4 text-amber-500 print:hidden" />
                Journal Détaillé
                <span className="text-xs font-normal text-slate-500">({pgJournal.length} entrées)</span>
              </h2>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden print:border print:border-gray-300 print:bg-white print:rounded-none">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto no-scrollbar print:max-h-none">
                  {pgJournal.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">Aucune entrée pour cette période.</div>
                  ) : (
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/50 sticky top-0 print:bg-gray-100 print:static">
                          <th className="p-3 text-xs font-semibold text-slate-400 uppercase print:text-black">Heure</th>
                          <th className="p-3 text-xs font-semibold text-slate-400 uppercase print:text-black">Type</th>
                          <th className="p-3 text-xs font-semibold text-slate-400 uppercase print:text-black">Réf</th>
                          <th className="p-3 text-xs font-semibold text-slate-400 uppercase print:text-black">Détail</th>
                          <th className="p-3 text-xs font-semibold text-slate-400 uppercase print:text-black">Paiement</th>
                          <th className="p-3 text-xs font-semibold text-slate-400 uppercase text-right print:text-black">Montant</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {pgJournal.map((entry, i) => (
                          <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20 print:border-gray-100">
                            <td className="p-3 text-slate-500 whitespace-nowrap print:text-black">
                              {new Date(entry.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-3">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase print:text-black",
                                entry.type === 'Vente' ? "bg-emerald-500/10 text-emerald-400" :
                                entry.type === 'Dépense' ? "bg-red-500/10 text-red-400" :
                                entry.type === 'Entrée Stock' ? "bg-blue-500/10 text-blue-400" :
                                "bg-slate-800 text-slate-400"
                              )}>
                                {entry.type}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-slate-400 text-[10px] print:text-black">{entry.ref}</td>
                            <td className="p-3 text-slate-300 print:text-black">{entry.detail}</td>
                            <td className="p-3 text-slate-500 italic print:text-black">{entry.payment}</td>
                            <td className={cn("p-3 text-right font-bold whitespace-nowrap print:text-black",
                              entry.amount === null ? "text-slate-600" :
                              entry.isNegative ? "text-red-400" : "text-emerald-400"
                            )}>
                              {entry.amount === null ? '—' : formatPrice(entry.amount, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </section>

          </div>{/* end #pg-printable */}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: SESSIONS (Z)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sessions' && (
        <div className="animate-in fade-in zoom-in-95">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              Journal des Clôtures de Caisse
            </h2>
            <label className={cn(
              "flex items-center gap-3 transition-colors border rounded-xl px-4 py-2 cursor-pointer focus-within:ring-2 focus-within:ring-amber-500",
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
            {filteredCycles.length > 0 ? filteredCycles.map(cycle => (
              <div
                key={cycle.id}
                onClick={() => setSelectedCycle(cycle)}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-amber-500/50 hover:bg-slate-800 transition-all group shadow-sm"
              >
                <div className="flex justify-between items-start mb-2">
                  <Badge variant={cycle.endTime ? "outline" : "success"} className={!cycle.endTime ? "animate-pulse" : ""}>
                    {cycle.endTime ? "Clôturé" : "En cours"}
                  </Badge>
                  <span className="text-xs font-mono text-slate-500">{cycle.id}</span>
                </div>
                <h3 className="text-slate-200 font-bold mb-2">
                  Service du {new Date(cycle.startTime).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
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
                  Voir le rapport →
                </div>
              </div>
            )) : (
              <div className="col-span-full border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500">
                Aucun service enregistré à cette date.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedCycle && <CycleReportModal cycle={selectedCycle} onClose={() => setSelectedCycle(null)} />}
      <OrderDetailModal
        order={selectedOrderDetails}
        onClose={() => setSelectedOrderDetails(null)}
        currency={currency}
      />
    </div>
  );
}
