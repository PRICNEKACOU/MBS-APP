import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store/store';
import { insforge } from '../../lib/insforge';
import toast from 'react-hot-toast';
import { Loader2, Store, User, Lock, Mail, ArrowRight, ShieldCheck, KeyRound, KeySquare, RefreshCw, CheckCircle2, Eye, EyeOff, Sparkles } from 'lucide-react';

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
  // 'signup' = nouveau compte, 'email' = compte existant non confirmé
  const [otpType, setOtpType] = useState('signup');
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

    try {
      const { data: authData, error: authError } = await insforge.auth.signInWithPassword({
        email,
        password: pin
      });

      if (authError) {
        const msg = (authError.message || '').toLowerCase();
        // Détection email non confirmé → on envoie un nouveau code et on ouvre l'écran OTP
        if (msg.includes('email not confirmed') || msg.includes('email verification') || msg.includes('not confirmed')) {
          await insforge.auth.resendVerificationEmail({ email });
          setOtpType('email');
          setPendingRegistration(null);
          setStep('otp');
          setSuccessMessage(`Un code de vérification a été envoyé à ${email}. Saisissez-le ci-dessous.`);
          setError(null);
          startCooldown(60);
          return;
        }
        throw authError;
      }

      await finalizeLogin(authData);

    } catch (err) {
      console.error(err);
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('email not confirmed') || msg.includes('not confirmed') || msg.includes('email verification')) {
        setOtpType('email');
        setPendingRegistration(null);
        setStep('otp');
        setSuccessMessage(`Un code de vérification a été envoyé à ${email}.`);
        setError(null);
        startCooldown(60);
      } else {
        setError(msg.includes('invalid login credentials') ? 'Email ou code PIN incorrect.' : err.message || 'Erreur lors de la connexion.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Renvoi du code de vérification ─────────────────────────────
  const handleResendConfirmation = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    try {
      const { error } = await insforge.auth.resendVerificationEmail({ email });
      if (error) throw error;
      setSuccessMessage('Nouveau code envoyé ! Vérifiez votre boîte mail.');
      startCooldown(60);
    } catch (err) {
      console.error(err);
      setError('Impossible de renvoyer le code. Patientez avant de réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Vérification OTP ─────────────────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const cleanToken = otpDigits.join('').replace(/\s/g, '').trim();
    if (cleanToken.length < 6) {
      setError('Veuillez saisir les 6 chiffres du code.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      // On utilise le bon type selon le flux (inscription vs connexion)
      const otpPayload = { email, otp: cleanToken };
      console.log("ENVOI INFORGE -> Email:", email, "| Token:", cleanToken, "| Longueur:", cleanToken.length);
      
      const { data: authData, error: otpError } = await insforge.auth.verifyEmail(otpPayload);

      if (otpError) throw otpError;
      if (!authData?.user) throw new Error('Session invalide après vérification.');

      // ✅ Email vérifié
      toast.success('Compte validé ! Bienvenue !', {
        duration: 3000,
        style: { background: '#1e293b', color: '#fbbf24', border: '1px solid #f59e0b40' }
      });

      if (pendingRegistration) {
        // Flux inscription : se reconnecter pour obtenir une session authentifiée complète
        // (verifyEmail ne garantit pas toujours une session avec les bons droits RLS)
        const { data: loginData, error: loginError } = await insforge.auth.signInWithPassword({
          email: pendingRegistration.email,
          password: pendingRegistration.pin
        });
        if (loginError) throw loginError;
        await createRestaurantAndProfile(loginData.user.id, pendingRegistration);
      } else {
        // Flux connexion : charger le profil existant
        await finalizeLogin(authData);
      }

    } catch (err) {
      console.error(err);
      const isInvalid = err.message?.toLowerCase().includes('expired')
        || err.message?.toLowerCase().includes('invalid')
        || err.message?.toLowerCase().includes('otp');
      const msg = isInvalid
        ? 'Code incorrect ou expiré. Cliquez sur « Renvoyer » pour obtenir un nouveau code.'
        : err.message || 'Erreur lors de la vérification.';
      setError(msg);
      toast.error(msg, {
        style: { background: '#1e293b', color: '#f87171', border: '1px solid #ef444440' }
      });
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
    // Générer l'ID du restaurant côté client pour éviter le .select() après insert
    // (.select() déclenche un SELECT soumis au RLS, mais l'utilisateur n'est pas encore dans bms_users)
    const restaurantId = crypto.randomUUID();

    const { error: restError } = await insforge.database
      .from('restaurants')
      .insert([{ id: restaurantId, nom: rName }]);

    if (restError) throw new Error(`Restaurant: ${restError.message}`);

    // Créer le profil bms_users (maintenant get_my_restaurant_id() pourra fonctionner)
    const { data: newUser, error: userError } = await insforge.database
      .from('bms_users')
      .insert([{
        id: userId,
        restaurant_id: restaurantId,
        nom: uName,
        email: uEmail,
        pin_code: uPin,
        role: 'ADMIN'
      }])
      .select()
      .single();

    if (userError) throw new Error(`Profil: ${userError.message}`);

    setAuth({ isAuthenticated: true, user: newUser, restaurant: { id: restaurantId, nom: rName } });
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

      // InForge envoie un code OTP par email
      if (authData?.requireEmailVerification || (authData?.user && !authData?.session)) {
        // Stocker les données en mémoire (PAS d'appel DB ici, pas encore de session)
        setPendingRegistration({ restaurantName, userName, email, pin });
        setOtpType('signup');
        setStep('otp');
        setSuccessMessage(`Code envoyé à ${email} ! Saisissez-le ci-dessous pour activer votre compte.`);
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

        {/* showResendUI supprimé : le flux email non confirmé redirige désormais
            directement vers l'écran OTP (handleLogin le gère) */}

        {/* ── ÉTAPE OTP ── */}
        {step === 'otp' && (
          <div className="px-8 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-400">

            {/* Bandeau informatif */}
            <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 mb-6">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <Mail className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-slate-200 font-semibold text-sm">Code envoyé par email</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  Nous vous avons envoyé un code à 6 chiffres à{' '}
                  <span className="text-amber-400 font-medium break-all">{email}</span>.
                  Saisissez-le ci-dessous.
                </p>
              </div>
            </div>

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
                    autoFocus={i === 0}
                    className={`w-11 h-14 text-center text-2xl font-bold rounded-xl border-2 bg-slate-950 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                      digit
                        ? 'border-amber-500 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                        : 'border-slate-700 text-slate-100 focus:border-amber-500'
                    }`}
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={isLoading || otpDigits.join('').length < 6}
                className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-amber-500/20"
              >
                {isLoading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <><Sparkles className="w-5 h-5" /> Valider mon compte</>
                }
              </button>
            </form>

            {/* Renvoi du code */}
            <div className="mt-5 text-center">
              <p className="text-slate-500 text-xs mb-2">Vous n'avez pas reçu le code ?</p>
              <button
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isLoading}
                className="flex items-center gap-1.5 mx-auto text-sm font-semibold disabled:text-slate-700 disabled:cursor-not-allowed text-amber-500 hover:text-amber-400 transition-colors duration-200"
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
              onClick={() => { setStep('login'); setError(null); setOtpDigits(['', '', '', '', '', '']); setSuccessMessage(null); setPendingRegistration(null); }}
              className="mt-5 w-full text-slate-600 hover:text-slate-400 text-xs text-center transition-colors duration-200"
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
