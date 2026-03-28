import React from "react";
import { cn } from "../../utils/utils";

export function Badge({ className, variant = "default", children, ...props }) {
  const variants = {
    default: "bg-slate-800 text-slate-100",
    success: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
    danger: "bg-red-500/10 text-red-500 border border-red-500/20",
    outline: "text-slate-100 border border-slate-700"
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
