import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { insforge } from '../../lib/insforge';
import { Loader2, Store, User, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

export const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  const navigate = useNavigate();
  const setAuth = useStore(state => state.setAuth);
  const initializeStore = useStore(state => state.initializeStore);

  // Form states
  const [restaurantName, setRestaurantName] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // 1. Authentification forte (Native InForge)
      const { data: authData, error: authError } = await insforge.auth.signInWithPassword({
        email,
        password: pin
      });

      if (authError) throw authError;

      // 2. Récupérer le profil utilisateur lié
      const { data: userProfile, error: userError } = await insforge.database
        .from('bms_users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (userError || !userProfile) {
        throw new Error("Profil utilisateur introuvable.");
      }

      // 3. Récupérer le restaurant séparément
      const { data: restaurantData } = await insforge.database
        .from('restaurants')
        .select('*')
        .eq('id', userProfile.restaurant_id)
        .single();

      const user = userProfile;
      const restaurant = restaurantData || { id: userProfile.restaurant_id, nom: 'Mon Restaurant' };

      // 3. Mettre à jour le store
      setAuth({ isAuthenticated: true, user, restaurant });
      
      // 4. Charger les données du restaurant
      await initializeStore();
      
      // 5. Redirection
      navigate('/pos');
      
    } catch (err) {
      console.error(err);
      setError(err.message === 'Invalid login credentials' ? "Email ou code PIN incorrect." : err.message || "Erreur lors de la connexion.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (pin.length < 4) throw new Error("Le code PIN doit faire au moins 4 caractères.");

      // 1. Création du compte InForge Auth (Identité forte)
      const { data: authData, error: authError } = await insforge.auth.signUp({
        email,
        password: pin
      });

      if (authError) throw authError;

      // Handle mandatory email verification
      if (authData?.requireEmailVerification || (authData?.user && !authData?.session)) {
        setSuccessMessage("Compte créé ! Veuillez vérifier votre boîte mail pour confirmer votre inscription.");
        return;
      }

      if (!authData?.user) throw new Error("Erreur lors de la création du compte.");

      const userId = authData.user.id;

      // 2. Créer le restaurant
      const { data: newRestaurant, error: restError } = await insforge.database
        .from('restaurants')
        .insert([{ nom: restaurantName }])
        .select()
        .single();

      if (restError) throw new Error(`Impossible de créer le restaurant: ${restError.message}`);

      // 3. Créer l'utilisateur dans bms_users lié à l'Auth ID
      const { data: newUser, error: userError } = await insforge.database
        .from('bms_users')
        .insert([{
          id: userId, // LIEN CRITIQUE : bms_users.id = auth.uid()
          restaurant_id: newRestaurant.id,
          nom: userName,
          email: email,
          pin_code: pin, // Optionnel si on utilise native auth, mais utile pour compatibilité
          role: 'ADMIN'
        }])
        .select()
        .single();

      if (userError) throw userError;

      // 4. Mettre à jour le store
      setAuth({ isAuthenticated: true, user: newUser, restaurant: newRestaurant });
      
      // 5. Charger les données
      await initializeStore();
      
      // 6. Redirection
      navigate('/pos');

    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de l'inscription.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden pb-[max(env(safe-area-inset-bottom,1rem),1rem)]">
      
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 transition-all duration-500">
        
        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center">
          <div className="w-16 h-16 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <ShieldCheck className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 uppercase tracking-widest">
            MBS <span className="text-amber-500">APP</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {isLogin ? "Connectez-vous à votre espace" : "Créez votre espace restaurant"}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex px-8 mb-6">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-3 text-sm font-semibold transition-all duration-300 border-b-2 ${isLogin ? 'text-amber-500 border-amber-500' : 'text-slate-500 border-slate-800 hover:text-slate-300'}`}
          >
            Connexion
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-3 text-sm font-semibold transition-all duration-300 border-b-2 ${!isLogin ? 'text-amber-500 border-amber-500' : 'text-slate-500 border-slate-800 hover:text-slate-300'}`}
          >
            Inscription
          </button>
        </div>

        {error && (
          <div className="mx-8 mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mx-8 mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 text-sm text-center animate-in fade-in duration-500">
            {successMessage}
          </div>
        )}

        {/* Forms */}
        <div className="px-8 pb-8">
          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
            
            {!isLogin && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Store className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    required
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    placeholder="Nom du Restaurant"
                    className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                  />
                </div>
                
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Votre Nom (Admin)"
                    className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                  />
                </div>
              </div>
            )}

            <div className="relative animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Adresse email"
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
              />
            </div>

            <div className="relative animate-in fade-in slide-in-from-bottom-2 duration-300 delay-75">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="password"
                required
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Code PIN (secret)"
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-500 tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 text-slate-900 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 delay-150"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? "Se connecter" : "Créer l'espace"}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
{/* 
      <div className="mt-8 text-center animate-in fade-in duration-1000">
        <p className="text-slate-600 text-sm">Sécurisé par <span className="text-slate-400 font-semibold">InForge</span></p>
      </div> */}
    </div>
  );
};
