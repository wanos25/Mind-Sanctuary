# Production Excellence — Audit Plan

## Scope

Post-launch hardening only: reliability, maintainability, performance, observability, security, scalability. **No feature or UX redesign.**

## Phases

| Phase | Focus | Execution risk |
|-------|--------|----------------|
| A | Dead code scan + safe removal | Low |
| B | Bundle splitting, QueryClient defaults | Low–Medium |
| C | Upload limits, headers, stream validation | Low |
| D | A11y (aria-live, focus) | Low |
| E | Global errors + product telemetry ring | Low |
| F | Disaster recovery documentation | None (docs) |
| G | Analytics coverage + lightweight events | Low |
| H | Smoke test matrix | None (docs) |

## Files likely affected

- `src/pages/Index.tsx` — lazy stage imports
- `src/main.tsx` — global error handlers
- `src/App.tsx` — QueryClient defaults
- `src/lib/uploadAttachment.ts`, `src/lib/voice/upload.ts` — size limits
- `src/lib/streamChat.ts` — payload guards
- `src/components/ui/ErrorBoundary.tsx` — telemetry hook
- `src/lib/observability/*` — new modules
- `index.html`, `public/_headers` — security meta/headers
- **Removals:** `VoiceModePage.tsx`, `useChannel.ts`, `useLongPress.ts`, `streamChatWithRetry`

## Out of scope (explicit)

- Auth / recovery / OAuth behavior
- Schema migrations
- `activity-media` bucket (separate from chat-attachments)
- Removing unused Radix/shadcn primitives (risky without dep scan)
- External Sentry/Datadog SDK (document integration path only)

## Target

Production readiness **≥ 95/100** after SQL/deploy verification unchanged from prior phase.
