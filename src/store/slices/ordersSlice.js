import { insforge } from '../../lib/insforge';
import { toast } from 'react-hot-toast';
import { mapToDb, orderMapping, movementMapping } from '../mappings';

export const createOrdersSlice = (set, get) => ({
  orders: [],
  hasNewWebOrder: false,
  setHasNewWebOrder: (val) => set({ hasNewWebOrder: val }),

  submitWebOrder: async (tableNumber, clientCart) => {
    if (!clientCart.length) return;
    try {
      const restaurantId = get().auth.restaurant?.id;
      if (!restaurantId) throw new Error("ID Restaurant manquant.");

      const newOrder = {
        id: 'WEB-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        items: clientCart,
        total: clientCart.reduce((s, i) => s + i.product.price * i.quantity, 0),
        tableNumber, status: 'pending',
        timestamp: new Date().toISOString(),
        restaurant_id: restaurantId
      };
      set(state => ({
        orders: [newOrder, ...state.orders],
        tables: state.tables.map(t => Number(t.number) === Number(tableNumber) ? { ...t, status: 'service_demande' } : t),
        hasNewWebOrder: true
      }));
      await Promise.all([
        insforge.database.from('orders').insert([mapToDb(newOrder, orderMapping)]),
        insforge.database.from('tables').update({ status: 'service_demande' }).eq('number', tableNumber).eq('restaurant_id', restaurantId)
      ]);
      toast.success("Commande envoyée !");
    } catch (err) {
      console.error(err);
      toast.error("Erreur commande QR.");
    }
  },

  acceptWebOrder: async (orderId, paymentMethod = 'Espèces') => {
    const { orders, products, currentCycle, tables, movements, auth } = get();
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status !== 'pending') return;

    const previousState = { orders, products, tables, movements };
    try {
      const restaurantId = auth.restaurant?.id;
      if (!restaurantId) throw new Error("ID Restaurant manquant.");

      const updatedProducts = products.map(p => {
        const item = order.items.find(i => i.product.id === p.id);
        if (!item) return p;
        return { ...p, stock: Math.max(0, p.stock - item.quantity) };
      });

      const updatedOrder = { ...order, status: 'completed', paymentMethod, cycleId: currentCycle?.id || null };

      const newMovements = order.items.map(item => ({
        id: 'MOV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
        productId: item.product.id, productName: item.product.name,
        type: 'OUT', quantity: item.quantity,
        reason: `Vente Web - ${order.id}`,
        date: new Date().toISOString(),
        cycleId: currentCycle?.id || null,
        restaurant_id: restaurantId
      }));

      set({
        orders: get().orders.map(o => o.id === orderId ? updatedOrder : o),
        products: updatedProducts,
        tables: order.tableNumber ? tables.map(t => t.number === order.tableNumber ? { ...t, status: 'occupee' } : t) : tables,
        movements: [...newMovements, ...movements],
        hasNewWebOrder: get().orders.filter(o => o.id !== orderId && o.status === 'pending').length > 0
      });

      await Promise.all([
        insforge.database.from('orders').update(mapToDb(updatedOrder, orderMapping)).eq('id', orderId).eq('restaurant_id', restaurantId),
        ...updatedProducts
          .filter(p => order.items.find(i => i.product.id === p.id))
          .map(p => insforge.database.from('products').update({ stock: p.stock }).eq('id', p.id).eq('restaurant_id', restaurantId)),
        order.tableNumber && insforge.database.from('tables').update({ status: 'occupee' }).eq('number', order.tableNumber).eq('restaurant_id', restaurantId),
        insforge.database.from('movements').insert(newMovements.map(m => mapToDb(m, movementMapping)))
      ].filter(Boolean));
      toast.success("Commande acceptée.");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'acceptation.");
      set(previousState);
    }
  },

  rejectWebOrder: async (orderId) => {
    set(state => ({
      orders: state.orders.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o),
      hasNewWebOrder: state.orders.filter(o => o.id !== orderId && o.status === 'pending').length > 0
    }));
    await insforge.database.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
  },

  cancelOrder: (orderId) => set(state => {
    const idx = state.orders.findIndex(o => o.id === orderId);
    if (idx === -1) return state;
    const order = state.orders[idx];
    if (order.status === 'cancelled') return state;

    const updatedOrders = [...state.orders];
    updatedOrders[idx] = { ...order, status: 'cancelled' };

    const updatedProducts = state.products.map(p => {
      const item = order.items.find(i => i.product.id === p.id);
      if (!item) return p;
      return { ...p, stock: p.stock + item.quantity };
    });

    const newMovements = order.items.map(item => ({
      id: 'MOV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
      productId: item.product.id, productName: item.product.name,
      type: 'IN', quantity: item.quantity,
      reason: `Annulation - ${order.id}`,
      date: new Date().toISOString(),
      cycleId: state.currentCycle?.id || null,
      restaurant_id: state.auth?.restaurant?.id
    }));

    return { orders: updatedOrders, products: updatedProducts, movements: [...newMovements, ...state.movements] };
  }),
});
