import { insforge } from '../../lib/insforge';
import { toast } from 'react-hot-toast';
import { mapToDb, movementMapping } from '../mappings';

export const createCartSlice = (set, get) => ({
  cart: [],

  addToCart: (product) => set(state => {
    // Normalisation des types — guard contre les strings venant du formulaire ou d'un mapping partiel
    const safeProduct = {
      ...product,
      price:    Number(product.price)    || 0,
      costPrice: Number(product.costPrice) || 0,
      stock:    Number(product.stock)    || 0,
      minStock: Number(product.minStock) || 0,
      name:     product.name     ?? 'Produit inconnu',
      category: product.category ?? '',
    };
    if (safeProduct.stock <= 0) return state;
    const existing = state.cart.find(i => i.product.id === safeProduct.id);
    if (existing) {
      if (existing.quantity >= safeProduct.stock) return state;
      return { cart: state.cart.map(i => i.product.id === safeProduct.id ? { ...i, quantity: i.quantity + 1 } : i) };
    }
    return { cart: [...state.cart, { product: safeProduct, quantity: 1, sellingPrice: safeProduct.price, costPrice: safeProduct.costPrice }] };
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

  checkout: async (tableNumber, paymentMethod = 'Espèces') => {
    const { cart, products, currentCycle, orders, tables, movements, auth } = get();
    if (!cart.length) return;

    const previousState = { orders, products, tables, movements };

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
        return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
      });

      const newOrder = {
        id: 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
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
        reason: `Vente - ${newOrder.id}`,
        date: new Date().toISOString(),
        cycleId: currentCycle?.id || null,
        restaurant_id: restaurantId
      }));

      set({ orders: [newOrder, ...orders], products: updatedProducts, tables: updatedTables, movements: [...newMovements, ...movements], cart: [] });

      if (!navigator.onLine) {
        const stockUpdates = updatedProducts
          .filter(p => cart.find(i => i.product.id === p.id))
          .map(p => ({ id: p.id, stock: p.stock }));
        await get().addToOfflineQueue({ type: 'order', order: newOrder, stockUpdates, movements: newMovements, tableUpdate: tableNumber || null });
        toast.success("Vente sauvegardée hors-ligne !");
      } else {
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
      }
    } catch (err) {
      console.error(err);
      toast.error("Échec de la vente. Veuillez réessayer.");
      set(previousState);
    }
  },
});
