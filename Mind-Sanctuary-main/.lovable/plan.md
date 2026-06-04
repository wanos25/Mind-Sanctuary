# Phase 4 + Phase 5 — Data Integrity Hardening & Advanced Integration

Backend lock: `fsterbxivhhzipfgpvou` (verified). Additive-only. No schema applied. No env touched.

This pass is intentionally surgical: Layers 1+2 and Phase 3 already shipped the bulk of the chat-hierarchy surface area. Phase 4 prepares the final integrity flip without applying it, and Phase 5 closes the high-value UX/integration gaps that did not require new migrations.

## Files modified

- `migration/fsterbxivhhzipfgpvou/sql/12_chats_enforce_not_null.sql` — **NEW, NOT APPLIED.** Idempotent, transactional, rollback-aware migration that re-runs the link backfill, hard-aborts on any remaining NULL/orphan/cross-user row, then enforces `NOT NULL` on `chat_messages.chat_id` and `messages.chat_id`. Also adds a defensive `(chat_id, user_id, created_at)` index.
- `src/lib/chats.ts` — adds `renameChat(chatId, title)` and `deleteChat(chatId)` helpers (RLS-bound; CASCADE on `chat_messages.chat_id` already in 11_chats_hierarchy).
- `src/components/chat/ChatSidebar.tsx` — inline rename (Enter / blur to commit, Esc to cancel) and delete (window.confirm-gated) on per-chat rows; hover-revealed action cluster preserves the calm baseline.
- `src/locales/{en,ar,es,fr,it}.json` — `renameChat`, `deleteChat`, `confirmDeleteChat` strings across all five locales.
- `.lovable/plan.md` — this report.

Phase 5 items that touched zero files because they were already done in earlier layers: chat-aware writers (Layer 1), sidebar hierarchy (Layer 2), chat-aware uploads & doctor projection (Phase 3), draft/scroll/voice continuity per chat (Layer 2 + Phase 3).

## Phase 4 — Writer audit results

Every code-path that inserts into `chat_messages` was re-verified to carry `chat_id` when one is active:

| Path | File | Carries `chat_id`? |
| --- | --- | --- |
| Standard text send | `SessionChat.tsx` L394 | ✅ guard: `if (currentChatId) payload.chat_id = currentChatId` |
| Streaming assistant message | `SessionChat.tsx` (same insert path used for both roles) | ✅ |
| Voice user message | `VoiceModePage.tsx` L95–97 | ✅ |
| Voice assistant message | `VoiceModePage.tsx` L121–123 | ✅ |
| Reflection injection | encoded into existing assistant message via `encodeReflection` (no separate row) | ✅ rides on parent row |
| Reply context | `reply_to_message_id` only, no new row | ✅ N/A |
| Voice meta update | `voice/persistence.ts` `UPDATE … WHERE id = ?` — does not create new rows | ✅ N/A |
| Doctor AI assist | `supabase/functions/doctor-ai-assist/index.ts` L188 — read-only `select` | ✅ N/A |
| Edge `chat` function | streams response, never inserts; client is the writer | ✅ N/A |
| Edge `reflect` function | returns text; client is the writer | ✅ N/A |

No orphan-producing writer paths remain. The only paths that can produce a NULL `chat_id` are legacy rows from before Layer 1 and (theoretically) a race where the message insert beats `setCurrentChatId` — mitigated by `lastInitKeyRef` and the synchronous `ensureLatestChatForSession`/`createChat` await chain in `SessionChat.initSession`.

## Phase 4 — Reader audit results

| Reader | File | Strategy |
| --- | --- | --- |
| Active-chat transcript | `SessionChat.loadMessagesFor` | Primary `eq('chat_id', chatId)`, legacy fallback `eq('session_id', …)` |
| Doctor transcript | `PatientWorkspace.tsx` L81 | User-scoped, includes `chat_id` (Phase 3) for downstream grouping |
| Profile export / delete | `AccountActions.tsx`, `SettingsPage.tsx` | User-scoped, all messages regardless of `chat_id` — safe before and after NOT NULL flip |
| Session messages | `lib/sessions.ts` `getSessionMessages` | Session-scoped, legacy-compatible, used by history exports |
| Voice meta read | `voice/persistence.ts` `readVoiceMeta` | Row-level, no chat/session dependency |

All readers tolerate both NULL and non-NULL `chat_id`. After the migration is applied, the legacy fallback in `SessionChat.loadMessagesFor` becomes dead code but remains safe.

## Phase 4 — Pre-flight integrity SQL (run before applying 12_…)

These read-only checks document what must be zero before applying the migration. They are not run automatically — psql is not exposed to this sandbox. Run via the Supabase SQL editor or `supabase db psql` from a developer machine:

```sql
-- 1. Any unlinked chat_messages
SELECT count(*) FROM public.chat_messages WHERE chat_id IS NULL;

-- 2. Any unlinked legacy messages
SELECT count(*) FROM public.messages WHERE chat_id IS NULL;

-- 3. Orphan chat_id (FK invariant — should always be 0)
SELECT count(*) FROM public.chat_messages cm
WHERE cm.chat_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.chats c WHERE c.id = cm.chat_id);

-- 4. Cross-user linkage
SELECT count(*) FROM public.chat_messages cm
JOIN public.chats c ON c.id = cm.chat_id
WHERE cm.user_id <> c.user_id;

-- 5. Sessions without any chat (should be 0 after 11_chats_hierarchy)
SELECT count(*) FROM public.sessions s
WHERE NOT EXISTS (SELECT 1 FROM public.chats c WHERE c.session_id = s.id);
```

