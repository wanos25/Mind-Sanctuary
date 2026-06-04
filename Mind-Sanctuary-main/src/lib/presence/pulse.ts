import { supabase } from '@/integrations/supabase/client';

export interface DailyPulse {
  pulse_date: string;
  dominant_emotion: string | null;
  avg_intensity: number | null;
  session_count: number;
  message_count: number;
  summary: string | null;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export async function loadRecentPulses(userId: string, days = 14): Promise<DailyPulse[]> {
  const cutoff = isoDate(new Date(Date.now() - days * 86400000));
  const { data, error } = await supabase
    .from('emotional_pulses')
    .select('*')
    .eq('user_id', userId)
    .gte('pulse_date', cutoff)
    .order('pulse_date', { ascending: false });
  if (error) { console.warn('loadRecentPulses', error); return []; }
  return (data ?? []) as unknown as DailyPulse[];
}

/**
 * Recompute today's pulse from sessions + messages.
 * Idempotent — upserts on (user_id, pulse_date).
 */
export async function recomputeTodayPulse(userId: string) {
  const today = new Date();
  const start = new Date(today); start.setHours(0, 0, 0, 0);
  const end = new Date(today); end.setHours(23, 59, 59, 999);

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, summary_emotion, summary_intensity')
    .eq('user_id', userId)
    .gte('started_at', start.toISOString())
    .lte('started_at', end.toISOString());

  const list = sessions ?? [];
  if (!list.length) return null;

  // message_count lives on chat_messages, not sessions — count separately.
  const sessionIds = list.map((s) => (s as { id: string }).id);
  let messageSum = 0;
  if (sessionIds.length) {
    const { count } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .in('session_id', sessionIds);
    messageSum = count ?? 0;
  }

  const emotionCounts = new Map<string, number>();
  let intensitySum = 0, intensityN = 0;
  for (const s of list) {
    const e = (s as { summary_emotion?: string }).summary_emotion;
    if (e) emotionCounts.set(e, (emotionCounts.get(e) ?? 0) + 1);
    const i = (s as { summary_intensity?: number }).summary_intensity;
    if (typeof i === 'number') { intensitySum += i; intensityN++; }
  }

  const dominant = [...emotionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const avg = intensityN ? intensitySum / intensityN : null;

  const row = {
    user_id: userId,
    pulse_date: isoDate(today),
    dominant_emotion: dominant,
    avg_intensity: avg,
    session_count: list.length,
    message_count: messageSum,
    summary: dominant ? `${list.length} session${list.length === 1 ? '' : 's'} · ${dominant}` : null,
  };
  await supabase.from('emotional_pulses').upsert(row, { onConflict: 'user_id,pulse_date' });
  return row;
}
