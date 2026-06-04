-- Anonymous recovery: transfer data from redeemed account to the caller's session.
-- Idempotent additive migration for fsterbxivhhzipfgpvou.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.restore_anonymous_account(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash text;
  _old_uid uuid;
  _new_uid uuid;
BEGIN
  _new_uid := auth.uid();
  IF _new_uid IS NULL THEN
    RETURN NULL;
  END IF;

  IF _code IS NULL OR length(trim(_code)) < 8 THEN
    RETURN NULL;
  END IF;

  _hash := encode(extensions.digest(trim(_code), 'sha256'), 'hex');

  SELECT user_id INTO _old_uid
    FROM public.anonymous_recovery_codes
   WHERE code_hash = _hash
     AND used_at IS NULL
   LIMIT 1;

  IF _old_uid IS NULL THEN
    RETURN NULL;
  END IF;

  IF _old_uid = _new_uid THEN
    UPDATE public.anonymous_recovery_codes SET used_at = COALESCE(used_at, now()) WHERE user_id = _old_uid;
    RETURN _new_uid;
  END IF;

  -- Transfer user-owned rows to the new anonymous session.
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

  -- Profile: copy fields onto the new user's row, then drop the old profile row.
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

  RETURN _new_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_anonymous_account(text) TO authenticated;
