import { insforge } from '../../lib/insforge';
import { toast } from 'react-hot-toast';
import { mapToDb, orderMapping, movementMapping } from '../mappings';
import { enqueueOffline, setOfflineQueue } from '../../utils/offlineQueue';

export const createOfflineSlice = (set, get) => ({
  offlineQueue: [],

  addToOfflineQueue: async (entry) => {
    await enqueueOffline(entry);
    set(state => ({ offlineQueue: [...state.offlineQueue, entry] }));
  },

  syncOfflineQueue: async () => {
    const queue = get().offlineQueue;
    if (queue.length === 0) return;

    const failed = [];
    for (const entry of queue) {
      try {
        if (entry.type === 'order') {
          await insforge.database.from('orders').insert([mapToDb(entry.order, orderMapping)]);
          for (const su of entry.stockUpdates) {
            await insforge.database.from('products').update({ stock: su.stock }).eq('id', su.id).eq('restaurant_id', entry.order.restaurant_id);
          }
          if (entry.movements?.length) {
            await insforge.database.from('movements').insert(entry.movements.map(m => mapToDb(m, movementMapping)));
          }
          if (entry.tableUpdate) {
            await insforge.database.from('tables').update({ status: 'occupee' }).eq('number', entry.tableUpdate).eq('restaurant_id', entry.order.restaurant_id);
          }
        }
      } catch (err) {
        console.error('Sync failed for entry:', entry, err);
        failed.push(entry);
      }
    }
    await setOfflineQueue(failed);
    set({ offlineQueue: failed });
    if (failed.length === 0 && queue.length > 0) {
      toast.success(`${queue.length} commande(s) synchronisée(s) !`);
    } else if (failed.length > 0) {
      toast.error(`${failed.length} commande(s) en attente de sync.`);
    }
  },
});
