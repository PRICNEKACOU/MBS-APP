import React from "react";
import { cn } from "../../utils/utils";

export const Button = React.forwardRef(
  ({ className, variant = "primary", size = "default", ...props }, ref) => {
    const variants = {
      primary: "bg-amber-500 text-slate-950 hover:bg-amber-400 focus:ring-amber-500",
      secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700",
      outline: "border border-slate-700 hover:bg-slate-800 text-slate-100",
      ghost: "hover:bg-slate-800 text-slate-100",
      danger: "bg-red-500 text-white hover:bg-red-600"
    };

    const sizes = {
      default: "h-11 px-6 py-3",
      sm: "h-9 rounded-md px-3 text-sm",
      lg: "h-16 rounded-xl px-8 text-xl",
      icon: "h-12 w-12 flex items-center justify-center p-3"
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
