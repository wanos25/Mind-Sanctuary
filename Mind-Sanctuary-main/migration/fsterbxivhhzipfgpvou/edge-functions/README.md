# Edge functions bundle

The four edge functions live unchanged in this repo at:

- `supabase/functions/chat/index.ts`
- `supabase/functions/reflect/index.ts`
- `supabase/functions/transcribe-voice/index.ts`
- `supabase/functions/tts-reply/index.ts`

To deploy them to `fsterbxivhhzipfgpvou`:

```bash
# in a fresh checkout
supabase link --project-ref fsterbxivhhzipfgpvou
supabase functions deploy chat             --no-verify-jwt
supabase functions deploy reflect          --no-verify-jwt
supabase functions deploy transcribe-voice --no-verify-jwt
supabase functions deploy tts-reply        --no-verify-jwt
```

Then set the secrets listed in `../README.md` §3.

No code changes are required — the functions only reference auto-injected
Supabase env vars and the secrets you set in §3.
