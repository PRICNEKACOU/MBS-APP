import { insforge } from '../../lib/insforge';
import { toast } from 'react-hot-toast';
import { mapToDb, mapFromDb, productMapping, movementMapping } from '../mappings';

export const createInventorySlice = (set, get) => ({
  products: [],
  movements: [],

  addProduct: async (productInfo) => {
    const previousProducts = get().products;
    const previousMovements = get().movements;
    try {
      const restaurantId = get().auth.restaurant?.id;
      if (!restaurantId) throw new Error("ID Restaurant manquant.");

      const newId = 'PRD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
      // Normalisation stricte des types – évite les comparaisons string-number dans le rendu
      const newProduct = {
        id: newId,
        archived: false,
        name: productInfo.name ?? '',
        category: productInfo.category ?? 'Cocktails',
        price: Number(productInfo.price) || 0,
        costPrice: Number(productInfo.costPrice) || 0,
        stock: Number(productInfo.stock) || 20,
        minStock: Number(productInfo.minStock) || 5,
        imageUrl: productInfo.imageUrl ?? '',
        restaurant_id: restaurantId
      };

      const newMovement = productInfo.stock > 0 ? {
        id: 'MOV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
        productId: newId,
        productName: newProduct.name,
        type: 'IN', quantity: newProduct.stock,
        reason: 'Création de produit',
        date: new Date().toISOString(),
        cycleId: get().currentCycle?.id || null,
        restaurant_id: restaurantId
      } : null;

      set(state => ({
        products: [newProduct, ...state.products],
        movements: newMovement ? [newMovement, ...state.movements] : state.movements
      }));

      const { error: insertError } = await insforge.database.from('products').insert([mapToDb(newProduct, productMapping)]);
      if (insertError) throw new Error(insertError.message || "Échec insertion produit");
      if (newMovement) {
        const { error: movError } = await insforge.database.from('movements').insert([mapToDb(newMovement, movementMapping)]);
        if (movError) console.error("Erreur mouvement:", movError);
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

      const newStock = type === 'IN' ? product.stock + quantity : Math.max(0, product.stock - quantity);
      let updatedFields = { stock: newStock };

      if (type === 'IN' && newCostPrice !== null) {
        const oldStock = product.stock || 0;
        const oldCost = product.costPrice || 0;
        const cump = oldStock === 0
          ? newCostPrice
          : ((oldStock * oldCost) + (quantity * newCostPrice)) / (oldStock + quantity);
        updatedFields.costPrice = Math.round(cump * 10000) / 10000;
      }

      const newMovement = {
        id: 'MOV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
        productId, productName: product.name,
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
});
