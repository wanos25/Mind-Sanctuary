-- Canonical recovery code hashing: uppercase, strip dashes/spaces, then SHA-256.
-- Legacy rows (hashed from dashed plaintext) remain valid via dashed fallback lookup.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Normalize: trim → upper → remove hyphens and whitespace
CREATE OR REPLACE FUNCTION public.normalize_recovery_code(_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(regexp_replace(trim(coalesce(_code, '')), '[-\s]+', '', 'g'));
$$;

-- Reconstruct dashed display form from 16-char normalized body (legacy hash compat)
CREATE OR REPLACE FUNCTION public.recovery_code_legacy_dashed(_norm text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN length($1) >= 16 THEN
      substring($1, 1, 4) || '-' ||
      substring($1, 5, 4) || '-' ||
      substring($1, 9, 4) || '-' ||
      substring($1, 13, 4)
    ELSE trim($1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.recovery_code_hash(_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(
    extensions.digest(public.normalize_recovery_code(_code), 'sha256'),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION public.recovery_code_hash_legacy(_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(
    extensions.digest(
      public.recovery_code_legacy_dashed(public.normalize_recovery_code(_code)),
      'sha256'
    ),
    'hex'
  );
$$;

-- Status probe for client error messaging
CREATE OR REPLACE FUNCTION public.get_recovery_code_status(_code text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _norm text;
  _hash text;
  _legacy_hash text;
  _used_at timestamptz;
BEGIN
  _norm := public.normalize_recovery_code(_code);
  IF length(_norm) < 12 THEN
    RETURN 'invalid_format';
  END IF;

  _hash := public.recovery_code_hash(_code);
  _legacy_hash := public.recovery_code_hash_legacy(_code);

  SELECT used_at INTO _used_at
    FROM public.anonymous_recovery_codes
   WHERE code_hash IN (_hash, _legacy_hash)
   ORDER BY CASE WHEN code_hash = _hash THEN 0 ELSE 1 END
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF _used_at IS NOT NULL THEN
    RETURN 'already_used';
  END IF;

  RETURN 'valid';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recovery_code_status(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_anonymous_recovery_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash text;
  _legacy_hash text;
  _uid uuid;
BEGIN
  IF public.normalize_recovery_code(_code) = '' OR length(public.normalize_recovery_code(_code)) < 12 THEN
    RETURN NULL;
  END IF;

  _hash := public.recovery_code_hash(_code);
  _legacy_hash := public.recovery_code_hash_legacy(_code);

  UPDATE public.anonymous_recovery_codes
     SET used_at = now()
   WHERE code_hash IN (_hash, _legacy_hash)
     AND used_at IS NULL
   RETURNING user_id INTO _uid;

  RETURN _uid;
END;
$$;

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
  IF _new_uid IS NULL THEN
    RETURN NULL;
  END IF;

  _norm := public.normalize_recovery_code(_code);
  IF length(_norm) < 12 THEN
    RETURN NULL;
  END IF;

  _hash := public.recovery_code_hash(_code);
  _legacy_hash := public.recovery_code_hash_legacy(_code);

  SELECT user_id INTO _old_uid
    FROM public.anonymous_recovery_codes
   WHERE code_hash IN (_hash, _legacy_hash)
     AND used_at IS NULL
   ORDER BY CASE WHEN code_hash = _hash THEN 0 ELSE 1 END
   LIMIT 1;

  IF _old_uid IS NULL THEN
    RETURN NULL;
  END IF;

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
  SELECT
    _new_uid,
    _new_uid,
    COALESCE(p.display_name, p.nickname),
    COALESCE(p.avatar, 'default'),
    COALESCE(p.identity_mode, 'anonymous'),
    p.email,
    p.nickname,
    p.age,
    p.gender,
    p.nickname_reason,
    COALESCE(p.interview_answers, '{}'::jsonb)
  FROM public.profiles p
  WHERE p.user_id = _old_uid
  ON CONFLICT (id) DO UPDATE SET
    avatar = EXCLUDED.avatar,
    identity_mode = EXCLUDED.identity_mode,
    nickname = EXCLUDED.nickname,
    age = EXCLUDED.age,
    gender = EXCLUDED.gender,
    nickname_reason = EXCLUDED.nickname_reason,
    interview_answers = EXCLUDED.interview_answers,
    display_name = EXCLUDED.display_name;

  DELETE FROM public.profiles WHERE user_id = _old_uid AND id <> _new_uid;

  UPDATE public.anonymous_recovery_codes
     SET user_id = _new_uid, used_at = now()
   WHERE user_id = _old_uid;

  RETURN _old_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_anonymous_account(text) TO authenticated;
