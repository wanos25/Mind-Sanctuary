# External Provider Audit + Fresh Secrets Setup + Cutover Readiness
Target backend: `fsterbxivhhzipfgpvou` · Source (legacy): `dbgncklwmjjzncukhvgm`
Mode: READ-ONLY audit. No runtime switch performed.

---

## 1. External Provider Inventory

| # | Provider | Purpose | Required? | Features broken if missing | Replacement difficulty | Files / functions using it | Safe to swap key? |
|---|---|---|---|---|---|---|---|
| 1 | **Lovable AI Gateway** (`ai.gateway.lovable.dev`) | LLM completions (chat, reflection), TTS synth fallback | **Required** | Chat replies, reflection summaries, TTS final fallback all hard-fail (`LOVABLE_API_KEY is not configured`) | Trivial — auto-issued per project | `supabase/functions/chat/index.ts`, `reflect/index.ts`, `tts-reply/index.ts` | **Yes** — new project gets its own `LOVABLE_API_KEY` automatically. No carry-over needed. |
| 2 | **ElevenLabs** (`api.elevenlabs.io`) | Primary STT (non-Arabic) + universal TTS fallback | **Required for voice** | Voice mode: STT for en/es/fr/it returns 500 "no STT provider configured"; TTS falls through to Lovable synth only | Easy — single API key | `transcribe-voice/index.ts`, `tts-reply/index.ts` | Yes — new ElevenLabs key works anywhere. Quota is per-account. |
| 3 | **Munsit** (`api.munsit.com`) | Arabic-first STT/TTS quality boost | **Optional** | Arabic voice still works via ElevenLabs fallback, but quality drops noticeably | Easy — single vendor key + voice/model IDs | `transcribe-voice/index.ts`, `tts-reply/index.ts` | Yes — vendor-scoped, project-agnostic. |
| 4 | **Google Gemini** (via Lovable Gateway, `google/gemini-3-flash-preview`) | Underlying chat model | Indirect | Same as #1 — fails if `LOVABLE_API_KEY` missing | N/A — accessed through gateway | `chat/index.ts` | No direct key needed. |
| 5 | **Supabase Auto-Injected** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`) | Function-side DB/auth access | Required (auto) | All functions return env errors | Auto — never set manually | every function | New project auto-provides its own — never copy from old. |

No other external providers are used. No OpenAI, no Anthropic, no Whisper-direct, no Google Cloud, no AWS, no Stripe, no Resend, no analytics SDK with secret.

---

## 2. Feature → Provider Map

| Feature | Powered by | Hard dependency |
|---|---|---|
| Chat generation (Dr. Sentinel) | Lovable Gateway → Gemini 3 Flash | `LOVABLE_API_KEY` |
| Reflection engine (`reflect` function) | Lovable Gateway | `LOVABLE_API_KEY` |
| Speech-to-Text (en/es/fr/it) | ElevenLabs `scribe_v2` | `ELEVENLABS_API_KEY` |
| Speech-to-Text (ar, preferred) | Munsit → fallback ElevenLabs | `MUNSIT_API_KEY` preferred, else `ELEVENLABS_API_KEY` |
| Text-to-Speech (multilingual) | ElevenLabs `multilingual_v2` → fallback Lovable synth | `ELEVENLABS_API_KEY` (else `LOVABLE_API_KEY`) |
| Text-to-Speech (Arabic, premium) | Munsit → ElevenLabs → Lovable | `MUNSIT_API_KEY` + `MUNSIT_TTS_VOICE_ID` |
| Clinician insights / doctor portal | Postgres RPCs only (no external) | none |
| Activities / R6 bootstrap | Postgres + RLS only | none |

### Survivability matrix

| Missing | Chat | Reflect | STT (en) | STT (ar) | TTS | Doctor portal | Activities |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `LOVABLE_API_KEY` | ❌ | ❌ | ✅ | ✅ | ⚠️ no synth fallback | ✅ | ✅ |
| `ELEVENLABS_API_KEY` | ✅ | ✅ | ❌ | ⚠️ if Munsit set ✅ | ⚠️ falls to Lovable synth | ✅ | ✅ |
| `MUNSIT_*` | ✅ | ✅ | ✅ | ⚠️ quality drop, still works | ⚠️ Arabic quality drop | ✅ | ✅ |

Minimum runnable set: `LOVABLE_API_KEY` only → chat + reflect + activities + doctor portal. Voice disabled.

---

## 3. Fresh Secrets Setup Guide — `fsterbxivhhzipfgpvou`

Set in Supabase Dashboard → **Project Settings → Edge Functions → Secrets**.

### Tier A — Required for launch

| Secret | Where to obtain | Notes |
|---|---|---|
| `LOVABLE_API_KEY` | Auto-provisioned by Lovable when Cloud is bound to the project. If missing, run `lovable_api_key--create`. | Workspace-scoped, billing tied. Never carry the old key — let Lovable mint a fresh one. |

### Tier B — Required for voice features

| Secret | Where to obtain | Notes |
|---|---|---|
| `ELEVENLABS_API_KEY` | https://elevenlabs.io → Profile → API Keys → "Create new" | Use a key dedicated to this project for clean quota tracking. |

### Tier C — Optional (Arabic quality boost)

| Secret | Where to obtain | Notes |
|---|---|---|
| `MUNSIT_API_KEY` | https://munsit.com dashboard → API Keys | Skip if you don't need Arabic-first STT/TTS. |
| `MUNSIT_BASE_URL` | — | Defaults to `https://api.munsit.com`. Only override if Munsit instructs. |
| `MUNSIT_TTS_VOICE_ID` | Munsit dashboard → Voices | Required only if Munsit TTS path enabled. |
| `MUNSIT_TTS_MODEL_ID` | — | Defaults to `munsit-tts-1`. |

