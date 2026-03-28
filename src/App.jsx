import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "./components/layout/AdminLayout";
import { ClientLayout } from "./components/layout/ClientLayout";
import { POS } from "./pages/admin/POS";
// Add placeholders for next phases
import { Inventory } from "./pages/admin/Inventory";
import { Dashboard } from "./pages/admin/Dashboard";
import { Tables } from "./pages/admin/Tables";
import { Menu } from "./pages/client/Menu";
import { useStore } from "./store/store";
import { useEffect } from "react";

function DataPersister() {
  const products = useStore(state => state.products);
  const tables = useStore(state => state.tables);
  const orders = useStore(state => state.orders);
  const movements = useStore(state => state.movements);
  const cycles = useStore(state => state.cycles);
  const currentCycle = useStore(state => state.currentCycle);

  useEffect(() => {
    localStorage.setItem('inventory', JSON.stringify(products));
    localStorage.setItem('tables', JSON.stringify(tables));
    localStorage.setItem('orders', JSON.stringify(orders));
    localStorage.setItem('movements', JSON.stringify(movements));
    localStorage.setItem('cycles', JSON.stringify(cycles));
    localStorage.setItem('currentCycle', JSON.stringify(currentCycle));
  }, [products, tables, orders, movements, cycles, currentCycle]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <DataPersister />
      <Routes>
        <Route path="/" element={<Navigate to="/pos" replace />} />
        
        {/* Admin Routes */}
        <Route element={<AdminLayout />}>
          <Route path="/pos" element={<POS />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/tables" element={<Tables />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        {/* Client Routes */}
        <Route element={<ClientLayout />}>
          <Route path="/menu" element={<Menu />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
