import { create } from 'zustand';
import { insforge } from '../lib/insforge';
import { playNotificationSound } from '../utils/sound';

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

const productMapping = { minStock: 'min_stock', imageUrl: 'image_url', costBatches: 'cost_batches' };
const cycleMapping = { startTime: 'start_time', endTime: 'end_time', startStock: 'start_stock', endStock: 'end_stock', openedBy: 'opened_by', closedBy: 'closed_by' };
const orderMapping = { tableNumber: 'table_number', paymentMethod: 'payment_method', cycleId: 'cycle_id' };
const movementMapping = { productId: 'product_id', productName: 'product_name', cycleId: 'cycle_id' };
const expenseMapping = { cycleId: 'cycle_id' };

export const useStore = create((set, get) => ({
  isLoading: true,
  isSyncing: false,
  language: 'fr',
  setLanguage: (language) => set({ language }),

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
  isCartOpen: false,
  setIsCartOpen: (isOpen) => set({ isCartOpen: isOpen }),

  initializeStore: async () => {
    set({ isLoading: true });
    try {
      const [{ data: products }, { data: tables }, { data: orders }, { data: movements }, { data: cycles }, { data: expenses }] = await Promise.all([
        insforge.database.from('products').select('*').eq('archived', false),
        insforge.database.from('tables').select('*'),
        insforge.database.from('orders').select('*'),
        insforge.database.from('movements').select('*'),
        insforge.database.from('cycles').select('*'),
        insforge.database.from('expenses').select('*')
      ]);

      const mappedProducts = (products || []).map(p => ({
        ...mapFromDb(p, productMapping),
        costBatches: p.cost_batches || []
      }));

      const mappedOrders = (orders || []).map(o => mapFromDb(o, orderMapping));
      const mappedCycles = (cycles || []).map(c => mapFromDb(c, cycleMapping));
      const mappedMovements = (movements || []).map(m => mapFromDb(m, movementMapping));
      const mappedExpenses = (expenses || []).map(e => mapFromDb(e, expenseMapping));

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

      // Real-time synchronization (InsForge SDK pattern)
      try {
        await insforge.realtime.connect();

        // Subscribe to Orders
        const orderChan = insforge.realtime.subscribe('orders');
        orderChan.on('ORDER_CHANGE', (payload) => {
          const dbOrder = payload;
          const exists = get().orders.some(o => o.id === dbOrder.id);
          const mappedOrder = mapFromDb(dbOrder, orderMapping);
          
          if (!exists) {
            set((state) => ({ 
              orders: [mappedOrder, ...state.orders],
              hasNewWebOrder: mappedOrder.status === 'pending'
            }));
            if (mappedOrder.status === 'pending') {
              playNotificationSound();
            }
          } else {
            set((state) => ({ 
              orders: state.orders.map(o => o.id === mappedOrder.id ? mappedOrder : o) 
            }));
          }
        });

        // Subscribe to Products
        const productChan = insforge.realtime.subscribe('products');
        productChan.on('PRODUCT_CHANGE', (payload) => {
          const dbProduct = payload;
          if (dbProduct.archived) {
             set((state) => ({ products: state.products.filter(p => p.id !== dbProduct.id) }));
          } else {
             const mappedProduct = {
               ...mapFromDb(dbProduct, productMapping),
               costBatches: dbProduct.cost_batches || []
             };
             set((state) => ({ 
               products: state.products.some(p => p.id === dbProduct.id)
                ? state.products.map(p => p.id === dbProduct.id ? mappedProduct : p)
                : [mappedProduct, ...state.products]
             }));
          }
        });

        // Subscribe to Tables
        const tableChan = insforge.realtime.subscribe('tables');
        tableChan.on('TABLE_CHANGE', (payload) => {
          const dbTable = payload;
          set((state) => ({ 
            tables: state.tables.map(t => t.id === dbTable.id ? dbTable : t) 
          }));
        });
      } catch (wsError) {
        console.warn("Real-time sync disabled (WebSocket error):", wsError.message);
      }

    } catch (error) {
      console.error("Failed to initialize store:", error);
      set({ isLoading: false });
    }
  },

  openCycle: async (openedBy) => {
    if (get().currentCycle) return;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const closedTodayCycle = get().cycles.find(c => {
      if (!c.endTime) return false;
      return c.startTime.startsWith(todayStr);
    });

    if (closedTodayCycle) {
      const reopenedCycle = {
        ...closedTodayCycle,
        endTime: null,
        endStock: null,
        closedBy: undefined
      };
      
      set({
        currentCycle: reopenedCycle,
        cycles: get().cycles.map(c => c.id === reopenedCycle.id ? reopenedCycle : c)
      });
      
      await insforge.database.from('cycles').update(mapToDb(reopenedCycle, cycleMapping)).eq('id', reopenedCycle.id);
      return;
    }

    const startStock = get().products.map(p => ({
      productId: p.id,
      name: p.name,
      stock: p.stock
    }));

    const newCycle = {
      id: "SHIFT-" + Math.random().toString(36).substr(2, 6).toUpperCase(),
      startTime: new Date().toISOString(),
      endTime: null,
      startStock,
      endStock: null,
      openedBy
    };

    set({ 
      currentCycle: newCycle,
      cycles: [newCycle, ...get().cycles]
    });

    await insforge.database.from('cycles').insert([mapToDb(newCycle, cycleMapping)]);
  },

  closeCycle: async (closedBy) => {
    const currentCycle = get().currentCycle;
    if (!currentCycle) return;

    const endStock = get().products.map(p => ({
      productId: p.id,
      name: p.name,
      stock: p.stock
    }));

    const finishedCycle = {
      ...currentCycle,
      endTime: new Date().toISOString(),
      endStock,
      closedBy
    };

    set({
      currentCycle: null,
      cycles: get().cycles.map(c => c.id === finishedCycle.id ? finishedCycle : c)
    });

    await insforge.database.from('cycles').update(mapToDb(finishedCycle, cycleMapping)).eq('id', finishedCycle.id);
  },

  // Cart actions
  addToCart: (product, tableNumber = null) => set((state) => {
    if (product.stock <= 0) return state;
    
    const existingItem = state.cart.find(item => item.product.id === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stock) return state; // Block exceeding stock
      return {
        cart: state.cart.map(item =>
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        )
      };
    }
    return { cart: [...state.cart, { product, quantity: 1, sellingPrice: product.price, tableNumber }] };
  }),

  removeFromCart: (productId) => set((state) => ({
    cart: state.cart.filter(item => item.product.id !== productId)
  })),

  updateCartItemPrice: (productId, newPrice) => set((state) => ({
    cart: state.cart.map(item => 
      item.product.id === productId ? { ...item, sellingPrice: newPrice } : item
    )
  })),

  updateCartQuantity: (productId, delta) => set((state) => ({
    cart: state.cart.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty > 0 && newQty <= item.product.stock) {
          return { ...item, quantity: newQty };
        }
      }
      return item;
    })
  })),

  clearCart: () => set({ cart: [] }),

  checkout: async (tableNumber, paymentMethod = 'Espèces') => {
    const { cart, products, currentCycle, orders, tables, movements } = get();
    if (cart.length === 0) return;

    const itemsForOrder = [];
    const updatedProducts = products.map(p => {
      const cartItem = cart.find(item => item.product.id === p.id);
      if (cartItem) {
        let remainingToDeduct = cartItem.quantity;
        let totalCostForThisItem = 0;
        let newCostBatches = [...(p.costBatches || [])];
        
        while (remainingToDeduct > 0 && newCostBatches.length > 0) {
          if (newCostBatches[0].qty <= remainingToDeduct) {
            totalCostForThisItem += newCostBatches[0].qty * newCostBatches[0].cost;
            remainingToDeduct -= newCostBatches[0].qty;
            newCostBatches.shift();
          } else {
            totalCostForThisItem += remainingToDeduct * newCostBatches[0].cost;
            newCostBatches[0] = { ...newCostBatches[0], qty: newCostBatches[0].qty - remainingToDeduct };
            remainingToDeduct = 0;
          }
        }
        
        const avgCostPrice = cartItem.quantity > 0 ? totalCostForThisItem / cartItem.quantity : 0;
        itemsForOrder.push({ ...cartItem, costPrice: avgCostPrice });
        return { ...p, stock: p.stock - cartItem.quantity, costBatches: newCostBatches };
      }
      return p;
    });

    const newOrder = {
      id: "ORD-" + Math.random().toString(36).substr(2, 6).toUpperCase(),
      items: itemsForOrder,
      total: cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0),
      tableNumber,
      paymentMethod,
      status: 'completed',
      timestamp: new Date().toISOString(),
      cycleId: currentCycle?.id || null
    };

    const updatedTables = tables.map(t => 
      t.number === tableNumber ? { ...t, status: 'occupee' } : t
    );

    const newMovements = cart.map(item => ({
      id: "MOV-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      productId: item.product.id,
      productName: item.product.name,
      type: 'OUT',
      quantity: item.quantity,
      reason: `Vente - ${newOrder.id}`,
      date: new Date().toISOString(),
      cycleId: currentCycle?.id || null
    }));

    set({ 
      orders: [newOrder, ...orders],
      products: updatedProducts,
      tables: updatedTables,
      movements: [...newMovements, ...movements],
      cart: [] 
    });

    // Sync to backend
    await Promise.all([
      insforge.database.from('orders').insert([mapToDb(newOrder, orderMapping)]),
      ...updatedProducts.filter(p => cart.find(ci => ci.product.id === p.id)).map(p => 
        insforge.database.from('products').update(mapToDb(p, productMapping)).eq('id', p.id)
      ),
      insforge.database.from('tables').update({ status: 'occupee' }).eq('number', tableNumber),
      insforge.database.from('movements').insert(newMovements.map(m => mapToDb(m, movementMapping)))
    ]);
  },

  acceptWebOrder: async (orderId, paymentMethod = 'Espèces') => {
    const { orders, products, currentCycle, tables, movements } = get();
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status !== 'pending') return;

    const itemsForOrder = [];
    const updatedProducts = products.map(p => {
      const orderItem = order.items.find(item => item.product.id === p.id);
      if (orderItem) {
        let remainingToDeduct = orderItem.quantity;
        let totalCostForThisItem = 0;
        let newCostBatches = [...(p.costBatches || [])];
        
        while (remainingToDeduct > 0 && newCostBatches.length > 0) {
          if (newCostBatches[0].qty <= remainingToDeduct) {
            totalCostForThisItem += newCostBatches[0].qty * newCostBatches[0].cost;
            remainingToDeduct -= newCostBatches[0].qty;
            newCostBatches.shift();
          } else {
            totalCostForThisItem += remainingToDeduct * newCostBatches[0].cost;
            newCostBatches[0] = { ...newCostBatches[0], qty: newCostBatches[0].qty - remainingToDeduct };
            remainingToDeduct = 0;
          }
        }
        
        const avgCostPrice = orderItem.quantity > 0 ? totalCostForThisItem / orderItem.quantity : 0;
        itemsForOrder.push({ ...orderItem, costPrice: avgCostPrice });
        return { ...p, stock: p.stock - orderItem.quantity, costBatches: newCostBatches };
      }
      return p;
    });

    const updatedOrder = {
      ...order,
      status: 'completed',
      paymentMethod,
      cycleId: currentCycle?.id || null
    };

    const updatedTables = tables.map(t => 
      t.number === order.tableNumber ? { ...t, status: 'occupee' } : t
    );

    const newMovements = order.items.map(item => ({
      id: "MOV-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      productId: item.product.id,
      productName: item.product.name,
      type: 'OUT',
      quantity: item.quantity,
      reason: `Vente Web Confirmée - ${order.id}`,
      date: new Date().toISOString(),
      cycleId: currentCycle?.id || null
    }));

    set({ 
      orders: get().orders.map(o => o.id === orderId ? updatedOrder : o),
      products: updatedProducts,
      tables: updatedTables,
      movements: [...newMovements, ...movements],
      hasNewWebOrder: get().orders.filter(o => o.id !== orderId && o.status === 'pending').length > 0
    });

    // Sync to backend
    await Promise.all([
      insforge.database.from('orders').update(mapToDb(updatedOrder, orderMapping)).eq('id', orderId),
      ...updatedProducts.filter(p => order.items.find(oi => oi.product.id === p.id)).map(p => 
        insforge.database.from('products').update(mapToDb(p, productMapping)).eq('id', p.id)
      ),
      insforge.database.from('tables').update({ status: 'occupee' }).eq('number', order.tableNumber),
      insforge.database.from('movements').insert(newMovements.map(m => mapToDb(m, movementMapping)))
    ]);
  },

  rejectWebOrder: async (orderId) => {
    set((state) => ({
      orders: state.orders.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o),
      hasNewWebOrder: state.orders.filter(o => o.id !== orderId && o.status === 'pending').length > 0
    }));

    await insforge.database.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
  },

  cancelOrder: (orderId) => set((state) => {
    const orderIndex = state.orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return state;
    
    const order = state.orders[orderIndex];
    if (order.status === 'cancelled') return state;

    const updatedOrders = [...state.orders];
    updatedOrders[orderIndex] = { ...order, status: 'cancelled' };

    const updatedProducts = state.products.map(p => {
      const canceledItem = order.items.find(item => item.product.id === p.id);
      if (canceledItem) {
        const newCostBatches = [...(p.costBatches || [])];
        newCostBatches.push({ qty: canceledItem.quantity, cost: canceledItem.costPrice || 0 });
        
        return { ...p, stock: p.stock + canceledItem.quantity, costBatches: newCostBatches };
      }
      return p;
    });

    const newMovements = order.items.map(item => ({
      id: "MOV-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      productId: item.product.id,
      productName: item.product.name,
      type: 'IN',
      quantity: item.quantity,
      reason: `Annulation Commande - ${order.id}`,
      date: new Date().toISOString(),
      cycleId: state.currentCycle?.id || null
    }));

    return {
      orders: updatedOrders,
      products: updatedProducts,
      movements: [...newMovements, ...state.movements]
    };
  }),

  // Handle incoming customer menu order
  submitWebOrder: async (tableNumber, clientCart) => {
    if (clientCart.length === 0) return;
    
    const newOrder = {
      id: "WEB-" + Math.random().toString(36).substr(2, 6).toUpperCase(),
      items: clientCart,
      total: clientCart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0),
      tableNumber,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    // UI Optimistic update
    set((state) => ({ 
      orders: [newOrder, ...state.orders],
      tables: state.tables.map(t => Number(t.number) === Number(tableNumber) ? { ...t, status: 'service_demande' } : t),
      hasNewWebOrder: true
    }));

    // Sync to cloud
    await Promise.all([
      insforge.database.from('orders').insert([mapToDb(newOrder, orderMapping)]),
      insforge.database.from('tables').update({ status: 'service_demande' }).eq('number', tableNumber)
    ]);
  },

  setTableStatus: async (tableId, status) => {
    set((state) => ({
      tables: state.tables.map(t => t.id === tableId ? { ...t, status } : t)
    }));
    await insforge.database.from('tables').update({ status }).eq('id', tableId);
  },

  addProduct: async (productInfo) => {
    const newId = "PRD-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4);
    const newMovement = {
      id: "MOV-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4).toUpperCase(),
      productId: newId,
      productName: productInfo.name,
      type: 'IN',
      quantity: productInfo.stock,
      reason: `Création de produit`,
      date: new Date().toISOString(),
      cycleId: get().currentCycle?.id || null
    };

    // Strip internal/form fields before saving to DB
    const { unitCost, ...cleanProductInfo } = productInfo;

    const newProduct = { 
      ...cleanProductInfo, 
      id: newId,
      archived: false,
      costBatches: productInfo.stock > 0 ? [{ qty: productInfo.stock, cost: productInfo.unitCost || 0 }] : []
    };
    set((state) => ({
      products: [newProduct, ...state.products],
      movements: productInfo.stock > 0 ? [newMovement, ...state.movements] : state.movements
    }));
    await insforge.database.from('products').insert([mapToDb(newProduct, productMapping)]);
    if (productInfo.stock > 0) {
      await insforge.database.from('movements').insert([mapToDb(newMovement, movementMapping)]);
    }
  },

  updateProduct: async (id, updatedInfo) => {
    set((state) => ({
      products: state.products.map(p => p.id === id ? { ...p, ...updatedInfo } : p)
    }));
    await insforge.database.from('products').update(mapToDb(updatedInfo, productMapping)).eq('id', id);
  },

  adjustStock: async (productId, type, quantity, reason, unitCost = 0) => {
    if (quantity <= 0) return;
    const product = get().products.find(p => p.id === productId);
    if (!product) return;

    let newStock = product.stock;
    let newCostBatches = [...(product.costBatches || [])];

    if (type === 'IN') {
      newStock += quantity;
      newCostBatches.push({ qty: quantity, cost: unitCost });
    } else {
      newStock = Math.max(0, product.stock - quantity);
      let remainingToDeduct = quantity;
      while (remainingToDeduct > 0 && newCostBatches.length > 0) {
        if (newCostBatches[0].qty <= remainingToDeduct) {
          remainingToDeduct -= newCostBatches[0].qty;
          newCostBatches.shift();
        } else {
          newCostBatches[0] = { ...newCostBatches[0], qty: newCostBatches[0].qty - remainingToDeduct };
          remainingToDeduct = 0;
        }
      }
    }

    const newMovement = {
      id: "MOV-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4).toUpperCase(),
      productId,
      productName: product.name,
      type,
      quantity,
      reason,
      date: new Date().toISOString(),
      cycleId: get().currentCycle?.id || null
    };

    set((state) => ({
      products: state.products.map(p => p.id === productId ? { ...p, stock: newStock, costBatches: newCostBatches } : p),
      movements: [newMovement, ...state.movements]
    }));

    await insforge.database.from('products').update({ stock: newStock, cost_batches: newCostBatches }).eq('id', productId);
    await insforge.database.from('movements').insert([mapToDb(newMovement, movementMapping)]);
  },

  deleteProduct: async (id) => {
    set((state) => ({
      products: state.products.filter(p => p.id !== id),
      cart: state.cart.filter(c => c.product.id !== id)
    }));
    await insforge.database.from('products').update({ archived: true }).eq('id', id);
  },

  addExpense: async (amount, reason, category = 'Charges Fixes') => {
    const newExpense = {
      id: "EXP-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      amount,
      reason,
      category,
      date: new Date().toISOString(),
      cycle_id: get().currentCycle?.id || null
    };
    set((state) => ({
      expenses: [newExpense, ...state.expenses]
    }));
    await insforge.database.from('expenses').insert([mapToDb(newExpense, expenseMapping)]);
  },

  hasNewWebOrder: false,
  setHasNewWebOrder: (val) => set({ hasNewWebOrder: val }),
}));
