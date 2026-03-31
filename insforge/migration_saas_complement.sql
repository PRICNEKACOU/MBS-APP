-- ============================================================
-- BMS APP — SAAS MULTI-TENANT SCHEMA (COMPLÉMENT)
-- Tables manquantes : cycles, movements, expenses, tables
-- ============================================================

-- ─── TABLE: cycles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cycles (
  id             TEXT PRIMARY KEY,
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  start_time     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time       TIMESTAMPTZ,
  start_stock    JSONB DEFAULT '[]'::jsonb,
  end_stock      JSONB DEFAULT '[]'::jsonb,
  opened_by      TEXT,
  closed_by      TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLE: movements ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movements (
  id             TEXT PRIMARY KEY,
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  product_id     UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name   TEXT NOT NULL,
  type           TEXT NOT NULL,
  quantity       INTEGER NOT NULL,
  reason         TEXT,
  date           TIMESTAMPTZ DEFAULT NOW(),
  cycle_id       TEXT REFERENCES cycles(id) ON DELETE SET NULL
);

-- ─── TABLE: expenses ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id             TEXT PRIMARY KEY,
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  amount         FLOAT NOT NULL,
  reason         TEXT NOT NULL,
  category       TEXT DEFAULT 'Charges Fixes',
  date           TIMESTAMPTZ DEFAULT NOW(),
  cycle_id       TEXT REFERENCES cycles(id) ON DELETE SET NULL
);

-- ─── TABLE: tables ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tables (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  number         INTEGER NOT NULL,
  status         TEXT DEFAULT 'libre',
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS (SÉCURITÉ)
-- ============================================================
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bms_saas_full_access' AND tablename = 'cycles') THEN
    CREATE POLICY "bms_saas_full_access" ON cycles FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bms_saas_full_access' AND tablename = 'movements') THEN
    CREATE POLICY "bms_saas_full_access" ON movements FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bms_saas_full_access' AND tablename = 'expenses') THEN
    CREATE POLICY "bms_saas_full_access" ON expenses FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bms_saas_full_access' AND tablename = 'tables') THEN
    CREATE POLICY "bms_saas_full_access" ON tables FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- REALTIME CHANNELS & TRIGGERS
-- ============================================================

-- Function for tenant-scoped notifications
CREATE OR REPLACE FUNCTION notify_tenant_change() 
RETURNS TRIGGER AS $$
DECLARE
    channel_base TEXT;
BEGIN
    channel_base := TG_TABLE_NAME || ':' || NEW.restaurant_id::text;
    PERFORM realtime.publish(channel_base, TG_TABLE_NAME || '_CHANGE', row_to_json(NEW)::jsonb);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
DROP TRIGGER IF EXISTS cycle_realtime ON cycles;
CREATE TRIGGER cycle_realtime AFTER INSERT OR UPDATE ON cycles FOR EACH ROW EXECUTE FUNCTION notify_tenant_change();

DROP TRIGGER IF EXISTS movement_realtime ON movements;
CREATE TRIGGER movement_realtime AFTER INSERT OR UPDATE ON movements FOR EACH ROW EXECUTE FUNCTION notify_tenant_change();

DROP TRIGGER IF EXISTS expense_realtime ON expenses;
CREATE TRIGGER expense_realtime AFTER INSERT OR UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION notify_tenant_change();

DROP TRIGGER IF EXISTS table_realtime ON tables;
CREATE TRIGGER table_realtime AFTER INSERT OR UPDATE ON tables FOR EACH ROW EXECUTE FUNCTION notify_tenant_change();

-- Update existing triggers to use the same logic if needed
DROP TRIGGER IF EXISTS product_realtime ON products;
CREATE TRIGGER product_realtime AFTER INSERT OR UPDATE ON products FOR EACH ROW EXECUTE FUNCTION notify_tenant_change();

DROP TRIGGER IF EXISTS order_realtime ON orders;
CREATE TRIGGER order_realtime AFTER INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION notify_tenant_change();
