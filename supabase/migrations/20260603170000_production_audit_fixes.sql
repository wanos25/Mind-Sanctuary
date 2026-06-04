-- Production audit fixes: schema gaps, RLS, recovery security, RPC return value.

-- ---------------------------------------------------------------------------
-- Missing utility used by message_feedback trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text;

-- ---------------------------------------------------------------------------
-- Chats hierarchy (abbreviated from manual 11_chats_hierarchy.sql)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chats (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title              text,
  summary_emotion    text,
  summary_intensity  numeric,
  message_count      integer NOT NULL DEFAULT 0,
  last_message_at    timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_chats_session_created
  ON public.chats (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_user_last_msg
  ON public.chats (user_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_created
  ON public.chat_messages (chat_id, created_at ASC);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chats_owner_select" ON public.chats;
CREATE POLICY "chats_owner_select" ON public.chats
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "chats_owner_insert" ON public.chats;
CREATE POLICY "chats_owner_insert" ON public.chats
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "chats_owner_update" ON public.chats;
CREATE POLICY "chats_owner_update" ON public.chats
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "chats_owner_delete" ON public.chats;
CREATE POLICY "chats_owner_delete" ON public.chats
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "chats_doctor_select" ON public.chats;
CREATE POLICY "chats_doctor_select" ON public.chats
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'doctor'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO authenticated;

-- ---------------------------------------------------------------------------
-- Therapist notes + anonymous recovery codes (abbreviated from manual 13)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.therapist_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id      uuid NULL,
  session_id   uuid NULL,
  title        text NOT NULL,
  body         text NOT NULL,
  tags         text[] NOT NULL DEFAULT '{}',
  archived     boolean NOT NULL DEFAULT false,
  read_at      timestamptz NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_therapist_notes_patient ON public.therapist_notes(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_therapist_notes_chat ON public.therapist_notes(chat_id) WHERE chat_id IS NOT NULL;

ALTER TABLE public.therapist_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patient reads own notes" ON public.therapist_notes;
CREATE POLICY "Patient reads own notes"
  ON public.therapist_notes FOR SELECT TO authenticated
  USING (patient_id = auth.uid() AND archived = false);
DROP POLICY IF EXISTS "Patient marks own note read" ON public.therapist_notes;
CREATE POLICY "Patient marks own note read"
  ON public.therapist_notes FOR UPDATE TO authenticated
  USING (patient_id = auth.uid()) WITH CHECK (patient_id = auth.uid());
DROP POLICY IF EXISTS "Doctor reads any notes" ON public.therapist_notes;
CREATE POLICY "Doctor reads any notes"
  ON public.therapist_notes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'));
DROP POLICY IF EXISTS "Doctor inserts notes" ON public.therapist_notes;
CREATE POLICY "Doctor inserts notes"
  ON public.therapist_notes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'doctor') AND author_id = auth.uid());
DROP POLICY IF EXISTS "Doctor updates own notes" ON public.therapist_notes;
CREATE POLICY "Doctor updates own notes"
  ON public.therapist_notes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') AND author_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'doctor') AND author_id = auth.uid());
DROP POLICY IF EXISTS "Doctor deletes own notes" ON public.therapist_notes;
CREATE POLICY "Doctor deletes own notes"
  ON public.therapist_notes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') AND author_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_notes TO authenticated;

CREATE TABLE IF NOT EXISTS public.anonymous_recovery_codes (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash   text NOT NULL,
  code_hint   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  used_at     timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_anon_recovery_code_hash ON public.anonymous_recovery_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_anon_recovery_unused
  ON public.anonymous_recovery_codes (code_hash) WHERE used_at IS NULL;

ALTER TABLE public.anonymous_recovery_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User reads own recovery row" ON public.anonymous_recovery_codes;
CREATE POLICY "User reads own recovery row"
  ON public.anonymous_recovery_codes FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "User inserts own recovery row" ON public.anonymous_recovery_codes;
CREATE POLICY "User inserts own recovery row"
  ON public.anonymous_recovery_codes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.anonymous_recovery_codes TO authenticated;

-- ---------------------------------------------------------------------------
-- Sessions DELETE + admin role management
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users delete own sessions" ON public.sessions;
CREATE POLICY "Users delete own sessions"
  ON public.sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin manages roles" ON public.user_roles;
CREATE POLICY "admin manages roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Doctor bootstrap RPCs (from R6)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.doctor_bootstrap_available()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NOT EXISTS(
    SELECT 1 FROM public.user_roles WHERE role IN ('doctor', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.claim_doctor_bootstrap()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_exists boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role IN ('doctor', 'admin')) INTO v_exists;
  IF v_exists THEN RAISE EXCEPTION 'bootstrap_closed'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'doctor')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.doctor_bootstrap_available() FROM public;
GRANT EXECUTE ON FUNCTION public.doctor_bootstrap_available() TO authenticated;
REVOKE ALL ON FUNCTION public.claim_doctor_bootstrap() FROM public;
GRANT EXECUTE ON FUNCTION public.claim_doctor_bootstrap() TO authenticated;

-- ---------------------------------------------------------------------------
-- Recovery security: authenticated-only status/redeem; restore returns new uid
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_recovery_code_status(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_anonymous_recovery_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_recovery_code_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_anonymous_recovery_code(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_anonymous_account(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _norm text;
  _hash text;
  _legacy_hash text;
  _old_uid uuid;
  _new_uid uuid;
BEGIN
  _new_uid := auth.uid();
  IF _new_uid IS NULL THEN RETURN NULL; END IF;

  _norm := public.normalize_recovery_code(_code);
  IF length(_norm) < 16 THEN RETURN NULL; END IF;

  _hash := public.recovery_code_hash(_code);
  _legacy_hash := public.recovery_code_hash_legacy(_code);

  SELECT user_id INTO _old_uid
    FROM public.anonymous_recovery_codes
   WHERE code_hash IN (_hash, _legacy_hash)
     AND used_at IS NULL
   ORDER BY CASE WHEN code_hash = _hash THEN 0 ELSE 1 END
   LIMIT 1;

  IF _old_uid IS NULL THEN RETURN NULL; END IF;

  IF _old_uid = _new_uid THEN
    UPDATE public.anonymous_recovery_codes SET used_at = COALESCE(used_at, now()) WHERE user_id = _old_uid;
    RETURN _new_uid;
  END IF;

  UPDATE public.sessions SET user_id = _new_uid WHERE user_id = _old_uid;
  UPDATE public.chats SET user_id = _new_uid WHERE user_id = _old_uid;
  UPDATE public.chat_messages SET user_id = _new_uid WHERE user_id = _old_uid;
  UPDATE public.activity_sessions SET user_id = _new_uid WHERE user_id = _old_uid;
  UPDATE public.video_watch_progress SET user_id = _new_uid WHERE user_id = _old_uid;
  UPDATE public.emotion_analyses SET user_id = _new_uid WHERE user_id = _old_uid;
  UPDATE public.emotional_memories SET user_id = _new_uid WHERE user_id = _old_uid;
  UPDATE public.memory_relationships SET user_id = _new_uid WHERE user_id = _old_uid;
  UPDATE public.memory_events SET user_id = _new_uid WHERE user_id = _old_uid;
  UPDATE public.key_moments SET user_id = _new_uid WHERE user_id = _old_uid;
  UPDATE public.analytics_aggregates SET user_id = _new_uid WHERE user_id = _old_uid;
  UPDATE public.ai_insight_summaries SET user_id = _new_uid WHERE user_id = _old_uid;
  UPDATE public.notification_queue SET user_id = _new_uid WHERE user_id = _old_uid;
  UPDATE public.activity_score_components SET user_id = _new_uid WHERE user_id = _old_uid;
  UPDATE public.therapist_notes SET patient_id = _new_uid WHERE patient_id = _old_uid;

  INSERT INTO public.profiles (id, user_id, display_name, avatar, identity_mode, email, nickname, age, gender, nickname_reason, interview_answers)
  SELECT _new_uid, _new_uid, COALESCE(p.display_name, p.nickname), COALESCE(p.avatar, 'default'),
         COALESCE(p.identity_mode, 'anonymous'), p.email, p.nickname, p.age, p.gender, p.nickname_reason,
         COALESCE(p.interview_answers, '{}'::jsonb)
  FROM public.profiles p WHERE p.user_id = _old_uid
  ON CONFLICT (id) DO UPDATE SET
    avatar = EXCLUDED.avatar, identity_mode = EXCLUDED.identity_mode, nickname = EXCLUDED.nickname,
    age = EXCLUDED.age, gender = EXCLUDED.gender, nickname_reason = EXCLUDED.nickname_reason,
    interview_answers = EXCLUDED.interview_answers, display_name = EXCLUDED.display_name;

  DELETE FROM public.profiles WHERE user_id = _old_uid AND id <> _new_uid;

  UPDATE public.anonymous_recovery_codes SET user_id = _new_uid, used_at = now() WHERE user_id = _old_uid;

  RETURN _new_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_anonymous_account(text) TO authenticated;

-- Align status RPC minimum length with client (16 chars)
CREATE OR REPLACE FUNCTION public.get_recovery_code_status(_code text)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  _norm text;
  _hash text;
  _legacy_hash text;
  _used_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'invalid_format'; END IF;

  _norm := public.normalize_recovery_code(_code);
  IF length(_norm) < 16 THEN RETURN 'invalid_format'; END IF;

  _hash := public.recovery_code_hash(_code);
  _legacy_hash := public.recovery_code_hash_legacy(_code);

  SELECT used_at INTO _used_at
    FROM public.anonymous_recovery_codes
   WHERE code_hash IN (_hash, _legacy_hash)
   ORDER BY CASE WHEN code_hash = _hash THEN 0 ELSE 1 END
   LIMIT 1;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF _used_at IS NOT NULL THEN RETURN 'already_used'; END IF;
  RETURN 'valid';
END;
$$;
