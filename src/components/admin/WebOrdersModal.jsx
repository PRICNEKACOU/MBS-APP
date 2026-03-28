import React, { useState } from "react";
import { X, Check, Trash2, Clock, MapPin, CreditCard, ShoppingBag } from "lucide-react";
import { useStore } from "../../store/store";
import { formatPrice } from "../../utils/currency";
import { Button } from "../ui/Button";

export function WebOrdersModal({ isOpen, onClose }) {
  const { orders, acceptWebOrder, rejectWebOrder, currency } = useStore();
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const [processingId, setProcessingId] = useState(null);

  if (!isOpen) return null;

  const handleAccept = async (orderId) => {
    setProcessingId(orderId);
    await acceptWebOrder(orderId);
    setProcessingId(null);
  };

  const handleReject = async (orderId) => {
    if (window.confirm("Voulez-vous vraiment annuler cette commande web ?")) {
      setProcessingId(orderId);
      await rejectWebOrder(orderId);
      setProcessingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/20 p-2 rounded-xl">
              <ShoppingBag className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Commandes Web</h2>
              <p className="text-sm text-slate-500">{pendingOrders.length} commande(s) en attente</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-full">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
          {pendingOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Clock className="w-16 h-16 opacity-20 mb-4" />
              <p className="text-lg font-medium italic">Aucune commande web en attente</p>
            </div>
          ) : (
            pendingOrders.map(order => (
              <div key={order.id} className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden animate-in slide-in-from-right-4 duration-300">
                <div className="p-4 border-b border-slate-800 flex flex-wrap justify-between items-center gap-4 bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-800 h-10 w-10 rounded-lg flex items-center justify-center font-bold text-amber-500">
                      {order.tableNumber || '?'}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Table</div>
                      <div className="text-sm font-bold text-slate-200 uppercase">Commande {order.id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-500 uppercase">Total</div>
                      <div className="text-lg font-black text-amber-500">{formatPrice(order.total, currency)}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <div className="space-y-2 mb-6">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-slate-400 font-medium">
                          <span className="text-white font-bold mr-2">{item.quantity}x</span>
                          {item.product.name}
                        </span>
                        <span className="text-slate-300">{formatPrice(item.sellingPrice * item.quantity, currency)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      variant="primary" 
                      className="flex-1 h-12 text-sm font-bold"
                      onClick={() => handleAccept(order.id)}
                      disabled={processingId === order.id}
                    >
                      {processingId === order.id ? "Traitement..." : "Accepter & Encaisser"}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-red-500/50 text-red-500 hover:bg-red-500/10 px-4"
                      onClick={() => handleReject(order.id)}
                      disabled={processingId === order.id}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50 text-center">
          <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">Système de Commandes Menu QR - Realtime</p>
        </div>
      </div>
    </div>
  );
}
