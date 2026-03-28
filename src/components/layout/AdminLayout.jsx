import React, { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { Coffee, Package, LayoutDashboard, Grid2x2, BellRing } from "lucide-react";
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
  
  const [isWebOrdersModalOpen, setIsWebOrdersModalOpen] = useState(false);

  return (
    <div className="flex bg-slate-950 font-sans text-slate-100 min-h-[100dvh]">
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex w-24 lg:w-64 flex-col fixed inset-y-0 left-0 bg-slate-900 border-r border-slate-800 z-50">
        <div className="flex h-16 items-center justify-center lg:justify-start px-4 lg:px-6 border-b border-slate-800">
          <span className="font-bold text-amber-500 text-xl tracking-tight lg:block hidden">BMS APP</span>
          <span className="font-bold text-amber-500 text-2xl lg:hidden">BMS</span>
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
              {/* Tooltip for md screens */}
              <div className="hidden md:block lg:hidden absolute left-14 opacity-0 group-hover:opacity-100 bg-slate-800 text-sm px-2 py-1 rounded transition-opacity pointer-events-none z-50 whitespace-nowrap">
                {t(item.label)}
              </div>
            </NavLink>
          ))}
        </nav>

        {/* Bottom Actions (Language + Notifications) */}
        <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
          {/* Language Toggle */}
          <button 
            onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
            className="flex items-center justify-center lg:justify-start gap-3 px-3 py-3 w-full rounded-lg transition-all text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            title="Switch Language"
          >
            <div className="h-6 w-6 shrink-0 flex items-center justify-center font-bold border border-slate-600 rounded">
              {language.toUpperCase()}
            </div>
            <span className="hidden lg:block font-medium">Language</span>
          </button>

          {/* Notifications / Web Orders */}
          <button 
            onClick={() => setIsWebOrdersModalOpen(true)}
            className={cn(
              "flex items-center gap-3 px-3 py-3 w-full rounded-lg transition-all",
              hasNewWebOrder ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)]" : "text-slate-400 hover:bg-slate-800"
            )}
            title="Web Orders"
          >
            <div className="relative">
              <BellRing className={cn("h-6 w-6 shrink-0", hasNewWebOrder && "animate-bounce")} />
              {hasNewWebOrder && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-600 rounded-full animate-pulse border-2 border-slate-900" />
              )}
            </div>
            <span className={cn("hidden lg:block font-medium", hasNewWebOrder && "font-bold text-slate-950")}>Web Orders</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col pt-safe md:ml-24 lg:ml-64 mb-16 md:mb-0 transition-all overflow-x-hidden">
        <Outlet />
      </main>

      {/* Web Orders Modal */}
      <WebOrdersModal 
        isOpen={isWebOrdersModalOpen} 
        onClose={() => setIsWebOrdersModalOpen(false)} 
      />

      {/* Mobile Bottom Navigation Component */}
      <MobileNav hasNewWebOrder={hasNewWebOrder} onOpenModal={() => setIsWebOrdersModalOpen(true)} />
    </div>
  );
}

function MobileNav({ hasNewWebOrder, onOpenModal }) {
  const t = useTranslation();
  
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 z-50 flex items-center justify-around px-2 pb-safe-bottom">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors relative",
              isActive ? "text-amber-500" : "text-slate-400 hover:text-slate-300"
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className={cn("absolute top-0 w-8 h-1 rounded-b-full bg-amber-500 transition-transform origin-top", isActive ? "scale-y-100" : "scale-y-0")} />
              <item.icon className={cn("h-6 w-6", isActive ? "fill-amber-500/20" : "")} />
              <span className="text-[10px] font-medium leading-none">{t(item.label)}</span>
            </>
          )}
        </NavLink>
      ))}
      
      {/* Mobile Notification Button */}
      <button 
        onClick={onOpenModal}
        className={cn(
          "flex flex-col items-center justify-center w-16 h-full space-y-1 relative",
          hasNewWebOrder ? "text-amber-500" : "text-slate-400"
        )}
      >
        <div className="relative">
          <BellRing className={cn("h-6 w-6", hasNewWebOrder && "animate-bounce")} />
          {hasNewWebOrder && <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-600 rounded-full animate-pulse border-2 border-slate-900" />}
        </div>
        <span className="text-[10px] font-medium uppercase tracking-tighter">Web</span>
      </button>
    </nav>
  );
}
