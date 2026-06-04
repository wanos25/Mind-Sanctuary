-- Schema-safe restore: only updates tables/columns that exist on this project.
-- Run in Supabase SQL Editor after 15_recovery_code_canonical_hash.sql.
-- Fixes: relation "public.video_watch_progress" does not exist (and similar).

CREATE OR REPLACE FUNCTION public.restore_reassign_user_column(
  _table text,
  _column text,
  _old_uid uuid,
  _new_uid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_tables t
      JOIN information_schema.columns c
        ON c.table_schema = t.schemaname
       AND c.table_name = t.tablename
     WHERE t.schemaname = 'public'
       AND t.tablename = _table
       AND c.column_name = _column
  ) THEN
    RETURN;
  END IF;

  EXECUTE format(
    'UPDATE public.%I SET %I = $1 WHERE %I = $2',
    _table, _column, _column
  )
  USING _new_uid, _old_uid;
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
    UPDATE public.anonymous_recovery_codes
       SET used_at = COALESCE(used_at, now())
     WHERE user_id = _old_uid;
    RETURN _new_uid;
  END IF;

  PERFORM public.restore_reassign_user_column('sessions', 'user_id', _old_uid, _new_uid);
  PERFORM public.restore_reassign_user_column('chats', 'user_id', _old_uid, _new_uid);
  PERFORM public.restore_reassign_user_column('chat_messages', 'user_id', _old_uid, _new_uid);
  PERFORM public.restore_reassign_user_column('activity_sessions', 'user_id', _old_uid, _new_uid);
  PERFORM public.restore_reassign_user_column('video_watch_progress', 'user_id', _old_uid, _new_uid);
  PERFORM public.restore_reassign_user_column('emotion_analyses', 'user_id', _old_uid, _new_uid);
  PERFORM public.restore_reassign_user_column('emotional_memories', 'user_id', _old_uid, _new_uid);
  PERFORM public.restore_reassign_user_column('memory_relationships', 'user_id', _old_uid, _new_uid);
  PERFORM public.restore_reassign_user_column('memory_events', 'user_id', _old_uid, _new_uid);
  PERFORM public.restore_reassign_user_column('key_moments', 'user_id', _old_uid, _new_uid);
  PERFORM public.restore_reassign_user_column('analytics_aggregates', 'user_id', _old_uid, _new_uid);
  PERFORM public.restore_reassign_user_column('ai_insight_summaries', 'user_id', _old_uid, _new_uid);
  PERFORM public.restore_reassign_user_column('notification_queue', 'user_id', _old_uid, _new_uid);
  PERFORM public.restore_reassign_user_column('activity_score_components', 'user_id', _old_uid, _new_uid);
  PERFORM public.restore_reassign_user_column('therapist_notes', 'patient_id', _old_uid, _new_uid);
  PERFORM public.restore_reassign_user_column('session_memories', 'user_id', _old_uid, _new_uid);
  PERFORM public.restore_reassign_user_column('crisis_flags', 'user_id', _old_uid, _new_uid);

  INSERT INTO public.profiles (
    id, user_id, display_name, avatar, identity_mode,
    email, nickname, age, gender, nickname_reason, interview_answers
  )
  SELECT
    _new_uid, _new_uid,
    COALESCE(p.display_name, p.nickname),
    COALESCE(p.avatar, 'default'),
    COALESCE(p.identity_mode, 'anonymous'),
    p.email, p.nickname, p.age, p.gender, p.nickname_reason,
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

GRANT EXECUTE ON FUNCTION public.restore_reassign_user_column(text, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_anonymous_account(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
