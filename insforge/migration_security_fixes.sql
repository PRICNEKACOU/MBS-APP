-- ============================================================
-- BMS APP — SÉCURITÉ MULTI-TENANT (RLS)
-- Isolation stricte basée sur l'identité InForge (auth.uid())
-- ============================================================

-- 1. Nettoyage des anciennes politiques permissives
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename, policyname FROM pg_policies WHERE policyname = 'bms_saas_full_access') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 2. Création d'une fonction helper pour le Tenant ID (Centralise la logique)
CREATE OR REPLACE FUNCTION get_my_restaurant_id()
RETURNS UUID AS $$
  -- On récupère le restaurant_id lié à l'utilisateur connecté dans la table bms_users
  -- NOTE : Nécessite que bms_users.id corresponde à auth.uid()
  SELECT restaurant_id FROM bms_users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. Création d'une fonction helper pour le Rôle (Admin check)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT (role = 'ADMIN') FROM bms_users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 4. Application des Politiques Stratifiées par Table

-- -- TABLES GÉNÉRALES (Lecture/Écriture pour tout le staff du restaurant)
-- Tables : products, orders, order_items, tables, movements
DO $$
DECLARE
    tbl TEXT;
    target_tables TEXT[] := ARRAY['products', 'orders', 'order_items', 'tables', 'movements'];
BEGIN
    FOREACH tbl IN ARRAY target_tables LOOP
        EXECUTE 'ALTER TABLE ' || tbl || ' ENABLE ROW LEVEL SECURITY;';
        
        -- Suppression si existe déjà (pour réentrance)
        EXECUTE 'DROP POLICY IF EXISTS ' || tbl || '_isolation_select ON ' || tbl;
        EXECUTE 'DROP POLICY IF EXISTS ' || tbl || '_isolation_all ON ' || tbl;

        -- Politique de LECTURE : On ne voit que les données de SON restaurant
        EXECUTE 'CREATE POLICY "' || tbl || '_isolation_select" ON ' || tbl || ' FOR SELECT USING (restaurant_id = get_my_restaurant_id());';
        
        -- Politique d''ÉCRITURE : On ne peut modifier/insérer que pour SON restaurant
        EXECUTE 'CREATE POLICY "' || tbl || '_isolation_all" ON ' || tbl || ' FOR ALL WITH CHECK (restaurant_id = get_my_restaurant_id());';
    END LOOP;
END $$;

-- -- TABLES SENSIBLES (ADMIN ONLY : Finance et Cycles)
-- Tables : cycles, expenses
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_only_cycles ON cycles;
CREATE POLICY "admin_only_cycles" ON cycles 
FOR ALL USING (restaurant_id = get_my_restaurant_id() AND is_admin())
WITH CHECK (restaurant_id = get_my_restaurant_id() AND is_admin());

DROP POLICY IF EXISTS admin_only_expenses ON expenses;
CREATE POLICY "admin_only_expenses" ON expenses 
FOR ALL USING (restaurant_id = get_my_restaurant_id() AND is_admin())
WITH CHECK (restaurant_id = get_my_restaurant_id() AND is_admin());

-- -- TABLE DES UTILISATEURS (Isolation totale, personne ne voit les autres restaurants)
ALTER TABLE bms_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bms_users_isolation ON bms_users;
CREATE POLICY "bms_users_isolation" ON bms_users 
FOR ALL USING (restaurant_id = get_my_restaurant_id()) 
WITH CHECK (restaurant_id = get_my_restaurant_id());

-- -- TABLE RESTAURANTS
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS restaurants_isolation ON restaurants;
CREATE POLICY "restaurants_isolation" ON restaurants 
FOR SELECT USING (id = get_my_restaurant_id());
