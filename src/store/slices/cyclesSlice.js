import { insforge } from '../../lib/insforge';
import { toast } from 'react-hot-toast';
import { mapToDb, cycleMapping } from '../mappings';

export const createCyclesSlice = (set, get) => ({
  cycles: [],
  currentCycle: null,

  openCycle: async (openedBy) => {
    if (get().currentCycle) return;

    // ── Guard : restaurantId obligatoire ──────────────────────────────────────
    const restaurantId = get().auth.restaurant?.id;
    if (!restaurantId) {
      toast.error("Session invalide. Reconnectez-vous.");
      return;
    }

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const closedToday = get().cycles.find(c => c.endTime && c.startTime.startsWith(todayStr));

      if (closedToday) {
        const reopened = { ...closedToday, endTime: null, endStock: null, closedBy: undefined };
        set({
          currentCycle: reopened,
          cycles: get().cycles.map(c => c.id === reopened.id ? reopened : c)
        });
        await insforge.database
          .from('cycles')
          .update(mapToDb(reopened, cycleMapping))
          .eq('id', reopened.id)
          .eq('restaurant_id', restaurantId);
        toast.success("Service du jour réouvert.");
        return;
      }

      const startStock = get().products.map(p => ({ productId: p.id, name: p.name, stock: p.stock }));
      const newCycle = {
        id:           'SHIFT-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        startTime:    new Date().toISOString(),
        endTime:      null,
        startStock,
        endStock:     null,
        openedBy:     openedBy || null,
        restaurant_id: restaurantId
      };

      set({ currentCycle: newCycle, cycles: [newCycle, ...get().cycles] });

      const { error } = await insforge.database
        .from('cycles')
        .insert([mapToDb(newCycle, cycleMapping)]);

      if (error) throw error;
      toast.success("Service démarré !");
    } catch (err) {
      console.error(err);
      // Rollback optimiste
      set(state => ({
        currentCycle: null,
        cycles: state.cycles.filter(c => !c.id?.startsWith('SHIFT-'))
      }));
      toast.error("Impossible d'ouvrir le service.");
    }
  },

  closeCycle: async (closedBy) => {
    const cycle = get().currentCycle;
    if (!cycle) return;

    // ── Guard : restaurantId obligatoire ──────────────────────────────────────
    const restaurantId = get().auth.restaurant?.id;
    if (!restaurantId) {
      toast.error("Session invalide. Reconnectez-vous.");
      return;
    }

    try {
      const endStock  = get().products.map(p => ({ productId: p.id, name: p.name, stock: p.stock }));
      const finished  = {
        ...cycle,
        endTime:  new Date().toISOString(),
        endStock,
        closedBy: closedBy || null
      };

      set({
        currentCycle: null,
        cycles: get().cycles.map(c => c.id === finished.id ? finished : c)
      });

      const { error } = await insforge.database
        .from('cycles')
        .update(mapToDb(finished, cycleMapping))
        .eq('id', finished.id)
        .eq('restaurant_id', restaurantId);

      if (error) throw error;
      toast.success("Service clôturé avec succès.");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la clôture.");
    }
  },
});
