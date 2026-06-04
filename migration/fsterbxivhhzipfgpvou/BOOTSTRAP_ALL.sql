-- ============================================================
-- PHASE 1 BOOTSTRAP — fsterbxivhhzipfgpvou
-- Paste-in order, idempotent, additive-only.
-- Generated 2026-05-20T22:00:58Z
-- ============================================================

-- ============================================================
-- >>>>>> migration/fsterbxivhhzipfgpvou/sql/01_extensions.sql
-- ============================================================
-- 01_extensions.sql — required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- pg_stat_statements and supabase_vault are managed by Supabase itself.

-- ============================================================
-- >>>>>> migration/fsterbxivhhzipfgpvou/sql/02_enums.sql
-- ============================================================
-- 02_enums.sql — all public enums (idempotent via DO blocks)

DO $$ BEGIN
  CREATE TYPE public.mood AS ENUM ('calm','anxious','overwhelmed','hopeful','neutral');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.msg_role AS ENUM ('user','ai');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.session_stage AS ENUM ('assessment','exploration','action');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.memory_type AS ENUM (
    'person','goal','fear','trigger','recovery',
    'achievement','preference','theme','event','habit'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','doctor','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- >>>>>> migration/fsterbxivhhzipfgpvou/sql/03_functions.sql
-- ============================================================
-- 03_functions.sql — helper + security-definer functions

-- Canonical updated_at trigger function (legacy name used by R5/R6 + supabase/migrations)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.profiles_sync_user_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN
  IF NEW.user_id IS NULL THEN NEW.user_id := NEW.id; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================================
-- >>>>>> migration/fsterbxivhhzipfgpvou/sql/04_tables.sql
-- ============================================================
-- 04_tables.sql — all public tables (idempotent)

-- profiles ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  uuid PRIMARY KEY,
  user_id             uuid,
  email               text,
  display_name        text,
  avatar              text DEFAULT 'default',
  identity_mode       text DEFAULT 'anonymous',
  nickname            text,
  age                 text,
  gender              text,
  nickname_reason     text,
  ai_tone             text,
  interview_answers   jsonb DEFAULT '{}'::jsonb,
  theme               text NOT NULL DEFAULT 'dark',
  notifications       boolean NOT NULL DEFAULT true,
  focus_default       boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- sessions ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL,
  title              text,
  stage              public.session_stage NOT NULL DEFAULT 'assessment',
  started_at         timestamptz NOT NULL DEFAULT now(),
  ended_at           timestamptz,
  summary_emotion    text,
  summary_intensity  numeric,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- messages (legacy/simple) -------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL,
  user_id     uuid NOT NULL,
  role        public.msg_role NOT NULL,
  content     text NOT NULL,
  mood        public.mood,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- chat_messages (rich) -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id               uuid NOT NULL,
  user_id                  uuid NOT NULL,
  role                     text NOT NULL,
  content                  text NOT NULL,
  reply_to_message_id      uuid,
  voice_url                text,
  voice_mime               text,
  voice_duration_ms        integer,
  voice_size_bytes         integer,
  voice_waveform           jsonb,
  voice_status             text,
  voice_generation_source  text,
  voice_metrics            jsonb,
  stt_transcript           text,
  stt_language             text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- emotion_analyses ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emotion_analyses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,
  session_id       uuid NOT NULL,
  message_id       uuid,
  primary_emotion  text,
  intensity        numeric,
  sentiment        numeric,
  distortions      jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- session_memories ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_memories (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,
  session_id       uuid,
  topic            text NOT NULL,
  emotion_pattern  text,
  context          text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- emotional_memories -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emotional_memories (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL,
  type                 public.memory_type NOT NULL,
  title                text NOT NULL,
  content              text,
  emotion              text,
  emotional_weight     numeric NOT NULL DEFAULT 0.5,
  recurrence_score     integer NOT NULL DEFAULT 1,
  confidence           numeric NOT NULL DEFAULT 0.5,
  tags                 text[]  NOT NULL DEFAULT '{}'::text[],
  source_session_ids   uuid[]  NOT NULL DEFAULT '{}'::uuid[],
  embedding            jsonb,
  last_referenced_at   timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- memory_relationships -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.memory_relationships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  from_memory_id  uuid NOT NULL,
  to_memory_id    uuid NOT NULL,
  relation_type   text NOT NULL DEFAULT 'related',
  strength        numeric NOT NULL DEFAULT 0.5,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- memory_events ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memory_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  memory_id   uuid NOT NULL,
  session_id  uuid,
  event_type  text NOT NULL,
  intensity   numeric DEFAULT 0.5,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- key_moments --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.key_moments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  session_id   uuid NOT NULL,
  message_id   uuid,
  moment_type  text NOT NULL,
  intensity    numeric DEFAULT 0.5,
  emotion      text,
  summary      text,
  position     integer DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- insights -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insights (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  title       text NOT NULL,
  description text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- achievements -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  code         text NOT NULL,
  title        text NOT NULL,
  description  text,
  metadata     jsonb DEFAULT '{}'::jsonb,
  unlocked_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);

-- ai_personality_state ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_personality_state (
  user_id        uuid PRIMARY KEY,
  tone           text    NOT NULL DEFAULT 'warm',
  empathy_level  numeric NOT NULL DEFAULT 0.7,
  pacing         text    NOT NULL DEFAULT 'measured',
  depth          text    NOT NULL DEFAULT 'moderate',
  trust_level    numeric NOT NULL DEFAULT 0.3,
  notes          text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- emotional_pulses ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emotional_pulses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL,
  pulse_date        date NOT NULL,
  dominant_emotion  text,
  avg_intensity     numeric,
  session_count     integer DEFAULT 0,
  message_count     integer DEFAULT 0,
  summary           text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pulse_date)
);

-- message_feedback ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  message_id  uuid NOT NULL,
  rating      smallint NOT NULL,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

-- user_roles (R4a doctor portal) ------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        public.app_role NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- ============================================================
-- >>>>>> migration/fsterbxivhhzipfgpvou/sql/05_indexes.sql
-- ============================================================
-- 05_indexes.sql — non-PK indexes (mirrors current Cloud backend)

CREATE INDEX IF NOT EXISTS sessions_user_idx
  ON public.sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS messages_session_idx
  ON public.messages (session_id, created_at);

CREATE INDEX IF NOT EXISTS chat_messages_session_idx
  ON public.chat_messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS chat_messages_user_idx
  ON public.chat_messages (user_id);
CREATE INDEX IF NOT EXISTS chat_messages_reply_to_idx
  ON public.chat_messages (reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS chat_messages_voice_status_idx
  ON public.chat_messages (voice_status) WHERE voice_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ea_user
  ON public.emotion_analyses (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ea_session
  ON public.emotion_analyses (session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_em_user_type
  ON public.emotional_memories (user_id, type);

CREATE INDEX IF NOT EXISTS message_feedback_message_idx
  ON public.message_feedback (message_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user
  ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role
  ON public.user_roles (role);

-- ============================================================
-- >>>>>> migration/fsterbxivhhzipfgpvou/sql/06_rls.sql
-- ============================================================
-- 06_rls.sql — enable RLS + all policies (mirror of Cloud backend)

ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotion_analyses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_memories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotional_memories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_relationships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_moments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_personality_state  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotional_pulses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_feedback      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles            ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "Profiles: select own"   ON public.profiles;
DROP POLICY IF EXISTS "Profiles: insert own"   ON public.profiles;
DROP POLICY IF EXISTS "Profiles: update own"   ON public.profiles;
CREATE POLICY "Profiles: select own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles: insert own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles: update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- sessions (own all)
DROP POLICY IF EXISTS "Sessions: own all" ON public.sessions;
CREATE POLICY "Sessions: own all" ON public.sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- messages (own all)
DROP POLICY IF EXISTS "Messages: own all" ON public.messages;
CREATE POLICY "Messages: own all" ON public.messages FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- chat_messages (own CRUD)
DROP POLICY IF EXISTS "own chat_messages select" ON public.chat_messages;
DROP POLICY IF EXISTS "own chat_messages insert" ON public.chat_messages;
DROP POLICY IF EXISTS "own chat_messages update" ON public.chat_messages;
DROP POLICY IF EXISTS "own chat_messages delete" ON public.chat_messages;
CREATE POLICY "own chat_messages select" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own chat_messages insert" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own chat_messages update" ON public.chat_messages FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own chat_messages delete" ON public.chat_messages FOR DELETE USING (auth.uid() = user_id);

-- emotion_analyses (own SID)
DROP POLICY IF EXISTS "own ea select" ON public.emotion_analyses;
DROP POLICY IF EXISTS "own ea insert" ON public.emotion_analyses;
DROP POLICY IF EXISTS "own ea delete" ON public.emotion_analyses;
CREATE POLICY "own ea select" ON public.emotion_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own ea insert" ON public.emotion_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ea delete" ON public.emotion_analyses FOR DELETE USING (auth.uid() = user_id);

-- session_memories
DROP POLICY IF EXISTS "own session_memories select" ON public.session_memories;
DROP POLICY IF EXISTS "own session_memories insert" ON public.session_memories;
DROP POLICY IF EXISTS "own session_memories delete" ON public.session_memories;
CREATE POLICY "own session_memories select" ON public.session_memories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own session_memories insert" ON public.session_memories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own session_memories delete" ON public.session_memories FOR DELETE USING (auth.uid() = user_id);

-- emotional_memories (own CRUD)
DROP POLICY IF EXISTS "own emo memories select" ON public.emotional_memories;
DROP POLICY IF EXISTS "own emo memories insert" ON public.emotional_memories;
DROP POLICY IF EXISTS "own emo memories update" ON public.emotional_memories;
DROP POLICY IF EXISTS "own emo memories delete" ON public.emotional_memories;
CREATE POLICY "own emo memories select" ON public.emotional_memories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own emo memories insert" ON public.emotional_memories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own emo memories update" ON public.emotional_memories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own emo memories delete" ON public.emotional_memories FOR DELETE USING (auth.uid() = user_id);

-- memory_relationships
DROP POLICY IF EXISTS "own rel select" ON public.memory_relationships;
DROP POLICY IF EXISTS "own rel insert" ON public.memory_relationships;
CREATE POLICY "own rel select" ON public.memory_relationships FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own rel insert" ON public.memory_relationships FOR INSERT WITH CHECK (auth.uid() = user_id);

-- memory_events
DROP POLICY IF EXISTS "own mev select" ON public.memory_events;
DROP POLICY IF EXISTS "own mev insert" ON public.memory_events;
CREATE POLICY "own mev select" ON public.memory_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own mev insert" ON public.memory_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- key_moments
DROP POLICY IF EXISTS "own km select" ON public.key_moments;
DROP POLICY IF EXISTS "own km insert" ON public.key_moments;
CREATE POLICY "own km select" ON public.key_moments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own km insert" ON public.key_moments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- insights (own all)
DROP POLICY IF EXISTS "Insights: own all" ON public.insights;
CREATE POLICY "Insights: own all" ON public.insights FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- achievements
DROP POLICY IF EXISTS "own ach select" ON public.achievements;
DROP POLICY IF EXISTS "own ach insert" ON public.achievements;
CREATE POLICY "own ach select" ON public.achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own ach insert" ON public.achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ai_personality_state
DROP POLICY IF EXISTS "own pers select" ON public.ai_personality_state;
DROP POLICY IF EXISTS "own pers insert" ON public.ai_personality_state;
DROP POLICY IF EXISTS "own pers update" ON public.ai_personality_state;
CREATE POLICY "own pers select" ON public.ai_personality_state FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own pers insert" ON public.ai_personality_state FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own pers update" ON public.ai_personality_state FOR UPDATE USING (auth.uid() = user_id);

-- emotional_pulses
DROP POLICY IF EXISTS "own pulse select" ON public.emotional_pulses;
DROP POLICY IF EXISTS "own pulse insert" ON public.emotional_pulses;
DROP POLICY IF EXISTS "own pulse update" ON public.emotional_pulses;
CREATE POLICY "own pulse select" ON public.emotional_pulses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own pulse insert" ON public.emotional_pulses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own pulse update" ON public.emotional_pulses FOR UPDATE USING (auth.uid() = user_id);

-- message_feedback (own CRUD)
DROP POLICY IF EXISTS "feedback: owners read"   ON public.message_feedback;
DROP POLICY IF EXISTS "feedback: owners insert" ON public.message_feedback;
DROP POLICY IF EXISTS "feedback: owners update" ON public.message_feedback;
DROP POLICY IF EXISTS "feedback: owners delete" ON public.message_feedback;
CREATE POLICY "feedback: owners read"   ON public.message_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "feedback: owners insert" ON public.message_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "feedback: owners update" ON public.message_feedback FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "feedback: owners delete" ON public.message_feedback FOR DELETE USING (auth.uid() = user_id);

-- user_roles (self-read only)
DROP POLICY IF EXISTS "user_roles self read" ON public.user_roles;
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Doctor additive read-only access ----------------------------------
DROP POLICY IF EXISTS "doctors read sessions"          ON public.sessions;
DROP POLICY IF EXISTS "doctors read chat_messages"     ON public.chat_messages;
DROP POLICY IF EXISTS "doctors read emotion_analyses"  ON public.emotion_analyses;
DROP POLICY IF EXISTS "doctors read profiles"          ON public.profiles;
CREATE POLICY "doctors read sessions"         ON public.sessions         FOR SELECT USING (public.has_role(auth.uid(),'doctor'));
CREATE POLICY "doctors read chat_messages"    ON public.chat_messages    FOR SELECT USING (public.has_role(auth.uid(),'doctor'));
CREATE POLICY "doctors read emotion_analyses" ON public.emotion_analyses FOR SELECT USING (public.has_role(auth.uid(),'doctor'));
CREATE POLICY "doctors read profiles"         ON public.profiles         FOR SELECT USING (public.has_role(auth.uid(),'doctor'));

-- ============================================================
-- >>>>>> migration/fsterbxivhhzipfgpvou/sql/07_triggers.sql
-- ============================================================
-- 07_triggers.sql — auth + updated_at triggers

-- Auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at triggers
DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS emotional_memories_touch ON public.emotional_memories;
CREATE TRIGGER emotional_memories_touch
  BEFORE UPDATE ON public.emotional_memories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS ai_personality_touch ON public.ai_personality_state;
CREATE TRIGGER ai_personality_touch
  BEFORE UPDATE ON public.ai_personality_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS message_feedback_touch ON public.message_feedback;
CREATE TRIGGER message_feedback_touch
  BEFORE UPDATE ON public.message_feedback
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- profiles.user_id mirror trigger
DROP TRIGGER IF EXISTS profiles_sync_user_id ON public.profiles;
CREATE TRIGGER profiles_sync_user_id
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_sync_user_id();

-- ============================================================
-- >>>>>> migration/fsterbxivhhzipfgpvou/sql/08_storage.sql
-- ============================================================
-- 08_storage.sql — buckets and storage policies

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own chat attachments" ON storage.objects;
CREATE POLICY "Users can upload own chat attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Anyone can read chat attachments" ON storage.objects;
CREATE POLICY "Anyone can read chat attachments"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "Users can delete own chat attachments" ON storage.objects;
CREATE POLICY "Users can delete own chat attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- >>>>>> migration/fsterbxivhhzipfgpvou/sql/09_realtime.sql
-- ============================================================
-- 09_realtime.sql — realtime publication
-- NOTE: The current Cloud backend has NO tables on supabase_realtime.
-- This file is intentionally a no-op. Uncomment the lines below if you
-- decide to enable realtime for chat in the future.
--
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
-- ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- ============================================================
-- >>>>>> migration/fsterbxivhhzipfgpvou/sql/10_r5_r6_activities_foundations.sql
-- ============================================================
-- =========================================================
-- Doctor role infrastructure (idempotent — only if missing)
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles (role);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =========================================================
-- R5: Activities Hub
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.activity_kind AS ENUM (
    'cbt_flow','image_interpretation','educational_video','spot_difference'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.activity_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.activity_kind NOT NULL,
  title text NOT NULL,
  description text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  locale text NOT NULL DEFAULT 'en',
  published boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Doctors can insert activity assets" ON public.activity_assets;
CREATE POLICY "Doctors can insert activity assets"
  ON public.activity_assets FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'doctor'::public.app_role));

DROP POLICY IF EXISTS "Doctors can update activity assets" ON public.activity_assets;
CREATE POLICY "Doctors can update activity assets"
  ON public.activity_assets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'::public.app_role));

DROP POLICY IF EXISTS "Doctors can view all activity assets" ON public.activity_assets;
CREATE POLICY "Doctors can view all activity assets"
  ON public.activity_assets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'::public.app_role));

DROP POLICY IF EXISTS "Users can view published activity assets" ON public.activity_assets;
CREATE POLICY "Users can view published activity assets"
  ON public.activity_assets FOR SELECT TO authenticated
  USING (published = true AND archived = false);

CREATE INDEX IF NOT EXISTS idx_activity_assets_kind ON public.activity_assets (kind);
CREATE INDEX IF NOT EXISTS idx_activity_assets_published ON public.activity_assets (published, archived);
CREATE INDEX IF NOT EXISTS idx_activity_assets_created_at ON public.activity_assets (created_at DESC);

DROP TRIGGER IF EXISTS update_activity_assets_updated_at ON public.activity_assets;
CREATE TRIGGER update_activity_assets_updated_at
  BEFORE UPDATE ON public.activity_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.activity_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES public.activity_assets(id) ON DELETE CASCADE,
  kind public.activity_kind NOT NULL,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  score real,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_sessions_response_size CHECK (octet_length(response::text) < 64000)
);

-- Defensive FK guard to sessions (optional link)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sessions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='activity_sessions' AND column_name='session_id'
    ) THEN
      ALTER TABLE public.activity_sessions
        ADD COLUMN session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

ALTER TABLE public.activity_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own activity sessions select" ON public.activity_sessions;
CREATE POLICY "Users manage own activity sessions select"
  ON public.activity_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'doctor'::public.app_role));

DROP POLICY IF EXISTS "Users manage own activity sessions insert" ON public.activity_sessions;
CREATE POLICY "Users manage own activity sessions insert"
  ON public.activity_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own activity sessions update" ON public.activity_sessions;
CREATE POLICY "Users manage own activity sessions update"
  ON public.activity_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_activity_sessions_user ON public.activity_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_sessions_asset ON public.activity_sessions (asset_id);
CREATE INDEX IF NOT EXISTS idx_activity_sessions_kind ON public.activity_sessions (kind);

-- =========================================================
-- R6: Foundation tables (no active writers yet)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.analytics_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  dimension text NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.analytics_aggregates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own analytics aggregates" ON public.analytics_aggregates;
CREATE POLICY "Users view own analytics aggregates"
  ON public.analytics_aggregates FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_aggregates_user_created ON public.analytics_aggregates (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_aggregates_period ON public.analytics_aggregates (user_id, period, period_start DESC);
COMMENT ON TABLE public.analytics_aggregates IS 'R6 foundation — no active writer yet. Periodic rollups for dashboards.';

CREATE TABLE IF NOT EXISTS public.ai_insight_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  model text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_insight_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own ai insight summaries" ON public.ai_insight_summaries;
CREATE POLICY "Users view own ai insight summaries"
  ON public.ai_insight_summaries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insight_summaries_user_created ON public.ai_insight_summaries (user_id, created_at DESC);
COMMENT ON TABLE public.ai_insight_summaries IS 'R6 foundation — no active writer yet. AI-authored long-form period summaries.';

CREATE TABLE IF NOT EXISTS public.notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own notification queue" ON public.notification_queue;
CREATE POLICY "Users view own notification queue"
  ON public.notification_queue FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_created ON public.notification_queue (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status_scheduled ON public.notification_queue (status, scheduled_for);
COMMENT ON TABLE public.notification_queue IS 'R6 foundation — no active worker/provider yet. Stub queue for future reminders.';

CREATE TABLE IF NOT EXISTS public.activity_score_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_session_id uuid NOT NULL REFERENCES public.activity_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  component text NOT NULL,
  value real NOT NULL DEFAULT 0,
  weight real NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_score_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own activity score components" ON public.activity_score_components;
CREATE POLICY "Users view own activity score components"
  ON public.activity_score_components FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_activity_score_components_session ON public.activity_score_components (activity_session_id);
CREATE INDEX IF NOT EXISTS idx_activity_score_components_user_created ON public.activity_score_components (user_id, created_at DESC);
COMMENT ON TABLE public.activity_score_components IS 'R6 foundation — no active writer yet. Extensible per-session score breakdown.';

CREATE TABLE IF NOT EXISTS public.clinician_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL,
  target_user_id uuid,
  format text NOT NULL DEFAULT 'pdf',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  result_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clinician_exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Doctors view clinician exports" ON public.clinician_exports;
CREATE POLICY "Doctors view clinician exports"
  ON public.clinician_exports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'::public.app_role));
DROP POLICY IF EXISTS "Doctors insert clinician exports" ON public.clinician_exports;
CREATE POLICY "Doctors insert clinician exports"
  ON public.clinician_exports FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'doctor'::public.app_role) AND auth.uid() = doctor_id);
CREATE INDEX IF NOT EXISTS idx_clinician_exports_doctor_created ON public.clinician_exports (doctor_id, created_at DESC);
COMMENT ON TABLE public.clinician_exports IS 'R6 foundation — no active export worker yet. Future PDF/CSV exports for clinicians.';
-- ============================================================
-- >>>>>> db/manual/R4a_doctor_portal_foundations.sql
-- ============================================================
-- ============================================================================
-- R4a — Doctor Portal Foundations
-- Target backend: dbgncklwmjjzncukhvgm (CANONICAL)
-- Apply manually via Supabase SQL Editor on the dbgncklwmjjzncukhvgm project.
-- ============================================================================
-- Properties:
--   * APPEND-ONLY. No DROP TABLE, no destructive changes.
--   * Idempotent (safe to re-run).
--   * Does NOT touch existing per-user RLS policies.
--   * Adds an additive read-only access path for doctors.
-- ============================================================================

-- 1) Role enum -----------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) user_roles table ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles self read" ON public.user_roles;
CREATE POLICY "user_roles self read"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- 3) has_role() — SECURITY DEFINER avoids recursive RLS ----------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4) Additive doctor READ-ONLY policies (preserves existing user policies)
DROP POLICY IF EXISTS "doctors read sessions" ON public.sessions;
CREATE POLICY "doctors read sessions"
  ON public.sessions FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

