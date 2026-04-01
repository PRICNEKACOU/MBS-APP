import React, { useState, useCallback } from "react";
import { Lock, Delete, Coffee } from "lucide-react";
import { useStore } from "../../store/store";

export function LockScreen() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const verifyPin = useStore(state => state.verifyPin);
  const restaurant = useStore(state => state.auth.restaurant);

  const handleDigit = useCallback((digit) => {
    setError(false);
    setPin(prev => {
      const next = prev + digit;
      if (next.length === 4) {
        // Auto-verify on 4th digit
        setTimeout(() => {
          const member = verifyPin(next);
          if (!member) {
            setError(true);
            setShake(true);
            setTimeout(() => { setShake(false); setPin(""); }, 500);
          }
        }, 100);
      }
      return next.length <= 4 ? next : prev;
    });
  }, [verifyPin]);

  const handleDelete = () => {
    setError(false);
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
          <Coffee className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-100">{restaurant?.nom || 'MBS APP'}</h1>
        <p className="text-slate-500 text-sm mt-1">Entrez votre code PIN</p>
      </div>

      {/* PIN Dots */}
      <div className={`flex gap-4 mb-8 ${shake ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
              i < pin.length
                ? error ? 'bg-red-500 border-red-500' : 'bg-amber-500 border-amber-500 scale-110'
                : 'border-slate-600'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-4 animate-pulse">Code PIN incorrect</p>
      )}

      {/* Numeric Keypad */}
      <div className="grid grid-cols-3 gap-3 max-w-[280px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
          <button
            key={digit}
            onClick={() => handleDigit(String(digit))}
            className="w-20 h-16 rounded-2xl bg-slate-900 border border-slate-800 text-2xl font-bold text-slate-100 hover:bg-slate-800 active:bg-amber-500/20 active:border-amber-500/30 active:scale-95 transition-all"
          >
            {digit}
          </button>
        ))}
        <div /> {/* Empty cell */}
        <button
          onClick={() => handleDigit("0")}
          className="w-20 h-16 rounded-2xl bg-slate-900 border border-slate-800 text-2xl font-bold text-slate-100 hover:bg-slate-800 active:bg-amber-500/20 active:border-amber-500/30 active:scale-95 transition-all"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="w-20 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
