-- =====================================================================
-- R6b — Grant clinician role on the ACTIVE runtime backend
-- Target project ref: fsterbxivhhzipfgpvou   (LOCKED — sole valid backend)
-- Apply manually in the Supabase SQL editor of THAT project only.
-- Idempotent · additive · non-destructive.
-- =====================================================================

-- 1) Foundations (no-ops if already present) --------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 2) Grant doctor role to the live clinician account ------------------
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'doctor'::public.app_role
FROM auth.users u
WHERE lower(u.email) = lower('asmartvip@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Verify ------------------------------------------------------------
SELECT u.email, r.role, r.created_at
FROM public.user_roles r
JOIN auth.users u ON u.id = r.user_id
WHERE lower(u.email) = lower('asmartvip@gmail.com');
