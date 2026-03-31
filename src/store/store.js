import { create } from 'zustand';
import { insforge } from '../lib/insforge';
import { playNotificationSound } from '../utils/sound';
import { toast } from 'react-hot-toast';

const mockTables = Array.from({ length: 12 }, (_, i) => ({
  id: (i + 1).toString(),
  number: i + 1,
  status: 'libre'
}));

const mapToDb = (data, mapping) => {
  const result = {};
  for (const key in data) {
    result[mapping[key] || key] = data[key];
  }
  return result;
};

const mapFromDb = (data, mapping) => {
  const result = {};
  const reverseMapping = Object.fromEntries(Object.entries(mapping).map(([k, v]) => [v, k]));
  for (const key in data) {
    result[reverseMapping[key] || key] = data[key];
  }
  return result;
};

// Simplified mapping: costBatches removed, costPrice added
const productMapping = {
  minStock: 'min_stock',
  imageUrl: 'image_url',
  costPrice: 'cost_price'
};
const cycleMapping = {
  startTime: 'start_time',
  endTime: 'end_time',
  startStock: 'start_stock',
  endStock: 'end_stock',
  openedBy: 'opened_by',
  closedBy: 'closed_by'
};
const orderMapping = {
  tableNumber: 'table_number',
  paymentMethod: 'payment_method',
  cycleId: 'cycle_id'
};
const movementMapping = {
  productId: 'product_id',
  productName: 'product_name',
  cycleId: 'cycle_id'
};
const expenseMapping = { cycleId: 'cycle_id' };

const savedAuth = (() => {
  try {
    const stored = localStorage.getItem('mbs_auth');
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse auth from localStorage');
  }
  return { isAuthenticated: false, user: null, restaurant: null };
})();