DROP POLICY IF EXISTS "doctors read chat_messages" ON public.chat_messages;
CREATE POLICY "doctors read chat_messages"
  ON public.chat_messages FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

DROP POLICY IF EXISTS "doctors read emotion_analyses" ON public.emotion_analyses;
CREATE POLICY "doctors read emotion_analyses"
  ON public.emotion_analyses FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

DROP POLICY IF EXISTS "doctors read profiles" ON public.profiles;
CREATE POLICY "doctors read profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

-- ============================================================================
-- To grant doctor access to a user, run (one-off, manual):
--   INSERT INTO public.user_roles (user_id, role)
--   VALUES ('<auth-user-uuid>', 'doctor')
--   ON CONFLICT (user_id, role) DO NOTHING;
-- ============================================================================

-- ============================================================
-- >>>>>> db/manual/R4b_doctor_review_crisis.sql
-- ============================================================
-- ============================================================================
-- R4b — Doctor Review Workflow & Crisis Management
-- Target backend: fsterbxivhhzipfgpvou (CANONICAL)
-- Also safe to apply to legacy Cloud backend for parity.
-- ============================================================================
-- Properties:
--   * APPEND-ONLY. No DROP TABLE / ALTER on existing tables / destructive ops.
--   * Idempotent (safe to re-run).
--   * Preserves all existing RLS, R1/R2/R3/R4a behaviors.
--   * Depends on R4a: public.has_role(uuid, public.app_role).
-- ============================================================================

