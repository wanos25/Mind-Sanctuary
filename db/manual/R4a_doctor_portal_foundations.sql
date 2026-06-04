-- ============================================================================
-- R4a — Doctor Portal Foundations
-- Target backend: fsterbxivhhzipfgpvou (CANONICAL — LOCKED)
-- Apply manually via Supabase SQL Editor on the fsterbxivhhzipfgpvou project.
-- ============================================================================
-- Properties:
--   * APPEND-ONLY. No DROP TABLE, no destructive changes.
--   * Idempotent (safe to re-run).
--   * Does NOT touch existing per-user RLS policies.
--   * Adds an additive read-only access path for doctors.
-- ============================================================================

-- 1) Role enum -----------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) user_roles table ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles self read" ON public.user_roles;
CREATE POLICY "user_roles self read"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- 3) has_role() — SECURITY DEFINER avoids recursive RLS ----------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4) Additive doctor READ-ONLY policies (preserves existing user policies)
DROP POLICY IF EXISTS "doctors read sessions" ON public.sessions;
CREATE POLICY "doctors read sessions"
  ON public.sessions FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

DROP POLICY IF EXISTS "doctors read chat_messages" ON public.chat_messages;
CREATE POLICY "doctors read chat_messages"
  ON public.chat_messages FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

DROP POLICY IF EXISTS "doctors read emotion_analyses" ON public.emotion_analyses;
CREATE POLICY "doctors read emotion_analyses"
  ON public.emotion_analyses FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

DROP POLICY IF EXISTS "doctors read profiles" ON public.profiles;
CREATE POLICY "doctors read profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

-- ============================================================================
-- To grant doctor access to a user, run (one-off, manual):
--   INSERT INTO public.user_roles (user_id, role)
--   VALUES ('<auth-user-uuid>', 'doctor')
--   ON CONFLICT (user_id, role) DO NOTHING;
-- ============================================================================
