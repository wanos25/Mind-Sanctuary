-- ── Expand profiles ────────────────────────────────────────────────
alter table public.profiles
  add column if not exists user_id uuid,
  add column if not exists avatar text default 'default',
  add column if not exists identity_mode text default 'anonymous',
  add column if not exists nickname text,
  add column if not exists age text,
  add column if not exists gender text,
  add column if not exists nickname_reason text,
  add column if not exists interview_answers jsonb default '{}'::jsonb,
  add column if not exists ai_tone text;

update public.profiles set user_id = id where user_id is null;

create or replace function public.profiles_sync_user_id()
returns trigger language plpgsql set search_path = public as $$
begin if new.user_id is null then new.user_id := new.id; end if; return new; end $$;

drop trigger if exists trg_profiles_sync_user_id on public.profiles;
create trigger trg_profiles_sync_user_id before insert or update on public.profiles
for each row execute function public.profiles_sync_user_id();

-- ── Expand sessions ────────────────────────────────────────────────
alter table public.sessions
  add column if not exists summary_emotion text,
  add column if not exists summary_intensity numeric;

-- ── Shared updated_at helper ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- ── memory_type enum ───────────────────────────────────────────────
do $$ begin
  create type public.memory_type as enum (
    'person','goal','fear','trigger','recovery','achievement','preference','theme','event','habit'
  );
exception when duplicate_object then null; end $$;

-- ── emotion_analyses ───────────────────────────────────────────────
create table if not exists public.emotion_analyses (
  id uuid primary key default gen_random_uuid(),
  message_id uuid,
  session_id uuid not null,
  user_id uuid not null,
  primary_emotion text,
  intensity numeric,
  sentiment numeric,
  distortions jsonb,
  created_at timestamptz not null default now()
);
alter table public.emotion_analyses enable row level security;
drop policy if exists "own ea select" on public.emotion_analyses;
drop policy if exists "own ea insert" on public.emotion_analyses;
drop policy if exists "own ea delete" on public.emotion_analyses;
create policy "own ea select" on public.emotion_analyses for select using (auth.uid() = user_id);
create policy "own ea insert" on public.emotion_analyses for insert with check (auth.uid() = user_id);
create policy "own ea delete" on public.emotion_analyses for delete using (auth.uid() = user_id);
create index if not exists idx_ea_session on public.emotion_analyses (session_id, created_at);
create index if not exists idx_ea_user on public.emotion_analyses (user_id, created_at desc);

-- ── emotional_memories ─────────────────────────────────────────────
create table if not exists public.emotional_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type public.memory_type not null,
  title text not null,
  content text,
  emotion text,
  emotional_weight numeric not null default 0.5,
  recurrence_score integer not null default 1,
  confidence numeric not null default 0.5,
  tags text[] not null default '{}',
  source_session_ids uuid[] not null default '{}',
  embedding jsonb,
  last_referenced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.emotional_memories enable row level security;
drop policy if exists "own emo memories select" on public.emotional_memories;
drop policy if exists "own emo memories insert" on public.emotional_memories;
drop policy if exists "own emo memories update" on public.emotional_memories;
drop policy if exists "own emo memories delete" on public.emotional_memories;
create policy "own emo memories select" on public.emotional_memories for select using (auth.uid() = user_id);
create policy "own emo memories insert" on public.emotional_memories for insert with check (auth.uid() = user_id);
create policy "own emo memories update" on public.emotional_memories for update using (auth.uid() = user_id);
create policy "own emo memories delete" on public.emotional_memories for delete using (auth.uid() = user_id);
create index if not exists idx_em_user_type on public.emotional_memories (user_id, type);
drop trigger if exists trg_em_updated_at on public.emotional_memories;
create trigger trg_em_updated_at before update on public.emotional_memories
for each row execute function public.set_updated_at();

