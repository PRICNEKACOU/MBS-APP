import React, { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { Coffee, Package, LayoutDashboard, Grid2x2, BellRing, Menu, X, LogOut } from "lucide-react";
import { cn } from "../../utils/utils";
import { useStore } from "../../store/store";
import { useTranslation } from "../../utils/i18n";
import { WebOrdersModal } from "../admin/WebOrdersModal";

const navItems = [
  { path: "/pos", icon: Coffee, label: "nav.pos" },
  { path: "/inventory", icon: Package, label: "nav.inventory" },
  { path: "/tables", icon: Grid2x2, label: "nav.tables" },
  { path: "/dashboard", icon: LayoutDashboard, label: "nav.dashboard" },
];

export function AdminLayout() {
  const t = useTranslation();
  const hasNewWebOrder = useStore(state => state.hasNewWebOrder);
  const language = useStore(state => state.language);
  const setLanguage = useStore(state => state.setLanguage);
  const restaurant = useStore(state => state.auth.restaurant);
  const logout = useStore(state => state.logout);

  const [isWebOrdersModalOpen, setIsWebOrdersModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex bg-slate-950 font-sans text-slate-100 min-h-[100dvh]">

      {/* ── Desktop Sidebar (md+) ───────────────────────────────────────── */}
      <aside className="no-print hidden md:flex w-24 lg:w-64 flex-col fixed inset-y-0 left-0 bg-slate-900 border-r border-slate-800 z-50">
        <div className="flex h-16 items-center justify-center lg:justify-start px-4 lg:px-6 border-b border-slate-800">
          <span className="font-bold text-amber-500 text-xl tracking-tight hidden lg:block truncate">
            {restaurant?.nom || "BMS APP"}
          </span>
          <span className="font-bold text-amber-500 text-2xl lg:hidden">
            {restaurant?.nom?.charAt(0) || "B"}
          </span>
        </div>

        <nav className="flex-1 space-y-2 py-4 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 lg:px-4 py-3 rounded-lg transition-colors group relative",
                  isActive
                    ? "bg-amber-500/10 text-amber-500"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                )
              }
            >
              <item.icon className="h-6 w-6 shrink-0" />
              <span className="hidden lg:block font-medium">{t(item.label)}</span>
              <div className="hidden md:block lg:hidden absolute left-14 opacity-0 group-hover:opacity-100 bg-slate-800 text-sm px-2 py-1 rounded transition-opacity pointer-events-none z-50 whitespace-nowrap">
                {t(item.label)}
              </div>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
          <button
            onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
            className="flex items-center justify-center lg:justify-start gap-3 px-3 py-3 w-full rounded-lg transition-all text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            title="Switch Language"
          >
            <div className="h-6 w-6 shrink-0 flex items-center justify-center font-bold border border-slate-600 rounded text-xs">
              {language.toUpperCase()}
            </div>
            <span className="hidden lg:block font-medium">Language</span>
          </button>

          <button
            onClick={() => setIsWebOrdersModalOpen(true)}
            className={cn(
              "flex items-center gap-3 px-3 py-3 w-full rounded-lg transition-all",
              hasNewWebOrder
                ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                : "text-slate-400 hover:bg-slate-800"
            )}
          >
            <div className="relative">
              <BellRing className={cn("h-6 w-6 shrink-0", hasNewWebOrder && "animate-bounce")} />
              {hasNewWebOrder && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-600 rounded-full animate-pulse border-2 border-slate-900" />
              )}
            </div>
            <span className={cn("hidden lg:block font-medium", hasNewWebOrder && "font-bold text-slate-950")}>
              Commandes Web
            </span>
          </button>

          <button
            onClick={logout}
            className="flex items-center justify-center lg:justify-start gap-3 px-3 py-3 w-full rounded-lg transition-all text-red-400 hover:text-red-300 hover:bg-red-500/10"
            title="Se déconnecter"
          >
            <LogOut className="h-6 w-6 shrink-0" />
            <span className="hidden lg:block font-medium">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Navbar (< md) ────────────────────────────────────── */}
      <header className="no-print md:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 z-50 flex items-center justify-between px-4">
        <span className="font-bold text-amber-500 text-xl tracking-tight truncate max-w-[200px]">
          {restaurant?.nom || "BMS APP"}
        </span>
        <div className="flex items-center gap-1">
          {hasNewWebOrder && (
            <button
              onClick={() => setIsWebOrdersModalOpen(true)}
              className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <BellRing className="h-6 w-6 text-amber-500 animate-bounce" />
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-600 rounded-full animate-pulse" />
            </button>
          )}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* ── Mobile Hamburger Drawer ──────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="absolute inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800 shrink-0">
              <span className="font-bold text-amber-500 text-xl truncate pr-4">
                {restaurant?.nom || "BMS APP"}
              </span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Drawer nav */}
            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-4 px-4 py-3 rounded-xl transition-colors font-medium",
                      isActive
                        ? "bg-amber-500/10 text-amber-500"
                        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                    )
                  }
                >
                  <item.icon className="h-6 w-6 shrink-0" />
                  <span>{t(item.label)}</span>
                </NavLink>
              ))}
            </nav>

            {/* Drawer footer */}
            <div className="p-4 border-t border-slate-800 space-y-2 shrink-0">
              <button
                onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
                className="flex items-center gap-4 px-4 py-3 w-full rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
              >
                <div className="h-6 w-6 flex items-center justify-center font-bold border border-slate-600 rounded text-xs">
                  {language.toUpperCase()}
                </div>
                <span className="font-medium">Langue / Language</span>
              </button>

              <button
                onClick={() => { setIsWebOrdersModalOpen(true); setIsMobileMenuOpen(false); }}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 w-full rounded-xl transition-all font-medium",
                  hasNewWebOrder
                    ? "bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                    : "text-slate-400 hover:bg-slate-800"
                )}
              >
                <div className="relative">
                  <BellRing className={cn("h-6 w-6 shrink-0", hasNewWebOrder && "animate-bounce")} />
                  {hasNewWebOrder && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-600 rounded-full animate-pulse" />
                  )}
                </div>
                <span>Commandes Web</span>
                {hasNewWebOrder && (
                  <span className="ml-auto bg-red-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
                    !
                  </span>
                )}
              </button>

              <button
                onClick={logout}
                className="flex items-center gap-4 px-4 py-3 w-full rounded-xl text-red-400 hover:text-white hover:bg-red-500/10 transition-all font-medium"
              >
                <LogOut className="h-6 w-6 shrink-0" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col md:ml-24 lg:ml-64 mt-14 md:mt-0 transition-all overflow-x-hidden">
        <Outlet />
      </main>

      <WebOrdersModal
        isOpen={isWebOrdersModalOpen}
        onClose={() => setIsWebOrdersModalOpen(false)}
      />
    </div>
  );
}
