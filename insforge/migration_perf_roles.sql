-- ============================================================
-- BMS APP — MIGRATION ARCHITECTURE : PERF & RÔLES
-- 1. Dénormalisation order_items (Perf)
-- 2. Nettoyage du Hack UUID
-- 3. Sécurité Intra-Tenant stricte
-- ============================================================

-- ============================================================
-- ÉTAPE 1 : OPTIMISATION DE ORDER_ITEMS (DÉNORMALISATION)
-- ============================================================

-- 1A. Ajout de la colonne restaurant_id
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS restaurant_id UUID;

-- 1B. Rétro-peuplement des données existantes (Jointure)
UPDATE order_items oi
SET restaurant_id = o.restaurant_id
FROM orders o
WHERE oi.order_id = o.id AND oi.restaurant_id IS NULL;

-- 1C. Blocage : La colonne devient obligatoire
ALTER TABLE order_items ALTER COLUMN restaurant_id SET NOT NULL;

-- Optionnel mais recommandé : Contrainte de clé étrangère
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_order_items_restaurant') THEN
    ALTER TABLE order_items ADD CONSTRAINT fk_order_items_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 1D. Mise à jour des index pour la performance
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant ON order_items(restaurant_id);

-- 1E. Remplacement des politiques RLS bancales (le hack de jointure) par les politiques directes
DROP POLICY IF EXISTS order_items_isolation ON order_items;
DROP POLICY IF EXISTS order_items_admin ON order_items;

CREATE POLICY "order_items_isolation" ON order_items
  FOR ALL
  TO authenticated
  USING (restaurant_id = get_my_restaurant_id())
  WITH CHECK (restaurant_id = get_my_restaurant_id());

CREATE POLICY "order_items_project_admin" ON order_items
  FOR ALL
  TO project_admin
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- ÉTAPE 2 : NETTOYAGE DU HACK UUID DANS L'AUTHENTIFICATION
-- ============================================================

-- On recrée get_my_restaurant_id de manière native (sans text cast)
CREATE OR REPLACE FUNCTION get_my_restaurant_id()
RETURNS UUID 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
AS $$
BEGIN
  -- L'opérateur natif UUID restaure la vitesse de l'indexation
  RETURN (
    SELECT restaurant_id 
    FROM public.bms_users 
    WHERE id = auth.uid() 
    LIMIT 1
  );
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- On s'assure que is_admin utilise lui aussi auth.uid() proprement
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql 
STABLE 
SECURITY DEFINER
AS $$
  SELECT (role = 'ADMIN') FROM public.bms_users WHERE id = auth.uid();
$$;

-- Accorder les droits (Important pour l'API)
GRANT EXECUTE ON FUNCTION get_my_restaurant_id TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;


-- ============================================================
-- ÉTAPE 3 : SÉCURITÉ INTRA-TENANT (RÔLES ET RLS)
-- ============================================================

-- NETTOYAGE D'ABORD : Suppression des isolations globales obsolètes
DROP POLICY IF EXISTS "products_isolation" ON products;
DROP POLICY IF EXISTS "expenses_isolation" ON expenses;
DROP POLICY IF EXISTS "cycles_isolation" ON cycles;

-- 3A. PRODUITS : Les barmans peuvent voir, seuls les admins gèrent le catalogue
CREATE POLICY "products_select_all" ON products 
  FOR SELECT TO authenticated 
  USING (restaurant_id = get_my_restaurant_id());

CREATE POLICY "products_modify_admin" ON products 
  FOR ALL TO authenticated 
  USING (restaurant_id = get_my_restaurant_id() AND is_admin())
  WITH CHECK (restaurant_id = get_my_restaurant_id() AND is_admin());

-- 3B. DÉPENSES (EXPENSES) : Seuls les admins peuvent modifier/supprimer
CREATE POLICY "expenses_select_insert" ON expenses 
  FOR SELECT TO authenticated 
  USING (restaurant_id = get_my_restaurant_id());

CREATE POLICY "expenses_insert" ON expenses 
  FOR INSERT TO authenticated 
  WITH CHECK (restaurant_id = get_my_restaurant_id());

CREATE POLICY "expenses_update_delete_admin" ON expenses 
  FOR UPDATE TO authenticated 
  USING (restaurant_id = get_my_restaurant_id() AND is_admin())
  WITH CHECK (restaurant_id = get_my_restaurant_id() AND is_admin());

CREATE POLICY "expenses_delete_admin" ON expenses 
  FOR DELETE TO authenticated 
  USING (restaurant_id = get_my_restaurant_id() AND is_admin());

-- 3C. CYCLES DE CAISSE : Les modifications critiques aux admins
CREATE POLICY "cycles_select_insert" ON cycles 
  FOR SELECT TO authenticated 
  USING (restaurant_id = get_my_restaurant_id());

CREATE POLICY "cycles_insert" ON cycles 
  FOR INSERT TO authenticated 
  WITH CHECK (restaurant_id = get_my_restaurant_id());

CREATE POLICY "cycles_update_delete_admin" ON cycles 
  FOR UPDATE TO authenticated 
  USING (restaurant_id = get_my_restaurant_id() AND is_admin())
  WITH CHECK (restaurant_id = get_my_restaurant_id() AND is_admin());

CREATE POLICY "cycles_delete_admin" ON cycles 
  FOR DELETE TO authenticated 
  USING (restaurant_id = get_my_restaurant_id() AND is_admin());

-- Rafraîchissement final des droits d'API
NOTIFY pgrst, 'reload schema';
