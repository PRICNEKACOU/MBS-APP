-- ============================================================
-- BMS APP — FIX DÉFINITIF v2 (2026-04-04)
-- Résout : "restaurant_id mismatch (expected <NULL>)"
--
-- CAUSES RACINES IDENTIFIÉES :
-- 1. CHAOS RLS : 7+ migrations contradictoires ont laissé bms_users
--    dans un état indéfini (parfois FOR ALL avec get_my_restaurant_id(),
--    ce qui crée une récursion NULL à l'inscription).
-- 2. CIRCULAR DEPENDENCY : La policy "bms_users_isolation FOR ALL"
--    utilise get_my_restaurant_id() qui lit bms_users — pendant l'INSERT
--    initial, la fonction retourne NULL (STABLE cachée) → INSERT bloqué
--    OU la phase RETURNING/SELECT échoue → newUser = null côté JS.
-- 3. COLONNE email MANQUANTE : Le frontend envoie un champ `email`
--    non présent dans le schéma bms_users → INSERT peut échouer.
-- 4. checkout_atomic : Appelle get_my_restaurant_id() (STABLE) deux fois ;
--    remplacé par un SELECT direct pour éviter tout problème de cache.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ÉTAPE 1 : NETTOYAGE RADICAL DE TOUTES LES POLICIES bms_users
-- (on drope par nom ET par pattern pour ne rien laisser trainer)
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'bms_users'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON bms_users';
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- ÉTAPE 2 : POLICIES DÉFINITIVES SUR bms_users
--
-- Philosophie : on n'utilise JAMAIS get_my_restaurant_id()
-- dans les policies bms_users pour éviter toute récursion.
-- On se base uniquement sur id = auth.uid().
-- ────────────────────────────────────────────────────────────

ALTER TABLE bms_users ENABLE ROW LEVEL SECURITY;

-- INSERT : L'utilisateur peut créer son propre profil admin
-- (id doit obligatoirement correspondre à auth.uid())
CREATE POLICY bms_users_insert ON bms_users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- SELECT : L'utilisateur voit uniquement sa propre ligne
-- (critique pour la phase RETURNING après INSERT et pour finalizeLogin)
CREATE POLICY bms_users_select_self ON bms_users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- UPDATE : Modification de son propre profil uniquement
CREATE POLICY bms_users_update ON bms_users
  FOR UPDATE TO authenticated
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Note : Pas de DELETE self — la suppression se fait en cascade
-- depuis restaurants (ON DELETE CASCADE) via un admin backend.

-- ────────────────────────────────────────────────────────────
-- ÉTAPE 3 : AJOUT DE LA COLONNE email DANS bms_users
--
-- Le frontend envoie { email: uEmail } lors de l'inscription.
-- Sans cette colonne, PostgREST retourne une erreur 400 qui
-- peut bloquer silencieusement la création du profil.
-- ────────────────────────────────────────────────────────────
ALTER TABLE bms_users ADD COLUMN IF NOT EXISTS email TEXT;

-- ────────────────────────────────────────────────────────────
-- ÉTAPE 4 : get_my_restaurant_id() — version robuste finale
--
-- SECURITY DEFINER : contourne le RLS pour lire bms_users.
-- VOLATILE (pas STABLE) : jamais mis en cache dans la même tx.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_restaurant_id()
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rid UUID;
BEGIN
  SELECT restaurant_id
    INTO v_rid
    FROM public.bms_users
   WHERE id = auth.uid()
   LIMIT 1;
  RETURN v_rid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_restaurant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_restaurant_id() TO anon;

-- ────────────────────────────────────────────────────────────
-- ÉTAPE 5 : is_admin() — version robuste finale
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role
    INTO v_role
    FROM public.bms_users
   WHERE id = auth.uid()
   LIMIT 1;
  RETURN (v_role = 'ADMIN');
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- ────────────────────────────────────────────────────────────
-- ÉTAPE 6 : checkout_atomic — réécriture du check de sécurité
--
-- PROBLÈME : La version précédente appelait get_my_restaurant_id()
-- deux fois (STABLE → mise en cache possible). On effectue
-- désormais un SELECT direct dans la fonction elle-même.
--
-- SECURITY DEFINER est conservé pour les écritures multi-tables
-- en une seule transaction.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION checkout_atomic(
  p_order_id       TEXT,
  p_items          JSONB,
  p_total          FLOAT,
  p_table_number   INTEGER,
  p_payment_method TEXT,
  p_status         TEXT,
  p_timestamp      TIMESTAMPTZ,
  p_cycle_id       TEXT,
  p_restaurant_id  TEXT,
  p_stock_updates  JSONB,   -- [{ "id": "PRD-...", "stock": 42 }]
  p_movements      JSONB    -- array d'objets mouvement (snake_case)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id        uuid := p_restaurant_id::uuid;
  v_actual_restaurant_id uuid;
  su RECORD;
  mv RECORD;
BEGIN
  -- ── Validation propriété : SELECT direct, sans STABLE function ──────────
  SELECT restaurant_id
    INTO v_actual_restaurant_id
    FROM public.bms_users
   WHERE id = auth.uid()
   LIMIT 1;

  IF v_restaurant_id IS DISTINCT FROM v_actual_restaurant_id THEN
    RAISE EXCEPTION
      'Unauthorized: restaurant_id mismatch (got %, expected %). Vérifiez que votre profil bms_users existe.',
      v_restaurant_id,
      COALESCE(v_actual_restaurant_id::text, '<NULL — profil introuvable pour auth.uid()=' || COALESCE(auth.uid()::text, 'NULL') || '>');
  END IF;

  -- ── Insérer la commande ──────────────────────────────────────────────────
  INSERT INTO orders (
    id, items, total, table_number, payment_method,
    status, timestamp, cycle_id, restaurant_id
  ) VALUES (
    p_order_id,
    p_items,
    p_total,
    p_table_number,
    p_payment_method,
    p_status,
    p_timestamp,
    NULLIF(p_cycle_id, ''),
    v_restaurant_id
  );

  -- ── Mettre à jour le stock de chaque produit ─────────────────────────────
  FOR su IN
    SELECT * FROM jsonb_to_recordset(p_stock_updates)
    AS x(id text, stock int)
  LOOP
    UPDATE products
       SET stock = su.stock
     WHERE id = su.id
       AND restaurant_id = v_restaurant_id;
  END LOOP;

  -- ── Enregistrer les mouvements de stock ──────────────────────────────────
  FOR mv IN
    SELECT * FROM jsonb_to_recordset(p_movements)
    AS x(
      id            text,
      product_id    text,
      product_name  text,
      type          text,
      quantity      int,
      reason        text,
      date          timestamptz,
      cycle_id      text,
      restaurant_id text
    )
  LOOP
    INSERT INTO movements (
      id, product_id, product_name, type,
      quantity, reason, date, cycle_id, restaurant_id
    ) VALUES (
      mv.id, mv.product_id, mv.product_name, mv.type,
      mv.quantity, mv.reason, mv.date,
      NULLIF(mv.cycle_id, ''),
      v_restaurant_id
    );
  END LOOP;

  -- ── Mettre à jour le statut de la table ──────────────────────────────────
  IF p_table_number IS NOT NULL THEN
    UPDATE tables
       SET status = 'occupee'
     WHERE number = p_table_number
       AND restaurant_id = v_restaurant_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION checkout_atomic TO authenticated;

-- ────────────────────────────────────────────────────────────
-- ÉTAPE 7 : CORRECTION DES UTILISATEURS ORPHELINS
--
-- Si un utilisateur existe dans auth.users mais n'a pas de
-- ligne bms_users (suite aux bugs RLS précédents), cette
-- requête diagnostique permet de les identifier.
-- À exécuter manuellement pour audit :
--
-- SELECT u.id, u.email, u.created_at
-- FROM auth.users u
-- LEFT JOIN public.bms_users b ON b.id = u.id
-- WHERE b.id IS NULL;
--
-- Les orphelins devront se reconnecter : l'application détectera
-- l'absence de profil et proposera de recréer le restaurant
-- (voir la correction Auth.jsx).
-- ────────────────────────────────────────────────────────────

-- Recharger le cache de l'API
NOTIFY pgrst, 'reload schema';
