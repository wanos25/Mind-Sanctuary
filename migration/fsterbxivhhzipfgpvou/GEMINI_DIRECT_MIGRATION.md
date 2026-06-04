# Direct Gemini API Migration — `fsterbxivhhzipfgpvou`

The runtime no longer depends on the Lovable AI Gateway or `LOVABLE_API_KEY`.
All LLM calls now hit Google's Gemini API directly via its OpenAI-compatible
endpoint, which preserves the existing SSE streaming + chat-completions
request/response shape with zero client-side changes.

## What changed

| File | Before | After |
|---|---|---|
| `supabase/functions/chat/index.ts` | `ai.gateway.lovable.dev` + `LOVABLE_API_KEY` + `google/gemini-3-flash-preview` | `generativelanguage.googleapis.com/v1beta/openai/chat/completions` + `GEMINI_API_KEY` + `gemini-2.5-flash` |
| `supabase/functions/reflect/index.ts` | same gateway | same direct endpoint |
| `supabase/functions/tts-reply/index.ts` (paraphrase step) | same gateway | same direct endpoint |
| `supabase/functions/transcribe-voice/index.ts` | unchanged (ElevenLabs + Munsit) | unchanged |

Frontend (`src/lib/streamChat.ts`, `useVoicePipeline`, telemetry, reply
context, Arabic flow) is **untouched** — the SSE chunk shape
`choices[0].delta.content` is identical between the Lovable Gateway and the
Google OpenAI-compatible endpoint.

## Required secrets on `fsterbxivhhzipfgpvou`

```
GEMINI_API_KEY        # Google AI Studio key
ELEVENLABS_API_KEY    # STT + TTS
MUNSIT_API_KEY        # optional, Arabic STT/TTS
MUNSIT_TTS_VOICE_ID   # optional, only if you want Munsit TTS
```

`LOVABLE_API_KEY` is no longer read anywhere and can be removed.

## Deployment

```bash
supabase link --project-ref fsterbxivhhzipfgpvou
supabase secrets set GEMINI_API_KEY=<value>
supabase secrets set ELEVENLABS_API_KEY=<value>
# optional:
supabase secrets set MUNSIT_API_KEY=<value> MUNSIT_TTS_VOICE_ID=<value>

supabase functions deploy chat             --no-verify-jwt
supabase functions deploy reflect          --no-verify-jwt
supabase functions deploy tts-reply        --no-verify-jwt
supabase functions deploy transcribe-voice --no-verify-jwt
```

## Verification checklist

1. **Chat streaming (EN)** — send a message in the app; tokens stream in
   word-by-word. Network tab shows `200` from `/functions/v1/chat` with
   `content-type: text/event-stream`.
2. **Chat streaming (AR)** — repeat in Arabic; RTL renders correctly,
   stream completes, reply context preserved.
3. **Reflection** — assistant reply triggers `/functions/v1/reflect`,
   returns a 1–2 sentence reflection.
4. **Voice STT** — record voice → `/functions/v1/transcribe-voice` returns
   `{ text, provider }`. Arabic prefers `munsit`, others `elevenlabs`.
5. **Voice TTS** — `/functions/v1/tts-reply` returns
   `{ paraphrase, audioBase64, provider }`; audio plays back.
6. **Error paths** — temporarily unset `GEMINI_API_KEY` → chat returns
   `500 "GEMINI_API_KEY is not configured"`. Restore and confirm recovery.
7. **No old references** — `rg "LOVABLE_API_KEY|ai\.gateway\.lovable"`
   over `src/` and `supabase/` returns zero matches.

## Model choice

`gemini-2.5-flash` is the closest 1:1 replacement for the previous
`google/gemini-3-flash-preview` (latency, streaming behavior, multilingual
quality including Arabic). To swap models later, change the single `model`
string in each of the three edge functions — nothing else.