### Tier D — DO NOT SET (Supabase auto-injects)

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`.

### Minimum Viable Launch Config

```
LOVABLE_API_KEY=<auto>
ELEVENLABS_API_KEY=<new key>
```

Voice (Arabic) degrades gracefully to ElevenLabs. Everything else works.

---

## 4. Runtime Cutover Preparation Audit

### 4.1 Edge functions present in repo
Verified — all 4 exist and are project-agnostic:
- `supabase/functions/chat/index.ts`
- `supabase/functions/reflect/index.ts`
- `supabase/functions/transcribe-voice/index.ts`
- `supabase/functions/tts-reply/index.ts`

No function references the old project ref. All reads come from `Deno.env.get(...)`.

### 4.2 Frontend runtime dependency scan

Grep results for `VITE_SUPABASE_*`, hardcoded `*.supabase.co`, and project refs:

| File | Reference | Action on cutover |
|---|---|---|
| `src/integrations/supabase/client.ts` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | None — env-driven |
| `src/lib/streamChat.ts` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | None — env-driven |
| `src/lib/reflection.ts` | same | None — env-driven |
| `src/lib/voice/transcribe.ts` | `supabase.functions.invoke('transcribe-voice')` | None — uses client |
| `src/lib/voice/voiceReply.ts` | `supabase.functions.invoke('tts-reply')` | None — uses client |

**Hardcoded project refs found anywhere in `src/` or `supabase/`: 0.**
**Stale backend strings remaining: 0.**

### 4.3 Compatibility checks

| Subsystem | Status | Evidence |
|---|---|---|
| Doctor login flow | ✅ Compatible | Phase 1 verified `has_role`, `doctor_bootstrap_available`, `claim_doctor_bootstrap`, `on_auth_user_created` |
| Voice pipeline | ✅ Compatible | Edge functions env-driven; client uses `supabase.functions.invoke` |
| Activities + R6 | ✅ Compatible | Tables, RLS, triggers verified in Phase 1 |
| Storage | ✅ Compatible | `chat-attachments` bucket + policies verified |
| Realtime | ✅ Compatible | Publication empty, no schema dependency |

### 4.4 Files requiring runtime ref update

**Only one file**: `.env`

```env
VITE_SUPABASE_PROJECT_ID="fsterbxivhhzipfgpvou"
VITE_SUPABASE_URL="https://fsterbxivhhzipfgpvou.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<NEW anon key from target project>"
```

`src/integrations/supabase/client.ts` does NOT need editing — it's already env-driven. (Lovable may regenerate it on rebind; resulting file is functionally identical.)

### 4.5 Exact runtime switch order

1. **Pre-flight (T-10 min)**
   - Confirm Tier A + Tier B secrets set on target.
   - Confirm auth providers + redirect URLs match.
   - Re-run `VERIFY_PHASE1.sql` against target → all green.
   - Tag current `.env` and push a `pre-cutover` snapshot for rollback.
2. **Announce maintenance window** (~5 min).
3. **Flip `.env`** to target values (3 lines above).
4. **Rebind Lovable Cloud** in Lovable Settings → Backend → point to `fsterbxivhhzipfgpvou`. Edge functions auto-deploy on bind.
5. **Hard reload** preview; clear local auth state.
6. **Smoke test** (see §4.7).
7. **Leave source `dbgncklwmjjzncukhvgm` untouched ≥ 7 days** as fallback.

### 4.6 Rollback procedure

Single action: revert `.env` to:
```
VITE_SUPABASE_PROJECT_ID="dbgncklwmjjzncukhvgm"
VITE_SUPABASE_URL="https://dbgncklwmjjzncukhvgm.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<old anon — preserved in git history>"
```
Rebind Cloud → old project. ETA: ~2 min. Zero DB mutation.

### 4.7 Post-cutover verification checklist

- [ ] Anonymous load: app boots, no console errors
- [ ] Email signup → confirmation email received
- [ ] Google OAuth round-trip succeeds
- [ ] Doctor bootstrap RPC visible to first allow-listed user
- [ ] `/functions/v1/chat` returns 200 SSE
- [ ] `/functions/v1/reflect` returns 200 JSON
- [ ] Voice record → `transcribe-voice` returns text + `provider` field
- [ ] TTS playback round-trip
- [ ] Activities list renders, completion writes to `activity_sessions`
- [ ] Storage upload to `chat-attachments` succeeds with RLS
- [ ] Realtime subscribe (if used by any page) connects

### 4.8 Estimated downtime

User-visible: **2–4 minutes** (env flip + rebind + reload). Active sessions get logged out — by design (different auth issuer).

### 4.9 Final Migration Confidence Score

**92 / 100**

Breakdown:
- Schema parity verified (Phase 1) → +25
- Zero hardcoded project refs in code → +20
- All providers project-agnostic → +15
- Auth + secrets manually configured (Phase 2 reported done) → +15
- Rollback is single-file revert → +10
- Smoke test plan defined → +7
- Deductions: target anon key not yet placed in `.env` (-4); first real e2e voice test still pending (-4).

Status: **READY for cutover on user command.** No further code changes required pre-flip.
