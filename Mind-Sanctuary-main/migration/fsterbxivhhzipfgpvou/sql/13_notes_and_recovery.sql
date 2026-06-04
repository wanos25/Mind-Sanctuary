-- ============================================================================
-- Additive migration: therapist notes + anonymous recovery codes
-- Backend lock: fsterbxivhhzipfgpvou
-- Run manually in Supabase Studio → SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS / IF NOT EXISTS clauses).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) THERAPIST NOTES
--    Doctors write notes for a patient. Patients can read their own notes.
--    Optionally pinned to a chat (note shows as a card in that conversation).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.therapist_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id      uuid NULL,    -- optional: pin to a chat
  session_id   uuid NULL,    -- optional: pin to a session
  title        text NOT NULL,
  body         text NOT NULL,
  tags         text[] NOT NULL DEFAULT '{}',
  archived     boolean NOT NULL DEFAULT false,
  read_at      timestamptz NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_therapist_notes_patient   ON public.therapist_notes(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_therapist_notes_author    ON public.therapist_notes(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_therapist_notes_chat      ON public.therapist_notes(chat_id) WHERE chat_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_notes TO authenticated;
GRANT ALL ON public.therapist_notes TO service_role;

ALTER TABLE public.therapist_notes ENABLE ROW LEVEL SECURITY;

-- Patients can read their own notes.
DROP POLICY IF EXISTS "Patient reads own notes" ON public.therapist_notes;
CREATE POLICY "Patient reads own notes"
  ON public.therapist_notes FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid() AND archived = false);

-- Patients can mark their own notes as read (only `read_at` should change in UI).
DROP POLICY IF EXISTS "Patient marks own note read" ON public.therapist_notes;
CREATE POLICY "Patient marks own note read"
  ON public.therapist_notes FOR UPDATE
  TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

-- Doctors can read/write any notes they author.
-- Assumes `public.has_role(uuid, app_role)` from prior migrations.
DROP POLICY IF EXISTS "Doctor reads any notes" ON public.therapist_notes;
CREATE POLICY "Doctor reads any notes"
  ON public.therapist_notes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'));

DROP POLICY IF EXISTS "Doctor inserts notes" ON public.therapist_notes;
CREATE POLICY "Doctor inserts notes"
  ON public.therapist_notes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'doctor') AND author_id = auth.uid());

DROP POLICY IF EXISTS "Doctor updates own notes" ON public.therapist_notes;
CREATE POLICY "Doctor updates own notes"
  ON public.therapist_notes FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') AND author_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'doctor') AND author_id = auth.uid());

DROP POLICY IF EXISTS "Doctor deletes own notes" ON public.therapist_notes;
CREATE POLICY "Doctor deletes own notes"
  ON public.therapist_notes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') AND author_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2) ANONYMOUS RECOVERY CODES
--    Generated once per anonymous user. Stored as hash. Used to "log back in"
--    to the same anonymous account from another device/browser.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.anonymous_recovery_codes (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash   text NOT NULL,             -- sha256 hex of the code
  code_hint   text NOT NULL,             -- first 4 chars of the plaintext code, for UX
  created_at  timestamptz NOT NULL DEFAULT now(),
  used_at     timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_anon_recovery_code_hash ON public.anonymous_recovery_codes(code_hash);

GRANT SELECT, INSERT, UPDATE ON public.anonymous_recovery_codes TO authenticated;
GRANT ALL ON public.anonymous_recovery_codes TO service_role;
-- Anon role NEEDS select access for the redemption RPC's USING clause (called
-- pre-login via the publishable key).
GRANT SELECT ON public.anonymous_recovery_codes TO anon;

ALTER TABLE public.anonymous_recovery_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User reads own recovery row" ON public.anonymous_recovery_codes;
CREATE POLICY "User reads own recovery row"
  ON public.anonymous_recovery_codes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "User inserts own recovery row" ON public.anonymous_recovery_codes;
CREATE POLICY "User inserts own recovery row"
  ON public.anonymous_recovery_codes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Note: redemption itself is done via a SECURITY DEFINER RPC below, not by the
-- client SELECT-ing the table. The `anon` SELECT grant is intentionally minimal
-- (no policy allows anon to SELECT), so anon cannot enumerate codes — they can
-- only call `redeem_anonymous_recovery_code(...)` which validates and returns
-- the matching user_id for the caller's app to use during sign-in.

-- ----------------------------------------------------------------------------
-- 3) REDEMPTION RPC
--    Called by the frontend with a raw recovery code. Returns the associated
--    user_id ONLY if the hash matches AND the code has not been used yet.
--    Marks the code as used in the same transaction.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_anonymous_recovery_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash text;
  _uid  uuid;
BEGIN
  IF _code IS NULL OR length(_code) < 8 THEN
    RETURN NULL;
  END IF;

  _hash := encode(extensions.digest(_code, 'sha256'), 'hex');

  UPDATE public.anonymous_recovery_codes
     SET used_at = now()
   WHERE code_hash = _hash
     AND used_at IS NULL
   RETURNING user_id INTO _uid;

  RETURN _uid;  -- NULL if no match or already used
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_anonymous_recovery_code(text) TO anon, authenticated;

-- Requires pgcrypto extension for digest():
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================================
-- DONE. Verify with:
--   SELECT * FROM pg_policies WHERE tablename IN ('therapist_notes','anonymous_recovery_codes');
-- ============================================================================