-- 1) doctor_reviews ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctor_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  status      text NOT NULL CHECK (status IN ('pending','in_review','closed','escalated')),
  summary     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.doctor_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doctors read reviews"        ON public.doctor_reviews;
DROP POLICY IF EXISTS "doctors insert reviews"      ON public.doctor_reviews;
DROP POLICY IF EXISTS "patients read own reviews"   ON public.doctor_reviews;

CREATE POLICY "doctors read reviews"
  ON public.doctor_reviews FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "doctors insert reviews"
  ON public.doctor_reviews FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'doctor') AND doctor_id = auth.uid());

CREATE POLICY "patients read own reviews"
  ON public.doctor_reviews FOR SELECT
  USING (auth.uid() = patient_id);

-- Truly append-only: NO update / delete policies are created.

CREATE INDEX IF NOT EXISTS idx_doctor_reviews_patient    ON public.doctor_reviews(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_reviews_doctor     ON public.doctor_reviews(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_reviews_status     ON public.doctor_reviews(status);
CREATE INDEX IF NOT EXISTS idx_doctor_reviews_created    ON public.doctor_reviews(created_at DESC);

-- 2) treatment_notes ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.treatment_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   uuid REFERENCES public.doctor_reviews(id) ON DELETE CASCADE,
  doctor_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note        text NOT NULL,
  visibility  text NOT NULL DEFAULT 'doctor' CHECK (visibility IN ('doctor','patient_visible')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doctors read notes"           ON public.treatment_notes;
DROP POLICY IF EXISTS "doctors insert notes"         ON public.treatment_notes;
DROP POLICY IF EXISTS "patients read visible notes"  ON public.treatment_notes;

CREATE POLICY "doctors read notes"
  ON public.treatment_notes FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "doctors insert notes"
  ON public.treatment_notes FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'doctor') AND doctor_id = auth.uid());

