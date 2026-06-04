import { supabase } from '@/integrations/supabase/client';

export interface SessionRow {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  summary_emotion: string | null;
  summary_intensity: number | null;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  user_id: string;
  role: string;
  content: string;
  created_at: string;
}

export async function listSessions(userId: string): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SessionRow[];
}

export async function getSessionMessages(sessionId: string): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChatMessageRow[];
}

export async function createSession(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('sessions')
    .insert({ user_id: userId })
    .select('id')
    .single();
  return data?.id ?? null;
}
