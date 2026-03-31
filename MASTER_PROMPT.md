# MASTER PROMPT — BMS APP (Bar Management System)

> Copie exacte du projet `neon-bar-app`. Utilise ce prompt pour recréer l'application à l'identique depuis zéro.

---

## CONTEXTE & OBJECTIF

Crée une application web complète de gestion de bar/restaurant appelée **BMS APP** (Bar Management System).
L'interface est en **français**, thème **dark (slate-950)**, accent **amber-500**.
Stack : React 19 + Vite + Tailwind CSS 4 + Zustand + InsForge (backend BaaS).

---

## STACK TECHNIQUE EXACTE

```
React 19.2.4
React Router DOM 7.13.2
Zustand 5.0.12
Tailwind CSS 4.2.2 (@tailwindcss/vite)
Lucide React 1.7.0
qrcode.react 4.2.0
clsx 2.1.1
tailwind-merge 3.5.0
@insforge/sdk 1.2.2
Vite 8.0.1
Vitest 4.1.2
ESLint 9.x
```

**Backend** : InsForge (Supabase-like) — authentification par anon key, PostgreSQL, RLS public, WebSocket realtime.

---

## STRUCTURE DES FICHIERS

```
src/
├── App.jsx
├── main.jsx
├── index.css
├── components/
│   ├── ui/
│   │   ├── Button.jsx
│   │   ├── Badge.jsx
│   │   └── ProductCard.jsx
│   ├── layout/
│   │   ├── AdminLayout.jsx
│   │   └── ClientLayout.jsx
│   └── admin/
│       └── WebOrdersModal.jsx
├── pages/
│   ├── admin/
│   │   ├── POS.jsx
│   │   ├── Inventory.jsx
│   │   ├── Dashboard.jsx
│   │   └── Tables.jsx
│   └── client/
│       └── Menu.jsx
├── store/
│   └── store.js
├── lib/
│   └── insforge.js
└── utils/
    ├── currency.js
    ├── i18n.js
    ├── stock.js
    ├── sound.js
    └── utils.js
insforge/
└── schema.sql
```

---

## ROUTING (App.jsx)

```
/           → redirect → /pos
/pos        → <POS />          (AdminLayout)
/inventory  → <Inventory />    (AdminLayout)
/tables     → <Tables />       (AdminLayout)
/dashboard  → <Dashboard />    (AdminLayout)
/menu/:tableId → <Menu />      (ClientLayout)
/menu          → <Menu />      (ClientLayout)
```

---

## BASE DE DONNÉES (PostgreSQL via InsForge)

### schema.sql complet

```sql
DROP TABLE IF EXISTS movements CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS cycles CASCADE;

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price FLOAT NOT NULL,           -- prix de vente EUR (base interne)
  cost_price FLOAT DEFAULT 0,     -- prix de revient EUR
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  image_url TEXT,
  archived BOOLEAN DEFAULT FALSE, -- soft delete
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tables (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL,
  status TEXT DEFAULT 'libre',    -- 'libre' | 'occupee' | 'service_demande'
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cycles (
  id TEXT PRIMARY KEY,            -- format 'SHIFT-XXXXXX'
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  start_stock JSONB DEFAULT '[]'::jsonb,  -- [{productId, name, stock}]
  end_stock JSONB DEFAULT '[]'::jsonb,
  opened_by TEXT,
  closed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,            -- format 'ORD-XXXXXX' ou 'WEB-XXXXXX'
  items JSONB NOT NULL,           -- [{product, quantity, sellingPrice, costPrice}]
  total FLOAT NOT NULL,           -- EUR
  table_number INTEGER,
  payment_method TEXT DEFAULT 'Espèces',  -- 'Espèces' | 'Mobile Money' | 'Carte Bancaire'
  status TEXT DEFAULT 'pending',  -- 'pending' | 'completed' | 'cancelled'
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  cycle_id TEXT REFERENCES cycles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE movements (
  id TEXT PRIMARY KEY,            -- format 'MOV-TIMESTAMP-XXXX'
  product_id TEXT REFERENCES products(id),
  product_name TEXT NOT NULL,
  type TEXT NOT NULL,             -- 'IN' | 'OUT'
  quantity INTEGER NOT NULL,
  reason TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  cycle_id TEXT REFERENCES cycles(id)
);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY,            -- format 'EXP-TIMESTAMP-XXXX'
  amount FLOAT NOT NULL,
  reason TEXT NOT NULL,
  category TEXT DEFAULT 'Charges Fixes',
  date TIMESTAMPTZ DEFAULT NOW(),
  cycle_id TEXT REFERENCES cycles(id)
);

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Policies publiques (pas d'auth)
CREATE POLICY "Public full access" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON tables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON cycles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON expenses FOR ALL USING (true) WITH CHECK (true);

-- Realtime channels
INSERT INTO realtime.channels (pattern, description, enabled) VALUES
  ('orders',   'Canal des commandes', true),
  ('products', 'Canal des produits',  true),
  ('tables',   'Canal des tables',    true)
ON CONFLICT (pattern) DO NOTHING;

-- Triggers realtime
CREATE OR REPLACE FUNCTION notify_order_changes() RETURNS TRIGGER AS $$
BEGIN PERFORM realtime.publish('orders', 'ORDER_CHANGE', row_to_json(NEW)::jsonb); RETURN NEW; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER order_realtime AFTER INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION notify_order_changes();

CREATE OR REPLACE FUNCTION notify_product_changes() RETURNS TRIGGER AS $$
BEGIN PERFORM realtime.publish('products', 'PRODUCT_CHANGE', row_to_json(NEW)::jsonb); RETURN NEW; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER product_realtime AFTER INSERT OR UPDATE ON products FOR EACH ROW EXECUTE FUNCTION notify_product_changes();

CREATE OR REPLACE FUNCTION notify_table_changes() RETURNS TRIGGER AS $$
BEGIN PERFORM realtime.publish('tables', 'TABLE_CHANGE', row_to_json(NEW)::jsonb); RETURN NEW; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER table_realtime AFTER INSERT OR UPDATE ON tables FOR EACH ROW EXECUTE FUNCTION notify_table_changes();
```

