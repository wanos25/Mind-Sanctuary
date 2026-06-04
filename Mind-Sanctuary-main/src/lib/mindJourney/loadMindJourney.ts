import { supabase } from '@/integrations/supabase/client';
import { sbExt } from '@/lib/supabaseExt';
import type { SessionRow } from '@/lib/sessions';
import type { EmotionAnalysisRow } from '@/lib/insightsAggregator';
import type { ActivitySession } from '@/lib/activities/types';

function isTableUnavailable(error: unknown): boolean {
  const e = error as { code?: string; message?: string; status?: number };
  const msg = (e.message ?? '').toLowerCase();
  return (
    e.status === 404
    || e.code === '42P01'
    || e.code === 'PGRST205'
    || msg.includes('could not find the table')
  );
}

async function safeList<T>(
  run: () => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  try {
    const { data, error } = await run();
    if (error) {
      if (isTableUnavailable(error)) return [];
      throw error;
    }
    return data ?? [];
  } catch (e) {
    if (isTableUnavailable(e)) return [];
    throw e;
  }
}

export interface RawMindJourneySources {
  sessions: SessionRow[];
  analyses: EmotionAnalysisRow[];
  activities: ActivitySession[];
  moments: Array<{
    id: string;
    created_at: string;
    moment_type: string;
    emotion: string | null;
    summary: string | null;
    intensity: number | null;
    session_id: string;
  }>;
}

export async function loadMindJourneySources(userId: string): Promise<RawMindJourneySources> {
  const [sessions, analyses, activities, moments] = await Promise.all([
    supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: true })
      .then((r) => {
        if (r.error) throw r.error;
        return (r.data ?? []) as SessionRow[];
      }),
    supabase
      .from('emotion_analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .then((r) => {
        if (r.error) throw r.error;
        return (r.data ?? []) as unknown as EmotionAnalysisRow[];
      }),
    safeList(() =>
      sbExt
        .from('activity_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('archived', false)
        .order('started_at', { ascending: true })
        .limit(200) as Promise<{ data: ActivitySession[] | null; error: unknown }>,
    ),
    safeList(() =>
      supabase
        .from('key_moments')
        .select('id, created_at, moment_type, emotion, summary, intensity, session_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(200) as Promise<{
        data: RawMindJourneySources['moments'] | null;
        error: unknown;
      }>,
    ),
  ]);

  return { sessions, analyses, activities, moments };
}
