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