export const useStore = create((set, get) => ({
  isLoading: savedAuth.isAuthenticated, // Si authentifié, on est en loading jusqu'au chargement des datas
  isSyncing: false,
  language: 'fr',
  setLanguage: (language) => set({ language }),

  auth: savedAuth,
  setAuth: (authParams) => {
    const newAuth = { ...get().auth, ...authParams };
    localStorage.setItem('mbs_auth', JSON.stringify(newAuth));
    set({ auth: newAuth });
  },
  logout: () => {
    localStorage.removeItem('mbs_auth');
    set({ auth: { isAuthenticated: false, user: null, restaurant: null } });
  },

  currency: 'CFA',
  setCurrency: (currency) => set({ currency }),

  products: [],
  tables: mockTables,
  orders: [],
  movements: [],
  cycles: [],
  currentCycle: null,
  expenses: [],
  cart: [],

  initializeStore: async () => {
    if (!get().auth.isAuthenticated) {
      set({ isLoading: false });
      return;
    }
    set({ isLoading: true });
    try {
      const [
        { data: products },
        { data: tables },
        { data: orders },
        { data: movements },
        { data: cycles },
        { data: expenses }
      ] = await Promise.all([
        insforge.database.from('products').select('*').eq('restaurant_id', get().auth.restaurant?.id).eq('archived', false),
        insforge.database.from('tables').select('*').eq('restaurant_id', get().auth.restaurant?.id),
        insforge.database.from('orders').select('*').eq('restaurant_id', get().auth.restaurant?.id),
        insforge.database.from('movements').select('*').eq('restaurant_id', get().auth.restaurant?.id),
        insforge.database.from('cycles').select('*').eq('restaurant_id', get().auth.restaurant?.id),
        insforge.database.from('expenses').select('*').eq('restaurant_id', get().auth.restaurant?.id)
      ]);

      // Simple flat mapping — no costBatches
      const mappedProducts = (products || []).map(p => ({
        ...mapFromDb(p, productMapping),
        costPrice: p.cost_price ?? 0  // safe fallback for old rows
      }));

      const mappedOrders   = (orders    || []).map(o => mapFromDb(o, orderMapping));
      const mappedCycles   = (cycles    || []).map(c => mapFromDb(c, cycleMapping));
      const mappedMovements= (movements || []).map(m => mapFromDb(m, movementMapping));
      const mappedExpenses = (expenses  || []).map(e => mapFromDb(e, expenseMapping));

      set({
        products: mappedProducts,
        tables: (tables || []).length > 0 ? tables : mockTables,
        orders: mappedOrders,
        movements: mappedMovements,
        cycles: mappedCycles,
        currentCycle: mappedCycles.find(c => !c.endTime) || null,
        expenses: mappedExpenses,
        isLoading: false
      });

      // Real-time sync (graceful — won't block if WS token is invalid)
      try {
        await insforge.realtime.connect();

        insforge.realtime.subscribe('orders').on('ORDER_CHANGE', (payload) => {
          const mapped = mapFromDb(payload, orderMapping);
          const exists = get().orders.some(o => o.id === mapped.id);
          if (!exists) {
            set(state => ({
              orders: [mapped, ...state.orders],
              hasNewWebOrder: mapped.status === 'pending'
            }));
            if (mapped.status === 'pending') playNotificationSound();
          } else {
            set(state => ({ orders: state.orders.map(o => o.id === mapped.id ? mapped : o) }));
          }
        });

        insforge.realtime.subscribe('products').on('PRODUCT_CHANGE', (payload) => {
          if (payload.archived) {
            set(state => ({ products: state.products.filter(p => p.id !== payload.id) }));
          } else {
            const mapped = { ...mapFromDb(payload, productMapping), costPrice: payload.cost_price ?? 0 };
            set(state => ({
              products: state.products.some(p => p.id === payload.id)
                ? state.products.map(p => p.id === payload.id ? mapped : p)
                : [mapped, ...state.products]
            }));
          }
        });

        insforge.realtime.subscribe('tables').on('TABLE_CHANGE', (payload) => {
          set(state => ({ tables: state.tables.map(t => t.id === payload.id ? payload : t) }));
        });

      } catch (wsErr) {
        console.warn('Real-time sync disabled (WS error):', wsErr.message);
      }

    } catch (err) {
      console.error('Failed to initialize store:', err);
      toast.error("Échec de la connexion au serveur.");
      set({ isLoading: false });
    }
  },

  // ─── Cycle (Service) ─────────────────────────────────────────────────────
  openCycle: async (openedBy) => {
    if (get().currentCycle) return;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const closedToday = get().cycles.find(c => c.endTime && c.startTime.startsWith(todayStr));

      if (closedToday) {
        const reopened = { ...closedToday, endTime: null, endStock: null, closedBy: undefined };
        set({ currentCycle: reopened, cycles: get().cycles.map(c => c.id === reopened.id ? reopened : c) });
        await insforge.database.from('cycles').update(mapToDb(reopened, cycleMapping)).eq('id', reopened.id);
        toast.success("Service du jour réouvert.");
        return;
      }

      const startStock = get().products.map(p => ({ productId: p.id, name: p.name, stock: p.stock }));
      const newCycle = {
        id: 'SHIFT-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        startTime: new Date().toISOString(),
        endTime: null, startStock, endStock: null, openedBy,
        restaurant_id: get().auth.restaurant?.id
      };
      set({ currentCycle: newCycle, cycles: [newCycle, ...get().cycles] });
      await insforge.database.from('cycles').insert([mapToDb(newCycle, cycleMapping)]);
      toast.success("Service démarré !");
    } catch (err) {
      console.error(err);
      toast.error("Impossible d'ouvrir le service.");
    }
  },

  closeCycle: async (closedBy) => {
    const cycle = get().currentCycle;
    if (!cycle) return;
    try {
      const endStock = get().products.map(p => ({ productId: p.id, name: p.name, stock: p.stock }));
      const finished = { ...cycle, endTime: new Date().toISOString(), endStock, closedBy };
      set({ currentCycle: null, cycles: get().cycles.map(c => c.id === finished.id ? finished : c) });
      await insforge.database.from('cycles').update(mapToDb(finished, cycleMapping)).eq('id', finished.id);
      toast.success("Service clôturé avec succès.");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la clôture.");
    }
  },

  // ─── Cart ────────────────────────────────────────────────────────────────
  addToCart: (product) => set(state => {
    if (product.stock <= 0) return state;
    const existing = state.cart.find(i => i.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) return state;
      return { cart: state.cart.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i) };
    }
    // sellingPrice = product.price (EUR base), costPrice snapshotted from product
    return { cart: [...state.cart, { product, quantity: 1, sellingPrice: product.price, costPrice: product.costPrice ?? 0 }] };
  }),

  removeFromCart: (productId) => set(state => ({ cart: state.cart.filter(i => i.product.id !== productId) })),

  // newPrice in EUR
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

  // ─── Checkout ────────────────────────────────────────────────────────────
  checkout: async (tableNumber, paymentMethod = 'Espèces') => {
    const { cart, products, currentCycle, orders, tables, movements, auth } = get();
    if (!cart.length) return;

    // Save previous state for rollback
    const previousState = { orders, products, tables, movements };

    try {
      const restaurantId = auth.restaurant?.id;
      if (!restaurantId) throw new Error("Accès refusé : ID Restaurant manquant.");

      // Snapshot sellingPrice + costPrice per item AT the moment of sale
      const itemsForOrder = cart.map(item => ({
        ...item,
        sellingPrice: item.sellingPrice,
        costPrice: item.costPrice ?? 0
      }));

      // Simple stock deduction
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

      const updatedTables = tableNumber ? tables.map(t => t.number === tableNumber ? { ...t, status: 'occupee' } : t) : tables;

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

      await Promise.all([
        insforge.database.from('orders').insert([mapToDb(newOrder, orderMapping)]),
        ...updatedProducts
          .filter(p => cart.find(i => i.product.id === p.id))
          .map(p => insforge.database.from('products').update({ stock: p.stock }).eq('id', p.id).eq('restaurant_id', restaurantId)),
        tableNumber && insforge.database.from('tables').update({ status: 'occupee' }).eq('number', tableNumber).eq('restaurant_id', restaurantId),
        insforge.database.from('movements').insert(newMovements.map(m => mapToDb(m, movementMapping)))
      ].filter(Boolean));

      toast.success("Vente enregistrée !");
    } catch (err) {
      console.error(err);
      toast.error("Échec de la vente. Veuillez réessayer.");
      set(previousState); // Rollback
    }
  },

  // ─── Web Orders ──────────────────────────────────────────────────────────
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

      // Simple stock deduction
      const updatedProducts = products.map(p => {
        const item = order.items.find(i => i.product.id === p.id);
        if (!item) return p;
        return { ...p, stock: Math.max(0, p.stock - item.quantity) };
      });

      const updatedOrder = { ...order, status: 'completed', paymentMethod, cycleId: currentCycle?.id || null };

      const newMovements = order.items.map(item => ({
        id: 'MOV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
        productId: item.product.id,
        productName: item.product.name,
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

    // Stock reversal — simple addition
    const updatedProducts = state.products.map(p => {
      const item = order.items.find(i => i.product.id === p.id);
      if (!item) return p;
      return { ...p, stock: p.stock + item.quantity };
    });

    const newMovements = order.items.map(item => ({
      id: 'MOV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
      productId: item.product.id,
      productName: item.product.name,
      type: 'IN', quantity: item.quantity,
      reason: `Annulation - ${order.id}`,
      date: new Date().toISOString(),
      cycleId: state.currentCycle?.id || null,
      restaurant_id: get().auth.restaurant?.id
    }));

    return { orders: updatedOrders, products: updatedProducts, movements: [...newMovements, ...state.movements] };
  }),

  // ─── Product CRUD ─────────────────────────────────────────────────────────
  addProduct: async (productInfo) => {
    const previousProducts = get().products;
    const previousMovements = get().movements;
    
    try {
      const restaurantId = get().auth.restaurant?.id;
      if (!restaurantId) throw new Error("ID Restaurant manquant.");

      const newId = 'PRD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
      const { unitCost, ...cleanInfo } = productInfo;

      const newProduct = {
        ...cleanInfo,
        id: newId,
        archived: false,
        costPrice: productInfo.costPrice ?? 0,
        restaurant_id: restaurantId
      };

      const newMovement = productInfo.stock > 0 ? {
        id: 'MOV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
        productId: newId,
        productName: newProduct.name,
        type: 'IN',
        quantity: newProduct.stock,
        reason: 'Création de produit',
        date: new Date().toISOString(),
        cycleId: get().currentCycle?.id || null,
        restaurant_id: restaurantId
      } : null;

      set(state => ({
        products: [newProduct, ...state.products],
        movements: newMovement ? [newMovement, ...state.movements] : state.movements
      }));

      await insforge.database.from('products').insert([mapToDb(newProduct, productMapping)]);
      if (newMovement) {
        await insforge.database.from('movements').insert([mapToDb(newMovement, movementMapping)]);
      }
      toast.success("Produit ajouté !");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'ajout.");
      set({ products: previousProducts, movements: previousMovements });
    }
  },

  updateProduct: async (id, updatedInfo) => {
    const previousProducts = get().products;
    try {
      const restaurantId = get().auth.restaurant?.id;
      if (!restaurantId) throw new Error("ID Restaurant manquant.");

      set(state => ({ products: state.products.map(p => p.id === id ? { ...p, ...updatedInfo } : p) }));
      await insforge.database.from('products').update(mapToDb(updatedInfo, productMapping)).eq('id', id).eq('restaurant_id', restaurantId);
      toast.success("Mise à jour réussie.");
    } catch (err) {
      console.error(err);
      toast.error("Erreur de mise à jour.");
      set({ products: previousProducts });
    }
  },

  // adjustStock: for IN, apply CUMP (Coût Unitaire Moyen Pondéré); for OUT, just deduct stock
  adjustStock: async (productId, type, quantity, reason, newCostPrice = null) => {
    if (quantity <= 0) return;
    const { products, movements, auth, currentCycle } = get();
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const previousProducts = products;
    const previousMovements = movements;

    try {
      const restaurantId = auth.restaurant?.id;
      if (!restaurantId) throw new Error("ID Restaurant manquant.");

      const newStock = type === 'IN'
        ? product.stock + quantity
        : Math.max(0, product.stock - quantity);

      let updatedFields = { stock: newStock };

      if (type === 'IN' && newCostPrice !== null) {
        const oldStock = product.stock || 0;
        const oldCost = product.costPrice || 0;
        const cumpCostPrice = oldStock === 0
          ? newCostPrice
          : ((oldStock * oldCost) + (quantity * newCostPrice)) / (oldStock + quantity);
        updatedFields.costPrice = Math.round(cumpCostPrice * 10000) / 10000;
      }

      const newMovement = {
        id: 'MOV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
        productId,
        productName: product.name,
        type, quantity, reason,
        date: new Date().toISOString(),
        cycleId: currentCycle?.id || null,
        restaurant_id: restaurantId
      };

      set(state => ({
        products: state.products.map(p => p.id === productId ? { ...p, ...updatedFields } : p),
        movements: [newMovement, ...state.movements]
      }));

      await insforge.database.from('products').update(mapToDb(updatedFields, productMapping)).eq('id', productId).eq('restaurant_id', restaurantId);
      await insforge.database.from('movements').insert([mapToDb(newMovement, movementMapping)]);
      toast.success("Stock ajusté.");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'ajustement.");
      set({ products: previousProducts, movements: previousMovements });
    }
  },

  deleteProduct: async (id) => {
    const previousProducts = get().products;
    const previousCart = get().cart;
    try {
      const restaurantId = get().auth.restaurant?.id;
      if (!restaurantId) throw new Error("ID Restaurant manquant.");

      set(state => ({
        products: state.products.filter(p => p.id !== id),
        cart: state.cart.filter(c => c.product.id !== id)
      }));
      await insforge.database.from('products').update({ archived: true }).eq('id', id).eq('restaurant_id', restaurantId);
      toast.success("Produit supprimé.");
    } catch (err) {
      console.error(err);
      toast.error("Erreur de suppression.");
      set({ products: previousProducts, cart: previousCart });
    }
  },

  // ─── Expenses ────────────────────────────────────────────────────────────
  addExpense: async (amount, reason, category = 'Charges Fixes') => {
    const previousExpenses = get().expenses;
    try {
      const restaurantId = get().auth.restaurant?.id;
      if (!restaurantId) throw new Error("ID Restaurant manquant.");

      const newExpense = {
        id: 'EXP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
        amount, reason, category,
        date: new Date().toISOString(),
        cycle_id: get().currentCycle?.id || null,
        restaurant_id: restaurantId
      };
      set(state => ({ expenses: [newExpense, ...state.expenses] }));
      await insforge.database.from('expenses').insert([mapToDb(newExpense, expenseMapping)]);
      toast.success("Dépense enregistrée.");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'enregistrement de la dépense.");
      set({ expenses: previousExpenses });
    }
  },

  setTableStatus: async (tableId, status) => {
    try {
      const restaurantId = get().auth.restaurant?.id;
      set(state => ({ tables: state.tables.map(t => t.id === tableId ? { ...t, status } : t) }));
      await insforge.database.from('tables').update({ status }).eq('id', tableId).eq('restaurant_id', restaurantId);
    } catch (err) {
      console.error(err);
      toast.error("Erreur table.");
    }
  },

  addTable: async () => {
    const previousTables = get().tables;
    try {
      const restaurantId = get().auth.restaurant?.id;
      if (!restaurantId) throw new Error("ID Restaurant manquant.");

      const tables = get().tables;
      const maxNumber = tables.reduce((max, t) => Math.max(max, t.number || 0), 0);
      const newTable = {
        id: 'TBL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        number: maxNumber + 1,
        status: 'libre',
        restaurant_id: restaurantId
      };
      set(state => ({ tables: [...state.tables, newTable] }));
      await insforge.database.from('tables').insert([newTable]);
      toast.success("Table ajoutée.");
    } catch (err) {
      console.error(err);
      toast.error("Erreur table.");
      set({ tables: previousTables });
    }
  },

  deleteTable: async (tableId) => {
    const previousTables = get().tables;
    try {
      const restaurantId = get().auth.restaurant?.id;
      const table = get().tables.find(t => t.id === tableId);
      if (!table || table.status !== 'libre') {
        toast.error("Impossible de supprimer une table occupée.");
        return false;
      }
      set(state => ({ tables: state.tables.filter(t => t.id !== tableId) }));
      await insforge.database.from('tables').delete().eq('id', tableId).eq('restaurant_id', restaurantId);
      toast.success("Table supprimée.");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Erreur suppression table.");
      set({ tables: previousTables });
      return false;
    }
  },

  hasNewWebOrder: false,
  setHasNewWebOrder: (val) => set({ hasNewWebOrder: val }),
}));
