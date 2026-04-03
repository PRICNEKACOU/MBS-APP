-- ============================================================
-- BMS APP — CORRECTIF SÉCURITÉ ROBUSTE
-- Gère les UIDs non-UUID (ex: "project-admin-with-api-key")
-- sans faire crasher Postgres.
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_restaurant_id()
RETURNS UUID 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
AS $$
BEGIN
  -- On convertit l''ID en text pour la comparaison afin d''éviter 
  -- l''erreur 22P02 (invalid input syntax for type uuid)
  RETURN (
    SELECT restaurant_id 
    FROM public.bms_users 
    WHERE id::text = auth.uid()::text 
    LIMIT 1
  );
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Accorder les droits
GRANT EXECUTE ON FUNCTION get_my_restaurant_id TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_restaurant_id TO anon;

-- Recharger le cache
NOTIFY pgrst, 'reload schema';
