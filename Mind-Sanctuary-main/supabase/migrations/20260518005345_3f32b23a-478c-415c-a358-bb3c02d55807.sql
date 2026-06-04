-- ── Core: chat_messages ─────────────────────────────────────────────
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_session_idx on public.chat_messages(session_id, created_at);
create index if not exists chat_messages_user_idx    on public.chat_messages(user_id);
alter table public.chat_messages enable row level security;
drop policy if exists "own chat_messages select" on public.chat_messages;
drop policy if exists "own chat_messages insert" on public.chat_messages;
drop policy if exists "own chat_messages update" on public.chat_messages;
drop policy if exists "own chat_messages delete" on public.chat_messages;
create policy "own chat_messages select" on public.chat_messages for select using (auth.uid() = user_id);
create policy "own chat_messages insert" on public.chat_messages for insert with check (auth.uid() = user_id);
create policy "own chat_messages update" on public.chat_messages for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own chat_messages delete" on public.chat_messages for delete using (auth.uid() = user_id);

-- ── Core: session_memories ──────────────────────────────────────────
create table if not exists public.session_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  topic text not null,
  emotion_pattern text,
  context text,
  session_id uuid references public.sessions(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.session_memories enable row level security;
drop policy if exists "own session_memories select" on public.session_memories;
drop policy if exists "own session_memories insert" on public.session_memories;
drop policy if exists "own session_memories delete" on public.session_memories;
create policy "own session_memories select" on public.session_memories for select using (auth.uid() = user_id);
create policy "own session_memories insert" on public.session_memories for insert with check (auth.uid() = user_id);
create policy "own session_memories delete" on public.session_memories for delete using (auth.uid() = user_id);

-- ── Voice + reply columns on chat_messages ──────────────────────────
alter table public.chat_messages
  add column if not exists voice_url               text,
  add column if not exists voice_mime              text,
  add column if not exists voice_duration_ms       integer,
  add column if not exists voice_size_bytes        integer,
  add column if not exists voice_waveform          jsonb,
  add column if not exists voice_status            text,
  add column if not exists voice_generation_source text,
  add column if not exists voice_metrics           jsonb,
  add column if not exists stt_transcript          text,
  add column if not exists stt_language            text,
  add column if not exists reply_to_message_id     uuid references public.chat_messages(id) on delete set null;

create index if not exists chat_messages_voice_status_idx
  on public.chat_messages (voice_status) where voice_status is not null;
create index if not exists chat_messages_reply_to_idx
  on public.chat_messages (reply_to_message_id) where reply_to_message_id is not null;

-- ── message_feedback ────────────────────────────────────────────────
create table if not exists public.message_feedback (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.chat_messages(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rating      smallint not null check (rating in (-1, 1)),
  reason      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (message_id, user_id)
);
create index if not exists message_feedback_message_idx on public.message_feedback (message_id);
alter table public.message_feedback enable row level security;
drop policy if exists "feedback: owners read"   on public.message_feedback;
drop policy if exists "feedback: owners insert" on public.message_feedback;
drop policy if exists "feedback: owners update" on public.message_feedback;
drop policy if exists "feedback: owners delete" on public.message_feedback;
create policy "feedback: owners read"   on public.message_feedback for select using (auth.uid() = user_id);
create policy "feedback: owners insert" on public.message_feedback for insert with check (auth.uid() = user_id);
create policy "feedback: owners update" on public.message_feedback for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "feedback: owners delete" on public.message_feedback for delete using (auth.uid() = user_id);

drop trigger if exists trg_message_feedback_touch on public.message_feedback;
create trigger trg_message_feedback_touch
  before update on public.message_feedback
  for each row execute function public.touch_updated_at();