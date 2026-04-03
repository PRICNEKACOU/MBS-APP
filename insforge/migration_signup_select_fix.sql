-- Fix the SELECT / RETURNING phase of the INSERT.
-- When the frontend does .insert().select(), Postgres attempts to return the new row.
-- But the existing bms_users_isolation ALL policy requires get_my_restaurant_id(), 
-- which is STABLE and returns NULL during the very statement where the user is created.
-- So we must allow a user to ALWAYS SELECT their own row to satisfy the RETURNING clause.

DROP POLICY IF EXISTS "bms_users_select_self" ON bms_users;
CREATE POLICY "bms_users_select_self" ON bms_users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

NOTIFY pgrst, 'reload schema';
