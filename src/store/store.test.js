import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from './store';

// Mock localStorage to execute in pure Node.js background environment smoothly
global.localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn()
};

describe('Zustand Global Store - Core Logic Tests', () => {
  beforeEach(() => {
    // Reset global state to a clean slate before each test
    useStore.setState({
      products: [
        { id: '1', name: 'Neon Mojito', category: 'Cocktails', price: 7800, stock: 15, minStock: 5 },
        { id: '2', name: 'Cyberpunk IPA', category: 'Beers', price: 5000, stock: 4, minStock: 10 }
      ],
      orders: [],
      movements: [],
      cycles: [],
      currentCycle: { id: 'TEST-SHIFT', startTime: new Date().toISOString() },
      cart: []
    });
  });

  it('1. Créer une commande : déduit le stock et crée l\'historique (Vente OUT)', () => {
    const store = useStore.getState();
    const product = store.products[0];
    
    // Add 2 items to cart
    store.addToCart(product, 'TABLE-1');
    store.addToCart(product, 'TABLE-1'); // quantity is now 2
    
    const stateAfterCart = useStore.getState();
    expect(stateAfterCart.cart.length).toBe(1);
    expect(stateAfterCart.cart[0].quantity).toBe(2);
    
    // Process Checkout
    stateAfterCart.checkout('TABLE-1');
    
    const finalState = useStore.getState();
    
    // Order verification
    expect(finalState.orders.length).toBe(1);
    expect(finalState.orders[0].items[0].product.id).toBe('1');
    expect(finalState.cart.length).toBe(0);
    
    // Stock Deducted Verification (15 - 2 = 13)
    const updatedProduct = finalState.products.find(p => p.id === '1');
    expect(updatedProduct.stock).toBe(13);
    
    // Automatic Log history Verification
    const movement = finalState.movements.find(m => m.productId === '1');
    expect(movement).toBeDefined();
    expect(movement.type).toBe('OUT');
    expect(movement.quantity).toBe(2);
    expect(movement.reason).toContain('Vente');
  });

  it('2. Annuler une commande : recrédite le stock et crée l\'historique (Remboursement IN)', () => {
    // Setup fake history
    const fakeOrder = {
      id: 'ORD-TEST001',
      status: 'completed',
      items: [
        { product: { id: '2', name: 'Cyberpunk IPA', price: 5000 }, quantity: 3 }
      ],
      total: 15000
    };
    
    // Set stock to 4
    useStore.setState({
      orders: [fakeOrder],
      products: [{ id: '2', name: 'Cyberpunk IPA', stock: 4, minStock: 10 }],
      movements: [] // Clear history
    });
    
    // Execute cancellation (3 IPAs refunded)
    useStore.getState().cancelOrder('ORD-TEST001');
    
    const finalState = useStore.getState();
    
    // Verification Flag
    expect(finalState.orders[0].status).toBe('cancelled');
    
    // Stock refunded verification (4 + 3 = 7)
    expect(finalState.products[0].stock).toBe(7);
    
    // Automatic Log history Verification
    expect(finalState.movements.length).toBe(1);
    expect(finalState.movements[0].type).toBe('IN');
    expect(finalState.movements[0].quantity).toBe(3);
    expect(finalState.movements[0].reason).toContain('Annulation');
    expect(finalState.movements[0].productId).toBe('2');
  });

  it('3. Mouvement manuel : ajuste le stock et log proprement la raison de l\'auditeur', () => {
    // INIT STATE: Product 1 has 15 stock. Product 2 has 4 stock.

    // Test A: Entrée de stock
    useStore.getState().adjustStock('1', 'IN', 10, 'Livraison Fournisseur');
    let state = useStore.getState();
    
    expect(state.products.find(p => p.id === '1').stock).toBe(25); // 15 + 10 = 25
    expect(state.movements.length).toBe(1);
    expect(state.movements[0].type).toBe('IN');
    expect(state.movements[0].quantity).toBe(10);
    expect(state.movements[0].reason).toBe('Livraison Fournisseur');
    
    // Test B: Sortie de stock
    useStore.getState().adjustStock('2', 'OUT', 2, 'Casse Verre Imprudence');
    state = useStore.getState();
    
    expect(state.products.find(p => p.id === '2').stock).toBe(2); // 4 - 2 = 2
    expect(state.movements.length).toBe(2); // The newest goes to top
    expect(state.movements[0].type).toBe('OUT');
    expect(state.movements[0].quantity).toBe(2);
    expect(state.movements[0].reason).toBe('Casse Verre Imprudence');
  });

  it('4. Encaisser avec un mode de paiement : enregistre le mode (Mobile Money)', () => {
    const store = useStore.getState();
    const product = store.products[0];
    
    // Add 1 item
    store.addToCart(product, 'TABLE-1');
    const stateAfterCart = useStore.getState();
    
    // Process Checkout with Payment Method
    stateAfterCart.checkout('TABLE-1', 'Mobile Money');
    
    const finalState = useStore.getState();
    
    // Check order has paymentMethod
    expect(finalState.orders.length).toBe(1);
    expect(finalState.orders[0].paymentMethod).toBe('Mobile Money');
    expect(finalState.orders[0].total).toBe(7800);
  });

  it('5. Petite Caisse : Ajouter une dépense le déduit virtuellement du Solde', () => {
    const store = useStore.getState();
    
    // Create an expense
    store.addExpense(2000, 'Achat de glaçons');
    
    const finalState = useStore.getState();
    expect(finalState.expenses.length).toBe(1);
    expect(finalState.expenses[0].amount).toBe(2000);
    expect(finalState.expenses[0].reason).toBe('Achat de glaçons');
    expect(finalState.expenses[0].date).toBeDefined();
  });
});
