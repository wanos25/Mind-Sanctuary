# Edge-Function Compatibility Audit — `fsterbxivhhzipfgpvou`

Scope: the four production functions copied from this repo —
`chat`, `reflect`, `transcribe-voice`, `tts-reply`.

---

## 1. Secret matrix

Set in Supabase Dashboard → **Project Settings → Edge Functions → Secrets**.

| Secret | chat | reflect | transcribe-voice | tts-reply | Required? |
|---|:-:|:-:|:-:|:-:|---|
| `LOVABLE_API_KEY`         | ✅ | ✅ |   | ✅ | **Yes** for AI replies + reflection + non-Munsit TTS path. Cloud-issued; reusable from your new project. |
| `ELEVENLABS_API_KEY`      |   |   | ✅ | ✅ | **Yes** for voice. Non-Arabic STT primary + universal TTS fallback. |
| `MUNSIT_API_KEY`          |   |   | ✅ | ✅ | Optional. Required only if you want Arabic-first STT/TTS quality. |
| `MUNSIT_BASE_URL`         |   |   | ✅ | ✅ | Optional. Defaults to `https://api.munsit.com`. |
| `MUNSIT_TTS_VOICE_ID`     |   |   |   | ✅ | Required only if Munsit TTS path is enabled. |
| `MUNSIT_TTS_MODEL_ID`     |   |   |   | ✅ | Optional. Defaults to `munsit-tts-1`. |

**Auto-injected by Supabase (do not set):**
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`.

---

## 2. Missing env vars on a fresh `fsterbxivhhzipfgpvou`

When you create the project, **none** of the table above exist yet. Minimum
set to make the app functional matches what's enabled today on Cloud:

```
LOVABLE_API_KEY          # required for chat / reflect / tts-reply
ELEVENLABS_API_KEY       # required for any voice round-trip
MUNSIT_API_KEY           # optional — Arabic-first
MUNSIT_TTS_VOICE_ID      # only if Munsit TTS enabled
```

The functions degrade gracefully:
- `transcribe-voice` returns `no STT provider configured` (500) if neither
  ElevenLabs nor Munsit is set.
- `tts-reply` falls back from Munsit → ElevenLabs → LovableAI synth as keys
  become available.
- `chat` / `reflect` hard-fail with `LOVABLE_API_KEY is not configured` if
  missing.

---

## 3. Provider dependencies

| Provider | Used in | Cloud-only? | Action for new project |
|---|---|:-:|---|
| **Lovable AI Gateway** (`ai.gateway.lovable.dev`) | `chat`, `reflect`, `tts-reply` synth fallback | No — gateway accepts the key from any host | Just set `LOVABLE_API_KEY`. |
| **ElevenLabs** (`api.elevenlabs.io`) | `transcribe-voice` (scribe_v2 STT), `tts-reply` (multilingual_v2 TTS) | No | Set `ELEVENLABS_API_KEY`. |
| **Munsit** (`api.munsit.com`) | Arabic-first STT/TTS | No | Set Munsit secrets only if you want ar-quality boost. |
| **OpenAI** | Not used directly | — | No action. The repo references "OpenAI/Gemini direct" only as a future migration option. |
| **Google Gemini** | Used **via** Lovable Gateway (`google/gemini-3-flash-preview`) | Indirect | No direct key needed unless you swap off the gateway. |

No function reads from Supabase Storage or DB beyond auto-injected
credentials — there is **no Cloud-specific URL hardcoded** anywhere.

---

## 4. Cloud-only assumptions found

Code grep (`Deno.env.get` + URL literals):

| Assumption | File | Cloud-only? | Verdict |
|---|---|:-:|---|
| `ai.gateway.lovable.dev` endpoint | `chat`, `reflect`, `tts-reply` | Multi-tenant gateway, not Cloud-only | OK — works from any Supabase project as long as `LOVABLE_API_KEY` is valid. |
| `api.elevenlabs.io`, `api.munsit.com` | voice functions | No | OK. |
| `SUPABASE_*` auto-injected vars | all | Auto-injected per project | OK — new project gets its own. |
| `--no-verify-jwt` at deploy time | docs | Cloud parity choice | OK — keep, or tighten later. |
| Storage bucket name `chat-attachments` | none in functions (client-side only) | Bucket exists in `sql/08_storage.sql` | OK. |

**Result: zero Cloud-only hardcoding.** The functions are portable.

---

## 5. Deploy order

```bash
supabase link --project-ref fsterbxivhhzipfgpvou
# Set secrets first so cold starts don't crash:
supabase secrets set LOVABLE_API_KEY=... ELEVENLABS_API_KEY=...
# Optional:
supabase secrets set MUNSIT_API_KEY=... MUNSIT_TTS_VOICE_ID=...

supabase functions deploy chat             --no-verify-jwt
supabase functions deploy reflect          --no-verify-jwt
supabase functions deploy transcribe-voice --no-verify-jwt
supabase functions deploy tts-reply        --no-verify-jwt
```

Verify with curl:

```bash
curl -i -X POST "https://fsterbxivhhzipfgpvou.supabase.co/functions/v1/chat" \
  -H "Content-Type: application/json" \
  -H "apikey: $DST_ANON_KEY" \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
```

Expect HTTP 200 + `text/event-stream`.

---

## 6. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `LOVABLE_API_KEY` rate limit when shared across Cloud + new project | Low | Rotate via `lovable_api_key--rotate_lovable_api_key`. |
| ElevenLabs quota drained by voice tests | Low | Use short clips during validation. |
| Munsit endpoint change | Low | `MUNSIT_BASE_URL` is an env override. |
| Function deploy fails due to stale `deno.lock` | Low | Delete `deno.lock` if present. |
