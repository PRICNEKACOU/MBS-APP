-- MISSION 2.5 — ASSAINISSEMENT ET SÉCURISATION DE LA BASE DE DONNÉES INFORGE

-- LIVRABLE 1 — CORRECTION DES POLICIES SUR orders
CREATE POLICY orders_isolation ON orders
  FOR ALL
  TO authenticated
  USING (restaurant_id = get_my_restaurant_id())
  WITH CHECK (restaurant_id = get_my_restaurant_id());

CREATE POLICY orders_admin ON orders
  FOR ALL
  TO project_admin
  USING (true)
  WITH CHECK (true);


-- LIVRABLE 2 — CORRECTION DES POLICIES SUR order_items
CREATE POLICY order_items_isolation ON order_items
  FOR ALL
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE restaurant_id = get_my_restaurant_id()
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM orders
      WHERE restaurant_id = get_my_restaurant_id()
    )
  );

CREATE POLICY order_items_admin ON order_items
  FOR ALL
  TO project_admin
  USING (true)
  WITH CHECK (true);


-- LIVRABLE 3 — CORRECTION DE bms_users
DROP POLICY IF EXISTS project_admin_policy ON bms_users;
DROP POLICY IF EXISTS bms_users_self ON bms_users;
DROP POLICY IF EXISTS bms_users_insert ON bms_users;
DROP POLICY IF EXISTS bms_users_update ON bms_users;

CREATE POLICY bms_users_isolation ON bms_users
  FOR ALL
  TO authenticated
  USING (restaurant_id = get_my_restaurant_id())
  WITH CHECK (restaurant_id = get_my_restaurant_id());

CREATE POLICY bms_users_admin ON bms_users
  FOR ALL
  TO project_admin
  USING (true)
  WITH CHECK (true);


-- LIVRABLE 4 — SÉCURISATION DES PIN EN CLAIR
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE bms_users
SET pin_code = crypt(pin_code, gen_salt('bf'))
WHERE pin_code !~ '^\$2[aby]\$';

ALTER TABLE bms_users
ADD CONSTRAINT pin_code_hashed
CHECK (length(pin_code) >= 60);

-- LIVRABLE 5 : VÉRIFICATION 
-- Exécutée manuellement via l'interface du terminal.
