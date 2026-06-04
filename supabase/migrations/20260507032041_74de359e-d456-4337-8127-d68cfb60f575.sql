
-- Add missing columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS avatar text,
  ADD COLUMN IF NOT EXISTS identity_mode text,
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS age text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS nickname_reason text,
  ADD COLUMN IF NOT EXISTS interview_answers jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_tone text;

-- Backfill user_id = id for existing rows
UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;

-- Keep user_id in sync with id automatically
CREATE OR REPLACE FUNCTION public.profiles_sync_user_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_user_id_trg ON public.profiles;
CREATE TRIGGER profiles_sync_user_id_trg
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_sync_user_id();

CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(user_id);

-- Add RLS policies that match user_id (existing ones use id)
DROP POLICY IF EXISTS "view own profile by user_id" ON public.profiles;
CREATE POLICY "view own profile by user_id" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "update own profile by user_id" ON public.profiles;
CREATE POLICY "update own profile by user_id" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert own profile by user_id" ON public.profiles;
CREATE POLICY "insert own profile by user_id" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = id);

-- Replace handle_new_user to be idempotent and include user_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, display_name)
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email,''), '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Wire the trigger to auth.users (it was defined but not attached)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
