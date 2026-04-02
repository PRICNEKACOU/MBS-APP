import { insforge } from '../../lib/insforge';
import { toast } from 'react-hot-toast';
import { mapToDb, expenseMapping } from '../mappings';

export const createExpensesSlice = (set, get) => ({
  expenses: [],

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
});