---

## FICHIERS SOURCE COMPLETS

### `src/lib/insforge.js`
```js
import { createClient } from '@insforge/sdk';

export const insforge = createClient(
  import.meta.env.VITE_INSFORGE_URL,
  import.meta.env.VITE_INSFORGE_ANON_KEY
);
```

### `src/utils/currency.js`
```js
const EXCHANGE_RATES = { EUR: 1, CFA: 655.957, USD: 1.08 };

export const formatPrice = (basePrice, activeCurrency = 'CFA') => {
  const rate = EXCHANGE_RATES[activeCurrency] || 1;
  const converted = basePrice * rate;
  if (activeCurrency === 'CFA')
    return `${Math.round(converted).toLocaleString('fr-FR').replace(/,/g, ' ')} FCFA`;
  if (activeCurrency === 'USD')
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(converted);
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(converted);
};
```

### `src/utils/utils.js`
```js
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs) { return twMerge(clsx(inputs)); }
```

### `src/utils/sound.js`
```js
export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (e) { /* silently fail */ }
}
```

### `src/utils/stock.js`
```js
// Rétropole le stock d'un produit à une date donnée
export function calculateHistoricalStock(productId, dateStr, products, movements) {
  const product = products.find(p => p.id === productId);
  if (!product) return 0;

  const targetDate = new Date(dateStr);
  targetDate.setHours(23, 59, 59, 999);

  // Mouvements APRÈS la date cible → à inverser
  const futureMovements = movements.filter(m => {
    if (m.productId !== productId) return false;
    return new Date(m.date) > targetDate;
  });

  let historicalStock = product.stock;
  for (const mov of futureMovements) {
    if (mov.type === 'IN')  historicalStock -= mov.quantity;
    if (mov.type === 'OUT') historicalStock += mov.quantity;
  }
  return Math.max(0, historicalStock);
}
```

