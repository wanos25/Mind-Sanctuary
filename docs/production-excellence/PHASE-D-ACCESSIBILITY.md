# Phase D — Accessibility Report

## Strengths

- `SkipToMain` skip link on all routes
- `useReducedMotion` in activity runners
- Voice player ARIA labels (partial)
- Route loading `role="status"` + `aria-live="polite"`
- RTL via `document.documentElement.dir`

## Applied improvements

| Area | Change |
|------|--------|
| ErrorBoundary | `role="alert"` + `aria-live="assertive"` |
| Spot Difference | Enter/Space on game board |
| Stage lazy load | Suspense fallback with `role="status"` |

## Gaps (documented, not redesigned)

| Area | Severity | Note |
|------|----------|------|
| Notes page | Medium | English hardcoded — screen reader language mix in AR |
| Mobile nav | Medium | No Notes tab |
| Login recovery | Low | Restore button needs dedicated `t()` key |
| Focus trap in modals | Low | Radix dialogs handle most cases |
