# Phase C — Security Audit Report

## Applied fixes

| Severity | Issue | Fix |
|----------|-------|-----|
| High | No upload size cap | 10 MB attachments, 8 MB voice |
| High | Dangerous extensions | Block `.exe`, `.html`, `.js`, etc. |
| Medium | Chat payload abuse | Max 80 messages; edge rejects >80 |
| Medium | Missing security headers | `public/_headers` + index meta |
| Low | Stale branding in HTML | Mind Sentinel title/meta |

## Already hardened (prior phase)

- Edge JWT on chat/reflect/transcribe/tts
- Private `chat-attachments` + signed URLs
- Recovery RPC restricted to authenticated
- Doctor/admin RLS via `is_clinical_staff()`

## Residual findings

| Severity | Issue | Recommendation |
|----------|-------|----------------|
| Medium | `activity-media` public bucket | Make private + signed URLs (doctor CMS) |
| Medium | ReactMarkdown without raw HTML | OK — no `rehype-raw`; XSS risk low |
| Medium | AI prompt injection | User content in system addenda — bounded by `replyContext` sanitizer; monitor abuse |
| Low | No server-side rate limit on edge | Add Supabase/WAF rate limits in dashboard |
| Low | HSTS | Configure at CDN (not in static `_headers` alone) |

## Auth (verified, not modified)

- Session via Supabase PKCE — no fixation path found
- OAuth/recovery flows unchanged per requirements
