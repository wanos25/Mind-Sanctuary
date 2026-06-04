
CREATE TABLE public.session_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  topic TEXT NOT NULL,
  emotion_pattern TEXT,
  context TEXT,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.session_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memories" ON public.session_memories
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memories" ON public.session_memories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories" ON public.session_memories
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
