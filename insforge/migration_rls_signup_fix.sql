-- ============================================================
-- BMS APP — CORRECTIF RLS INSCRIPTION (v2)
-- Résout : "new row violates row-level security policy for table restaurants"
-- ============================================================
-- Cause : Lors du signup, l'utilisateur n'a pas encore de ligne
-- dans bms_users, donc get_my_restaurant_id() retourne NULL et
-- bloque tout INSERT sur restaurants et bms_users.
-- Solution : Séparer les politiques par opération SQL (INSERT différent des autres).

-- ─── TABLE : restaurants ─────────────────────────────────────────────────────

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS restaurants_isolation_all ON restaurants;
DROP POLICY IF EXISTS restaurants_select ON restaurants;
DROP POLICY IF EXISTS restaurants_insert ON restaurants;
DROP POLICY IF EXISTS restaurants_update ON restaurants;
DROP POLICY IF EXISTS restaurants_delete ON restaurants;

-- INSERT : Tout utilisateur authentifié peut créer un restaurant
-- (la propriété est établie ensuite via bms_users.restaurant_id)
CREATE POLICY restaurants_insert ON restaurants
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- SELECT : Seulement son propre restaurant (via bms_users pivot)
CREATE POLICY restaurants_select ON restaurants
  FOR SELECT TO authenticated
  USING (id = get_my_restaurant_id());

-- UPDATE : Seulement son propre restaurant
CREATE POLICY restaurants_update ON restaurants
  FOR UPDATE TO authenticated
  USING (id = get_my_restaurant_id())
  WITH CHECK (id = get_my_restaurant_id());

-- DELETE : Seulement son propre restaurant
CREATE POLICY restaurants_delete ON restaurants
  FOR DELETE TO authenticated
  USING (id = get_my_restaurant_id());

-- ─── TABLE : bms_users ───────────────────────────────────────────────────────

ALTER TABLE bms_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bms_users_isolation ON bms_users;
DROP POLICY IF EXISTS bms_users_insert ON bms_users;
DROP POLICY IF EXISTS bms_users_self ON bms_users;
DROP POLICY IF EXISTS bms_users_update ON bms_users;

-- INSERT : L'utilisateur peut créer son propre profil (id doit matcher auth.uid())
CREATE POLICY bms_users_insert ON bms_users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- SELECT : Seulement son propre profil
CREATE POLICY bms_users_self ON bms_users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- UPDATE : Seulement son propre profil
CREATE POLICY bms_users_update ON bms_users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
