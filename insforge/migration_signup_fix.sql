-- ============================================================
-- BMS APP — FIX INSCRIPTION (RLS)
-- Choix de l'architecture : OPTION 1 (Frontend Insert)
-- ============================================================
-- Explication : L'Option 2 (Trigger InForge sur auth.users) n'est pas viable
-- car au moment de la création silencieuse dans auth.users, le Backend 
-- ne connaît ni le nom du restaurant, ni le PIN, ni le nom de l'utilisateur 
-- (recueillis dans l'état React et envoyés après vérification OTP).
-- ============================================================

-- 1. Ajout de la politique d'insertion personnelle
-- Permet à l'utilisateur nouvellement validé de créer SA propre ligne bms_users
DROP POLICY IF EXISTS "bms_users_insert_self" ON bms_users;

CREATE POLICY "bms_users_insert_self" ON bms_users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Note : Il n'est pas nécessaire de rendre restaurant_id NULLable (DROP NOT NULL) car 
-- votre frontend génère déjà le crypto.randomUUID() et l'envoie parfaitement 
-- lors du .insert() de createRestaurantAndProfile. C'était juste le RLS (vigile) 
-- qui bloquait l'entrée.

-- Rechargement du cache de l'API InForge
NOTIFY pgrst, 'reload schema';
