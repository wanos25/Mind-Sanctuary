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
