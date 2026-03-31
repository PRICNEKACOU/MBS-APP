import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { insforge } from '../../lib/insforge';
import { Loader2, Store, User, Lock, Mail, ArrowRight, ShieldCheck, KeyRound, RefreshCw, CheckCircle2 } from 'lucide-react';

// ── Étapes du flux ────────────────────────────────────────────────────────────
// 'login' | 'register' | 'otp'

export const Auth = () => {
  const [step, setStep] = useState('login'); // 'login' | 'register' | 'otp'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Countdown pour le renvoi OTP
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef(null);

  // OTP input : 6 cases individuelles
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);

  const navigate = useNavigate();
  const setAuth = useStore(state => state.setAuth);
  const initializeStore = useStore(state => state.initializeStore);

  // Formulaire
  const [restaurantName, setRestaurantName] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');

  // Nettoyage du compteur
  useEffect(() => {
    return () => clearInterval(cooldownRef.current);
  }, []);

  const startCooldown = (seconds = 60) => {
    setResendCooldown(seconds);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Connexion ────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await insforge.auth.signInWithPassword({
        email,
        password: pin
      });

      if (authError) {
        const msg = authError.message || '';
        // Intercepter l'erreur de vérification e-mail
        if (msg.toLowerCase().includes('email') && msg.toLowerCase().includes('verif')) {
          // Renvoyer un OTP de vérification
          await insforge.auth.resend({ type: 'signup', email });
          setStep('otp');
          setSuccessMessage(null);
          setError(null);
          startCooldown(60);
          return;
        }
        throw authError;
      }

      await finalizeLogin(authData);

    } catch (err) {
      console.error(err);
      const msg = err.message || '';
      if (msg.toLowerCase().includes('email verification')) {
        setStep('otp');
        setError(null);
        startCooldown(60);
      } else {
        setError(msg === 'Invalid login credentials' ? 'Email ou code PIN incorrect.' : msg || 'Erreur lors de la connexion.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Vérification OTP ─────────────────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const token = otpDigits.join('');
    if (token.length < 6) {
      setError('Veuillez saisir les 6 chiffres du code.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { data: authData, error: otpError } = await insforge.auth.verifyOtp({
        email,
        token,
        type: 'email'
      });

      if (otpError) throw otpError;

      await finalizeLogin(authData);

    } catch (err) {
      console.error(err);
      setError('Code incorrect ou expiré. Demandez un nouveau code.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Renvoi du code ───────────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setError(null);

    try {
      await insforge.auth.resend({ type: 'signup', email });
      setSuccessMessage('Nouveau code envoyé ! Vérifiez votre boîte mail.');
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
      startCooldown(60);
    } catch (err) {
      setError('Impossible de renvoyer le code. Réessayez plus tard.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Finalisation commune après auth réussie ───────────────────────────────────
  const finalizeLogin = async (authData) => {
    if (!authData?.user) throw new Error('Session invalide.');

    const { data: userProfile, error: userError } = await insforge.database
      .from('bms_users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (userError || !userProfile) throw new Error('Profil utilisateur introuvable.');

    const { data: restaurantData } = await insforge.database
      .from('restaurants')
      .select('*')
      .eq('id', userProfile.restaurant_id)
      .single();

    setAuth({
      isAuthenticated: true,
      user: userProfile,
      restaurant: restaurantData || { id: userProfile.restaurant_id, nom: 'Mon Restaurant' }
    });

    await initializeStore();
    navigate('/pos');
  };

  // ── Inscription ──────────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (pin.length < 6) throw new Error('Le code PIN doit faire au moins 6 caractères.');

      const { data: authData, error: authError } = await insforge.auth.signUp({ email, password: pin });

      if (authError) throw authError;

      // Vérification e-mail requise par InForge
      if (authData?.requireEmailVerification || (authData?.user && !authData?.session)) {
        // Créer le restaurant et le profil en avance (ils seront accessibles après vérification)
        const { data: newRestaurant, error: restError } = await insforge.database
          .from('restaurants')
          .insert([{ nom: restaurantName }])
          .select()
          .single();

        if (restError) throw new Error(`Restaurant: ${restError.message}`);

        const { error: userError } = await insforge.database
          .from('bms_users')
          .insert([{
            id: authData.user.id,
            restaurant_id: newRestaurant.id,
            nom: userName,
            email: email,
            pin_code: pin,
            role: 'ADMIN'
          }]);

        if (userError) throw userError;

        // Passer à l'étape OTP
        setStep('otp');
        setSuccessMessage('Compte créé ! Un code de vérification a été envoyé à ' + email);
        setError(null);
        startCooldown(60);
        return;
      }

      if (!authData?.user) throw new Error('Erreur lors de la création du compte.');
      await finalizeLogin(authData);

    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de l'inscription.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Gestion saisie OTP case par case ─────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] w-full bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden pb-[max(env(safe-area-inset-bottom,1rem),1rem)]">

      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 transition-all duration-500">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center">
          <div className={`w-16 h-16 bg-slate-950 border rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner transition-colors duration-300 ${step === 'otp' ? 'border-amber-500/50' : 'border-slate-800'}`}>
            {step === 'otp'
              ? <KeyRound className="w-8 h-8 text-amber-500" />
              : <ShieldCheck className="w-8 h-8 text-amber-500" />
            }
          </div>
          <h1 className="text-2xl font-bold text-slate-100 uppercase tracking-widest">
            MBS <span className="text-amber-500">APP</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {step === 'otp'
              ? 'Vérification de votre identité'
              : step === 'login'
                ? 'Connectez-vous à votre espace'
                : 'Créez votre espace restaurant'}
          </p>
        </div>

        {/* Tabs (masqués pendant OTP) */}
        {step !== 'otp' && (
          <div className="flex px-8 mb-6">
            <button
              onClick={() => { setStep('login'); setError(null); setSuccessMessage(null); }}
              className={`flex-1 py-3 text-sm font-semibold transition-all duration-300 border-b-2 ${step === 'login' ? 'text-amber-500 border-amber-500' : 'text-slate-500 border-slate-800 hover:text-slate-300'}`}
            >
              Connexion
            </button>
            <button
              onClick={() => { setStep('register'); setError(null); setSuccessMessage(null); }}
              className={`flex-1 py-3 text-sm font-semibold transition-all duration-300 border-b-2 ${step === 'register' ? 'text-amber-500 border-amber-500' : 'text-slate-500 border-slate-800 hover:text-slate-300'}`}
            >
              Inscription
            </button>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="mx-8 mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center animate-in fade-in duration-300">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mx-8 mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm text-center animate-in fade-in duration-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ── ÉTAPE OTP ── */}
        {step === 'otp' && (
          <div className="px-8 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <p className="text-slate-400 text-sm text-center mb-6">
              Entrez le code à 6 chiffres envoyé à <span className="text-slate-200 font-medium">{email}</span>
            </p>

            <form onSubmit={handleVerifyOtp} className="space-y-6">
              {/* 6 cases OTP */}
              <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => otpRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className={`w-11 h-14 text-center text-xl font-bold rounded-xl border bg-slate-950 text-slate-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 ${digit ? 'border-amber-500/50 text-amber-400' : 'border-slate-700'}`}
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={isLoading || otpDigits.join('').length < 6}
                className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300"
              >
                {isLoading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <><CheckCircle2 className="w-5 h-5" /> Vérifier le code</>
                }
              </button>
            </form>

            {/* Renvoi du code */}
            <div className="mt-5 text-center">
              <p className="text-slate-500 text-sm mb-2">Vous n'avez pas reçu le code ?</p>
              <button
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isLoading}
                className="flex items-center gap-1.5 mx-auto text-sm font-semibold disabled:text-slate-600 disabled:cursor-not-allowed text-amber-500 hover:text-amber-400 transition-colors duration-200"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                {resendCooldown > 0
                  ? `Renvoyer dans ${resendCooldown}s`
                  : 'Renvoyer le code'
                }
              </button>
            </div>

            {/* Revenir en arrière */}
            <button
              onClick={() => { setStep('login'); setError(null); setOtpDigits(['', '', '', '', '', '']); setSuccessMessage(null); }}
              className="mt-4 w-full text-slate-500 hover:text-slate-300 text-sm text-center transition-colors duration-200"
            >
              ← Retour à la connexion
            </button>
          </div>
        )}

        {/* ── FORMULAIRE LOGIN / REGISTER ── */}
        {step !== 'otp' && (
          <div className="px-8 pb-8">
            <form onSubmit={step === 'login' ? handleLogin : handleRegister} className="space-y-4">

              {/* Champs Inscription uniquement */}
              {step === 'register' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Store className="h-5 w-5 text-slate-500" />
                    </div>
                    <input
                      type="text" required value={restaurantName}
                      onChange={e => setRestaurantName(e.target.value)}
                      placeholder="Nom du Restaurant"
                      className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-500" />
                    </div>
                    <input
                      type="text" required value={userName}
                      onChange={e => setUserName(e.target.value)}
                      placeholder="Votre Nom (Admin)"
                      className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Adresse email"
                  className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                />
              </div>

              {/* PIN */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="password" required value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="Code PIN (6 chiffres minimum)"
                  className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-500 tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-6 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 text-slate-900 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300"
              >
                {isLoading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <>{step === 'login' ? 'Se connecter' : "Créer l'espace"} <ArrowRight className="w-5 h-5" /></>
                }
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
