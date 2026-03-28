-- Suppression des anciennes tables si nécessaire
DROP TABLE IF EXISTS movements CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS cycles CASCADE;

-- Table Products (FIFO support via JSONB)
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price FLOAT NOT NULL,
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  image_url TEXT,
  cost_batches JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table Tables (État du restaurant)
CREATE TABLE tables (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL,
  status TEXT DEFAULT 'libre',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table Cycles (Sessions de service Z)
CREATE TABLE cycles (
  id TEXT PRIMARY KEY,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  start_stock JSONB DEFAULT '[]'::jsonb,
  end_stock JSONB DEFAULT '[]'::jsonb,
  opened_by TEXT,
  closed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table Orders (Ventes & Paniers)
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  items JSONB NOT NULL,
  total FLOAT NOT NULL,
  table_number INTEGER,
  payment_method TEXT DEFAULT 'Espèces',
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  cycle_id TEXT REFERENCES cycles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table Movements (Audit de stock)
CREATE TABLE movements (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id),
  product_name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'IN', 'OUT'
  quantity INTEGER NOT NULL,
  reason TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  cycle_id TEXT REFERENCES cycles(id)
);

-- Table Expenses (Petite Caisse)
CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  amount FLOAT NOT NULL,
  reason TEXT NOT NULL,
  category TEXT DEFAULT 'Charges Fixes',
  date TIMESTAMPTZ DEFAULT NOW(),
  cycle_id TEXT REFERENCES cycles(id)
);

-- Activer RLS sur toutes les tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Politiques RLS Simplifiées (Public Read/Write pour le moment en mode Admin/Barman local)
-- Dans une prod réelle, on utiliserait auth.uid()
CREATE POLICY "Public full access" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON tables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON cycles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON expenses FOR ALL USING (true) WITH CHECK (true);
