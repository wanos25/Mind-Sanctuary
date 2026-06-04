
-- sessions: add summary fields used by SessionChat & Insights
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS summary_emotion text,
  ADD COLUMN IF NOT EXISTS summary_intensity numeric;

-- chat_messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON public.chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS chat_messages_user_idx ON public.chat_messages(user_id);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own chat_messages select" ON public.chat_messages;
CREATE POLICY "own chat_messages select" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own chat_messages insert" ON public.chat_messages;
CREATE POLICY "own chat_messages insert" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own chat_messages delete" ON public.chat_messages;
CREATE POLICY "own chat_messages delete" ON public.chat_messages FOR DELETE USING (auth.uid() = user_id);

-- emotion_analyses
CREATE TABLE IF NOT EXISTS public.emotion_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid,
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  primary_emotion text,
  intensity numeric,
  sentiment text,
  distortions text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS emotion_analyses_user_idx ON public.emotion_analyses(user_id);
ALTER TABLE public.emotion_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own emotion_analyses select" ON public.emotion_analyses;
CREATE POLICY "own emotion_analyses select" ON public.emotion_analyses FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own emotion_analyses insert" ON public.emotion_analyses;
CREATE POLICY "own emotion_analyses insert" ON public.emotion_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own emotion_analyses delete" ON public.emotion_analyses;
CREATE POLICY "own emotion_analyses delete" ON public.emotion_analyses FOR DELETE USING (auth.uid() = user_id);

-- session_memories
CREATE TABLE IF NOT EXISTS public.session_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid,
  topic text NOT NULL,
  emotion_pattern text,
  context text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS session_memories_user_idx ON public.session_memories(user_id, created_at DESC);
ALTER TABLE public.session_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own session_memories select" ON public.session_memories;
CREATE POLICY "own session_memories select" ON public.session_memories FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own session_memories insert" ON public.session_memories;
CREATE POLICY "own session_memories insert" ON public.session_memories FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own session_memories delete" ON public.session_memories;
CREATE POLICY "own session_memories delete" ON public.session_memories FOR DELETE USING (auth.uid() = user_id);
