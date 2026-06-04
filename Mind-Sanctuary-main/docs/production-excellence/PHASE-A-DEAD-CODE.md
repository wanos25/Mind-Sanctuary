# Phase A — Dead Code Report

## Safe removals (applied)

| Item | Path | Root cause | Impact |
|------|------|------------|--------|
| Orphan page | `src/components/voice/VoiceModePage.tsx` | Never imported/routed | ~12 KB source removed |
| Unused hook | `src/hooks/useChannel.ts` | Realtime helper never wired | Zero references |
| Unused hook | `src/hooks/useLongPress.ts` | Replaced by VoiceRecorderButton internals | Zero references |
| Dead export | `streamChatWithRetry` in `streamChat.ts` | No callers | Smaller API surface |

## Risky — not removed

| Item | Reason |
|------|--------|
| `src/components/ui/*` (40+ shadcn primitives) | Used indirectly; dep scan required |
| `es.json`, `fr.json`, `it.json` | Loaded by i18n — intentional |
| `lovable-tagger` devDependency | Dev-only Vite plugin |
| `@react-three/*` | Dashboard/ClinicEntry 3D — product feature |
| `cmdk`, `vaul`, `input-otp` | Pulled in by UI kit components |

## Expected gain

- Cleaner mental model for contributors
- Marginal bundle reduction (orphan page was not in main chunk)