If query 1 or 2 returns > 0, the migration's own backfill in step 1 will link them in the same transaction. If it can't link them (no parent session/chat), the `DO $$ … RAISE EXCEPTION` block aborts the transaction.

### Migration rollback strategy

If something goes wrong after `12_…` commits (e.g. a writer regression appears in the field):

```sql
ALTER TABLE public.chat_messages ALTER COLUMN chat_id DROP NOT NULL;
ALTER TABLE public.messages      ALTER COLUMN chat_id DROP NOT NULL;
-- (optional) DROP INDEX IF EXISTS idx_chat_messages_chat_user_created;
```

The `ON DELETE CASCADE` FK and trigger machinery from `11_…` are preserved either way.

### Expected execution impact

- Re-running the link UPDATE on a healthy database touches 0 rows and completes in <100ms.
- `ALTER … SET NOT NULL` requires a table scan but holds an `ACCESS EXCLUSIVE` lock only for the duration of the scan; on the order of seconds for typical user-scale traffic. Run during a low-traffic window.

## Phase 4 — Type safety pass (deferred, intentional)

Regenerating `src/integrations/supabase/types.ts` to include `public.chats` was considered and deferred. Reasons:

- The current `sbExt` boundary is narrow (`chats`, voice columns) and self-documenting.
- A full regeneration also rewrites unrelated table definitions, expanding the diff surface beyond the scope of this pass.
- The proposed regeneration becomes much safer *after* `12_…` is applied (no nullable `chat_id` to project), so deferring it to the same window as the migration cut is the lower-risk plan.

This is tracked in "Remaining migration debt" below.

## Phase 5 — Advanced chat UX completion

- **Chat rename**: pencil icon on hover, inline input with Enter/blur to commit, Esc to cancel. RLS-bound (`update` policy on `chats` already enforces `auth.uid() = user_id`). 120-char clamp client-side; row updates optimistically in the cached `chatsBySession` map without a refetch.
- **Chat delete**: trash icon on hover, `window.confirm` gate, optimistic removal from cache. CASCADE on `chat_messages.chat_id` already removes linked messages. If the deleted chat was active, `currentChatId` is cleared so `SessionChat.initSession` re-derives the next chat via `ensureLatestChatForSession`.
- **Doctor visibility**: `PatientWorkspace` transcript projection already includes `chat_id` from Phase 3, ready for future grouping UI.

## Phase 5 — Items deferred (with explicit reasons)

| Item | Why deferred |
| --- | --- |
| Activities `chat_id` column | Requires a new migration + UX decision (is an activity per-chat or per-session?). Defer until product owner signs off. |
| Doctor portal chat-grouping UI | Data is exposed (Phase 3); rendering it as collapsible chat groups inside the Transcript tab is a UX layer that deserves its own pass. |
| Breadcrumb header in `SessionChat` (session date · chat title) | Out of scope for this pass — current header already exposes session timing; chat title is now also addressable via the sidebar. |
| Supabase type regen | See Phase 4 rationale above. |
| Warm-light polish, hover/loading states refresh | Risk-bounded design pass; needs design review, not a code dump. |

## QA performed (this pass)

- `node scripts/check-locale-parity.mjs` → all five locales at parity (en/ar/es/fr/it, 0/0 missing/extra).
- `node scripts/check-backend-lock.mjs` → only `fsterbxivhhzipfgpvou` referenced.
- Code-level audit of every `chat_messages` writer and reader (results table above).
- Cinematic rules table re-verified against `AppContext.tsx` setters — no change vs Phase 3.
- Rename/delete UX walkthrough: pencil opens inline input, Enter commits, blur commits, Esc cancels, trash prompts confirm, deletion clears `currentChatId` when active.

## Regression risks

- **Inline rename UX**: blur-to-commit may surprise users who click outside expecting cancel. Mitigation: 120-char clamp + RLS means worst case is a write of unchanged trimmed title. Easy follow-up to swap to explicit-save-only if user feedback dislikes blur-commit.
- **Delete confirm dialog**: uses `window.confirm` (system modal). Functional, but not branded. Marked as a polish follow-up.
- **`12_…` migration**: not yet applied. Risk surfaces only at apply time and is bounded by the hard-abort guard.

## Remaining migration debt

1. `12_chats_enforce_not_null.sql` written but not applied — apply during a low-traffic window after running the pre-flight SQL above.
2. `activity_sessions.chat_id` column not introduced.
3. `chats` table absent from generated Supabase types — `sbExt` still used in `chats.ts`, `voice/persistence.ts`. Regen recommended *after* `12_…` ships.
4. Legacy session-scoped drafts in `localStorage` continue to receive a one-shot read; not actively purged.
5. Doctor portal chat-grouping UI deferred — data is available.

## Production readiness assessment

- **Hierarchy**: all writers chat-aware; all readers chat-aware with legacy fallback; rename/delete now available.
- **Integrity**: migration prepared, hard-gated, rollback-documented. Cannot regress production until applied.
- **Cinematic**: all five rules behave exactly as specified (verified again this pass).
- **Localization / RTL / mobile / anonymous / GPU / atmosphere / virtualization**: untouched.
- **Doctor visibility**: `chat_id` exposed in transcript projection; RLS unchanged.
- **Performance**: no new fetch loops, no new effects; sidebar still lazy-loads per-session.

Verdict: production-ready on the existing schema. The final `NOT NULL` flip is one apply-window away and is the only remaining gating item for "data-integrity-complete" status.
