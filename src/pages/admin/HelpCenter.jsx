import React, { useState, useMemo } from 'react';
import {
  Search, ChevronDown, ChevronUp, HelpCircle,
  DollarSign, Printer, Package, QrCode,
  Users, Shield, Wifi, BarChart3, Clock,
  PhoneCall, MessageCircle
} from 'lucide-react';

// ── FAQ DATA ──────────────────────────────────────────────────────────────────
const HELP_DATA = [
  {
    icon: DollarSign,
    title: 'Comment convertir le prix en CFA ?',
    content: "Les prix sont stockes en Euros dans la base de donnees. L'application convertit automatiquement avec le taux 1 EUR = 655,957 FCFA. Pour changer la devise affichee, clique sur le bouton devise (EUR/CFA/USD) dans la barre du haut de la Caisse. La fonction formatPrice() arrondit les CFA a l'entier le plus proche.",
    tags: ['cfa', 'euro', 'prix', 'devise', 'convertir', 'fcfa', 'dollar', 'usd', 'taux'],
  },
  {
    icon: Printer,
    title: 'Comment imprimer un ticket de caisse ?',
    content: "Apres avoir encaisse une commande, clique sur 'Encaisser & Imprimer'. Un apercu du ticket s'affiche. Utilise le bouton d'impression pour lancer l'impression via le navigateur (Ctrl+P / Cmd+P). Tu peux utiliser une imprimante thermique Bluetooth ou une imprimante classique. Le ticket affiche les articles, le total et le mode de paiement.",
    tags: ['ticket', 'imprimer', 'caisse', 'impression', 'print', 'recu', 'facture', 'thermique'],
  },
  {
    icon: Package,
    title: 'Comment gerer les stocks de boisson ?',
    content: "Va dans l'onglet Inventaire. Clique sur 'Nouveau Produit' pour ajouter une boisson (Flag, Bock, Ivoire...). Definis le stock initial et le seuil d'alerte (stock minimum). Quand tu vends, le stock se decrement automatiquement. Une alerte rouge apparait quand le stock passe sous le seuil minimum. Tu peux aussi faire des ajustements manuels (entree/sortie).",
    tags: ['stock', 'boisson', 'inventaire', 'bouteille', 'flag', 'bock', 'ivoire', 'rupture', 'alerte', 'ajustement'],
  },
  {
    icon: QrCode,
    title: 'Comment fonctionne la commande par QR Code ?',
    content: "Chaque table a un QR Code unique. Le client scanne le code avec son telephone, voit le menu et passe commande. Tu recois une notification en temps reel dans la section 'Commandes Web' (icone cloche). Tu peux accepter ou refuser la commande. Le client est informe du statut.",
    tags: ['qr', 'code', 'menu', 'client', 'commande', 'web', 'scanner', 'telephone', 'notification'],
  },
  {
    icon: Users,
    title: 'Comment ajouter et gerer les tables ?',
    content: "Va dans l'onglet Tables. Clique sur '+' pour ajouter une nouvelle table. Chaque table a un statut : Libre (vert), Occupee (orange), Service Demande (rouge). Change le statut en cliquant sur la table. Le QR Code de la table est genere automatiquement.",
    tags: ['table', 'ajouter', 'statut', 'libre', 'occupee', 'service', 'gestion'],
  },
  {
    icon: Clock,
    title: "Comment fonctionnent les cycles de service ?",
    content: "Un cycle represente une session de travail (ex: Service du midi, Service du soir). Ouvre un cycle pour commencer a enregistrer les ventes. Ferme-le en fin de service pour voir le recapitulatif : chiffre d'affaires, nombre d'articles vendus, depenses. Les cycles te permettent de suivre la performance par service.",
    tags: ['cycle', 'service', 'session', 'ouvrir', 'fermer', 'midi', 'soir', 'recapitulatif'],
  },
  {
    icon: BarChart3,
    title: 'Comment voir mes statistiques de vente ?',
    content: "Va dans l'onglet Gestion. Tu y trouveras : le chiffre d'affaires du cycle en cours, le nombre d'articles vendus, les alertes de stock bas, et l'historique des commandes. Les montants sont affiches dans la devise que tu as selectionnee.",
    tags: ['statistique', 'vente', 'chiffre', 'affaires', 'dashboard', 'gestion', 'recette', 'benefice'],
  },
  {
    icon: Shield,
    title: 'Comment securiser mon compte ?',
    content: "Ton compte est protege par email + code PIN (6 chiffres minimum). Lors de l'inscription, un code de verification est envoye par email. Si tu oublies ton PIN, utilise 'Mot de passe oublie' sur l'ecran de connexion pour recevoir un lien de reinitialisation.",
    tags: ['securite', 'compte', 'pin', 'mot de passe', 'oublie', 'reinitialiser', 'email', 'connexion'],
  },
  {
    icon: Wifi,
    title: "L'application fonctionne-t-elle hors connexion ?",
    content: "L'application necessite une connexion Internet pour synchroniser les donnees avec le serveur (InForge). Cependant, les donnees du cycle en cours sont gardees en memoire. Si ta connexion est instable, les commandes seront synchronisees des le retour du reseau.",
    tags: ['hors ligne', 'connexion', 'internet', 'wifi', 'reseau', 'synchronisation', 'offline'],
  },
  {
    icon: DollarSign,
    title: 'Comment enregistrer une depense ?',
    content: "Dans l'onglet Gestion, section Depenses, clique sur 'Nouvelle depense'. Saisis le montant (en CFA, il sera converti), la description (ex: Achat glace, Transport). La depense est liee au cycle en cours pour un suivi precis de ta rentabilite.",
    tags: ['depense', 'charge', 'achat', 'transport', 'glace', 'frais'],
  },
];

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export const HelpCenter = () => {
  const [query, setQuery] = useState('');
  const [openIndex, setOpenIndex] = useState(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return HELP_DATA;
    const q = query.toLowerCase().trim();
    return HELP_DATA.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.content.toLowerCase().includes(q) ||
      item.tags.some(tag => tag.includes(q))
    );
  }, [query]);

  const toggle = (i) => setOpenIndex(prev => prev === i ? null : i);

  return (
    <div className="min-h-[100dvh] bg-slate-950 pb-[max(env(safe-area-inset-bottom,1rem),5rem)]">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/50">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100">Centre d'aide</h1>
              <p className="text-xs text-slate-500">{HELP_DATA.length} articles disponibles</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
            <input
              type="text"
              placeholder='Rechercher... (ex: "CFA", "ticket", "stock")'
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-all"
            />
          </div>
        </div>
      </div>

      {/* FAQ List */}
      <div className="px-4 pt-4 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-7 h-7 text-slate-600" />
            </div>
            <p className="text-slate-400 font-medium mb-1">Aucun resultat pour "{query}"</p>
            <p className="text-slate-600 text-sm mb-6">Essaie un autre mot-cle</p>
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 max-w-xs mx-auto">
              <p className="text-slate-400 text-sm mb-3">Besoin d'aide ?</p>
              <a
                href="https://wa.me/2250700000000"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                Contacter le support
              </a>
            </div>
          </div>
        ) : (
          filtered.map((item, i) => {
            const isOpen = openIndex === i;
            const Icon = item.icon;
            return (
              <div
                key={i}
                className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all duration-200 ${
                  isOpen ? 'border-amber-500/30 shadow-lg shadow-amber-500/5' : 'border-slate-800'
                }`}
              >
                <button
                  onClick={() => toggle(i)}
                  className="w-full flex items-center gap-3 px-4 py-4 text-left"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isOpen ? 'bg-amber-500/15' : 'bg-slate-800'
                  }`}>
                    <Icon className={`w-4.5 h-4.5 ${isOpen ? 'text-amber-400' : 'text-slate-500'}`} />
                  </div>
                  <span className={`flex-1 text-sm font-medium transition-colors ${
                    isOpen ? 'text-amber-400' : 'text-slate-200'
                  }`}>
                    {item.title}
                  </span>
                  <div className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    <ChevronDown className={`w-4 h-4 ${isOpen ? 'text-amber-500' : 'text-slate-600'}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="ml-12 pl-0 border-l-2 border-amber-500/20 pl-4">
                      <p className="text-slate-400 text-sm leading-relaxed">
                        {item.content}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pt-8 pb-4 text-center">
        <p className="text-slate-700 text-xs">
          MBS APP - Aide &amp; Support
        </p>
      </div>
    </div>
  );
};
