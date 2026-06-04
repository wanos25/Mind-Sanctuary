# Phase F — Disaster Recovery Report

## 1. Supabase Postgres outage

| Impact | App cannot auth, read/write data |
| Fallback | Cached UI may render; all data operations fail |
| Recovery | Status page; retry when Supabase green; no data loss if outage < RPO |

## 2. Edge function outage

| Impact | Chat AI, voice STT/TTS, reflect fail |
| Fallback | Client shows toast; messages may save without AI reply |
| Recovery | Redeploy functions; multi-provider failover in `chat` edge |

## 3. Storage outage

| Impact | Uploads/playback fail |
| Fallback | Chat text-only; voice shows error |
| Recovery | Restore bucket policies; re-sign URLs |

## 4. Migration failure

| Impact | Deploy blocked or partial schema |
| Recovery | Idempotent migrations; manual SQL in `migration/fsterbxivhhzipfgpvou/sql/` |
| Procedure | Never run destructive SQL; verify with `VERIFY_PHASE1.sql` |

## 5. Broken AI provider

| Impact | All providers fail → empty stream |
| Fallback | `chat` edge returns graceful JSON error |
| Recovery | Rotate API keys; Groq/OpenRouter/Gemini chain |

## 6. Invalid environment variables

| Impact | Client cannot init Supabase |
| Detection | Build-time `VITE_SUPABASE_*` required |
| Recovery | Fix `.env` / hosting secrets; redeploy |

## RTO/RPO (recommended ops targets)

- **RTO:** 4 hours (redeploy + SQL verify)
- **RPO:** 24 hours (Supabase daily backups — confirm plan tier)
