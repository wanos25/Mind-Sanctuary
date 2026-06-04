# Frontend Runtime — LOCKED

> **Backend lockdown is in effect.**
> The sole valid backend for this project is **`fsterbxivhhzipfgpvou`**.
>
> All previous "fallback" / "rollback" / "alternate target" strategies
> documented in earlier revisions of this file are **revoked**.

---

## Locked configuration

`.env` must contain exactly:

```
VITE_SUPABASE_URL=https://fsterbxivhhzipfgpvou.supabase.co
VITE_SUPABASE_PROJECT_ID=fsterbxivhhzipfgpvou
VITE_SUPABASE_PUBLISHABLE_KEY=<fsterbxivhhzipfgpvou anon key>
```

`src/integrations/supabase/client.ts` reads these via `import.meta.env.*`
and constructs the client. No alternate-target wrapper, no `config.ts`
switch, no runtime override exists in the repo.

## What is forbidden

- Re-introducing any `dbgncklwmjjzncukhvgm`, `joqnptgangpdqhkqbfeq`, or
  `fnsabcjkkivzcytwxrsy` reference in runtime code, edge functions,
  `supabase/config.toml`, or `.env`.
- Adding a "backend switcher" / `TARGETS` map / fallback chain.
- Hardcoding any `*.supabase.co` URL outside `.env`.

A CI guard (`scripts/check-backend-lock.mjs`) fails the build if any of
the deprecated refs reappear in tracked files outside historical
migration notes.

## If the backend ever needs to change

Open a dedicated migration ticket. Do not edit `.env` or `client.ts` as
part of a polish / UX / refactor pass.
