# Phase 2 — Runtime Cutover Readiness Report

**Source (current runtime, untouched):** `dbgncklwmjjzncukhvgm`
**Target (canonical, Phase 1 verified):** `fsterbxivhhzipfgpvou`
**Status:** preparation only — no env / client / runtime changes performed.

---

## 1. Auth / Provider Parity (manual, target dashboard)

| Item | Source value | Action on target |
|---|---|---|
| Email + password | Enabled | Enable. Confirm "Confirm email" matches source. |
| Google OAuth | Enabled (managed by Lovable Cloud on source) | Enable provider. Paste Google `client_id` + `client_secret` from source's Auth → Providers → Google. |
| Apple OAuth | Enabled if used on source — verify in source dashboard | Mirror only if source has it on. |
| Phone / Magic link | Off on source | Leave off. |
| Password HIBP check | Recommended ON | Toggle on. |
| JWT expiry / refresh rotation | Defaults | Leave defaults. |
| Email templates (signup, recovery, magic link, invite, email-change, reauth) | Default Lovable templates | Leave defaults for cutover; can re-scaffold later. |

**Site URL & redirect URLs on target Auth → URL Configuration:**

- Site URL: `https://id-preview--8408ec74-a4a7-4cfc-a144-4f0ba8111076.lovable.app`
- Additional Redirect URLs:
  - `http://localhost:5173`
  - `http://localhost:5173/**`
  - `https://id-preview--8408ec74-a4a7-4cfc-a144-4f0ba8111076.lovable.app`
  - `https://id-preview--8408ec74-a4a7-4cfc-a144-4f0ba8111076.lovable.app/**`
  - (production custom domain — add when assigned)

Google OAuth → Authorized redirect URIs (Google Cloud Console):
- `https://fsterbxivhhzipfgpvou.supabase.co/auth/v1/callback`

---

## 2. Storage Bucket Verification (target)

| Bucket | Visibility | Source | Action |
|---|---|---|---|
| `chat-attachments` | private | created by `sql/08_storage.sql` | Confirm exists, `public = false`, RLS policies present (per-user folder). Already verified in Phase 1 step 8. |

No file copy required (fresh-start strategy).

---

## 3. Edge Functions — Deployment Checklist

Code lives in `supabase/functions/` (Lovable-managed; auto-deploys to whichever project the `.env` points to). Functions to deploy to target:

| Function | File | verify_jwt | Required secrets |
|---|---|---|---|
| `chat` | `supabase/functions/chat/index.ts` | false (in-code JWT validation) | `LOVABLE_API_KEY` |
| `reflect` | `supabase/functions/reflect/index.ts` | false | `LOVABLE_API_KEY` |
| `transcribe-voice` | `supabase/functions/transcribe-voice/index.ts` | false | `ELEVENLABS_API_KEY`, `MUNSIT_API_KEY` (optional, Arabic), `MUNSIT_BASE_URL` (optional) |
| `tts-reply` | `supabase/functions/tts-reply/index.ts` | false | `LOVABLE_API_KEY`, `ELEVENLABS_API_KEY`, `MUNSIT_API_KEY`, `MUNSIT_TTS_VOICE_ID`, `MUNSIT_TTS_MODEL_ID`, `MUNSIT_BASE_URL` |

**Current status on target:** NOT deployed. Deployment is bound to the project the Lovable workspace is linked to — currently `dbgncklwmjjzncukhvgm`. Deployment to target happens automatically the moment `.env` is repointed in Phase 6. No manual `supabase functions deploy` required from the sandbox.

---

## 4. Required Secrets Inventory (target project)

Set in target Supabase dashboard → Edge Functions → Secrets BEFORE flipping `.env`:

| Secret | Required | Notes |
|---|---|---|
| `LOVABLE_API_KEY` | yes | Auto-provisioned by Lovable Cloud once target is connected. If using external Supabase, request via Lovable. |
| `ELEVENLABS_API_KEY` | yes | Copy from source secrets. |
| `MUNSIT_API_KEY` | optional (Arabic) | Copy if present on source. |
| `MUNSIT_BASE_URL` | optional | Defaults to `https://api.munsit.com`. |
| `MUNSIT_TTS_VOICE_ID` | optional (Arabic TTS) | Copy from source. |
| `MUNSIT_TTS_MODEL_ID` | optional | Defaults to `munsit-tts-1`. |

