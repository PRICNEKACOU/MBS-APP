import { insforge } from '../../lib/insforge';
import { toast } from 'react-hot-toast';
import { mockTables } from '../mappings';

export const createTablesSlice = (set, get) => ({
  tables: mockTables,

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
});
