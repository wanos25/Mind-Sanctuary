-- =====================================================================
-- 11_chats_hierarchy.sql
-- Additive sessions → chats → messages hierarchy.
-- Backend lock: fsterbxivhhzipfgpvou
-- Idempotent. Safe to re-run. No data loss. No destructive operations.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. New table: public.chats
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chats (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  title              text,
  summary_emotion    text,
  summary_intensity  numeric,
  message_count      integer     NOT NULL DEFAULT 0,
  last_message_at    timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. Additive columns on existing tables
-- ---------------------------------------------------------------------
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS chat_count     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_onboarding  boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chats_session_created
  ON public.chats (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chats_user_last_msg
  ON public.chats (user_id, last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_created
  ON public.chat_messages (chat_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_messages_chat_created
  ON public.messages (chat_id, created_at ASC);

-- ---------------------------------------------------------------------
-- 4. RLS — mirrors existing patterns on sessions / chat_messages
-- ---------------------------------------------------------------------
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chats_owner_select" ON public.chats;
CREATE POLICY "chats_owner_select" ON public.chats
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "chats_owner_insert" ON public.chats;
CREATE POLICY "chats_owner_insert" ON public.chats
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chats_owner_update" ON public.chats;
CREATE POLICY "chats_owner_update" ON public.chats
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chats_owner_delete" ON public.chats;
CREATE POLICY "chats_owner_delete" ON public.chats
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Doctor visibility (parity with sessions/chat_messages doctor policies)
DROP POLICY IF EXISTS "chats_doctor_select" ON public.chats;
CREATE POLICY "chats_doctor_select" ON public.chats
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'));

-- ---------------------------------------------------------------------
-- 5. Triggers (SECURITY DEFINER, pinned search_path)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chats_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chats_touch_updated_at ON public.chats;
CREATE TRIGGER trg_chats_touch_updated_at
  BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.chats_touch_updated_at();

CREATE OR REPLACE FUNCTION public.chat_messages_bump_chat_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.chat_id IS NOT NULL THEN
    UPDATE public.chats
       SET message_count   = message_count + 1,
           last_message_at = GREATEST(COALESCE(last_message_at, NEW.created_at), NEW.created_at),
           updated_at      = now()
     WHERE id = NEW.chat_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_messages_bump_chat_stats ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_bump_chat_stats
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_bump_chat_stats();

CREATE OR REPLACE FUNCTION public.chats_bump_session_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sessions
     SET chat_count = chat_count + 1
   WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chats_bump_session_counter ON public.chats;
CREATE TRIGGER trg_chats_bump_session_counter
  AFTER INSERT ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.chats_bump_session_counter();

-- ---------------------------------------------------------------------
-- 6. Backfill — one chat per existing session, then re-link messages.
--    Triggers fire during these statements; we reset counters at the end.
-- ---------------------------------------------------------------------

-- 6a. Create exactly one chat per existing session that lacks one.
INSERT INTO public.chats (
  id, session_id, user_id, title,
  summary_emotion, summary_intensity,
  message_count, last_message_at,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  s.id,
  s.user_id,
  s.title,
  s.summary_emotion,
  s.summary_intensity,
  0,                                    -- recomputed in 6d
  NULL,                                 -- recomputed in 6d
  s.created_at,
  s.created_at
FROM public.sessions s
WHERE NOT EXISTS (
  SELECT 1 FROM public.chats c WHERE c.session_id = s.id
);

-- 6b. Link every chat_messages row to its session's (single) chat.
UPDATE public.chat_messages cm
   SET chat_id = c.id
  FROM public.chats c
 WHERE c.session_id = cm.session_id
   AND cm.chat_id IS NULL;

-- 6c. Same for legacy messages.
UPDATE public.messages m
   SET chat_id = c.id
  FROM public.chats c
 WHERE c.session_id = m.session_id
   AND m.chat_id IS NULL;

-- 6d. Recompute chats.message_count and last_message_at from truth.
WITH agg AS (
  SELECT chat_id,
         count(*)         AS cnt,
         max(created_at)  AS last_at
    FROM public.chat_messages
   WHERE chat_id IS NOT NULL
   GROUP BY chat_id
)
UPDATE public.chats c
   SET message_count   = COALESCE(agg.cnt, 0),
       last_message_at = agg.last_at
  FROM agg
 WHERE c.id = agg.chat_id;

-- 6e. Recompute sessions.chat_count from truth.
WITH agg AS (
  SELECT session_id, count(*) AS cnt
    FROM public.chats
   GROUP BY session_id
)
UPDATE public.sessions s
   SET chat_count = COALESCE(agg.cnt, 0)
  FROM agg
 WHERE s.id = agg.session_id;

-- 6f. Mark each user's earliest session as the onboarding session.
WITH firsts AS (
  SELECT DISTINCT ON (user_id) id
    FROM public.sessions
   ORDER BY user_id, started_at ASC
)
UPDATE public.sessions s
   SET is_onboarding = true
  FROM firsts f
 WHERE s.id = f.id
   AND s.is_onboarding = false;

-- ---------------------------------------------------------------------
-- 7. Backfill guard — must reach 100% before any future NOT NULL flip.
--    We do NOT enforce NOT NULL on chat_messages.chat_id yet; that
--    happens in a follow-up migration only after every writer is
--    updated to set chat_id.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  unlinked integer;
BEGIN
  SELECT count(*) INTO unlinked
    FROM public.chat_messages
   WHERE chat_id IS NULL;
  IF unlinked > 0 THEN
    RAISE NOTICE '11_chats_hierarchy: % chat_messages rows still have NULL chat_id', unlinked;
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- Post-run verification queries (run manually, not part of TX)
-- ---------------------------------------------------------------------
-- SELECT count(*) AS unlinked_chat_messages FROM public.chat_messages WHERE chat_id IS NULL;
-- SELECT count(*) AS chats_total              FROM public.chats;
-- SELECT count(*) AS sessions_total           FROM public.sessions;
-- SELECT count(*) AS onboarding_sessions      FROM public.sessions WHERE is_onboarding;
