# Production Audit — Mind Sentinel (`fsterbxivhhzipfgpvou`)

Audit date: 2026-06-03. Frontend + migration SQL reviewed; live Supabase dashboard not queried in this pass.

---

## 1. Security audit

### Findings

| Area | Status | Notes |
|------|--------|-------|
| RLS on user tables | Pass (design) | Sessions, messages, profiles, activities scoped by `auth.uid()` in migrations |
| Therapist notes | Pass (design) | Patient read own; doctor CRUD own notes; see `13_notes_and_recovery.sql` |
| Recovery RPC | Pass (design) | `redeem_anonymous_recovery_code` + `restore_anonymous_account` are SECURITY DEFINER; no raw code enumeration via SELECT |
| Service role in client | Pass | Only `VITE_SUPABASE_URL` + publishable key in client |
| OAuth metadata | Caution | Never use `user_metadata` for authorization (Supabase best practice) |
| Admin role changes | Caution | `UserManagement` can grant `doctor` only when caller is `admin` — verify RLS on `user_roles` in production |
| Edge function secrets | Required | `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `LOVABLE_API_KEY`, `ELEVENLABS_API_KEY`, optional Munsit keys |

### Recommendations

1. Run `migration/fsterbxivhhzipfgpvou/sql/13_notes_and_recovery.sql` and `20260603140000_anonymous_recovery_transfer.sql` if not applied.
2. Confirm `handle_new_user` trigger (`20260603120000_fix_handle_new_user.sql`) is live — fixes signup/OAuth profile creation.
3. Enable leaked-password protection and email confirmation in Supabase Auth for production email users.
4. Audit `has_role()` helper exists and is used by doctor policies.

---

## 2. Performance audit

### Findings

| Area | Status | Notes |
|------|--------|-------|
| Route code-splitting | Pass | `/doctor`, `/activities`, `/diagnostics` lazy-loaded in `App.tsx` |
| Activity runners | Pass | Lazy imports in `ActivitiesHub.tsx` |
| Main bundle | Caution | `index-*.js` ~2.6MB / ~754KB gzip — acceptable for demo; consider manual chunks later |
| 3D dashboard | Caution | `DashboardScene` lazy; disabled on low GPU tier via `applyGpuTierToDocument` |
| Auth hydration | Pass | Waits for `INITIAL_SESSION` before routing |
| Video progress | Pass | Debounced persistence in `EducationalVideo` |

### Recommendations

1. Run `npx update-browserslist-db@latest` periodically.
2. Monitor edge function cold starts for `chat` and `tts-reply`.
3. Consider `manualChunks` for three.js if bundle size becomes a blocker.

---

## 3. Route audit

| Path | Component | Auth | Notes |
|------|-----------|------|-------|
| `/` | `Index` (stage router) | Session gate | Login → dashboard via `useAuthSessionGate` |
| `/activities` | `Activities` | Requires user | Shared `AuthProvider` at app root |
| `/doctor-login` | `DoctorLogin` | Public | Clinician sign-in |
| `/doctor` | `DoctorPortal` | `useUserRole` doctor/admin | Role-gated UI |
| `/diagnostics` | `Diagnostics` | Dev/diag | Restrict in production if needed |
| `*` | `NotFound` | Public | |

No orphan routes detected. Catch-all is last in `App.tsx`.

---

## 4. Admin / clinician audit

| Capability | Mutates user data? | Notes |
|------------|-------------------|-------|
| Patient list / workspace | Read-only queries | Transcript, sessions, activities tabs |
| Crisis queue | Status updates only | Scoped to crisis_flags |
| Content manager | Writes activity assets | Intentional clinician tool |
| User management | Role grant/revoke | Admin only for doctor role toggle |
| Review actions | Writes review records | Clinician workflow |

Patient chat content is not editable from portal — aligned with read-only clinical review.

---

## 5. Activities audit

| Check | Status |
|-------|--------|
| Lazy runner load | Pass |
| ErrorBoundary per runner | Pass |
| React hooks order (active runner) | Pass — regression test |
| ARIA regions / live regions | Pass (Phase 7) |
| RLS on `activity_sessions` | Pass (user_id scoped) |

---

## 6. Unresolved / manual verification

- [ ] Google OAuth redirect URL in Supabase + Google Cloud Console
- [ ] Facebook App ID/secret + `email`, `public_profile` scopes
- [ ] SQL migrations applied on `fsterbxivhhzipfgpvou`
- [ ] Edge functions deployed: `chat`, `tts-reply`, `transcribe-voice`, `reflect`
- [ ] E2E: Google login → dashboard
- [ ] E2E: Anonymous signup → recovery modal → redeem on second device
- [ ] E2E: Open each activity type once
