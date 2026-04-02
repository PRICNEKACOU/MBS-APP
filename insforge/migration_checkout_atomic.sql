-- ============================================================
-- BMS APP — FONCTION CHECKOUT ATOMIQUE
-- Exécute l'intégralité du checkout en une seule transaction
-- PostgreSQL pour éviter les états incohérents en cas d'erreur.
--
-- Appelée depuis le frontend via :
--   insforge.database.rpc('checkout_atomic', { ...params })
--
-- Dépend de : get_my_restaurant_id() (migration_security_fixes.sql)
-- ============================================================

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
  p_movements      JSONB    -- array of movement objects (snake_case)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER   -- permet les écritures multi-tables dans une seule transaction
AS $$
DECLARE
  v_restaurant_id uuid := p_restaurant_id::uuid;
  su RECORD;
  mv RECORD;
BEGIN
  -- ── Validation propriété (empêche l'accès inter-restaurant) ──────────────
  IF v_restaurant_id IS DISTINCT FROM get_my_restaurant_id() THEN
    RAISE EXCEPTION 'Unauthorized: restaurant_id mismatch (got %, expected %)',
      v_restaurant_id, get_my_restaurant_id();
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
    SET    stock = su.stock
    WHERE  id = su.id
    AND    restaurant_id = v_restaurant_id;
  END LOOP;

  -- ── Enregistrer les mouvements de stock ──────────────────────────────────
  FOR mv IN
    SELECT * FROM jsonb_to_recordset(p_movements)
    AS x(
      id           text,
      product_id   text,
      product_name text,
      type         text,
      quantity     int,
      reason       text,
      date         timestamptz,
      cycle_id     text,
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
    SET    status = 'occupee'
    WHERE  number = p_table_number
    AND    restaurant_id = v_restaurant_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);

EXCEPTION WHEN OTHERS THEN
  -- PostgreSQL rollback automatique en cas d'exception
  RAISE;
END;
$$;

-- Accorder l'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION checkout_atomic TO authenticated;
