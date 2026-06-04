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