### `src/utils/i18n.js`
```js
import { useStore } from '../store/store';

const translations = {
  fr: {
    'nav.pos': 'Caisse', 'nav.inventory': 'Stock', 'nav.tables': 'Tables', 'nav.dashboard': 'Tableau de bord',
    'pos.title': 'Point de Vente', 'pos.search': 'Rechercher un produit...', 'pos.cart': 'Panier',
    'pos.empty_cart': 'Le panier est vide', 'pos.total': 'Total', 'pos.checkout': 'Encaisser',
    'pos.table_select': 'Aucune table',
    'inventory.title': 'Gestion des Stocks', 'inventory.add_product': 'Ajouter un produit',
    'inventory.search': 'Rechercher...', 'inventory.name': 'Produit', 'inventory.category': 'Catégorie',
    'inventory.price': 'Prix de vente', 'inventory.cost': 'Prix de revient', 'inventory.stock': 'Stock',
    'inventory.min_stock': 'Stock min', 'inventory.actions': 'Actions',
    'dashboard.title': 'Tableau de Bord', 'dashboard.today_sales': 'Ventes du jour',
    'dashboard.items_sold': 'Articles vendus', 'dashboard.low_stock': 'Alertes stock',
    'dashboard.expenses': 'Dépenses',
    'tables.title': 'Gestion des Tables', 'tables.libre': 'Libre', 'tables.occupee': 'Occupée',
    'tables.service': 'Service demandé',
    'menu.title': 'Notre Menu', 'menu.search': 'Rechercher...', 'menu.order': 'Commander',
    'menu.cart': 'Mon panier', 'menu.confirm': 'Confirmer la commande',
    'common.save': 'Enregistrer', 'common.cancel': 'Annuler', 'common.delete': 'Supprimer',
    'common.edit': 'Modifier', 'common.close': 'Fermer', 'common.loading': 'Chargement...',
  },
  en: {
    'nav.pos': 'POS', 'nav.inventory': 'Inventory', 'nav.tables': 'Tables', 'nav.dashboard': 'Dashboard',
    'pos.title': 'Point of Sale', 'pos.search': 'Search product...', 'pos.cart': 'Cart',
    'pos.empty_cart': 'Cart is empty', 'pos.total': 'Total', 'pos.checkout': 'Checkout',
    'pos.table_select': 'No table',
    'inventory.title': 'Inventory Management', 'inventory.add_product': 'Add product',
    'inventory.search': 'Search...', 'inventory.name': 'Product', 'inventory.category': 'Category',
    'inventory.price': 'Selling price', 'inventory.cost': 'Cost price', 'inventory.stock': 'Stock',
    'inventory.min_stock': 'Min stock', 'inventory.actions': 'Actions',
    'dashboard.title': 'Dashboard', 'dashboard.today_sales': 'Today\'s sales',
    'dashboard.items_sold': 'Items sold', 'dashboard.low_stock': 'Stock alerts',
    'dashboard.expenses': 'Expenses',
    'tables.title': 'Table Management', 'tables.libre': 'Free', 'tables.occupee': 'Occupied',
    'tables.service': 'Service requested',
    'menu.title': 'Our Menu', 'menu.search': 'Search...', 'menu.order': 'Order',
    'menu.cart': 'My cart', 'menu.confirm': 'Confirm order',
    'common.save': 'Save', 'common.cancel': 'Cancel', 'common.delete': 'Delete',
    'common.edit': 'Edit', 'common.close': 'Close', 'common.loading': 'Loading...',
  }
};

export function useTranslation() {
  const language = useStore(state => state.language);
  return (key) => translations[language]?.[key] || translations['fr'][key] || key;
}
```

---

## STORE ZUSTAND COMPLET (`src/store/store.js`)

Le store gère tout l'état global. Points clés :

1. **Mapping camelCase ↔ snake_case** entre le frontend et la DB via `mapToDb`/`mapFromDb`
2. **12 tables mockées** si la DB est vide : `Array.from({length: 12}, (_, i) => ({id:(i+1).toString(), number:i+1, status:'libre'}))`
3. **initializeStore()** : charge tout en parallèle + établit 3 listeners WebSocket (orders, products, tables)
4. **Snapshot prix** : à l'ajout au panier, `sellingPrice = product.price` et `costPrice = product.costPrice` sont capturés
5. **cancelOrder** : réverse le stock (type 'IN', reason `Annulation - {orderId}`)
6. **adjustStock IN** : peut mettre à jour `costPrice` ; OUT ne touche que le stock
7. **openCycle** : si un cycle a déjà été ouvert+fermé aujourd'hui → le réouvre au lieu d'en créer un nouveau

Mappings :
```js
productMapping  = { minStock:'min_stock', imageUrl:'image_url', costPrice:'cost_price' }
cycleMapping    = { startTime:'start_time', endTime:'end_time', startStock:'start_stock', endStock:'end_stock', openedBy:'opened_by', closedBy:'closed_by' }
orderMapping    = { tableNumber:'table_number', paymentMethod:'payment_method', cycleId:'cycle_id' }
movementMapping = { productId:'product_id', productName:'product_name', cycleId:'cycle_id' }
expenseMapping  = { cycleId:'cycle_id' }
```

