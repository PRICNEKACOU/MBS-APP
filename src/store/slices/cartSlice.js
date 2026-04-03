import { insforge } from '../../lib/insforge';
import { toast } from 'react-hot-toast';
import { mapToDb, movementMapping } from '../mappings';

export const createCartSlice = (set, get) => ({
  cart: [],

  addToCart: (product) => set(state => {
    // Normalisation des types avec garde null-safe
    // stock null/undefined = non renseigné → on autorise l'ajout (pas épuisé)
    // stock === 0          = épuisé → on bloque
    const safeStock    = product.stock    != null ? Number(product.stock)    : Infinity;
    const safeCostPrice = product.costPrice != null ? Number(product.costPrice) : 0;
    const safePrice    = Number(product.price) || 0;
    const safeMinStock = Number(product.minStock) || 0;

    const safeProduct = {
      ...product,
      price:     safePrice,
      costPrice: safeCostPrice,
      stock:     safeStock,
      minStock:  safeMinStock,
      name:      product.name     ?? 'Produit inconnu',
      category:  product.category ?? '',
    };

    if (safeProduct.stock <= 0) return state; // bloqué uniquement si épuisé
    const existing = state.cart.find(i => i.product.id === safeProduct.id);
    if (existing) {
      if (Number.isFinite(safeProduct.stock) && existing.quantity >= safeProduct.stock) return state;
      return { cart: state.cart.map(i => i.product.id === safeProduct.id ? { ...i, quantity: i.quantity + 1 } : i) };
    }
    return { cart: [...state.cart, { product: safeProduct, quantity: 1, sellingPrice: safePrice, costPrice: safeCostPrice }] };
  }),

  removeFromCart: (productId) => set(state => ({
    cart: state.cart.filter(i => i.product.id !== productId)
  })),

  updateCartItemPrice: (productId, newPrice) => set(state => ({
    cart: state.cart.map(i => i.product.id === productId ? { ...i, sellingPrice: newPrice } : i)
  })),

  updateCartQuantity: (productId, delta) => set(state => ({
    cart: state.cart.map(i => {
      if (i.product.id !== productId) return i;
      const qty = i.quantity + delta;
      return (qty > 0 && qty <= i.product.stock) ? { ...i, quantity: qty } : i;
    })
  })),

  clearCart: () => set({ cart: [] }),

  // ─────────────────────────────────────────────────────────────────────────────
  // checkout() — Finalisation de vente atomique
  //
  // Retourne un objet { success: boolean, order } pour permettre à l'appelant
  // (POS.jsx) de savoir si la vente a réussi AVANT d'afficher le reçu.
  //
  // FIXES :
  //  - cart inclus dans previousState → panier restauré en cas d'échec DB
  //  - retour d'un signal succès/échec clair (au lieu de void)
  //  - toast.error propre (fin du mode DEBUG)
  //  - l'ordre retourné contient l'ID réel sauvegardé en DB
  // ─────────────────────────────────────────────────────────────────────────────
  checkout: async (tableNumber, paymentMethod = 'Espèces') => {
    const { cart, products, currentCycle, orders, tables, movements, auth } = get();
    if (!cart.length) return { success: false, order: null };

    // ── Snapshot complet incluant le panier (pour rollback propre) ────────────
    const previousState = { orders, products, tables, movements, cart };

    try {
      const restaurantId = auth.restaurant?.id;
      if (!restaurantId) throw new Error("Accès refusé : ID Restaurant manquant.");

      const itemsForOrder = cart.map(item => ({
        ...item,
        sellingPrice: item.sellingPrice,
        costPrice: item.costPrice ?? 0
      }));

      const updatedProducts = products.map(p => {
        const cartItem = cart.find(i => i.product.id === p.id);
        if (!cartItem) return p;
        const currentStock = p.stock != null ? Number(p.stock) : 0;
        return { ...p, stock: Math.max(0, currentStock - cartItem.quantity) };
      });

      // ID réel utilisé en DB (format cohérent)
      const orderId = 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase();

      const newOrder = {
        id: orderId,
        items: itemsForOrder,
        total: cart.reduce((s, i) => s + i.sellingPrice * i.quantity, 0),
        tableNumber,
        paymentMethod,
        status: 'completed',
        timestamp: new Date().toISOString(),
        cycleId: currentCycle?.id || null,
        restaurant_id: restaurantId
      };

      const updatedTables = tableNumber
        ? tables.map(t => t.number === tableNumber ? { ...t, status: 'occupee' } : t)
        : tables;

      const newMovements = cart.map(item => ({
        id: 'MOV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
        productId: item.product.id,
        productName: item.product.name,
        type: 'OUT',
        quantity: item.quantity,
        reason: `Vente - ${orderId}`,
        date: new Date().toISOString(),
        cycleId: currentCycle?.id || null,
        restaurant_id: restaurantId
      }));

      // ── Mise à jour optimiste du store ─────────────────────────────────────
      set({
        orders: [newOrder, ...orders],
        products: updatedProducts,
        tables: updatedTables,
        movements: [...newMovements, ...movements],
        cart: []
      });

      // ── Persistance DB ─────────────────────────────────────────────────────
      if (!navigator.onLine) {
        const stockUpdates = updatedProducts
          .filter(p => cart.find(i => i.product.id === p.id))
          .map(p => ({ id: p.id, stock: p.stock }));
        await get().addToOfflineQueue({
          type: 'order',
          order: newOrder,
          stockUpdates,
          movements: newMovements,
          tableUpdate: tableNumber || null
        });
        toast.success("Vente sauvegardée hors-ligne !");
        return { success: true, order: newOrder };
      }

      const { error: rpcError } = await insforge.database.rpc('checkout_atomic', {
        p_order_id:       newOrder.id,
        p_items:          newOrder.items,
        p_total:          newOrder.total,
        p_table_number:   tableNumber || null,
        p_payment_method: newOrder.paymentMethod,
        p_status:         newOrder.status,
        p_timestamp:      newOrder.timestamp,
        p_cycle_id:       newOrder.cycleId || '',
        p_restaurant_id:  restaurantId,
        p_stock_updates:  updatedProducts
          .filter(p => cart.find(i => i.product.id === p.id))
          .map(p => ({ id: p.id, stock: p.stock })),
        p_movements:      newMovements.map(m => mapToDb(m, movementMapping))
      });

      if (rpcError) throw rpcError;

      toast.success("Vente enregistrée !");
      return { success: true, order: newOrder };

    } catch (err) {
      console.error("[Checkout] Erreur :", err);

      // Rollback complet — panier restauré pour ne pas perdre la commande
      set(previousState);

      // Message utilisateur lisible (fin du mode DEBUG)
      const userMsg = err?.message?.includes('restaurant_id mismatch')
        ? "Erreur d'autorisation : profil non lié au restaurant. Contactez le support."
        : err?.message?.includes('ID Restaurant manquant')
        ? "Session expirée. Veuillez vous reconnecter."
        : "Échec de l'enregistrement. Vérifiez votre connexion et réessayez.";

      toast.error(userMsg);
      return { success: false, order: null };
    }
  },
});
