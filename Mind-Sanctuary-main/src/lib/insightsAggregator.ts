import { supabase } from '@/integrations/supabase/client';
import { SessionRow } from './sessions';

export interface EmotionAnalysisRow {
  id: string;
  user_id: string;
  session_id: string;
  primary_emotion: string | null;
  sentiment: number | null;
  intensity: number | null;
  distortions: string[] | null;
  created_at: string;
}

export interface InsightsData {
  sessions: SessionRow[];
  analyses: EmotionAnalysisRow[];
  trend: { date: string; intensity: number; emotion: string }[];
  distribution: { emotion: string; count: number; color: string }[];
  weekly: { day: string; sessions: number; intensity: number }[];
  distortions: { name: string; count: number }[];
  totals: {
    sessions: number;
    avgIntensity: number;
    dominantEmotion: string;
    intensityDelta: number; // % change vs previous period
    consistencyDays: number;
  };
  headline: string;
}

export const EMOTION_COLORS: Record<string, string> = {
  calm: 'hsl(170 60% 60%)',
  'mild stress': 'hsl(45 80% 60%)',
  'moderate anxiety': 'hsl(25 85% 58%)',
  'severe depression': 'hsl(220 50% 55%)',
  burnout: 'hsl(0 70% 60%)',
  joy: 'hsl(50 90% 65%)',
  sadness: 'hsl(220 40% 50%)',
  anger: 'hsl(0 75% 55%)',
  fear: 'hsl(280 50% 55%)',
  default: 'hsl(38 50% 55%)',
};

export const colorForEmotion = (e?: string | null) =>
  (e && EMOTION_COLORS[e.toLowerCase()]) || EMOTION_COLORS.default;

export async function loadInsights(userId: string): Promise<InsightsData> {
  const [{ data: sessionsData }, { data: analysesData }] = await Promise.all([
    supabase.from('sessions').select('*').eq('user_id', userId).order('started_at', { ascending: true }),
    supabase.from('emotion_analyses').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
  ]);

  const sessions = (sessionsData ?? []) as SessionRow[];
  const analyses = (analysesData ?? []) as unknown as EmotionAnalysisRow[];

  // Trend over sessions
  const trend = sessions.map((s) => ({
    date: new Date(s.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    intensity: Math.round((s.summary_intensity ?? 0) * 100),
    emotion: s.summary_emotion ?? '—',
  }));

  // Distribution
  const distMap: Record<string, number> = {};
  sessions.forEach((s) => {
    const e = (s.summary_emotion ?? 'unknown').toLowerCase();
    distMap[e] = (distMap[e] ?? 0) + 1;
  });
  analyses.forEach((a) => {
    if (!a.primary_emotion) return;
    const e = a.primary_emotion.toLowerCase();
    if (!distMap[e]) distMap[e] = 0;
  });
  const distribution = Object.entries(distMap)
    .map(([emotion, count]) => ({ emotion, count, color: colorForEmotion(emotion) }))
    .sort((a, b) => b.count - a.count);

  // Weekly rhythm
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekAgg: Record<string, { count: number; sumI: number }> = {};
  days.forEach((d) => (weekAgg[d] = { count: 0, sumI: 0 }));
  sessions.forEach((s) => {
    const d = days[new Date(s.started_at).getDay()];
    weekAgg[d].count += 1;
    weekAgg[d].sumI += s.summary_intensity ?? 0;
  });
  const weekly = days.map((d) => ({
    day: d,
    sessions: weekAgg[d].count,
    intensity: weekAgg[d].count ? Math.round((weekAgg[d].sumI / weekAgg[d].count) * 100) : 0,
  }));

  // Distortions
  const distCounts: Record<string, number> = {};
  analyses.forEach((a) => a.distortions?.forEach((d) => (distCounts[d] = (distCounts[d] ?? 0) + 1)));
  const distortions = Object.entries(distCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Totals + delta
  const total = sessions.length;
  const avgIntensity = total
    ? sessions.reduce((a, s) => a + (s.summary_intensity ?? 0), 0) / total
    : 0;
  const half = Math.floor(total / 2);
  const recent = sessions.slice(half);
  const earlier = sessions.slice(0, half);
  const recentAvg = recent.length
    ? recent.reduce((a, s) => a + (s.summary_intensity ?? 0), 0) / recent.length
    : 0;
  const earlierAvg = earlier.length
    ? earlier.reduce((a, s) => a + (s.summary_intensity ?? 0), 0) / earlier.length
    : 0;
  const intensityDelta = earlierAvg ? Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100) : 0;

  const dominantEmotion = distribution[0]?.emotion ?? '—';

  // Consistency: unique days with a session in last 14 days
  const cutoff = Date.now() - 14 * 86400000;
  const uniqueDays = new Set(
    sessions
      .filter((s) => new Date(s.started_at).getTime() >= cutoff)
      .map((s) => new Date(s.started_at).toDateString())
  );

  const headline = buildHeadline({ total, intensityDelta, dominantEmotion });

  return {
    sessions,
    analyses,
    trend,
    distribution,
    weekly,
    distortions,
    totals: {
      sessions: total,
      avgIntensity: Math.round(avgIntensity * 100),
      dominantEmotion,
      intensityDelta,
      consistencyDays: uniqueDays.size,
    },
    headline,
  };
}

function buildHeadline({ total, intensityDelta, dominantEmotion }: { total: number; intensityDelta: number; dominantEmotion: string }) {
  if (total === 0) return 'Your emotional observatory awakens with your first session.';
  if (total < 3) return 'A pattern is beginning to form. Keep reflecting.';
  if (intensityDelta <= -10) return `You've felt ${Math.abs(intensityDelta)}% calmer recently.`;
  if (intensityDelta >= 10) return `Emotional intensity has risen ${intensityDelta}% — be gentle with yourself.`;
  return `You've been emotionally consistent — mostly ${dominantEmotion}.`;
}

export function generateAIInsights(data: InsightsData): string[] {
  const out: string[] = [];
  const { totals, weekly, distortions, distribution, sessions } = data;

  if (totals.sessions === 0) return out;

  const peakDay = [...weekly].sort((a, b) => b.sessions - a.sessions)[0];
  if (peakDay && peakDay.sessions > 0) {
    out.push(`You reflect most often on ${peakDay.day}s — a meaningful rhythm.`);
  }

  if (totals.intensityDelta <= -10) {
    out.push(`Your emotional intensity has dropped ${Math.abs(totals.intensityDelta)}% — a sign of growing balance.`);
  } else if (totals.intensityDelta >= 15) {
    out.push(`Recent sessions show heightened intensity. Consider a breathing exercise.`);
  }

  if (distortions[0]) {
    out.push(`Your most recurring pattern is "${distortions[0].name}", noticed ${distortions[0].count} time${distortions[0].count === 1 ? '' : 's'}.`);
  }

  if (distribution[0]) {
    out.push(`Your dominant emotional landscape this period: ${distribution[0].emotion}.`);
  }

  // Late-night reflection?
  const lateNight = sessions.filter((s) => {
    const h = new Date(s.started_at).getHours();
    return h >= 22 || h <= 4;
  }).length;
  if (lateNight >= Math.max(2, Math.floor(sessions.length * 0.3))) {
    out.push(`You engage more deeply during late-night reflections — your mind opens after dark.`);
  }

  if (totals.consistencyDays >= 5) {
    out.push(`You've checked in on ${totals.consistencyDays} different days in the last 2 weeks — strong consistency.`);
  }

  return out.slice(0, 5);
}
