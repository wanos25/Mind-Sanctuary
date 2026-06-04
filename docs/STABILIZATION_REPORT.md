# Mind Sentinel — Stabilization Report (Pre-R6/R7)

Date: 2026-05-20
Scope: append-only hardening pass after R1–R6 foundation. No backend rewiring,
no destructive SQL, no behavior changes.

## 1. Runtime audit

| Area                  | Status | Notes |
|-----------------------|--------|-------|
| Routes (`/`, `/diagnostics`, `/doctor`, `/activities`, `*`) | OK | All wrapped in per-route ErrorBoundary. |
| Auth/session          | OK | `onAuthStateChange` set up before `getSession()` in `AuthContext`. |
| Doctor portal         | OK | Role gate via `useUserRole` → `user_roles` (SECURITY DEFINER `has_role`). |
| Activities hub        | OK | Runners now lazy-loaded, wrapped in Suspense + ErrorBoundary. |
| Voice pipeline        | OK | Orchestrator, recorder, providers, telemetry intact. No regressions in 30/30 tests. |
| Edge functions        | OK | `chat`, `reflect`, `transcribe-voice`, `tts-reply` deployed; CORS verified. |
| Storage access        | OK | Buckets governed by RLS; no client-side admin keys. |
| RTL / i18n            | OK | 5 locales (en, ar, es, fr, it); locale-parity CI artifact in place. |
| Theme switching       | OK | All 3 themes (light/dark/sanctuary) use HSL tokens. |
| Mobile responsiveness | OK | Tailwind responsive classes; no h-screen regressions found. |
| ClinicEntry 3D intro  | UNTOUCHED (per immutable lock). |

## 2. Type-safety cleanup

Remaining `: any` usage (4 files, low-risk):
- `src/pages/DoctorPortal.tsx` (3) — Supabase escape-hatch reads against `profiles` / `sessions` not in generated types yet.
- `src/components/ui/RadialClock.tsx` (2) — D3-style coercions.
- `src/hooks/useSpeechSynthesis.ts` (1) — vendor SpeechSynthesis quirks.
- `src/components/VoiceInput.tsx` (1) — MediaRecorder polyfill.

All documented as intentional. Migration path: regenerate `integrations/supabase/types.ts`
after next schema sync — `sbExt` wrapper at `src/lib/supabaseExt.ts` is the
single canonical escape hatch for new tables.

## 3. Performance pass

- **ActivitiesHub:** runners now `React.lazy` — initial bundle no longer ships
  CBTFlow, ImageInterpretation, EducationalVideo, SpotDifference.
- **MessageBubble:** memoized via FNV-1a + exact-equality fallback (Pass 4).
- **Waveform / VoicePlayer:** shimmer is playhead-local; decode is on-demand.
- **DoctorPortal queries:** patient list cap = 100, sessions cap = 500 with
  client-side aggregation — acceptable for current scale; revisit at >1k patients.

## 4. Error boundary + recovery

Added `src/components/ui/ErrorBoundary.tsx` (theme-aware, structured console
log, retry CTA). Coverage:
- `app-root` (entire tree)
- `route:index`, `route:diagnostics`, `route:doctor`, `route:activities`
- `activity:<kind>` per runner (with Suspense fallback)

Existing inline try/catch + toast surfaces in voice pipeline and chat send
remain — no silent failures detected.

## 5. Accessibility

- Keyboard nav: shadcn primitives provide full Radix a11y.
- Screen-reader labels: icon-only Buttons reviewed in DoctorPortal/TopNav — all carry text or `aria-label`.
- Focus: Radix Dialog/DropdownMenu manage focus traps natively.
- Contrast: tokens use HSL with verified AA across light/dark/sanctuary.
- RTL: `dir="rtl"` toggle via `useDirection` hook; `me-/ms-` logical classes
  used throughout new code.

## 6. Production observability

- `src/lib/voice/telemetry.ts` + `metricsAggregator.ts` — voice stage timings preserved.
- `ErrorBoundary` logs `{label, message, stack, componentStack}` — ready to
  forward to telemetry sink without code changes (add `onError` prop).
- Diagnostics page (`/diagnostics`) consistent; ArabicVoiceFlowTest + StageTimeline + TelemetryDashboard intact.

## 7. Security / RLS audit (static review)

Verified via `db/manual/` + `migration/.../sql/06_rls.sql`:
- `profiles`, `sessions`, `messages`, `user_roles`, `activity_assets`, `activity_sessions`, `emotional_memories`, `memory_relationships`, `doctor_reviews`, `crisis_events` — all RLS enabled.
- `user_roles` self-read policy only; role escalation prevented (no client INSERT path).
- Doctor-only policies use `public.has_role(auth.uid(), 'doctor' | 'admin')`.
- Patient isolation: every patient-owned table filters by `user_id = auth.uid()`.
- Anonymous sign-in is intentional (privacy-first onboarding) and scoped by `auth.uid()`.

No new public-read surfaces introduced this pass.

## 8. Schema / docs inventory

Active migrations: `migration/fsterbxivhhzipfgpvou/sql/01..09_*.sql` (extensions,
enums, functions, tables, indexes, rls, triggers, storage, realtime). Manual
deltas: `db/manual/R4a_doctor_portal_foundations.sql`, `R4b_doctor_review_crisis.sql`.

Edge-function secrets (runtime): `LOVABLE_API_KEY`, `MUNSIT_API_KEY` (Arabic STT),
plus standard `SUPABASE_*`. No new secrets required this pass.

Rollback notes: every change in this pass is additive. To revert:
1. Remove `src/components/ui/ErrorBoundary.tsx`.
2. Restore previous `src/App.tsx` (unwrap routes).
3. Restore eager imports in `src/components/activities/ActivitiesHub.tsx`.
No DB migration to roll back.

## 9. Verification

- `tsc --noEmit`: clean.
- `vitest run`: 30/30 passing.
- Locale-parity CI: configured (`.github/workflows/ci.yml`).
- No new dependencies.

## 10. Remaining technical debt

- Regenerate Supabase `types.ts` and remove `sbExt` casts in DoctorPortal once schema is synced.
- DoctorPortal patient aggregation should move server-side (RPC or materialized view) before scaling past ~1k patients.
- Consider lazy-loading 3D scene modules (`TherapyRoomBackground`, `DashboardScene`) on routes that don't need them.
- Wire `ErrorBoundary.onError` to a telemetry sink (Sentry / custom edge function) when observability backend is chosen.
- Add e2e smoke (Playwright) for: anon sign-in → chat send → voice record → activity start → doctor login.

## 11. Production-readiness estimate

**Green-light for soft production launch** with current feature surface.
Blockers for hard launch:
1. Telemetry sink wired to ErrorBoundary (currently console-only).
2. DoctorPortal server-side aggregation (perf at scale).
3. e2e smoke suite in CI.

Everything else is polish or future-pass scope. Safe to proceed to R6/R7
planning.
