import React, { useState } from 'react';
import { X, ArrowRight, Coffee, Package, Grid2x2, Receipt, PartyPopper, ChevronRight } from 'lucide-react';

const STEPS = [
  {
    icon: PartyPopper,
    title: 'Bienvenue dans MBS APP !',
    description: "Ton application de gestion pour ton Maquis. En quelques clics, gère tes produits, tes tables et ta caisse comme un pro. On te montre comment faire !",
    color: 'from-amber-500 to-orange-500',
  },
  {
    icon: Package,
    title: 'Inventaire',
    description: "Ici, ajoute tes bouteilles (Flag, Bock, Ivoire...) et tes plats (Braised, Kedjenou, Alloco...). Gère les stocks en temps réel pour ne jamais tomber en rupture.",
    color: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Grid2x2,
    title: 'Tables',
    description: "Selectionne une table pour prendre une commande. Tes clients peuvent aussi scanner le QR Code pour commander directement depuis leur telephone !",
    color: 'from-blue-500 to-indigo-500',
  },
  {
    icon: Receipt,
    title: 'Caisse',
    description: "Genere le ticket et encaisse en CFA ou en Euro. Tout est calcule automatiquement. Tu peux aussi imprimer le ticket pour le client.",
    color: 'from-purple-500 to-pink-500',
  },
];

export const OnboardingTour = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem('mbs_onboarding_done', 'true');
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('mbs_onboarding_done', 'true');
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Card */}
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">

        {/* Illustration */}
        <div className={`relative h-48 bg-gradient-to-br ${current.color} flex items-center justify-center overflow-hidden`}>
          {/* Decorative circles */}
          <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute bottom-[-15%] left-[-5%] w-24 h-24 bg-white/10 rounded-full" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
              <Icon className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Skip button */}
          {!isLast && (
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 w-8 h-8 bg-black/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-black/30 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-xl font-bold text-slate-100 text-center mb-3">
            {current.title}
          </h2>
          <p className="text-slate-400 text-sm text-center leading-relaxed">
            {current.description}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 py-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-8 bg-amber-500'
                  : i < step
                  ? 'w-2 bg-amber-500/50'
                  : 'w-2 bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-2">
          <button
            onClick={handleNext}
            className="w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-900 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-amber-500/20"
          >
            {isLast ? (
              <>
                <Coffee className="w-5 h-5" />
                C'est parti !
              </>
            ) : (
              <>
                Suivant
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          {!isLast && (
            <button
              onClick={handleSkip}
              className="w-full mt-3 text-slate-500 hover:text-slate-300 text-sm text-center transition-colors"
            >
              Passer le tutoriel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
