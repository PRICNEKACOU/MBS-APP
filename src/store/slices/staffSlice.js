import { insforge } from '../../lib/insforge';
import { toast } from 'react-hot-toast';
import { hashPin, isPinHashed } from '../../utils/crypto';

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS   = 5 * 60 * 1000;

export const createStaffSlice = (set, get) => ({
  staff: [],
  activeStaff: null,
  isLocked: false,
  pinAttempts: { count: 0, lockedUntil: null },

  setActiveStaff: (member) => set({ activeStaff: member, isLocked: false }),
  lockScreen: () => set({ isLocked: true, activeStaff: null }),

  fetchStaff: async () => {
    try {
      const restaurantId = get().auth.restaurant?.id;
      if (!restaurantId) return;
      const { data } = await insforge.database.from('staff').select('*').eq('restaurant_id', restaurantId);
      set({ staff: data || [] });
    } catch (err) {
      console.error('Failed to fetch staff:', err);
    }
  },

  addStaffMember: async (name, pinCode, role = 'waiter') => {
    const previousStaff = get().staff;
    try {
      const restaurantId = get().auth.restaurant?.id;
      if (!restaurantId) throw new Error("ID Restaurant manquant.");

      const hashedNewPin = await hashPin(pinCode);
      const duplicate = get().staff.some(s =>
        s.pin_code === hashedNewPin || (!isPinHashed(s.pin_code) && s.pin_code === pinCode)
      );
      if (duplicate) {
        toast.error("Ce code PIN est deja utilise.");
        return false;
      }

      const newMember = {
        id: 'STF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        restaurant_id: restaurantId, name, role,
        pin_code: hashedNewPin
      };
      set(state => ({ staff: [newMember, ...state.staff] }));
      await insforge.database.from('staff').insert([newMember]);
      toast.success("Membre ajouté !");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'ajout.");
      set({ staff: previousStaff });
      return false;
    }
  },

  removeStaffMember: async (staffId) => {
    const previousStaff = get().staff;
    try {
      const restaurantId = get().auth.restaurant?.id;
      set(state => ({ staff: state.staff.filter(s => s.id !== staffId) }));
      await insforge.database.from('staff').delete().eq('id', staffId).eq('restaurant_id', restaurantId);
      toast.success("Membre supprimé.");
    } catch (err) {
      console.error(err);
      toast.error("Erreur de suppression.");
      set({ staff: previousStaff });
    }
  },

  updateStaffPin: async (staffId, newPin) => {
    const previousStaff = get().staff;
    try {
      const hashedNewPin = await hashPin(newPin);
      const duplicate = get().staff.some(s =>
        s.id !== staffId && (s.pin_code === hashedNewPin || (!isPinHashed(s.pin_code) && s.pin_code === newPin))
      );
      if (duplicate) {
        toast.error("Ce code PIN est deja utilise.");
        return false;
      }
      const restaurantId = get().auth.restaurant?.id;
      set(state => ({ staff: state.staff.map(s => s.id === staffId ? { ...s, pin_code: hashedNewPin } : s) }));
      await insforge.database.from('staff').update({ pin_code: hashedNewPin }).eq('id', staffId).eq('restaurant_id', restaurantId);
      toast.success("Code PIN mis à jour.");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Erreur de mise à jour.");
      set({ staff: previousStaff });
      return false;
    }
  },

  verifyPin: async (pin) => {
    const now = Date.now();
    const { count, lockedUntil } = get().pinAttempts;

    if (lockedUntil && now < lockedUntil) {
      const remaining = Math.ceil((lockedUntil - now) / 1000);
      toast.error(`Trop de tentatives. Réessayez dans ${remaining}s.`);
      return null;
    }

    const hashedInput = await hashPin(pin);
    let member = get().staff.find(s => s.pin_code === hashedInput);

    if (!member) {
      member = get().staff.find(s => !isPinHashed(s.pin_code) && s.pin_code === pin);
      if (member) {
        const restaurantId = get().auth.restaurant?.id;
        set(state => ({ staff: state.staff.map(s => s.id === member.id ? { ...s, pin_code: hashedInput } : s) }));
        insforge.database.from('staff').update({ pin_code: hashedInput }).eq('id', member.id).eq('restaurant_id', restaurantId).catch(console.warn);
      }
    }

    if (member) {
      set({ pinAttempts: { count: 0, lockedUntil: null }, activeStaff: { id: member.id, name: member.name, role: member.role }, isLocked: false });
      return member;
    }

    const newCount = count + 1;
    if (newCount >= PIN_MAX_ATTEMPTS) {
      set({ pinAttempts: { count: newCount, lockedUntil: now + PIN_LOCKOUT_MS } });
      toast.error("5 tentatives échouées. Accès bloqué pendant 5 minutes.");
    } else {
      set({ pinAttempts: { count: newCount, lockedUntil: null } });
    }
    return null;
  },
});
