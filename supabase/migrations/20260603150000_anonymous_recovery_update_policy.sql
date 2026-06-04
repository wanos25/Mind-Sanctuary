-- Allow authenticated users to update their own recovery row (upsert retry path).
DROP POLICY IF EXISTS "User updates own recovery row" ON public.anonymous_recovery_codes;
CREATE POLICY "User updates own recovery row"
  ON public.anonymous_recovery_codes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
