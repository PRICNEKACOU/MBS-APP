-- ============================================================
-- BMS APP — MIGRATION : MENU PUBLIC SÉCURISÉ (Option B)
-- Ces fonctions permettent aux utilisateurs anonymes
-- d'interagir avec la BDD de façon bridée sans exposer
-- le RLS aux connexions "anon". 
-- ============================================================

-- 1. Fonction pour récupérer le Menu et les infos du Restaurant
CREATE OR REPLACE FUNCTION get_public_menu(p_restaurant_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_restaurant RECORD;
  v_products JSONB;
BEGIN
  -- 1a. Vérifier l'existence et récupérer les infos de base du restaurant
  SELECT * INTO v_restaurant 
  FROM restaurants 
  WHERE id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant introuvable';
  END IF;

  -- 1b. Récupérer les produits (non archivés et avec du stock positif)
  SELECT jsonb_agg(row_to_json(p)) INTO v_products
  FROM (
    SELECT * 
    FROM products 
    WHERE restaurant_id = p_restaurant_id 
      AND archived = false 
      AND stock > 0
  ) p;

  -- 1c. Retourner l'ensemble structuré
  RETURN jsonb_build_object(
    'success', true,
    'restaurant', row_to_json(v_restaurant),
    'products', COALESCE(v_products, '[]'::jsonb)
  );
END;
$$;

-- Autoriser tout le monde (y compris non-authentifiés) à exécuter cette fonction RPC
GRANT EXECUTE ON FUNCTION get_public_menu TO public;
GRANT EXECUTE ON FUNCTION get_public_menu TO anon;


-- 2. Fonction pour soumettre une commande QR (Menu Client)
CREATE OR REPLACE FUNCTION submit_public_order(
  p_order_id TEXT,
  p_items JSONB,
  p_total FLOAT,
  p_table_number INTEGER,
  p_restaurant_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 2a. Insérer la commande de base
  INSERT INTO orders (
    id, items, total, table_number, payment_method,
    status, timestamp, cycle_id, restaurant_id
  ) VALUES (
    p_order_id,
    p_items,
    p_total,
    p_table_number,
    NULL, -- Sera défini lors de l'acceptation par le barman
    'pending',
    NOW(),
    NULL,
    p_restaurant_id
  );

  -- 2b. Mettre à jour l'état de la table associée, le cas échéant
  IF p_table_number IS NOT NULL THEN
    UPDATE tables 
    SET status = 'service_demande'
    WHERE number = p_table_number 
      AND restaurant_id = p_restaurant_id;
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

-- Autoriser tout le monde à soumettre une commande
GRANT EXECUTE ON FUNCTION submit_public_order TO public;
GRANT EXECUTE ON FUNCTION submit_public_order TO anon;
