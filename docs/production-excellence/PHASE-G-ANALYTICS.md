# Phase G — Analytics Coverage Report

## Can measure today (client ring buffer)

| Metric | Event |
|--------|-------|
| Recovery generate | `auth.recovery_generate` |
| Recovery redeem | `auth.recovery_redeem` |
| Activity start/complete | `activity.start`, `activity.complete` |
| Chat stream | `chat.stream_completed`, `chat.stream_aborted` |
| Error boundaries | `app.error_boundary` |

## Cannot measure without backend sink

| Metric | Gap |
|--------|-----|
| DAU / MAU | Needs server aggregation |
| Auth failures | Not instrumented (auth flow untouched) |
| OAuth vs email split | Not instrumented |
| CBT vs spot vs video completion rates | Partial — `activity.complete` has `kind` |
| Doctor engagement | Not instrumented |
| Voice usage volume | Voice telemetry exists but not product dashboard |

## Recommended next step (post-launch)

- Nightly Edge Function: ingest `snapshotProductEvents()` batch to `analytics_aggregates`
- Or privacy-reviewed Plausible/PostHog with no PHI in event props
