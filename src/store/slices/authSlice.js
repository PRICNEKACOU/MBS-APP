const savedAuth = (() => {
  try {
    const stored = localStorage.getItem('mbs_auth');
    if (stored) return JSON.parse(stored);
  } catch {
    console.error('Failed to parse auth from localStorage');
  }
  return { isAuthenticated: false, user: null, restaurant: null };
})();

export { savedAuth };

export const createAuthSlice = (set, get) => ({
  isLoading: savedAuth.isAuthenticated,
  isSyncing: false,
  language: 'fr',
  setLanguage: (language) => set({ language }),

  currency: 'CFA', // Devise unique FCFA — setCurrency conservé pour rétrocompat

  auth: savedAuth,
  setAuth: (authParams) => {
    const newAuth = { ...get().auth, ...authParams };
    localStorage.setItem('mbs_auth', JSON.stringify(newAuth));
    set({ auth: newAuth });
  },
  logout: () => {
    localStorage.removeItem('mbs_auth');
    set({ auth: { isAuthenticated: false, user: null, restaurant: null } });
  },
});
