import { Navigate, Outlet } from 'react-router-dom';
import { useStore } from '../store/store';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute = ({ allowedRoles = [] }) => {
  const auth      = useStore(state => state.auth);
  const isLoading = useStore(state => state.isLoading);

  // 1. Pas encore authentifié → redirection vers /auth
  if (!auth.isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // 2. Authentifié mais store encore en cours de chargement (initializeStore pas terminé)
  //    OU restaurant_id absent (nouveau compte, tenant en cours de création)
  //    → Bloquer les composants enfants pour éviter des requêtes RLS prématurées
  if (isLoading || !auth.restaurant?.id) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[9999]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <Loader2 className="w-8 h-8 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <p className="mt-6 text-slate-400 text-sm animate-pulse">Préparation de votre espace...</p>
      </div>
    );
  }

  // 3. Accès restreint par rôle
  if (allowedRoles.length > 0 && !allowedRoles.includes(auth.user?.role)) {
    console.warn(`Access denied for role: ${auth.user?.role}. Required: ${allowedRoles.join(', ')}`);
    return <Navigate to="/pos" replace />;
  }

  return <Outlet />;
};

