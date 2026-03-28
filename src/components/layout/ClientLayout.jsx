import React from "react";
import { Outlet } from "react-router-dom";
import { Coffee } from "lucide-react";

export function ClientLayout() {
  return (
    <div className="flex flex-col bg-slate-50 font-sans text-slate-900 min-h-[100dvh]">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center justify-center h-16 px-4 max-w-lg mx-auto w-full">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-slate-950">
              <Coffee className="w-6 h-6" />
            </div>
            <h1 className="font-extrabold text-2xl tracking-tight bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">BMS APP</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto pb-32">
        <Outlet />
      </main>
    </div>
  );
}
