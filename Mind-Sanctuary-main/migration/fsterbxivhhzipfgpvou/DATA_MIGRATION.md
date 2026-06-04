# Data Migration Package — `joqnptgangpdqhkqbfeq` → `fsterbxivhhzipfgpvou`

> **Status: PLAN ONLY. Nothing here has been executed.**
> Lovable Cloud (`joqnptgangpdqhkqbfeq`) is the source of truth and stays **read-only / untouched**.
> `fsterbxivhhzipfgpvou` is the new primary. Cloud remains as rollback.

Everything below is idempotent-friendly and FK-safe. Run sections in the order given.

---

## 0. Variables you'll set once (locally, never commit)

```bash
# SOURCE (Lovable Cloud — read only)
export SRC_REF=joqnptgangpdqhkqbfeq
export SRC_DB_URL='postgresql://postgres:<SRC_DB_PASSWORD>@db.joqnptgangpdqhkqbfeq.supabase.co:5432/postgres'
export SRC_SERVICE_ROLE='<cloud service_role key>'

# TARGET (new primary)
export DST_REF=fsterbxivhhzipfgpvou
export DST_DB_URL='postgresql://postgres:<DST_DB_PASSWORD>@db.fsterbxivhhzipfgpvou.supabase.co:5432/postgres'
export DST_SERVICE_ROLE='<new service_role key>'
```

Get DB passwords from **Project Settings → Database → Connection string → URI**.
Service role keys from **Project Settings → API**.

---

## 1. Auth users export / import

Supabase CLI preserves `id`, email, password hash, providers, metadata, and `created_at`.

### 1a. Export (against source — pure read)

```bash
supabase login
supabase link --project-ref $SRC_REF
supabase auth export users.jsonl
```

Produces `users.jsonl` locally. **Do not commit.**

### 1b. Disable the new-user trigger on TARGET (prevents double profile rows)

In Supabase SQL editor for `$DST_REF`:

```sql
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
```

### 1c. Import (against target)

```bash
supabase link --project-ref $DST_REF
supabase auth import users.jsonl
```

### 1d. Re-enable the trigger

```sql
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
```

Trigger will only fire on *new* signups going forward; existing imported users keep their original `id` so the profile rows you import in §2 line up.

---

## 2. Public schema export / import (FK-safe order)

All tables are scoped by `user_id`. Order respects FKs and the
`profiles → sessions → messages → analyses → memories → insights → roles` chain.

### 2a. Export script (source, read-only)

Save as `scripts/export_public.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
mkdir -p dump
TABLES=(
  profiles
  user_roles
  sessions
  chat_messages
  messages
  emotion_analyses
  emotional_memories
  memory_relationships
  memory_events
  key_moments
  session_memories
  insights
  achievements
  ai_personality_state
  emotional_pulses
  message_feedback
)
for t in "${TABLES[@]}"; do
  echo ">> exporting $t"
  psql "$SRC_DB_URL" -c "\COPY (SELECT * FROM public.$t) TO 'dump/${t}.csv' WITH CSV HEADER"
done
```

### 2b. Import script (target)

Save as `scripts/import_public.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
TABLES=(
  profiles
  user_roles
  sessions
  chat_messages
  messages
  emotion_analyses
  emotional_memories
  memory_relationships
  memory_events
  key_moments
  session_memories
  insights
  achievements
  ai_personality_state
  emotional_pulses
  message_feedback
)

# Defer FK + triggers during bulk load
psql "$DST_DB_URL" -c "SET session_replication_role = 'replica';"

for t in "${TABLES[@]}"; do
  echo ">> importing $t"
  psql "$DST_DB_URL" -c "\COPY public.$t FROM 'dump/${t}.csv' WITH CSV HEADER"
done

psql "$DST_DB_URL" -c "SET session_replication_role = 'origin';"
```

> `session_replication_role = replica` per-session disables FK + user triggers for that connection only. It's safer than dropping constraints.

### 2c. Validation queries (run on TARGET)