ID formats :
- Produits : `'PRD-' + Date.now() + '-' + random(4)`
- Commandes POS : `'ORD-' + random(6).toUpperCase()`
- Commandes web : `'WEB-' + random(6).toUpperCase()`
- Mouvements : `'MOV-' + Date.now() + '-' + random(4).toUpperCase()`
- Dépenses : `'EXP-' + Date.now() + '-' + random(4).toUpperCase()`
- Cycles : `'SHIFT-' + random(6).toUpperCase()`

---

## COMPOSANTS UI

### `src/components/ui/Button.jsx`
Variants : `primary | secondary | outline | ghost | danger`
Sizes : `default | sm | lg | icon`
- `primary` : `bg-amber-500 text-slate-950 hover:bg-amber-400`
- `danger` : `bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20`

### `src/components/ui/Badge.jsx`
Variants : `default | success | warning | danger | outline`
- `success` : `bg-emerald-500/10 text-emerald-500`
- `warning` : `bg-amber-500/10 text-amber-500`
- `danger`  : `bg-red-500/10 text-red-500`

### `src/components/ui/ProductCard.jsx`
- Affiche image (avec fallback icône), nom, catégorie, prix formaté, badge stock
- Badge stock : `stock <= 0` → "Rupture" (danger), `stock <= minStock` → "Faible" (warning), sinon "En Stock" (success)
- Bouton "+" → `addToCart(product)` — désactivé si stock = 0
- Clique sur la card elle-même ajoute aussi au panier

---

## PAGE POS (`src/pages/admin/POS.jsx`)

**État fermé** : si `!currentCycle`, affiche un écran verrouillé avec Lock icon + bouton "Ouvrir le service maintenant" → `openCycle()` après `window.confirm()`

**Grille produits** : `grid-cols-3 sm:grid-cols-4 md:grid-cols-5`, filtrée par `searchTerm` (name + category)

**Sidebar panier** :
- Desktop (lg+) : panneau fixe à droite `w-96`
- Mobile : drawer coulissant `fixed inset-y-0 right-0 z-[100]` avec backdrop
- FAB mobile : `fixed bottom-24 right-4 z-[80] h-16 w-16 bg-amber-500 rounded-full` avec badge rouge animé

**Prix éditables** : clic sur Edit2 icon → input en CFA → validation → `updateCartItemPrice(id, valueCFA / 655.957)`

**Checkout flow** :
1. Bouton "Encaisser" → modal paiement (`z-[110]`)
2. Choix : Espèces (emerald), Mobile Money (amber), Carte Bancaire (blue)
3. `checkout(tableNumber, paymentMethod)` → reset cart → ouvre modal ticket

**Ticket de caisse** : `z-[120]`, format `font-mono w-[300px]`, entête BMS APP, date/heure, numéro ticket, liste articles, total, paiement, "Merci de votre visite" → bouton `window.print()`

**Clôture cycle** : bouton Power icon dans l'entête → `window.confirm()` → `closeCycle()`

---

## PAGE INVENTORY (`src/pages/admin/Inventory.jsx`)

**Deux onglets** : "État des Stocks" | "Mouvements de Stock"

**Onglet stocks** :
- Filtre date (date picker) → si date ≠ aujourd'hui, utilise `calculateHistoricalStock()`
- Tableau : image, nom, catégorie, prix vente, prix revient, stock actuel/historique, badge alerte, boutons action
- Badges : "Rupture" (rouge), "Faible" (orange), "OK" (vert)
- Bouton éditer produit → modal edit
- Bouton ajuster stock → modal ajustement
- Bouton supprimer → `deleteProduct(id)` (soft archive) après confirm

**Modal ajustement stock** :
- Type : IN / OUT (radio ou select)
- Quantité
- Raison (IN : "Livraison Fournisseur", "Retour Client", "Inventaire" ; OUT : "Casse", "Consommation interne", "Perte")
- Si IN : champ "Nouveau prix de revient (optionnel)"
- → `adjustStock(productId, type, qty, reason, newCostPrice)`

**Modal produit** (add/edit) :
- Nom, catégorie, prix de vente (en CFA → converti EUR : valCFA/655.957), prix de revient (CFA), stock initial, stock min, URL image
- → `addProduct()` ou `updateProduct()`

**Onglet mouvements** :
- Liste triée par date desc
- Colonnes : date, produit, type (IN badge vert / OUT badge rouge), quantité, raison, cycle

---

## PAGE DASHBOARD (`src/pages/admin/Dashboard.jsx`)

**Quatre onglets** : "Résumé du Jour" | "Détail des Opérations" | "Petite Caisse" | "Sessions (Z)"

