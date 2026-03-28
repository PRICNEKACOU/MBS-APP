import { create } from 'zustand';

const mockProducts = [
  { id: '1', name: 'Neon Mojito', category: 'Cocktails', price: 7800, stock: 15, minStock: 5, imageUrl: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&h=400&fit=crop' },
  { id: '2', name: 'Cyberpunk IPA', category: 'Beers', price: 5000, stock: 4, minStock: 10, imageUrl: 'https://images.unsplash.com/photo-1629851703274-1b15beadd5f5?w=400&h=400&fit=crop' },
  { id: '3', name: 'Midnight Espresso', category: 'Cocktails', price: 9000, stock: 0, minStock: 5, imageUrl: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=400&h=400&fit=crop' },
  { id: '4', name: 'Synthwave Whiskey', category: 'Spirits', price: 12000, stock: 20, minStock: 10, imageUrl: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&h=400&fit=crop' },
  { id: '5', name: 'Laser Lime Soda', category: 'Softs', price: 3000, stock: 50, minStock: 20, imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&h=400&fit=crop' }
];

const mockTables = Array.from({ length: 12 }, (_, i) => ({
  id: (i + 1).toString(),
  number: i + 1,
  status: 'libre' // 'libre', 'occupee', 'service_demande'
}));

const loadInitial = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch(e) {
    console.error("Local storage error:", e);
  }
  return fallback;
};

const loadInventory = () => {
  try {
    const saved = localStorage.getItem('inventory');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map(p => ({
        ...p,
        costBatches: p.costBatches || [{ qty: p.stock, cost: 0 }]
      }));
    }
  } catch(e) {
    console.error("Local storage error:", e);
  }
  return mockProducts.map(p => ({
    ...p,
    costBatches: p.costBatches || [{ qty: p.stock, cost: 0 }]
  }));
};

export const useStore = create((set, get) => ({
  language: 'fr',
  setLanguage: (language) => set({ language }),

  currency: 'CFA',
  setCurrency: (currency) => set({ currency }),

  products: loadInventory(),
  tables: loadInitial('tables', mockTables),
  orders: loadInitial('orders', []),
  movements: loadInitial('movements', []),
  cycles: loadInitial('cycles', []),
  currentCycle: loadInitial('currentCycle', null),
  expenses: loadInitial('expenses', []),
  cart: [],

  // Service Cycles
  openCycle: () => set((state) => {
    if (state.currentCycle) return state;

    // Determine today's date local
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    // Find any closed cycle from today
    const closedTodayCycleIndex = state.cycles.findIndex(c => {
      if (!c.endTime) return false;
      const cDate = new Date(c.startTime);
      const cDateStr = cDate.getFullYear() + '-' + String(cDate.getMonth() + 1).padStart(2, '0') + '-' + String(cDate.getDate()).padStart(2, '0');
      return cDateStr === todayStr;
    });

    if (closedTodayCycleIndex !== -1) {
      // Re-open instead of overriding
      const reopenedCycle = {
        ...state.cycles[closedTodayCycleIndex],
        endTime: null,
        endStock: null,
        closedBy: undefined
      };
      
      const updatedCycles = [...state.cycles];
      updatedCycles[closedTodayCycleIndex] = reopenedCycle;
      
      setTimeout(() => alert("Session du jour rouverte avec succès !"), 100);

      return {
        currentCycle: reopenedCycle,
        cycles: updatedCycles
      };
    }

    const startStock = state.products.map(p => ({
      productId: p.id,
      name: p.name,
      stock: p.stock
    }));

    const newCycle = {
      id: "SHIFT-" + Math.random().toString(36).substr(2, 6).toUpperCase(),
      startTime: new Date().toISOString(),
      endTime: null,
      startStock,
      endStock: null
    };

    return { 
      currentCycle: newCycle,
      cycles: [newCycle, ...state.cycles]
    };
  }),

  closeCycle: () => set((state) => {
    if (!state.currentCycle) return state;

    const endStock = state.products.map(p => ({
      productId: p.id,
      name: p.name,
      stock: p.stock
    }));

    const finishedCycle = {
      ...state.currentCycle,
      endTime: new Date().toISOString(),
      endStock
    };

    return {
      currentCycle: null,
      cycles: state.cycles.map(c => c.id === finishedCycle.id ? finishedCycle : c)
    };
  }),

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

  // Checkout simulating POS transaction
  checkout: (tableNumber, paymentMethod = 'Espèces') => set((state) => {
    if (state.cart.length === 0) return state;

    const itemsForOrder = [];
    
    // Deduct stock and calculate FIFO cost
    const updatedProducts = state.products.map(p => {
      const cartItem = state.cart.find(item => item.product.id === p.id);
      if (cartItem) {
        let remainingToDeduct = cartItem.quantity;
        let totalCostForThisItem = 0;
        let newCostBatches = [...(p.costBatches || [])];
        
        while (remainingToDeduct > 0 && newCostBatches.length > 0) {
          if (newCostBatches[0].qty <= remainingToDeduct) {
            totalCostForThisItem += newCostBatches[0].qty * newCostBatches[0].cost;
            remainingToDeduct -= newCostBatches[0].qty;
            newCostBatches.shift(); // Remove empty batch
          } else {
            totalCostForThisItem += remainingToDeduct * newCostBatches[0].cost;
            newCostBatches[0] = { ...newCostBatches[0], qty: newCostBatches[0].qty - remainingToDeduct };
            remainingToDeduct = 0;
          }
        }
        
        const avgCostPrice = cartItem.quantity > 0 ? totalCostForThisItem / cartItem.quantity : 0;
        
        itemsForOrder.push({
          ...cartItem,
          costPrice: avgCostPrice
        });

        return { ...p, stock: p.stock - cartItem.quantity, costBatches: newCostBatches };
      }
      return p;
    });

    const newOrder = {
      id: "ORD-" + Math.random().toString(36).substr(2, 6).toUpperCase(),
      items: itemsForOrder,
      total: state.cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0),
      tableNumber,
      paymentMethod,
      status: 'completed',
      timestamp: new Date().toISOString(),
      cycleId: state.currentCycle?.id || null
    };

    const updatedTables = state.tables.map(t => 
      t.number === tableNumber ? { ...t, status: 'occupee' } : t
    );

    const newMovements = state.cart.map(item => ({
      id: "MOV-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      productId: item.product.id,
      productName: item.product.name,
      type: 'OUT',
      quantity: item.quantity,
      reason: `Vente - ${newOrder.id}`,
      date: new Date().toISOString(),
      cycleId: state.currentCycle?.id || null
    }));

    return { 
      orders: [newOrder, ...state.orders],
      products: updatedProducts,
      tables: updatedTables,
      movements: [...newMovements, ...state.movements],
      cart: [] 
    };
  }),

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
        // Return to stock with its exact average costPrice it was sold at
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

  // Simulate incoming customer menu order
  submitWebOrder: (tableNumber, clientCart) => set((state) => {
    if (clientCart.length === 0) return state;
    
    const newOrder = {
      id: "WEB-" + Math.random().toString(36).substr(2, 6).toUpperCase(),
      items: clientCart,
      total: clientCart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0),
      tableNumber,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    // Customer places order, table needs service, and trigger notification
    const updatedTables = state.tables.map(t => 
      t.number === tableNumber ? { ...t, status: 'service_demande' } : t
    );

    return { 
      orders: [newOrder, ...state.orders],
      tables: updatedTables,
      hasNewWebOrder: true
    };
  }),

  // Table actions
  setTableStatus: (tableId, status) => set((state) => ({
    tables: state.tables.map(t => t.id === tableId ? { ...t, status } : t)
  })),

  // Product Management actions
  addProduct: (productInfo) => set((state) => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newMovement = {
      id: "MOV-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      productId: newId,
      productName: productInfo.name,
      type: 'IN',
      quantity: productInfo.stock,
      reason: `Création de produit`,
      date: new Date().toISOString(),
      cycleId: state.currentCycle?.id || null
    };
    const newProduct = { 
      ...productInfo, 
      id: newId,
      costBatches: productInfo.stock > 0 ? [{ qty: productInfo.stock, cost: productInfo.unitCost || 0 }] : []
    };
    return {
      products: [newProduct, ...state.products],
      movements: productInfo.stock > 0 ? [newMovement, ...state.movements] : state.movements
    };
  }),

  updateProduct: (id, updatedInfo) => set((state) => {
    return {
      products: state.products.map(p => p.id === id ? { ...p, ...updatedInfo } : p)
    };
  }),

  adjustStock: (productId, type, quantity, reason, unitCost = 0) => set((state) => {
    if (quantity <= 0) return state;
    const product = state.products.find(p => p.id === productId);
    if (!product) return state;

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
      id: "MOV-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      productId,
      productName: product.name,
      type,
      quantity,
      reason,
      date: new Date().toISOString(),
      cycleId: state.currentCycle?.id || null
    };

    return {
      products: state.products.map(p => p.id === productId ? { ...p, stock: newStock, costBatches: newCostBatches } : p),
      movements: [newMovement, ...state.movements]
    };
  }),

  deleteProduct: (id) => set((state) => ({
    products: state.products.filter(p => p.id !== id),
    cart: state.cart.filter(c => c.product.id !== id) // Remove from cart if deleted
  })),

  // Expenses management
  addExpense: (amount, reason, category = 'Charges Fixes') => set((state) => {
    const newExpense = {
      id: "EXP-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      amount,
      reason,
      category,
      date: new Date().toISOString(),
      cycleId: state.currentCycle?.id || null
    };
    return {
      expenses: [newExpense, ...state.expenses]
    };
  }),

  // Notification for incoming web orders
  hasNewWebOrder: false,
  setHasNewWebOrder: (val) => set({ hasNewWebOrder: val }),
}));

// Subscribe to all changes and push to localStorage
useStore.subscribe((state) => {
  try {
    localStorage.setItem('inventory', JSON.stringify(state.products));
    localStorage.setItem('tables', JSON.stringify(state.tables));
    localStorage.setItem('orders', JSON.stringify(state.orders));
    localStorage.setItem('movements', JSON.stringify(state.movements));
    localStorage.setItem('cycles', JSON.stringify(state.cycles));
    localStorage.setItem('currentCycle', JSON.stringify(state.currentCycle));
    localStorage.setItem('expenses', JSON.stringify(state.expenses));
  } catch (e) {
    console.error("Failed to save state via subscribe:", e);
  }
});