CREATE POLICY "patients read visible notes"
  ON public.treatment_notes FOR SELECT
  USING (auth.uid() = patient_id AND visibility = 'patient_visible');

-- Append-only: no update / delete policies.

CREATE INDEX IF NOT EXISTS idx_treatment_notes_patient ON public.treatment_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_notes_review  ON public.treatment_notes(review_id);
CREATE INDEX IF NOT EXISTS idx_treatment_notes_created ON public.treatment_notes(created_at DESC);

-- 3) crisis_flags ------------------------------------------------------------
-- message_id FK is added conditionally so this file remains portable across
-- environments where public.chat_messages may not yet exist.
CREATE TABLE IF NOT EXISTS public.crisis_flags (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id       uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  message_id       uuid,
  severity         text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  source           text NOT NULL CHECK (source IN ('system','doctor','self_report')),
  reason           text,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  acknowledged_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_messages'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'crisis_flags'
      AND constraint_name = 'crisis_flags_message_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.crisis_flags
             ADD CONSTRAINT crisis_flags_message_id_fkey
             FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON DELETE SET NULL';
  END IF;
END $$;

ALTER TABLE public.crisis_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doctors read flags"          ON public.crisis_flags;
DROP POLICY IF EXISTS "doctors insert flags"        ON public.crisis_flags;
DROP POLICY IF EXISTS "doctors update flag ack"     ON public.crisis_flags;
DROP POLICY IF EXISTS "patients self insert flag"   ON public.crisis_flags;
DROP POLICY IF EXISTS "patients read own flags"     ON public.crisis_flags;

CREATE POLICY "doctors read flags"
  ON public.crisis_flags FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "doctors insert flags"
  ON public.crisis_flags FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "doctors update flag ack"
  ON public.crisis_flags FOR UPDATE
  USING (public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "patients self insert flag"
  ON public.crisis_flags FOR INSERT
  WITH CHECK (auth.uid() = patient_id AND source = 'self_report');

CREATE POLICY "patients read own flags"
  ON public.crisis_flags FOR SELECT
  USING (auth.uid() = patient_id);

CREATE INDEX IF NOT EXISTS idx_crisis_flags_status    ON public.crisis_flags(status);
CREATE INDEX IF NOT EXISTS idx_crisis_flags_severity  ON public.crisis_flags(severity);
CREATE INDEX IF NOT EXISTS idx_crisis_flags_patient   ON public.crisis_flags(patient_id);
CREATE INDEX IF NOT EXISTS idx_crisis_flags_created   ON public.crisis_flags(created_at DESC);

-- ============================================================
-- >>>>>> db/manual/R6_doctor_bootstrap.sql
-- ============================================================
-- R6 — Doctor bootstrap helpers
-- Apply once via the Supabase SQL editor (or psql). Idempotent.
--
-- Provides two SECURITY DEFINER RPCs used by /doctor-login:
--   * doctor_bootstrap_available()  — read-only probe
--   * claim_doctor_bootstrap()      — first-time self-claim of 'doctor' role
--
-- Bootstrap closes automatically once any doctor/admin exists in user_roles.

create or replace function public.doctor_bootstrap_available()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists(
    select 1 from public.user_roles
    where role in ('doctor', 'admin')
  );
$$;

revoke all on function public.doctor_bootstrap_available() from public;
grant execute on function public.doctor_bootstrap_available() to authenticated;

create or replace function public.claim_doctor_bootstrap()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_exists boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select exists(
    select 1 from public.user_roles
    where role in ('doctor', 'admin')
  ) into v_exists;

  if v_exists then
    raise exception 'bootstrap_closed';
  end if;

  insert into public.user_roles (user_id, role)
  values (v_uid, 'doctor')
  on conflict (user_id, role) do nothing;

  return true;
end;
$$;

revoke all on function public.claim_doctor_bootstrap() from public;
grant execute on function public.claim_doctor_bootstrap() to authenticated;
