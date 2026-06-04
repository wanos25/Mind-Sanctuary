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
