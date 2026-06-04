# Phase B — Performance Report

## Before

| Metric | Value |
|--------|-------|
| Main entry chunk | ~2.64 MB (gzip ~759 KB) |
| Index route imports | 10 stages eager-loaded |
| React Query | Default refetch-on-focus |
| Three.js | Loaded with Dashboard/ClinicEntry in main graph |

## After

| Change | Expected gain |
|--------|----------------|
| Lazy `React.lazy` for stages (except login) | **Initial JS −15–25%** for users landing on login |
| `staleTime: 60s`, `refetchOnWindowFocus: false` | Fewer duplicate Supabase reads |
| Per-stage Suspense fallback | Faster TTI on cold load |

## Remaining hotspots

- **SessionChat** + voice pipeline still heavy when opened (expected)
- **DashboardScene** Three.js — consider GPU tier downgrade (already has `applyGpuTierToDocument`)
- **Framer Motion** on every stage transition — acceptable; respects `useReducedMotion` in runners

## Memory

- Stream `AbortController` (prior phase) + reflection timer cleanup — retained
- Global error/telemetry rings capped at 80–200 entries