**Onglet Résumé** (KPIs) :
- Filtre date
- Total ventes du jour (sum orders completed)
- Nombre d'articles vendus
- Nombre d'alertes stock faible
- Total dépenses
- Liste des 5 dernières opérations

**Onglet Opérations** :
- Tableau des commandes filtrées par date
- Colonnes : heure, ID, table, articles (count), total, méthode paiement, profit (total - sum(costPrice*qty)), statut
- Profit coloré : vert si positif, rouge si négatif
- Clic ligne → modal détail commande (ticket view)
- Bouton annuler commande
- Bouton export CSV

**Onglet Petite Caisse** :
- Form ajout dépense : montant (FCFA), raison, catégorie
- Liste dépenses du jour
- Total dépenses

**Onglet Sessions (Z)** :
- Liste des cycles avec dates, montant total, statut (En cours / Terminé)
- Clic → modal rapport Z :
  - Tableau stock début/fin/écart par produit
  - Total ventes du cycle
  - Total dépenses du cycle
  - Résultat net

---

## PAGE TABLES (`src/pages/admin/Tables.jsx`)

- Grille de 12 tables (ou selon DB)
- Couleurs : libre (slate-800/700), occupee (amber-500/10 + border amber), service_demande (red-500/10 + border red + **animate-pulse**)
- Chaque carte : numéro table, badge statut, boutons de transition
- Bouton QR Code → modal avec `<QRCodeSVG value={window.location.origin + '/menu/' + table.number} />`
- Boutons statut : marquer libre / marquer occupée / (service_demande → accepté = libre)

---

## PAGE MENU CLIENT (`src/pages/client/Menu.jsx`)

- Layout clair (white/slate-50 bg)
- Récupère `tableId` depuis `useParams()`
- Filtre products où `stock > 0`
- SearchBar, liste produits avec image, nom, prix en CFA, boutons +/-
- Cart flottant en bas (sticky) avec compteur et bouton "Commander"
- Submit → `submitWebOrder(tableId, cart)` → écran confirmation "Commande envoyée !"
- Pas de `currentCycle` requis côté client

---

## LAYOUT ADMIN (`src/components/layout/AdminLayout.jsx`)

- **Desktop** : sidebar fixe gauche `w-24 lg:w-64` avec logo "BMS APP"/"BMS", navLinks + tooltip sur md
- **Mobile** : `fixed bottom-0` nav bar `h-16` avec 4 liens + bouton Web Orders
- **Notification bell** : si `hasNewWebOrder` → bouton amber pulsant avec badge rouge, `animate-bounce` sur l'icône
- **Language toggle** : bouton bas sidebar FR/EN → `setLanguage()`
- **WebOrdersModal** : s'ouvre via cloche

---

## WEB ORDERS MODAL (`src/components/admin/WebOrdersModal.jsx`)

- Modal plein écran ou large (z-[200])
- Liste les commandes avec `status === 'pending'`
- Affiche : table, liste articles, total, heure
- Boutons : **Accepter** (emerald) → `acceptWebOrder(id)` | **Refuser** (red) → `rejectWebOrder(id)`
- Si aucune commande pending : message "Aucune commande en attente"
- Fermeture → `setHasNewWebOrder(false)`

---

## DESIGN SYSTEM

### Couleurs principales
```
slate-950  → #020617  (fond global)
slate-900  → #0f172a  (surfaces, cards, sidebar)
slate-800  → #1e293b  (inputs, bordures légères)
slate-700  → #334155  (bordures actives)
slate-400  → #94a3b8  (texte secondaire)
slate-100  → #f1f5f9  (texte principal)
amber-500  → #f59e0b  (couleur accent principale)
amber-400  → #fbbf24  (hover accent)
emerald-500→ #10b981  (succès, IN)
red-500    → #ef4444  (danger, OUT, annulation)
blue-500   → #3b82f6  (carte bancaire)
```

### Classes communes
```css
/* Card/Panel */
bg-slate-900 border border-slate-800 rounded-xl

/* Input */
bg-slate-800 border border-slate-700 rounded-lg text-slate-100
focus:ring-2 focus:ring-amber-500 focus:border-transparent

/* Modal backdrop */
fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100]

/* Modal container */
bg-slate-900 border border-slate-800 rounded-3xl p-6 animate-in fade-in zoom-in-95

/* Bouton primary */
bg-amber-500 text-slate-950 font-bold hover:bg-amber-400

/* Scrollbar invisible */
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.no-scrollbar::-webkit-scrollbar { display: none; }
```

