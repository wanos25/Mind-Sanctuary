# Phase E — Error Tracking Architecture

## Layers

```
Browser
├── installGlobalErrorHandlers()     → window error + unhandledrejection
├── ErrorBoundary (per route/stage)  → React render errors
├── notifyError() ring               → classified app errors + optional toast
├── productTelemetry ring            → product events (privacy-safe)
└── voice telemetry ring             → voice/stream diagnostics (existing)

Edge functions
├── requireAuth()                    → JWT gate
└── console.info structured logs     → request metadata
```

## Modules

| File | Purpose |
|------|---------|
| `src/lib/observability/globalErrors.ts` | Global capture + 80-entry ring |
| `src/lib/observability/productTelemetry.ts` | Product events + 200-entry ring |
| `src/lib/reliability/notifyError.ts` | Existing unified notifier |

## Export for production sink

```typescript
import { snapshotGlobalErrors } from '@/lib/observability/globalErrors';
import { snapshotProductEvents } from '@/lib/observability/productTelemetry';

// Forward to Sentry/Datadog on interval or beforeunload
```

## User-facing guarantee

- Error boundaries show recoverable card — no white screen
- Global errors logged; app continues when possible
