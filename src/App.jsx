import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "./components/layout/AdminLayout";
import { ClientLayout } from "./components/layout/ClientLayout";
import { POS } from "./pages/admin/POS";
import { Inventory } from "./pages/admin/Inventory";
import { Dashboard } from "./pages/admin/Dashboard";
import { Tables } from "./pages/admin/Tables";
import { Auth } from "./pages/admin/Auth";
import { Menu } from "./pages/client/Menu";
import { useStore } from "./store/store";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "react-hot-toast";

import { ProtectedRoute } from "./components/ProtectedRoute";

function App() {
  const initializeStore = useStore(state => state.initializeStore);
  const isLoading = useStore(state => state.isLoading);
  const isAuthenticated = useStore(state => state.auth.isAuthenticated);

  useEffect(() => {
    initializeStore();
  }, [initializeStore]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[9999]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
          <Loader2 className="w-8 h-8 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <h1 className="mt-6 text-xl font-bold text-slate-100 tracking-wider uppercase">MBS APP</h1>
        <p className="mt-2 text-slate-500 text-sm animate-pulse">Initialisation du Cloud...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        <Route path="/" element={<Navigate to="/pos" replace />} />
        
        {/* Auth Route */}
        <Route path="/auth" element={!isAuthenticated ? <Auth /> : <Navigate to="/pos" replace />} />

        {/* Protected Routes Wrapper */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            {/* Caisse accessible par tous */}
            <Route path="/pos" element={<POS />} />

            {/* Routes réservées aux ADMINS */}
            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/tables" element={<Tables />} />
              <Route path="/dashboard" element={<Dashboard />} />
            </Route>
          </Route>
        </Route>

        {/* Client Routes (QR Menu) */}
        <Route element={<ClientLayout />}>
          <Route path="/menu/:tableId" element={<Menu />} />
          <Route path="/menu" element={<Menu />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
