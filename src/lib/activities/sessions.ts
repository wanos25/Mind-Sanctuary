import { sbExt } from '@/lib/supabaseExt';
import type { ActivitySession, ActivityKind } from './types';
import { MAX_RESPONSE_BYTES } from './types';

function clampResponse(response: Record<string, unknown>) {
  try {
    const s = JSON.stringify(response);
    if (s.length <= MAX_RESPONSE_BYTES) return response;
    return { truncated: true, preview: s.slice(0, MAX_RESPONSE_BYTES - 64) };
  } catch {
    return { error: 'unserializable' };
  }
}

export async function startActivitySession(input: {
  user_id: string;
  asset_id: string;
  kind: ActivityKind;
  session_id?: string | null;
}): Promise<ActivitySession> {
  const { data, error } = await sbExt
    .from('activity_sessions')
    .insert([
      {
        user_id: input.user_id,
        asset_id: input.asset_id,
        kind: input.kind,
        session_id: input.session_id ?? null,
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return data as ActivitySession;
}

export async function completeActivitySession(input: {
  id: string;
  response: Record<string, unknown>;
  score?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await sbExt
    .from('activity_sessions')
    .update({
      response: clampResponse(input.response),
      score: input.score ?? null,
      metadata: input.metadata ?? {},
      completed_at: new Date().toISOString(),
    })
    .eq('id', input.id);
  if (error) throw error;
}

export async function listOwnActivitySessions(userId: string): Promise<ActivitySession[]> {
  const { data, error } = await sbExt
    .from('activity_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as ActivitySession[];
}
