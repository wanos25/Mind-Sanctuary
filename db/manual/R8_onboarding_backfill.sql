-- =====================================================================
-- R8_onboarding_backfill.sql
-- Additive repair for sessions.is_onboarding backfill miss in
-- migration/fsterbxivhhzipfgpvou/sql/11_chats_hierarchy.sql (step 6f).
--
-- Backend lock: fsterbxivhhzipfgpvou
-- Idempotent. Safe to re-run. No data loss. No destructive ops.
-- Only flips false → true on each user's earliest session.
-- =====================================================================

BEGIN;

-- Verification snapshot (read-only) — captured into a NOTICE for the log.
DO $$
DECLARE
  total_sessions   integer;
  flagged_before   integer;
  null_started_at  integer;
BEGIN
  SELECT count(*) INTO total_sessions FROM public.sessions;
  SELECT count(*) INTO flagged_before FROM public.sessions WHERE is_onboarding;
  SELECT count(*) INTO null_started_at FROM public.sessions WHERE started_at IS NULL;
  RAISE NOTICE 'R8 pre: sessions=% onboarding=% null_started_at=%',
    total_sessions, flagged_before, null_started_at;
END $$;

-- Re-mark each user's earliest session using a NULL-safe ordering.
WITH firsts AS (
  SELECT DISTINCT ON (user_id) id
    FROM public.sessions
   ORDER BY user_id, COALESCE(started_at, created_at) ASC, id ASC
)
UPDATE public.sessions s
   SET is_onboarding = true
  FROM firsts f
 WHERE s.id = f.id
   AND s.is_onboarding IS DISTINCT FROM true;

DO $$
DECLARE
  flagged_after integer;
BEGIN
  SELECT count(*) INTO flagged_after FROM public.sessions WHERE is_onboarding;
  RAISE NOTICE 'R8 post: onboarding=%', flagged_after;
END $$;

COMMIT;

-- Re-verification (run manually):
-- SELECT count(*) AS onboarding_sessions FROM public.sessions WHERE is_onboarding;
-- SELECT user_id, count(*) FILTER (WHERE is_onboarding) AS onboarding_per_user
--   FROM public.sessions GROUP BY user_id HAVING count(*) FILTER (WHERE is_onboarding) <> 1;
-- (Second query should return zero rows: exactly one onboarding session per user.)
