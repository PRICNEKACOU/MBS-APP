import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store/store';
import { insforge } from '../../lib/insforge';
import { Loader2, Store, User, Lock, Mail, ArrowRight, ShieldCheck, KeyRound, KeySquare, RefreshCw, CheckCircle2, Eye, EyeOff } from 'lucide-react';

// ── Étapes du flux ────────────────────────────────────────────────────────────
// 'login' | 'register' | 'otp' | 'forgot' | 'reset'

export const Auth = () => {
  const location = useLocation();
  
  // Détection du token de reset depuis l'URL (lien e-mail)
  const resetToken = new URLSearchParams(location.search).get('token');

  const [step, setStep] = useState(resetToken ? 'reset' : 'login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showResendUI, setShowResendUI] = useState(false); // email non confirmé
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Countdown pour le renvoi OTP
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef(null);

  // OTP input : 6 cases individuelles
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);

  // Données d'inscription en attente de validation OTP
  const [pendingRegistration, setPendingRegistration] = useState(null);

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

  // ── Mot de passe oublié : envoi du lien ─────────────────────────────────────
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await insforge.auth.sendResetPasswordEmail({ email });
      if (error) throw error;
      setSuccessMessage(`Un lien de réinitialisation a été envoyé à ${email}. Vérifiez votre boîte mail.`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Impossible d\'envoyer le lien. Vérifiez l\'adresse e-mail.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Réinitialisation du mot de passe ─────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);

    if (newPin.length < 6) {
      setError('Le nouveau code PIN doit faire au moins 6 caractères.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('Les codes PIN ne correspondent pas.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await insforge.auth.resetPassword({
        token: resetToken,
        newPassword: newPin
      });
      if (error) throw error;
      setSuccessMessage('Mot de passe réinitialisé ! Vous pouvez maintenant vous connecter.');
      setTimeout(() => setStep('login'), 2500);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Lien invalide ou expiré. Demandez un nouveau lien.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Connexion ──────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setShowResendUI(false);

    try {
      const { data: authData, error: authError } = await insforge.auth.signInWithPassword({
        email,
        password: pin
      });

      if (authError) {
        const msg = (authError.message || '').toLowerCase();
        // Détection email non confirmé
        if (msg.includes('email not confirmed') || msg.includes('email verification') || msg.includes('not confirmed')) {
          setShowResendUI(true);
          setError(null);
          return;
        }
        throw authError;
      }

      await finalizeLogin(authData);

    } catch (err) {
      console.error(err);
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('email not confirmed') || msg.includes('not confirmed') || msg.includes('email verification')) {
        setShowResendUI(true);
        setError(null);
      } else {
        setError(msg.includes('invalid login credentials') ? 'Email ou code PIN incorrect.' : err.message || 'Erreur lors de la connexion.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Renvoi email de confirmation (depuis écran de login) ─────────────────
  const handleResendConfirmation = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    try {
      // Méthode correcte du SDK InForge
      const { error } = await insforge.auth.resendVerificationEmail({ email });
      if (error) throw error;
      setSuccessMessage('Email renvoyé ! Vérifiez votre boîte mail.');
      startCooldown(60);
    } catch (err) {
      console.error(err);
      setError('Impossible de renvoyer l’email. Patientez avant de réessayer.');
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
      if (!authData?.user) throw new Error('Session invalide après vérification.');

      // ✅ Session valide — maintenant on peut écrire en DB
      if (pendingRegistration) {
        // Flux inscription : créer le restaurant + profil maintenant
        await createRestaurantAndProfile(authData.user.id, pendingRegistration);
      } else {
        // Flux connexion : charger le profil existant
        await finalizeLogin(authData);
      }

    } catch (err) {
      console.error(err);
      setError(err.message?.includes('expired') || err.message?.includes('invalid')
        ? 'Code incorrect ou expiré. Demandez un nouveau code.'
        : err.message || 'Erreur lors de la vérification.'
      );
    } finally {
      setIsLoading(false);
    }
  };


  // ── Renvoi OTP (depuis étape OTP) ─────────────────────────────────
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setError(null);

    try {
      await insforge.auth.resendVerificationEmail({ email });
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

  // ── Création du restaurant APRÈS session valide ──────────────────────────────
  const createRestaurantAndProfile = async (userId, { restaurantName: rName, userName: uName, email: uEmail, pin: uPin }) => {
    // Créer le restaurant (session valide = RLS passe)
    const { data: newRestaurant, error: restError } = await insforge.database
      .from('restaurants')
      .insert([{ nom: rName }])
      .select()
      .single();

    if (restError) throw new Error(`Restaurant: ${restError.message}`);

    // Créer le profil bms_users
    const { data: newUser, error: userError } = await insforge.database
      .from('bms_users')
      .insert([{
        id: userId,
        restaurant_id: newRestaurant.id,
        nom: uName,
        email: uEmail,
        pin_code: uPin,
        role: 'ADMIN'
      }])
      .select()
      .single();

    if (userError) throw new Error(`Profil: ${userError.message}`);

    setAuth({ isAuthenticated: true, user: newUser, restaurant: newRestaurant });
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
        // Stocker les données en mémoire (PAS d'appel DB ici, pas encore de session)
        setPendingRegistration({
          restaurantName,
          userName,
          email,
          pin
        });

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
            {step === 'otp' ? 'Vérification de votre identité'
              : step === 'forgot' ? 'Récupération du compte'
              : step === 'reset' ? 'Nouveau mot de passe'
              : step === 'login' ? 'Connectez-vous à votre espace'
              : 'Créez votre espace restaurant'}
          </p>
        </div>

        {/* Tabs (masqués pendant OTP, forgot, reset) */}
        {step !== 'otp' && step !== 'forgot' && step !== 'reset' && (
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

        {/* ── MOT DE PASSE OUBLIÉ ── */}
        {step === 'forgot' && (
          <div className="px-8 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <p className="text-slate-400 text-sm text-center mb-6">
              Entrez votre adresse e-mail pour recevoir un lien de réinitialisation.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
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
              <button
                type="submit" disabled={isLoading}
                className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] disabled:opacity-50 text-slate-900 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Mail className="w-5 h-5" /> Envoyer le lien</>}
              </button>
            </form>
            <button
              onClick={() => { setStep('login'); setError(null); setSuccessMessage(null); }}
              className="mt-4 w-full text-slate-500 hover:text-slate-300 text-sm text-center transition-colors"
            >
              ← Retour à la connexion
            </button>
          </div>
        )}

        {/* ── NOUVEAU MOT DE PASSE (depuis lien e-mail) ── */}
        {step === 'reset' && (
          <div className="px-8 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <p className="text-slate-400 text-sm text-center mb-6">
              Choisissez un nouveau code PIN pour votre compte.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type={showPin ? 'text' : 'password'} required value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                  placeholder="Nouveau code PIN (6 min.)"
                  className="w-full pl-11 pr-12 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-500 tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                />
                <button type="button" onClick={() => setShowPin(p => !p)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300">
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type={showPin ? 'text' : 'password'} required value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value)}
                  placeholder="Confirmer le code PIN"
                  className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-500 tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                />
              </div>
              <button
                type="submit" disabled={isLoading}
                className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] disabled:opacity-50 text-slate-900 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><KeySquare className="w-5 h-5" /> Enregistrer le nouveau PIN</>}
              </button>
            </form>
          </div>
        )}

        {/* ── EMAIL NON CONFIRMÉ : UI de renvoi ── */}
        {step === 'login' && showResendUI && (
          <div className="px-8 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Mail className="w-8 h-8 text-amber-500" />
              </div>
              <div>
                <p className="text-slate-100 font-semibold text-lg">Compte non activé</p>
                <p className="text-slate-400 text-sm mt-1.5">
                  L'adresse <span className="text-amber-400 font-medium">{email}</span> n'a pas encore été confirmée.
                </p>
                <p className="text-slate-500 text-xs mt-1">Vérifiez vos e-mails et cliquez sur le lien de confirmation.</p>
              </div>

              <button
                onClick={handleResendConfirmation}
                disabled={resendCooldown > 0 || isLoading}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold py-3.5 px-4 rounded-xl transition-all duration-300"
              >
                {isLoading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <><RefreshCw className="w-5 h-5" /> {resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : "Renvoyer l'email de confirmation"}</>
                }
              </button>

              <button
                onClick={() => { setShowResendUI(false); setError(null); setSuccessMessage(null); }}
                className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
              >
                ← Retour à la connexion
              </button>
            </div>
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
