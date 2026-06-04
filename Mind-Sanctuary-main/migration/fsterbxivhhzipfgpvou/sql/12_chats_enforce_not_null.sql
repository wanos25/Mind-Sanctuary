-- =====================================================================
-- 12_chats_enforce_not_null.sql
-- Final hardening pass: enforce chat_messages.chat_id NOT NULL.
-- Backend lock: fsterbxivhhzipfgpvou
-- Additive-safe, rollback-aware, idempotent, transactional.
--
-- DO NOT APPLY until the production audit in plan.md
-- (Phase 4 § "Pre-flight integrity SQL") returns zero on every check.
--
-- Strategy:
--   1. Re-run the backfill from 11_chats_hierarchy.sql (idempotent UPDATE)
--      so any rows written between migrations are linked.
--   2. Hard guard: if ANY chat_messages row is still NULL after the
--      backfill, RAISE EXCEPTION inside the transaction. The whole
--      migration rolls back — no partial state.
--   3. Only then add the NOT NULL constraint.
--   4. Same treatment for legacy public.messages.chat_id.
--
-- Rollback:
--   ALTER TABLE public.chat_messages ALTER COLUMN chat_id DROP NOT NULL;
--   ALTER TABLE public.messages      ALTER COLUMN chat_id DROP NOT NULL;
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Re-run the safe link backfill (idempotent — touches only NULLs).
-- ---------------------------------------------------------------------

-- 1a. Make sure every session has at least one chat. If a session was
--     created by a path that somehow skipped chat creation, materialize
--     one now so the next UPDATE has somewhere to point to.
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
  0,
  NULL,
  s.created_at,
  s.created_at
FROM public.sessions s
WHERE NOT EXISTS (
  SELECT 1 FROM public.chats c WHERE c.session_id = s.id
);

-- 1b. Link NULL chat_messages to their session's earliest chat
--     (DISTINCT ON to keep a deterministic choice if multiple chats exist).
WITH first_chat AS (
  SELECT DISTINCT ON (session_id)
         session_id, id AS chat_id
    FROM public.chats
   ORDER BY session_id, created_at ASC
)
UPDATE public.chat_messages cm
   SET chat_id = fc.chat_id
  FROM first_chat fc
 WHERE fc.session_id = cm.session_id
   AND cm.chat_id IS NULL;

-- 1c. Same for legacy public.messages.
WITH first_chat AS (
  SELECT DISTINCT ON (session_id)
         session_id, id AS chat_id
    FROM public.chats
   ORDER BY session_id, created_at ASC
)
UPDATE public.messages m
   SET chat_id = fc.chat_id
  FROM first_chat fc
 WHERE fc.session_id = m.session_id
   AND m.chat_id IS NULL;

-- ---------------------------------------------------------------------
-- 2. Hard guard — transactional abort if any NULLs remain.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  unlinked_cm integer;
  unlinked_m  integer;
  orphan_cm   integer;
  cross_user  integer;
BEGIN
  SELECT count(*) INTO unlinked_cm
    FROM public.chat_messages WHERE chat_id IS NULL;
  SELECT count(*) INTO unlinked_m
    FROM public.messages      WHERE chat_id IS NULL;

  -- Orphans: chat_id references a row that no longer exists.
  -- Possible only if FK was somehow disabled — defensive check.
  SELECT count(*) INTO orphan_cm
    FROM public.chat_messages cm
   WHERE cm.chat_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.chats c WHERE c.id = cm.chat_id);

  -- Cross-user linkage: message user_id must equal owning chat user_id.
  SELECT count(*) INTO cross_user
    FROM public.chat_messages cm
    JOIN public.chats c ON c.id = cm.chat_id
   WHERE cm.user_id <> c.user_id;

  IF unlinked_cm > 0 OR unlinked_m > 0 OR orphan_cm > 0 OR cross_user > 0 THEN
    RAISE EXCEPTION
      '12_chats_enforce_not_null aborted: unlinked_chat_messages=%, unlinked_messages=%, orphan_chat_messages=%, cross_user_links=%',
      unlinked_cm, unlinked_m, orphan_cm, cross_user;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. Enforce NOT NULL. Idempotent: re-running is a no-op once set.
-- ---------------------------------------------------------------------
ALTER TABLE public.chat_messages
  ALTER COLUMN chat_id SET NOT NULL;

ALTER TABLE public.messages
  ALTER COLUMN chat_id SET NOT NULL;

-- ---------------------------------------------------------------------
-- 4. Defensive index — supports the chat-scoped read path that is now
--    the sole supported reader. Idempotent.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_user_created
  ON public.chat_messages (chat_id, user_id, created_at ASC);

COMMIT;

-- ---------------------------------------------------------------------
-- Post-apply verification (run manually after migration commits).
-- All must return 0.
-- ---------------------------------------------------------------------
-- SELECT count(*) AS unlinked_chat_messages
--   FROM public.chat_messages WHERE chat_id IS NULL;
-- SELECT count(*) AS unlinked_messages
--   FROM public.messages WHERE chat_id IS NULL;
-- SELECT count(*) AS cross_user_chat_messages
--   FROM public.chat_messages cm JOIN public.chats c ON c.id = cm.chat_id
--  WHERE cm.user_id <> c.user_id;
