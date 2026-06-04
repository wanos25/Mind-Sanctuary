import { colorForEmotion } from '@/lib/insightsAggregator';
import type { RawMindJourneySources } from './loadMindJourney';
import type {
  DailyEmotionalScore,
  JourneyAnalytics,
  JourneyStreaks,
  JourneyTimelineEvent,
} from './types';

const ANXIETY_EMOTIONS = new Set([
  'anxiety',
  'moderate anxiety',
  'fear',
  'stress',
  'mild stress',
  'worry',
]);

export function wellnessScore(intensity: number, sentiment?: number | null): number {
  const inv = 1 - Math.min(1, Math.max(0, intensity));
  const sentBoost = sentiment != null ? ((sentiment + 1) / 2) * 0.15 : 0;
  return Math.round(Math.min(100, Math.max(0, (inv + sentBoost) * 100)));
}

function dateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function buildDailyScores(sources: RawMindJourneySources): DailyEmotionalScore[] {
  const byDay = new Map<string, { sum: number; n: number; emotions: Record<string, number> }>();

  for (const s of sources.sessions) {
    const key = dateKey(s.started_at);
    const score = wellnessScore(s.summary_intensity ?? 0.5);
    const bucket = byDay.get(key) ?? { sum: 0, n: 0, emotions: {} };
    bucket.sum += score;
    bucket.n += 1;
    const em = (s.summary_emotion ?? 'unknown').toLowerCase();
    bucket.emotions[em] = (bucket.emotions[em] ?? 0) + 1;
    byDay.set(key, bucket);
  }

  for (const a of sources.analyses) {
    const key = dateKey(a.created_at);
    const score = wellnessScore(a.intensity ?? 0.5, a.sentiment);
    const bucket = byDay.get(key) ?? { sum: 0, n: 0, emotions: {} };
    bucket.sum += score;
    bucket.n += 1;
    const em = (a.primary_emotion ?? 'unknown').toLowerCase();
    bucket.emotions[em] = (bucket.emotions[em] ?? 0) + 1;
    byDay.set(key, bucket);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const dominant = Object.entries(v.emotions).sort((x, y) => y[1] - x[1])[0]?.[0] ?? '—';
      return {
        dateKey: key,
        date: new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        score: Math.round(v.sum / Math.max(1, v.n)),
        sessionCount: v.n,
        dominantEmotion: dominant,
      };
    });
}

export function computeStreaks(dailyScores: DailyEmotionalScore[]): JourneyStreaks {
  const sorted = [...dailyScores].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  let current = 0;
  let longest = 0;
  let prev: string | null = null;

  for (const d of sorted) {
    if (!prev) {
      current = 1;
    } else {
      const prevDate = new Date(`${prev}T12:00:00`);
      const curDate = new Date(`${d.dateKey}T12:00:00`);
      const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / 86400000);
      current = diffDays === 1 ? current + 1 : 1;
    }
    longest = Math.max(longest, current);
    prev = d.dateKey;
  }

  const today = new Date().toISOString().slice(0, 10);
  const last = sorted[sorted.length - 1]?.dateKey;
  const lastDate = last ? new Date(`${last}T12:00:00`) : null;
  const todayDate = new Date(`${today}T12:00:00`);
  const daysSinceLast =
    lastDate ? Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000) : 999;
  const activeStreak = daysSinceLast <= 1 ? current : 0;

  const recoveryDays = sorted.filter((d) => d.score >= 60).length;

  return {
    reflectionDays: sorted.length,
    currentStreak: activeStreak,
    longestStreak: longest,
    recoveryDays,
  };
}