Auto-provided by Supabase runtime (do NOT set manually): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`.

---

## 5. Voice Pipeline Compatibility Audit

| Concern | Status |
|---|---|
| Edge functions use only `Deno.env.get(...)` | yes — no hard-coded refs to source project |
| `transcribe-voice` provider fallback chain (Munsit → ElevenLabs → Lovable Whisper) | preserved; gracefully degrades if optional secrets missing |
| `tts-reply` provider chain (Munsit AR → ElevenLabs → Lovable) | preserved |
| Client uses `supabase.functions.invoke(...)` (not raw `/api/...` paths) | confirmed in `src/lib/voice/*` |
| Storage upload via `chat-attachments` | bucket present on target |
| Audio MIME / size limits | unchanged (client-side) |

No code changes required for voice pipeline to run on target.

---

## 6. Frontend Wiring Audit (read-only)

- `src/integrations/supabase/client.ts` reads `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` — already env-driven; no code edit needed for cutover.
- `src/integrations/supabase/types.ts` is project-agnostic (Database type schema only). Will regenerate against target post-cutover if drift detected.
- No file imports a project ref string literal.

---

## 7. Cutover Steps (Phase 6 — DO NOT EXECUTE YET)

1. **Pre-flight:** Re-run `VERIFY_PHASE1.sql` on target → all green.
2. **Set secrets on target dashboard** (section 4).
3. **Configure auth providers + redirect URLs on target** (section 1).
4. **Announce maintenance window** (dev-stage; can be ≤2 min).
5. **Flip `.env`:**
   ```
   VITE_SUPABASE_PROJECT_ID="fsterbxivhhzipfgpvou"
   VITE_SUPABASE_URL="https://fsterbxivhhzipfgpvou.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="<target anon key from dashboard → API>"
   ```
6. **Trigger Lovable project rebind** to target (workspace → connected backend).
   Edge functions auto-redeploy to target on rebind.
7. **Hard reload preview** → clear localStorage (old JWT is for source).
8. **Smoke test** (section 8).
9. **Leave source untouched** as cold fallback ≥7 days.

---

## 8. Post-Cutover Smoke Test Checklist

- [ ] `/login` → email signup → profile row auto-created (trigger fires).
- [ ] `/login` → Google OAuth round-trip.
- [ ] `/` chat send → `chat` function 200 → message persisted.
- [ ] Voice record → `transcribe-voice` 200 → reply audio via `tts-reply`.
- [ ] `/doctor-login` → claim doctor role via `claim_doctor_bootstrap` RPC.
- [ ] `/doctor` loads dashboard, RLS allows clinician queries.
- [ ] Activities Hub loads (empty assets expected, no error).
- [ ] Storage upload (attachment) → file lands in `chat-attachments/<uid>/...`.

---

## 9. Rollback Plan

**Trigger:** any smoke-test step above fails OR runtime errors > 0 within 10 min.

**Action:** revert `.env` to:
```
VITE_SUPABASE_PROJECT_ID="dbgncklwmjjzncukhvgm"
VITE_SUPABASE_URL="https://dbgncklwmjjzncukhvgm.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZ25ja2x3bWpqem5jdWtodmdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5OTM0ODgsImV4cCI6MjA4ODU2OTQ4OH0.nCuKxYN7C5aR6z8i2aKAbYFCvKvX5djZEr67w5N-vZE"
```
+ rebind workspace back to source. Edge functions auto-redeploy back. Users clear localStorage. Source DB is untouched throughout, so zero data loss.

**Hard-rollback (target schema corruption):** drop+recreate target `public` schema → re-run `BOOTSTRAP_ALL.sql`. Source unaffected.

---

## 10. Readiness Score

| Dimension | Score | Note |
|---|---|---|
| Schema parity | 10 / 10 | Phase 1 verified all 23 tables, RLS, RPCs, R5/R6, doctor bootstrap. |
| Auth config | 0 / 10 | Manual step pending (providers + redirect URLs on target). |
| Secrets | 0 / 10 | Pending manual dashboard entry. |
| Edge functions | 8 / 10 | Code is project-agnostic; deploys automatically on rebind. |
| Storage | 10 / 10 | Bucket + policies verified. |
| Client wiring | 10 / 10 | Fully env-driven, no source ref hardcoded. |
| Voice pipeline | 10 / 10 | Provider fallbacks intact. |
| Rollback | 10 / 10 | Source untouched; flip-back is single `.env` revert. |

**Overall: 58 / 80 — BLOCKED on two manual dashboard tasks only:**
1. Configure auth providers + redirect URLs on target.
2. Set edge-function secrets on target.

Once both are green, score reaches **80 / 80** and Phase 6 (runtime cutover) is safe to execute.

---

## What is NOT done (per rules)

- `.env` unchanged.
- `client.ts` unchanged.
- `supabase/config.toml` unchanged (still pinned to legacy `project_id`; will retarget on rebind).
- No edge function deployed to target.
- No source backend touched.
- No client rebind triggered.
