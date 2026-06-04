-- ============================================================
-- PHASE 1 VERIFICATION — fsterbxivhhzipfgpvou
-- Read-only. Run after BOOTSTRAP_ALL.sql completes without error.
-- Each block prints a label + expected result inline; manually
-- compare. Stop and report if any row count / boolean is off.
-- ============================================================

-- 1) Extensions present  (expect: uuid-ossp, pgcrypto)
SELECT 'extensions' AS check, extname
FROM pg_extension
WHERE extname IN ('uuid-ossp','pgcrypto')
ORDER BY extname;

-- 2) Enum count  (expect: 6 → mood, msg_role, session_stage, memory_type, app_role, activity_kind)
SELECT 'enums' AS check, t.typname
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typtype = 'e'
ORDER BY t.typname;

-- 3) Public table count  (expect: 23)
SELECT 'public_table_count' AS check, COUNT(*) AS n
FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE';

SELECT 'public_tables' AS check, table_name
FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE'
ORDER BY table_name;

-- 4) RLS enabled on every public table  (expect: all relrowsecurity = t)
SELECT 'rls' AS check, relname, relrowsecurity
FROM pg_class
WHERE relnamespace='public'::regnamespace AND relkind='r'
ORDER BY relname;

-- 5) Required functions present
--    (expect rows for: has_role, handle_new_user, update_updated_at_column,
--     touch_updated_at, set_updated_at, profiles_sync_user_id,
--     doctor_bootstrap_available, claim_doctor_bootstrap)
SELECT 'functions' AS check, p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN (
    'has_role','handle_new_user','update_updated_at_column',
    'touch_updated_at','set_updated_at','profiles_sync_user_id',
    'doctor_bootstrap_available','claim_doctor_bootstrap'
  )
ORDER BY p.proname;

-- 6) auth.users trigger attached  (expect: 1 row, on_auth_user_created)
SELECT 'auth_trigger' AS check, trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_schema='auth' AND event_object_table='users';

-- 7) updated_at triggers per table  (expect ≥ 1 per table that has updated_at)
SELECT 'updated_at_triggers' AS check, event_object_table, trigger_name
FROM information_schema.triggers
WHERE trigger_schema='public' AND trigger_name LIKE 'update_%_updated_at'
ORDER BY event_object_table;

-- 8) Storage bucket  (expect: chat-attachments, public = false)
SELECT 'bucket' AS check, id, public
FROM storage.buckets
WHERE id = 'chat-attachments';

-- 9) RLS policies per table  (expect ≥ 1 per table)
SELECT 'policies' AS check, tablename, COUNT(*) AS n
FROM pg_policies
WHERE schemaname='public'
GROUP BY tablename
ORDER BY tablename;

-- 10) R5/R6 tables present  (expect: 7 rows)
SELECT 'r5_r6_tables' AS check, table_name
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN (
    'activity_assets','activity_sessions','activity_score_components',
    'analytics_aggregates','ai_insight_summaries','notification_queue',
    'clinician_exports'
  )
ORDER BY table_name;

-- 11) Doctor bootstrap RPCs are SECURITY DEFINER  (expect: both rows, prosecdef = t)
SELECT 'doctor_rpcs' AS check, p.proname, p.prosecdef
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('doctor_bootstrap_available','claim_doctor_bootstrap')
ORDER BY p.proname;

-- 12) Realtime publication  (expect: 0 rows — intentionally empty for now)
SELECT 'realtime' AS check, schemaname, tablename
FROM pg_publication_tables
WHERE pubname='supabase_realtime'
ORDER BY tablename;
