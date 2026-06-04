# Structural Parity Diff — `dbgncklwmjjzncukhvgm` → `fsterbxivhhzipfgpvou`

> **STATUS: TEMPLATE / DRY-RUN ONLY.** No execution yet.
> Run the queries in §1 against BOTH projects (read-only, in SQL editor), paste
> the outputs into §2, and let §3 generate the additive SQL needed to reach
> parity. Source (`dbgncklwmjjzncukhvgm`) is never written to.

---

## 0. How to use

1. Open SQL editor on **source** (`dbgncklwmjjzncukhvgm`) and **target** (`fsterbxivhhzipfgpvou`) side-by-side.
2. Run every query in §1 on both projects.
3. Diff each pair (UNIX `diff`, VS Code, `git diff --no-index a.txt b.txt`).
4. Record missing/extra objects in §2 (one section per category).
5. The bootstrap files in `sql/01..10` are the source of truth — anything
   on source but not on target after running 01..10 must either:
   - be added to a new `sql/11_*.sql` (if it's a feature we want to keep), or
   - be explicitly accepted as legacy/orphan (record in §4).

This document is **plan/diff only**. It produces no migration until reviewed.

---

## 1. Read-only inventory queries

Run each block in BOTH projects, dump results to `inventory_src/*.txt` and
`inventory_dst/*.txt`.

### 1a. Tables
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY 1;
```

### 1b. Columns (full shape — name, type, nullability, default)
```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

### 1c. Enums
```sql
SELECT t.typname, e.enumlabel, e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;
```

### 1d. Indexes
```sql
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### 1e. Triggers
```sql
SELECT event_object_table AS table_name, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY 1, 2;

-- include auth schema triggers (handle_new_user)
SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'auth'
ORDER BY 1, 2;
```

### 1f. Functions
```sql
SELECT n.nspname AS schema, p.proname AS function,
       pg_get_function_identity_arguments(p.oid) AS args,
       l.lanname AS language, p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
ORDER BY p.proname;
```

### 1g. RLS policies
```sql
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- per-table RLS enabled flag
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
ORDER BY relname;
```

### 1h. Storage buckets + policies
```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
ORDER BY id;

SELECT bucket_id, name, definition
FROM storage.policies
ORDER BY bucket_id, name;
```

### 1i. Realtime publication
```sql
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
```

### 1j. Edge functions (Dashboard or CLI — not SQL)
```bash
supabase functions list --project-ref dbgncklwmjjzncukhvgm
supabase functions list --project-ref fsterbxivhhzipfgpvou
```
Expected on both after Phase 3: `chat`, `reflect`, `transcribe-voice`, `tts-reply`.

### 1k. Edge function secrets (names only)
Dashboard → Settings → Edge Functions → Secrets (compare **names**, never values).

### 1l. Auth providers + redirect URLs
Dashboard → Authentication → Providers + URL Configuration (manual compare).

---

## 2. Expected baseline (what target should have after `sql/01..10`)

| Category | Source-of-truth file | Expected count / objects |
|---|---|---|
| Extensions | `sql/01_extensions.sql` | `uuid-ossp`, `pgcrypto` |
| Enums | `sql/02_enums.sql` + `sql/10_*.sql` | `mood`, `msg_role`, `session_stage`, `memory_type`, `app_role`, `activity_kind` (**6 total**) |
| Public tables | `sql/04_tables.sql` + `sql/10_*.sql` | profiles, sessions, messages, chat_messages, emotion_analyses, session_memories, emotional_memories, memory_relationships, memory_events, key_moments, insights, achievements, ai_personality_state, emotional_pulses, message_feedback, user_roles, activity_assets, activity_sessions, activity_score_components, analytics_aggregates, ai_insight_summaries, notification_queue, clinician_exports (**23 total**) |
| RLS | every public table | `relrowsecurity = true` on all 23 |
| Functions | `sql/03_functions.sql` + `sql/10_*.sql` | `has_role`, `handle_new_user`, `touch_updated_at`, `set_updated_at`, `profiles_sync_user_id`, `update_updated_at_column`, `doctor_bootstrap_available`, `claim_doctor_bootstrap` |
| Triggers | `sql/07_triggers.sql` + `sql/10_*.sql` | `on_auth_user_created` (auth.users), `update_*_updated_at` per table |
| Storage buckets | `sql/08_storage.sql` | `chat-attachments` (private) |
| Realtime | `sql/09_realtime.sql` | empty publication |
| Edge functions | `supabase/functions/` | 4 functions |

Record per-category result of comparing `inventory_src` vs `inventory_dst`:

```text
[ ] Tables       —  missing on dst: ____   extra on dst: ____
[ ] Columns      —  shape mismatches: ____
[ ] Enums        —  missing labels: ____
[ ] Indexes      —  missing on dst: ____
[ ] Triggers     —  missing on dst: ____
[ ] Functions    —  missing on dst: ____
[ ] RLS policies —  missing on dst: ____
[ ] Buckets      —  missing on dst: ____
[ ] Realtime     —  missing on dst: ____
[ ] Edge fns     —  missing on dst: ____
[ ] Secrets      —  missing on dst: ____
[ ] Auth config  —  diffs:        ____
```

---

## 3. Additive parity SQL

If §2 surfaces objects present on source but absent from target after
`sql/01..10`, capture them in a new file (do not modify existing bootstrap
files):

```
migration/fsterbxivhhzipfgpvou/sql/11_parity_additions.sql
```

Rules:
- **Additive only** — `CREATE ... IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`.
- No `DROP`, no `ALTER COLUMN TYPE`, no `RENAME`.
- Each block must explain *why* the object is needed (link to feature/PR).
- Re-runnable end-to-end.

If a destructive change is genuinely required, escalate — do NOT add it to
`11_parity_additions.sql`. Open a separate `sql/12_breaking_*.sql` with an
explicit review gate.

---

## 4. Accepted divergences (orphans on source we intentionally drop)

Document any source-only objects we deliberately do NOT bring forward.

| Object | Type | Reason for dropping |
|---|---|---|
| _none yet_ | | |

---

## 5. Gate

Phase 5 (data migration) MUST NOT begin until:

- [ ] §1 queries executed on both projects.
- [ ] §2 checklist 100% green (or every red item resolved in §3 / §4).
- [ ] `sql/11_parity_additions.sql` (if any) reviewed + applied on target.
- [ ] Re-run §1 on target; diff vs source is empty modulo §4.

Only then is the schema considered at parity and safe to receive data.
