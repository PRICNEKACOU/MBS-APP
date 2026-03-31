import { Navigate, Outlet } from 'react-router-dom';
import { useStore } from '../store/store';

export const ProtectedRoute = ({ allowedRoles = [] }) => {
  const auth = useStore(state => state.auth);
  
  if (!auth.isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(auth.user?.role)) {
    console.warn(`Access denied for role: ${auth.user?.role}. Required: ${allowedRoles.join(', ')}`);
    return <Navigate to="/pos" replace />;
  }

  return <Outlet />;
};
