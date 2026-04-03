import { create } from 'zustand';
import { insforge } from '../lib/insforge';
import { playNotificationSound } from '../utils/sound';
import { toast } from 'react-hot-toast';
import { getAllOffline } from '../utils/offlineQueue';

import { createAuthSlice } from './slices/authSlice';
import { createCyclesSlice } from './slices/cyclesSlice';
import { createCartSlice } from './slices/cartSlice';
import { createInventorySlice } from './slices/inventorySlice';
import { createOrdersSlice } from './slices/ordersSlice';
import { createTablesSlice } from './slices/tablesSlice';
import { createExpensesSlice } from './slices/expensesSlice';
import { createStaffSlice } from './slices/staffSlice';
import { createOfflineSlice } from './slices/offlineSlice';
import { mapFromDb, productMapping, orderMapping, movementMapping, cycleMapping, expenseMapping, mockTables } from './mappings';

// ─── WebSocket: exponential backoff retry ─────────────────────────────────────
const WS_MAX_RETRIES = 5;
const WS_BASE_DELAY_MS = 1000;

async function connectRealtimeWithRetry(attempt = 0) {
  try {
    await insforge.realtime.connect();
    return true;
  } catch (err) {
    if (attempt >= WS_MAX_RETRIES) {
      console.warn(`Real-time: giving up after ${WS_MAX_RETRIES} retries.`, err.message);
      return false;
    }
    const delay = Math.min(WS_BASE_DELAY_MS * 2 ** attempt, 30000);
    console.warn(`Real-time: retry ${attempt + 1}/${WS_MAX_RETRIES} in ${delay}ms`, err.message);
    await new Promise(r => setTimeout(r, delay));
    return connectRealtimeWithRetry(attempt + 1);
  }
}

export const useStore = create((set, get) => ({
  // isLoading est géré exclusivement par authSlice (évite la double déclaration)
  // La valeur initiale est définie dans createAuthSlice selon savedAuth.isAuthenticated

  isSyncing: false,
  language: 'fr',
  setLanguage: (language) => set({ language }),

  ...createAuthSlice(set, get),
  ...createCyclesSlice(set, get),
  ...createCartSlice(set, get),
  ...createInventorySlice(set, get),
  ...createOrdersSlice(set, get),
  ...createTablesSlice(set, get),
  ...createExpensesSlice(set, get),
  ...createStaffSlice(set, get),
  ...createOfflineSlice(set, get),

  // ─── initializeStore (cross-cutting: loads all data + realtime) ────────────
  initializeStore: async (retryAttempt = 0) => {
    if (!get().auth.isAuthenticated) {
      set({ isLoading: false });
      return;
    }

    const restaurantId = get().auth.restaurant?.id;
    if (!restaurantId) {
      set({ isLoading: false });
      return;
    }

    // Assurer que le spinner s'affiche
    if (retryAttempt === 0) set({ isLoading: true });

    try {
      // 1. FORCER L'ATTENTE DU TOKEN (Résolution Race Condition)
      // La promesse getSession garantit que le SDK local a hydraté ses headers JWT
      const { data: sessionData, error: sessionError } = await insforge.auth.getSession();
      if (sessionError || !sessionData?.session) {
        throw new Error('Session non complètement propagée.');
      }

      // 2. Fetch Data (Promises)
      const [
        productsRes,
        tablesRes,
        ordersRes,
        movementsRes,
        cyclesRes,
        expensesRes,
        staffRes
      ] = await Promise.all([
        insforge.database.from('products').select('*').eq('restaurant_id', restaurantId).eq('archived', false),
        insforge.database.from('tables').select('*').eq('restaurant_id', restaurantId),
        insforge.database.from('orders').select('*').eq('restaurant_id', restaurantId),
        insforge.database.from('movements').select('*').eq('restaurant_id', restaurantId),
        insforge.database.from('cycles').select('*').eq('restaurant_id', restaurantId),
        insforge.database.from('expenses').select('*').eq('restaurant_id', restaurantId),
        insforge.database.from('staff').select('*').eq('restaurant_id', restaurantId)
      ]);

      // Regrouper les erreurs éventuelles pour déclencher le retry
      const errors = [productsRes.error, tablesRes.error, ordersRes.error, movementsRes.error, cyclesRes.error, expensesRes.error, staffRes.error].filter(Boolean);
      if (errors.length > 0) {
        throw errors[0]; // On lance la première erreur trouvée pour entrer dans le bloc Catch
      }

      // 3. Mapping
      const mappedProducts  = (productsRes.data || []).map(p => ({ ...mapFromDb(p, productMapping), costPrice: p.cost_price ?? null }));
      const mappedOrders    = (ordersRes.data || []).map(o => mapFromDb(o, orderMapping));
      const mappedCycles    = (cyclesRes.data || []).map(c => mapFromDb(c, cycleMapping));
      const mappedMovements = (movementsRes.data || []).map(m => mapFromDb(m, movementMapping));
      const mappedExpenses  = (expensesRes.data || []).map(e => mapFromDb(e, expenseMapping));

      const savedQueue = await getAllOffline().catch(() => []);

      // 4. Update state success
      set({
        products: mappedProducts,
        tables: (tablesRes.data?.length > 0) ? tablesRes.data : mockTables,
        orders: mappedOrders,
        movements: mappedMovements,
        cycles: mappedCycles,
        currentCycle: mappedCycles.find(c => !c.endTime) || null,
        expenses: mappedExpenses,
        staff: staffRes.data || [],
        offlineQueue: savedQueue,
        isLoading: false
      });

      // 5. Connect Realtime
      const connected = await connectRealtimeWithRetry();
      if (!connected) {
        console.warn('Real-time sync disabled (all retries exhausted).');
        return;
      }

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
          const mapped = { ...mapFromDb(payload, productMapping), costPrice: payload.cost_price ?? null };
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

    } catch (err) {
      console.error(`Failed to initialize store (Attempt ${retryAttempt + 1}):`, err);
      
      const isConfigError = err?.code === 'PGRST301' || err?.message?.toLowerCase().includes('rls') || err?.message?.toLowerCase().includes('session non');

      // LOGIQUE DE RETRY SI ERREUR TEMPORAIRE / RACE CONDITION
      const MAX_RETRIES = 3;
      if (retryAttempt < MAX_RETRIES) {
        console.warn(`Nouvelle tentative dans 1s... (${retryAttempt + 1}/${MAX_RETRIES})`);
        setTimeout(() => {
          get().initializeStore(retryAttempt + 1);
        }, 1000);
        return; // Ne pas afficher l'erreur ni casser le chargement
      }

      // Si toutes les tentatives échouent :
      if (!isConfigError) {
        toast.error("Échec du chargement des données. Veuillez rafraîchir.");
      }
      set({ isLoading: false });
    }
  },
}));
