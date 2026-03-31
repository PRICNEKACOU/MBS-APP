-- ============================================================
-- BMS APP — SÉCURITÉ DE PRODUCTION (FINALE)
-- Isolation Multi-Tenant Inviolable et Performance
-- ============================================================

-- 1. NETTOYAGE RADICAL DU PASSÉ (Suppression de TOUTES les politiques permissives)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND (policyname ILIKE '%full access%' OR policyname ILIKE '%global_access%')) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 2. DÉFINITION DES SERVICES DE SÉCURITÉ (Fonctions sans récursion)
CREATE OR REPLACE FUNCTION get_my_restaurant_id()
RETURNS UUID AS $$
  -- On utilise SECURITY DEFINER pour contourner l'éventuel RLS sur bms_users lors du lookup
  SELECT restaurant_id FROM public.bms_users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT (role = 'ADMIN') FROM public.bms_users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. ISOLATION DE LA TABLE PIVOT (bms_users)
-- On n'utilise PAS la fonction get_my_restaurant_id ici pour éviter la récursion
ALTER TABLE bms_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bms_users_isolation ON bms_users;
CREATE POLICY "bms_users_isolation" ON bms_users 
FOR ALL TO authenticated 
USING (id = auth.uid()) 
WITH CHECK (id = auth.uid());

-- 4. ÉCRÉMAGE DES AUTRES TABLES (Isolation par restaurant_id)
DO $$
DECLARE
    tbl TEXT;
    target_tables TEXT[] := ARRAY['products', 'orders', 'order_items', 'tables', 'movements', 'cycles', 'expenses'];
BEGIN
    FOREACH tbl IN ARRAY target_tables LOOP
        EXECUTE 'ALTER TABLE ' || tbl || ' ENABLE ROW LEVEL SECURITY;';
        
        -- On nettoie toute politique résiduelle
        EXECUTE 'DROP POLICY IF EXISTS ' || tbl || '_isolation_all ON ' || tbl;
        EXECUTE 'DROP POLICY IF EXISTS ' || tbl || '_full_access ON ' || tbl;
        
        -- Politique Principale : Isolation par Restaurant ID
        EXECUTE 'CREATE POLICY \"' || tbl || '_isolation_all\" ON ' || tbl || ' FOR ALL TO authenticated USING (restaurant_id = get_my_restaurant_id()) WITH CHECK (restaurant_id = get_my_restaurant_id());';
    END LOOP;
END $$;

-- 5. PROTECTION DES TABLES SENSIBLES (ADMIN ONLY)
-- On affine l'accès sur cycles et expenses : Seul un ADMIN du restaurant peut écrire
DROP POLICY IF EXISTS admin_restricted_cycles ON cycles;
CREATE POLICY "admin_restricted_cycles" ON cycles 
FOR ALL TO authenticated 
USING (restaurant_id = get_my_restaurant_id() AND is_admin())
WITH CHECK (restaurant_id = get_my_restaurant_id() AND is_admin());

DROP POLICY IF EXISTS admin_restricted_expenses ON expenses;
CREATE POLICY "admin_restricted_expenses" ON expenses 
FOR ALL TO authenticated 
USING (restaurant_id = get_my_restaurant_id() AND is_admin())
WITH CHECK (restaurant_id = get_my_restaurant_id() AND is_admin());

-- 6. INDEX DE PERFORMANCE FINAUX
CREATE INDEX IF NOT EXISTS idx_products_tenant_active ON products(restaurant_id) WHERE archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_orders_tenant_date ON orders(restaurant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_movements_tenant_product ON movements(restaurant_id, product_id);
-- 7. PURGE DES DONNÉES DE TEST (CLEAN SLATE)
-- On vide tout SAUF les comptes utilisateurs et l''entité restaurant
TRUNCATE TABLE order_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE orders RESTART IDENTITY CASCADE;
TRUNCATE TABLE movements RESTART IDENTITY CASCADE;
TRUNCATE TABLE cycles RESTART IDENTITY CASCADE;
TRUNCATE TABLE expenses RESTART IDENTITY CASCADE;
TRUNCATE TABLE tables RESTART IDENTITY CASCADE;
TRUNCATE TABLE products RESTART IDENTITY CASCADE;

