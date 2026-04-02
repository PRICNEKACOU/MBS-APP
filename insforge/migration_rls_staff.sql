-- ============================================================
-- BMS APP — RLS TABLE STAFF (sous-comptes PIN)
-- Applique l'isolation multi-tenant sur la table staff,
-- distincte de bms_users (comptes admin InsForge Auth).
-- Dépend de : get_my_restaurant_id() et is_admin()
--   définis dans migration_security_fixes.sql
-- ============================================================

-- S'assurer que la table existe avec la bonne structure
CREATE TABLE IF NOT EXISTS staff (
  id            TEXT PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'waiter',
  pin_code      TEXT NOT NULL  -- Stocké haché (SHA-256) — JAMAIS en clair
);

CREATE INDEX IF NOT EXISTS idx_staff_restaurant ON staff(restaurant_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Nettoyage (réentrance)
DROP POLICY IF EXISTS staff_select    ON staff;
DROP POLICY IF EXISTS staff_insert    ON staff;
DROP POLICY IF EXISTS staff_update    ON staff;
DROP POLICY IF EXISTS staff_delete    ON staff;

-- SELECT : Tout le staff d'un restaurant peut voir les autres membres de SON restaurant
CREATE POLICY staff_select ON staff
  FOR SELECT TO authenticated
  USING (restaurant_id = get_my_restaurant_id());

-- INSERT : Seul l'admin peut ajouter un membre
CREATE POLICY staff_insert ON staff
  FOR INSERT TO authenticated
  WITH CHECK (restaurant_id = get_my_restaurant_id() AND is_admin());

-- UPDATE : Seul l'admin peut modifier un membre
CREATE POLICY staff_update ON staff
  FOR UPDATE TO authenticated
  USING  (restaurant_id = get_my_restaurant_id() AND is_admin())
  WITH CHECK (restaurant_id = get_my_restaurant_id() AND is_admin());

-- DELETE : Seul l'admin peut supprimer un membre
CREATE POLICY staff_delete ON staff
  FOR DELETE TO authenticated
  USING (restaurant_id = get_my_restaurant_id() AND is_admin());

-- ─── NOTE SÉCURITÉ ───────────────────────────────────────────────────────────
-- La colonne pin_code doit TOUJOURS contenir un hash SHA-256 (64 hex chars).
-- Le hachage est effectué côté client dans src/utils/crypto.js avant tout
-- appel INSERT ou UPDATE. Les anciens PIN en clair sont migrés automatiquement
-- lors de la prochaine connexion réussie (lazy migration dans store.js verifyPin).