```sql
SELECT 'profiles' t, count(*) FROM profiles
UNION ALL SELECT 'sessions', count(*) FROM sessions
UNION ALL SELECT 'chat_messages', count(*) FROM chat_messages
UNION ALL SELECT 'messages', count(*) FROM messages
UNION ALL SELECT 'emotion_analyses', count(*) FROM emotion_analyses
UNION ALL SELECT 'message_feedback', count(*) FROM message_feedback
UNION ALL SELECT 'user_roles', count(*) FROM user_roles;
```

Compare against the same query on source. Counts must match exactly.

---

## 3. Storage migration (`chat-attachments` bucket)

The bucket holds user-uploaded chat images + voice blobs. ~few-MB per object, small N.

### 3a. List + download from source

```bash
mkdir -p storage_dump/chat-attachments
supabase link --project-ref $SRC_REF
supabase storage ls ss:///chat-attachments --recursive > storage_dump/manifest.txt
# Mirror locally
supabase storage cp ss:///chat-attachments storage_dump/chat-attachments --recursive
```

### 3b. Upload to target

```bash
supabase link --project-ref $DST_REF
# Bucket already created by sql/08_storage.sql
supabase storage cp storage_dump/chat-attachments ss:///chat-attachments --recursive
```

### 3c. Validation

```bash
diff \
  <(supabase storage ls ss:///chat-attachments --recursive | sort) \
  storage_dump/manifest.txt
```

Object paths embed `user_id/session_id/...`, which still resolve because user IDs were preserved in §1.

---

## 4. FK-safe import ordering (reference)

```
auth.users              (§1)
└── public.profiles     (handle_new_user trigger normally creates these,
                         but trigger is DISABLED during §1 import so we import them in §2)
    ├── public.user_roles
    ├── public.sessions
    │    ├── public.chat_messages
    │    │    └── public.message_feedback
    │    ├── public.messages
    │    ├── public.emotion_analyses
    │    ├── public.session_memories
    │    ├── public.insights
    │    └── public.key_moments
    ├── public.emotional_memories
    │    ├── public.memory_relationships
    │    └── public.memory_events
    ├── public.achievements
    ├── public.ai_personality_state
    └── public.emotional_pulses
storage.objects/chat-attachments   (§3)
```

---

## 5. Rollback

| Scenario | Action |
|---|---|
| Target import corrupted | `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` on TARGET, re-run `sql/01..09`, restart §1–§3. |
| Auth import wrong | `DELETE FROM auth.users WHERE created_at > '<cutoff>';` on TARGET only. Source unaffected. |
| Storage upload wrong | `supabase storage rm ss:///chat-attachments --recursive` on TARGET, then re-upload. |
| Need to revert app to Cloud | Frontend env swap — see `RUNTIME_SWITCH.md` §3. **No DB changes needed.** |

Cloud project is never modified by any step above, so total rollback = "point frontend back at Cloud + redeploy". RTO ≈ 2 min.

---

## 6. Risks & manual steps required from you

| Risk | Severity | Mitigation |
|---|---|---|
| Wrong DB password / service-role key pasted | Med | Use env vars, never inline. Test with a SELECT before COPY. |
| Trigger not re-enabled after §1 | High | §1d is a required step. Add a checklist tick. |
| Storage object paths reference old user IDs that don't exist on target | Low — IDs are preserved | Verify a sample object loads via signed URL after §3. |
| Running export against TARGET by accident (data loss illusion) | Low | Always `echo $SRC_DB_URL` before `\COPY ... TO`. |
| FK violation mid-import | Med | `session_replication_role=replica` defers them; recount + run `SELECT conname FROM pg_constraint WHERE NOT convalidated` after. |

**Manual steps you must perform** (cannot be automated from inside Lovable):
1. Retrieve DB passwords + service-role keys from Supabase dashboard.
2. Run `supabase auth export/import` locally with the CLI.
3. Run the two shell scripts (§2a, §2b) on your machine.
4. Run `supabase storage cp` for §3.
5. Toggle the `on_auth_user_created` trigger (§1b, §1d).
