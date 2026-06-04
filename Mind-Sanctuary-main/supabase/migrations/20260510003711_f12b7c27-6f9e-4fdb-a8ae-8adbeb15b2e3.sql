-- Shared timestamp trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Memory type enum
DO $$ BEGIN
  CREATE TYPE public.memory_type AS ENUM (
    'person','goal','fear','trigger','recovery','achievement','preference','theme','event','habit'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- emotional_memories
CREATE TABLE IF NOT EXISTS public.emotional_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type public.memory_type NOT NULL,
  title text NOT NULL,
  content text,
  emotion text,
  emotional_weight numeric NOT NULL DEFAULT 0.5,
  recurrence_score integer NOT NULL DEFAULT 1,
  confidence numeric NOT NULL DEFAULT 0.5,
  tags text[] NOT NULL DEFAULT '{}',
  source_session_ids uuid[] NOT NULL DEFAULT '{}',
  embedding jsonb,
  last_referenced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.emotional_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memories select" ON public.emotional_memories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own memories insert" ON public.emotional_memories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own memories update" ON public.emotional_memories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own memories delete" ON public.emotional_memories FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_em_user_type ON public.emotional_memories (user_id, type);
CREATE INDEX IF NOT EXISTS idx_em_user_weight ON public.emotional_memories (user_id, emotional_weight DESC);
CREATE TRIGGER trg_em_updated_at BEFORE UPDATE ON public.emotional_memories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- memory_relationships
CREATE TABLE IF NOT EXISTS public.memory_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_memory_id uuid NOT NULL,
  to_memory_id uuid NOT NULL,
  relation_type text NOT NULL DEFAULT 'related',
  strength numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.memory_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rel select" ON public.memory_relationships FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own rel insert" ON public.memory_relationships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rel update" ON public.memory_relationships FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own rel delete" ON public.memory_relationships FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_mrel_user ON public.memory_relationships (user_id);

-- memory_events
CREATE TABLE IF NOT EXISTS public.memory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  memory_id uuid NOT NULL,
  session_id uuid,
  event_type text NOT NULL,
  intensity numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.memory_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mev select" ON public.memory_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own mev insert" ON public.memory_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_mev_user_mem ON public.memory_events (user_id, memory_id);

-- key_moments
CREATE TABLE IF NOT EXISTS public.key_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  message_id uuid,
  moment_type text NOT NULL,
  intensity numeric DEFAULT 0.5,
  emotion text,
  summary text,
  position integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.key_moments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own km select" ON public.key_moments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own km insert" ON public.key_moments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own km update" ON public.key_moments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own km delete" ON public.key_moments FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_km_user_session ON public.key_moments (user_id, session_id);

-- emotional_pulses
CREATE TABLE IF NOT EXISTS public.emotional_pulses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pulse_date date NOT NULL,
  dominant_emotion text,
  avg_intensity numeric,
  session_count integer DEFAULT 0,
  message_count integer DEFAULT 0,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pulse_date)
);
ALTER TABLE public.emotional_pulses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pulse select" ON public.emotional_pulses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own pulse insert" ON public.emotional_pulses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own pulse update" ON public.emotional_pulses FOR UPDATE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_pulse_user_date ON public.emotional_pulses (user_id, pulse_date DESC);

-- achievements
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ach select" ON public.achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own ach insert" ON public.achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_ach_user ON public.achievements (user_id, unlocked_at DESC);

-- ai_personality_state
CREATE TABLE IF NOT EXISTS public.ai_personality_state (
  user_id uuid PRIMARY KEY,
  tone text NOT NULL DEFAULT 'warm',
  empathy_level numeric NOT NULL DEFAULT 0.7,
  pacing text NOT NULL DEFAULT 'measured',
  depth text NOT NULL DEFAULT 'moderate',
  trust_level numeric NOT NULL DEFAULT 0.3,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_personality_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pers select" ON public.ai_personality_state FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own pers insert" ON public.ai_personality_state FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own pers update" ON public.ai_personality_state FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER trg_pers_updated_at BEFORE UPDATE ON public.ai_personality_state
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();