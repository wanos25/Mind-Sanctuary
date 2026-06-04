# Mind Hunter — Bootstrap Package for `fsterbxivhhzipfgpvou`

Self-contained, **idempotent** bootstrap of the full backend (schema, enums,
RLS, triggers, functions, indexes, storage, realtime, edge functions).

**Source (read-only):** Lovable Cloud `joqnptgangpdqhkqbfeq` — left untouched.
**Target:** your project `fsterbxivhhzipfgpvou`.

> ⚠️ This is a BOOTSTRAP, not a data dump. It builds an empty production-grade
> replica. Data migration is a separate, optional step (see §6).

---

## 0. Pre-flight

In the Supabase dashboard for `fsterbxivhhzipfgpvou`:

1. Project must be ACTIVE_HEALTHY.
2. **Authentication → Providers**: enable **Email** (confirm OFF only if you want to skip verification) and **Google** if you use Google sign-in.
3. **Authentication → URL Configuration**: set Site URL + Redirect URLs to your deployed origins (and `http://localhost:5173` for dev).
4. Copy these from **Project Settings → API**, you'll need them in §5:
   - `Project URL`           → `VITE_SUPABASE_URL`
   - `anon public` key       → `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `service_role` key      → only for one-off data migration, never ship to frontend

---

## 1. SQL bootstrap (run in order)

Open **SQL Editor** and execute these files top-to-bottom. Each is idempotent
(safe to re-run).

| Order | File                                  | Purpose |
|-------|---------------------------------------|---------|
| 01    | `sql/01_extensions.sql`               | uuid-ossp, pgcrypto |
| 02    | `sql/02_enums.sql`                    | mood, msg_role, session_stage, memory_type, app_role |
| 03    | `sql/03_functions.sql`                | trigger helpers + `has_role()` (SECURITY DEFINER) |
| 04    | `sql/04_tables.sql`                   | All 16 base public tables incl. voice/feedback/doctor |
| 05    | `sql/05_indexes.sql`                  | All non-PK indexes |
| 06    | `sql/06_rls.sql`                      | Enable RLS + every policy (per-user + doctor read) |
| 07    | `sql/07_triggers.sql`                 | `handle_new_user` on auth.users + updated_at triggers |
| 08    | `sql/08_storage.sql`                  | `chat-attachments` bucket + policies |
| 09    | `sql/09_realtime.sql`                 | Currently empty (nothing is on the realtime publication today) |
| 10    | `sql/10_r5_r6_activities_foundations.sql` | R5 `activity_kind` enum + `activity_assets` / `activity_sessions`; R6 foundation tables (`analytics_aggregates`, `ai_insight_summaries`, `notification_queue`, `activity_score_components`, `clinician_exports`) with RLS, indexes, triggers, comments |
| 11    | `db/manual/R4a_doctor_portal_foundations.sql` | Doctor-portal read overlays |
| 12    | `db/manual/R4b_doctor_review_crisis.sql` | Doctor review + crisis review tables |
| 13    | `db/manual/R6_doctor_bootstrap.sql`   | `doctor_bootstrap_available` + `claim_doctor_bootstrap` RPCs |

After step 13 the database is structurally identical to the active runtime.

> **Before Phase 5 data migration**, run the structural diff in
> `PARITY_DIFF.md` to confirm parity between source and target. If anything
> is missing on the target, capture it in `sql/11_parity_additions.sql`
> (additive only) and re-run.

---

## 2. Edge function deployment

Copy the four functions from this repo's `supabase/functions/` directory
into a clone of your new project, then deploy via Supabase CLI:

```bash
# from a directory linked to fsterbxivhhzipfgpvou
supabase link --project-ref fsterbxivhhzipfgpvou
supabase functions deploy chat              --no-verify-jwt
supabase functions deploy reflect           --no-verify-jwt
supabase functions deploy transcribe-voice  --no-verify-jwt
supabase functions deploy tts-reply         --no-verify-jwt
```

The `--no-verify-jwt` flag matches current Lovable Cloud behavior. Tighten
later if you want explicit JWT validation.

---

## 3. Required edge-function secrets

Set in **Project Settings → Edge Functions → Secrets**:

| Secret                    | Used by                          | Required | Notes |
|---------------------------|----------------------------------|----------|-------|
| `LOVABLE_API_KEY`         | chat, reflect, tts-reply         | **Yes**  | Lovable AI Gateway key. If you leave Lovable Cloud entirely you'll need to swap to OpenAI/Gemini direct in these functions. |
| `ELEVENLABS_API_KEY`      | transcribe-voice, tts-reply      | Yes (voice) | STT/TTS fallback + non-Arabic primary |
| `MUNSIT_API_KEY`          | transcribe-voice, tts-reply      | Optional | Arabic-first STT/TTS provider |
| `MUNSIT_BASE_URL`         | transcribe-voice, tts-reply      | Optional | Default `https://api.munsit.com` |
| `MUNSIT_TTS_VOICE_ID`     | tts-reply                        | Optional | Required only for Munsit TTS |
| `MUNSIT_TTS_MODEL_ID`     | tts-reply                        | Optional | Defaults to `munsit-tts-1` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_DB_URL` are auto-injected by Supabase — do not set manually.

---

## 4. Realtime

The current Cloud backend has **no tables** on the `supabase_realtime`
publication. `sql/09_realtime.sql` is intentionally empty. If you later want
live chat updates, add:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
```

