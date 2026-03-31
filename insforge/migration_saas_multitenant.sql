-- ============================================================
-- BMS APP — SAAS MULTI-TENANT SCHEMA
-- Architecture : Un restaurant = un restaurant_id
-- Toutes les tables métier filtrent par restaurant_id (RLS)
-- ============================================================

-- ─── TABLE: restaurants (racine du tenant) ───────────────────
CREATE TABLE IF NOT EXISTS restaurants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom              TEXT NOT NULL,
  date_creation    TIMESTAMPTZ DEFAULT NOW(),
  plan_abonnement  TEXT NOT NULL DEFAULT 'starter' -- 'starter', 'pro', 'enterprise'
);

-- ─── TABLE: bms_users (staff du bar — PIN auth, pas auth.users) ───
CREATE TABLE IF NOT EXISTS bms_users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  nom            TEXT NOT NULL,
  pin_code       TEXT NOT NULL,              -- stocké haché de préférence
  role           TEXT NOT NULL DEFAULT 'BARMAN' -- 'ADMIN' | 'BARMAN'
);

-- ─── TABLE: products ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  nom            TEXT NOT NULL,
  categorie      TEXT NOT NULL DEFAULT 'Autres',
  prix_vente     FLOAT NOT NULL DEFAULT 0,
  cout_achat     FLOAT NOT NULL DEFAULT 0,
  stock          INTEGER NOT NULL DEFAULT 0,
  stock_min      INTEGER NOT NULL DEFAULT 5,
  image_url      TEXT,
  archived       BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLE: orders ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES bms_users(id) ON DELETE SET NULL,
  total          FLOAT NOT NULL DEFAULT 0,
  date           TIMESTAMPTZ DEFAULT NOW(),
  statut         TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'cancelled'
  payment_method TEXT NOT NULL DEFAULT 'Espèces',
  table_number   INTEGER
);

-- ─── TABLE: order_items ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id               UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id             UUID REFERENCES products(id) ON DELETE SET NULL,
  quantite               INTEGER NOT NULL DEFAULT 1,
  prix_vente_historique  FLOAT NOT NULL DEFAULT 0,  -- snapshot au moment de la vente
  cout_achat_historique  FLOAT NOT NULL DEFAULT 0   -- snapshot CUMP au moment de la vente
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE restaurants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bms_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items   ENABLE ROW LEVEL SECURITY;

-- Politique temporaire FULL ACCESS (remplacer par policies JWT en prod)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bms_saas_full_access' AND tablename = 'restaurants') THEN
    CREATE POLICY "bms_saas_full_access" ON restaurants FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bms_saas_full_access' AND tablename = 'bms_users') THEN
    CREATE POLICY "bms_saas_full_access" ON bms_users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bms_saas_full_access' AND tablename = 'products') THEN
    CREATE POLICY "bms_saas_full_access" ON products FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bms_saas_full_access' AND tablename = 'orders') THEN
    CREATE POLICY "bms_saas_full_access" ON orders FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bms_saas_full_access' AND tablename = 'order_items') THEN
    CREATE POLICY "bms_saas_full_access" ON order_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- INDEX DE PERFORMANCE (filtrage par restaurant_id rapide)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_bms_users_restaurant     ON bms_users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_restaurant       ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant         ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_date               ON orders(date DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id      ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_archived         ON products(archived) WHERE archived = FALSE;