### Animations utilisées (Tailwind)
- `animate-bounce` — badge panier, cloche alerte
- `animate-pulse` — badge rouge, tables service_demande
- `animate-spin` — loader
- `animate-in fade-in zoom-in-95` — modals (Tailwind animate-in plugin ou CSS custom)

---

## VARIABLES D'ENVIRONNEMENT (`.env`)

```
VITE_INSFORGE_URL=<url_de_ton_projet_insforge>
VITE_INSFORGE_ANON_KEY=<ta_cle_anonyme_insforge>
```

---

## INITIALISATION DE L'APP

### `src/main.jsx`
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
```

### `src/App.jsx`
```jsx
import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/store'
import { AdminLayout } from './components/layout/AdminLayout'
import { ClientLayout } from './components/layout/ClientLayout'
import { POS } from './pages/admin/POS'
import { Inventory } from './pages/admin/Inventory'
import { Dashboard } from './pages/admin/Dashboard'
import { Tables } from './pages/admin/Tables'
import { Menu } from './pages/client/Menu'

export default function App() {
  const { initializeStore, isLoading } = useStore()

  useEffect(() => { initializeStore() }, [])

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500" />
    </div>
  )

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/pos" replace />} />
      <Route element={<AdminLayout />}>
        <Route path="/pos" element={<POS />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/tables" element={<Tables />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
      <Route element={<ClientLayout />}>
        <Route path="/menu/:tableId" element={<Menu />} />
        <Route path="/menu" element={<Menu />} />
      </Route>
    </Routes>
  )
}
```

### `src/index.css`
```css
@import "tailwindcss";

.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.no-scrollbar::-webkit-scrollbar { display: none; }

/* Safe area mobile */
.pb-safe { padding-bottom: env(safe-area-inset-bottom); }
.pt-safe { padding-top: env(safe-area-inset-top); }
```

### `vite.config.js`
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

---

## LOGIQUE MÉTIER CRITIQUE

### Gestion des prix
- Tous les prix sont stockés en **EUR** en DB
- Affichage converti en CFA (×655.957), USD (×1.08) ou EUR
- Le barman peut éditer le prix d'un article dans le panier **en CFA** → converti EUR avant `updateCartItemPrice`
- Le snapshot `sellingPrice` dans `order.items` est en EUR

### Cycle de service
- **Obligatoire** pour accéder au POS (sinon écran verrouillé)
- Ouverture : capture `startStock` (snapshot produits)
- Fermeture : capture `endStock` + timestamp
- **Réouverture le même jour** : si cycle fermé le jour même → rouvre le même cycle (reset `endTime` à null)
- Toutes les commandes et mouvements sont liés au `cycleId` actif

### Commandes web
- Créées en `pending` depuis le menu client
- Pas de déduction de stock au moment du submit
- Stock déduit **seulement** au moment de `acceptWebOrder()` par le barman
- `rejectWebOrder()` : passe en `cancelled` sans toucher le stock
- Trigger audio sur nouvelle commande pending : `playNotificationSound()`

### Annulation de commande
- `cancelOrder()` : passe en `cancelled` + **réverse le stock** (IN) + crée mouvement `Annulation - {orderId}`
- Fonctionne sur les commandes POS et web acceptées

### Stock historique
- Dashboard et Inventory permettent de voir le stock à une date passée
- Calcul : partir du stock actuel et **inverser** tous les mouvements postérieurs à la date cible

---

## ORDRE DE DÉVELOPPEMENT RECOMMANDÉ

1. Setup Vite + React + Tailwind + InsForge SDK
2. Créer le schéma DB dans InsForge
3. `insforge.js` + `store.js` (initializeStore + CRUD de base)
4. Composants UI : Button, Badge, ProductCard
5. AdminLayout (sidebar desktop + nav mobile)
6. Page POS (grille + panier + checkout + ticket)
7. Page Inventory (tableau + modals ajustement + produit)
8. Page Tables (grille + statuts + QR codes)
9. Page Dashboard (KPIs + opérations + petite caisse + sessions Z)
10. ClientLayout + Menu (commande client)
11. WebOrdersModal + notifications temps réel
12. Polissage mobile (FAB, safe areas, no-scrollbar)

---

*Ce master prompt couvre 100% des fonctionnalités actives de BMS APP. Il suffit de brancher ses propres credentials InsForge dans `.env` et d'exécuter `schema.sql` pour avoir un projet identique et fonctionnel.*