function splitPeriodScores(daily: DailyEmotionalScore[]): { first: number[]; second: number[] } {
  if (daily.length < 2) return { first: daily.map((d) => d.score), second: [] };
  const mid = Math.floor(daily.length / 2);
  return {
    first: daily.slice(0, mid).map((d) => d.score),
    second: daily.slice(mid).map((d) => d.score),
  };
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function anxietyIntensity(sources: RawMindJourneySources, slice: 'first' | 'second'): number {
  const sessions = sources.sessions;
  const mid = Math.floor(sessions.length / 2);
  const subset =
    slice === 'first' ? sessions.slice(0, mid) : sessions.slice(mid);
  const anxietySessions = subset.filter((s) =>
    ANXIETY_EMOTIONS.has((s.summary_emotion ?? '').toLowerCase()),
  );
  if (!anxietySessions.length) {
    return avg(subset.map((s) => s.summary_intensity ?? 0.5));
  }
  return avg(anxietySessions.map((s) => s.summary_intensity ?? 0.5));
}

export function buildAnalytics(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  streaks: JourneyStreaks,
): JourneyAnalytics {
  const { first, second } = splitPeriodScores(dailyScores);
  const firstAvg = avg(first);
  const secondAvg = avg(second);
  const moodImprovementPct =
    firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;

  const anxFirst = anxietyIntensity(sources, 'first');
  const anxSecond = anxietyIntensity(sources, 'second');
  const anxietyReductionPct =
    anxFirst > 0 ? Math.round(((anxFirst - anxSecond) / anxFirst) * 100) : 0;

  let stressTrend: JourneyAnalytics['stressTrend'] = 'stable';
  if (moodImprovementPct >= 8) stressTrend = 'improving';
  else if (moodImprovementPct <= -8) stressTrend = 'rising';

  const maxStreak = Math.max(streaks.longestStreak, 1);
  const consistencyScore = Math.min(
    100,
    Math.round((streaks.reflectionDays / 14) * 50 + (streaks.currentStreak / maxStreak) * 50),
  );

  return {
    moodImprovementPct,
    anxietyReductionPct,
    stressTrend,
    consistencyScore,
  };
}

export function buildTimelineEvents(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  streaks: JourneyStreaks,
): JourneyTimelineEvent[] {
  const events: JourneyTimelineEvent[] = [];

  for (const d of dailyScores) {
    events.push({
      id: `daily-${d.dateKey}`,
      kind: 'daily_score',
      at: `${d.dateKey}T12:00:00.000Z`,
      title: d.date,
      subtitle: d.dominantEmotion,
      score: d.score,
      emotion: d.dominantEmotion,
      meta: { sessions: d.sessionCount },
    });
  }

  for (const s of sources.sessions) {
    const score = wellnessScore(s.summary_intensity ?? 0.5);
    events.push({
      id: `session-${s.id}`,
      kind: 'session',
      at: s.started_at,
      title: s.summary_emotion ?? 'Reflection session',
      subtitle: new Date(s.started_at).toLocaleString(),
      score,
      emotion: s.summary_emotion ?? undefined,
      meta: { intensity: Math.round((s.summary_intensity ?? 0) * 100) },
    });
  }

  for (const a of sources.activities.filter((x) => x.completed_at)) {
    events.push({
      id: `activity-${a.id}`,
      kind: 'activity',
      at: a.completed_at!,
      title: a.kind.replace(/_/g, ' '),
      subtitle: a.score != null ? `Score ${Math.round(a.score)}` : undefined,
      meta: { kind: a.kind },
    });
  }

  for (const m of sources.moments) {
    events.push({
      id: `moment-${m.id}`,
      kind: 'moment',
      at: m.created_at,
      title: m.moment_type.replace(/_/g, ' '),
      subtitle: m.summary ?? m.emotion ?? undefined,
      emotion: m.emotion ?? undefined,
      meta: { intensity: m.intensity ?? 0 },
    });
  }

  const milestones: { id: string; at: string; title: string; subtitle: string }[] = [];
  if (sources.sessions.length >= 1) {
    milestones.push({
      id: 'ms-first',
      at: sources.sessions[0].started_at,
      title: 'First reflection',
      subtitle: 'Your journey began',
    });
  }
  if (sources.sessions.length >= 5) {
    milestones.push({
      id: 'ms-five',
      at: sources.sessions[4].started_at,
      title: 'Five sessions',
      subtitle: 'Building consistency',
    });
  }
  if (streaks.longestStreak >= 3) {
    const at = dailyScores[dailyScores.length - 1]?.dateKey ?? new Date().toISOString();
    milestones.push({
      id: 'ms-streak',
      at: `${at}T12:00:00.000Z`,
      title: `${streaks.longestStreak}-day streak`,
      subtitle: 'Sustained reflection',
    });
  }
  if (sources.activities.some((a) => a.completed_at)) {
    const first = sources.activities.find((a) => a.completed_at)!;
    milestones.push({
      id: 'ms-activity',
      at: first.completed_at!,
      title: 'First activity completed',
      subtitle: first.kind.replace(/_/g, ' '),
    });
  }

  for (const m of milestones) {
    events.push({ id: m.id, kind: 'milestone', at: m.at, title: m.title, subtitle: m.subtitle });
  }

  if (streaks.currentStreak >= 2) {
    events.push({
      id: 'streak-current',
      kind: 'streak',
      at: new Date().toISOString(),
      title: `${streaks.currentStreak}-day recovery streak`,
      subtitle: 'Active engagement',
      meta: { days: streaks.currentStreak },
    });
  }

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export { colorForEmotion };