-- ── memory_relationships ───────────────────────────────────────────
create table if not exists public.memory_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  from_memory_id uuid not null,
  to_memory_id uuid not null,
  relation_type text not null default 'related',
  strength numeric not null default 0.5,
  created_at timestamptz not null default now()
);
alter table public.memory_relationships enable row level security;
drop policy if exists "own rel select" on public.memory_relationships;
drop policy if exists "own rel insert" on public.memory_relationships;
create policy "own rel select" on public.memory_relationships for select using (auth.uid() = user_id);
create policy "own rel insert" on public.memory_relationships for insert with check (auth.uid() = user_id);

-- ── memory_events ──────────────────────────────────────────────────
create table if not exists public.memory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  memory_id uuid not null,
  session_id uuid,
  event_type text not null,
  intensity numeric default 0.5,
  created_at timestamptz not null default now()
);
alter table public.memory_events enable row level security;
drop policy if exists "own mev select" on public.memory_events;
drop policy if exists "own mev insert" on public.memory_events;
create policy "own mev select" on public.memory_events for select using (auth.uid() = user_id);
create policy "own mev insert" on public.memory_events for insert with check (auth.uid() = user_id);

-- ── key_moments ────────────────────────────────────────────────────
create table if not exists public.key_moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid not null,
  message_id uuid,
  moment_type text not null,
  intensity numeric default 0.5,
  emotion text,
  summary text,
  position integer default 0,
  created_at timestamptz not null default now()
);
alter table public.key_moments enable row level security;
drop policy if exists "own km select" on public.key_moments;
drop policy if exists "own km insert" on public.key_moments;
create policy "own km select" on public.key_moments for select using (auth.uid() = user_id);
create policy "own km insert" on public.key_moments for insert with check (auth.uid() = user_id);

-- ── emotional_pulses ───────────────────────────────────────────────
create table if not exists public.emotional_pulses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  pulse_date date not null,
  dominant_emotion text,
  avg_intensity numeric,
  session_count integer default 0,
  message_count integer default 0,
  summary text,
  created_at timestamptz not null default now(),
  unique (user_id, pulse_date)
);
alter table public.emotional_pulses enable row level security;
drop policy if exists "own pulse select" on public.emotional_pulses;
drop policy if exists "own pulse insert" on public.emotional_pulses;
drop policy if exists "own pulse update" on public.emotional_pulses;
create policy "own pulse select" on public.emotional_pulses for select using (auth.uid() = user_id);
create policy "own pulse insert" on public.emotional_pulses for insert with check (auth.uid() = user_id);
create policy "own pulse update" on public.emotional_pulses for update using (auth.uid() = user_id);

-- ── achievements ───────────────────────────────────────────────────
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code text not null,
  title text not null,
  description text,
  metadata jsonb default '{}'::jsonb,
  unlocked_at timestamptz not null default now(),
  unique (user_id, code)
);
alter table public.achievements enable row level security;
drop policy if exists "own ach select" on public.achievements;
drop policy if exists "own ach insert" on public.achievements;
create policy "own ach select" on public.achievements for select using (auth.uid() = user_id);
create policy "own ach insert" on public.achievements for insert with check (auth.uid() = user_id);

-- ── ai_personality_state ───────────────────────────────────────────
create table if not exists public.ai_personality_state (
  user_id uuid primary key,
  tone text not null default 'warm',
  empathy_level numeric not null default 0.7,
  pacing text not null default 'measured',
  depth text not null default 'moderate',
  trust_level numeric not null default 0.3,
  notes text,
  updated_at timestamptz not null default now()
);
alter table public.ai_personality_state enable row level security;
drop policy if exists "own pers select" on public.ai_personality_state;
drop policy if exists "own pers insert" on public.ai_personality_state;
drop policy if exists "own pers update" on public.ai_personality_state;
create policy "own pers select" on public.ai_personality_state for select using (auth.uid() = user_id);
create policy "own pers insert" on public.ai_personality_state for insert with check (auth.uid() = user_id);
create policy "own pers update" on public.ai_personality_state for update using (auth.uid() = user_id);
drop trigger if exists trg_pers_updated_at on public.ai_personality_state;
create trigger trg_pers_updated_at before update on public.ai_personality_state
for each row execute function public.set_updated_at();