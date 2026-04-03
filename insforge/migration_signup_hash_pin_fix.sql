-- ============================================================
-- BMS APP — FIX HASHAGE DYNAMIQUE DU PIN (SIGNUP)
-- ============================================================
-- Explication : PostgreSQL bloquait l'insertion via sa contrainte
-- "pin_code_hashed" car le frontend envoie un PIN brut de 6 caractères,
-- ce qui viole "length(pin_code) >= 60".
-- 
-- Solution : Un TRIGGER interceptant l'insertion ou la modification
-- avant la validation des contraintes, pour hasher le PIN avec pgcrypto.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION trigger_hash_pin()
RETURNS TRIGGER AS $$
BEGIN
  -- Vérifier si le PIN n'est pas déjà un hash bcrypt (commence par $2a$, $2b$, $2y$)
  IF NEW.pin_code IS NOT NULL AND NEW.pin_code !~ '^\$2[aby]\$' THEN
    -- Hacher le PIN de manière sécurisée
    NEW.pin_code := crypt(NEW.pin_code, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger s'il existe déjà pour éviter les doublons
DROP TRIGGER IF EXISTS hash_pin_before_insert_update ON bms_users;

-- Attacher le trigger à la table bms_users
CREATE TRIGGER hash_pin_before_insert_update
BEFORE INSERT OR UPDATE OF pin_code ON bms_users
FOR EACH ROW
EXECUTE FUNCTION trigger_hash_pin();

-- Recharger le cache
NOTIFY pgrst, 'reload schema';