---

## 5. Frontend runtime switch (DO NOT do this until §1–§4 are green)

The Lovable runtime regenerates `.env` and `src/integrations/supabase/client.ts`
on every deploy, locking them to the Cloud project. To run against your own
project you have two options:

### Option 5a — Keep Lovable Cloud as the dev backend, your project only in self-hosted prod
Build the app yourself (`npm run build`) and serve `dist/` from your own host,
with these env vars set at build time (e.g. on Vercel/Netlify):

```
VITE_SUPABASE_URL=https://fsterbxivhhzipfgpvou.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your anon key>
VITE_SUPABASE_PROJECT_ID=fsterbxivhhzipfgpvou
```

Lovable Cloud stays the dev preview backend (perfect fallback).

### Option 5b — Override inside the Lovable codebase (will fight regenerations)
Edit `src/integrations/supabase/client.ts` to hard-code your URL + anon key.
Any future Lovable backend tool call **will overwrite this file**. Only use if
you've accepted you'll re-apply the patch periodically.

Recommended: **5a**.

---

## 6. Optional data migration (LATER, manual)

Bootstrap creates an empty DB. To move existing rows from
`joqnptgangpdqhkqbfeq` → `fsterbxivhhzipfgpvou`:

1. **Auth users**: use `supabase auth export` / `import` (CLI) — preserves
   IDs and password hashes. Run before any `public.*` import so the
   `handle_new_user` trigger doesn't double-create profiles. Or:
   disable the trigger temporarily on the target, import auth, then import
   profiles by ID, then re-enable.
2. **Public tables** (in this order — respects FK-via-user_id chain):
   `profiles → sessions → chat_messages → messages → emotion_analyses →
    emotional_memories → memory_relationships → memory_events → key_moments →
    session_memories → insights → achievements → ai_personality_state →
    emotional_pulses → message_feedback → user_roles`
   For each: `COPY (SELECT * FROM public.<t>) TO STDOUT` on source,
   `COPY public.<t> FROM STDIN` on target. Service-role connection on both.
3. **Storage**: re-upload `chat-attachments/` keys or use the
   `supabase storage cp` command between projects.

A turnkey data-migration script is **not** included — it requires service-role
keys for two projects and should be a deliberate, audited operation.

---

## 7. Verification checklist

Run against `fsterbxivhhzipfgpvou` after §1–§4:

- [ ] `SELECT extname FROM pg_extension` includes `uuid-ossp`, `pgcrypto`.
- [ ] `\dT public.*` lists all 5 enums.
- [ ] `\dt public.*` lists 17 tables (16 + `user_roles`).
- [ ] `SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind='r'` — every table has `relrowsecurity = t`.
- [ ] `SELECT * FROM pg_policies WHERE schemaname='public'` — at least one policy per table; `chat_messages` has 4 (own all) + 1 doctor read.
- [ ] `SELECT id FROM storage.buckets WHERE id='chat-attachments'` returns one row.
- [ ] `\df public.handle_new_user`, `\df public.has_role`, `\df public.touch_updated_at`, `\df public.set_updated_at`, `\df public.profiles_sync_user_id` all exist.
- [ ] `SELECT tgname FROM pg_trigger WHERE tgname='on_auth_user_created'` returns one row.
- [ ] Sign up a test user → `profiles` row auto-created.
- [ ] Insert a `sessions` row → succeeds for the owning user only.
- [ ] Edge functions `chat`, `reflect`, `transcribe-voice`, `tts-reply` deployed and reachable; test `chat` with a short message and confirm streaming reply.
- [ ] Voice round-trip: record → transcribe-voice → chat → tts-reply → playback works.
- [ ] Doctor portal: insert `INSERT INTO user_roles(user_id, role) VALUES ('<uid>', 'doctor')`, log in as that user, verify they can read other users' `sessions` / `chat_messages` / `profiles` / `emotion_analyses`.

---

## 8. Rollback plan

Because the legacy Cloud backend is **never touched**, rollback is just
"point the frontend back at the Cloud project":

```
VITE_SUPABASE_URL=<lovable cloud url>
VITE_SUPABASE_PUBLISHABLE_KEY=<lovable cloud anon key>
VITE_SUPABASE_PROJECT_ID=joqnptgangpdqhkqbfeq
```

Redeploy the frontend. Zero schema changes required, zero data lost.

If you also want to wipe a botched bootstrap on `fsterbxivhhzipfgpvou`:

```sql
-- DESTRUCTIVE: only on target, only if bootstrap is wrong
DROP SCHEMA public CASCADE; CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;
```
…then re-run `sql/01..09`.

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Lovable regenerates `client.ts` / `.env` | Use deployment Option 5a (build outside Lovable). |
| `LOVABLE_API_KEY` is Cloud-only — direct edge-function calls might be rate-limited if your new project isn't on the same gateway | Long-term: swap edge functions to a direct provider (OpenAI / Google Gemini) using your own key. |
| `handle_new_user` trigger + manual `auth.users` import can double-insert profiles | Disable trigger during auth import, or insert profiles by ID afterwards. |
| Service-role keys leakage during data migration | Run from a local secure machine; never commit. |
| Voice provider keys missing on new project | Voice features will silently degrade; verify §3 before §7 round-trip test. |
