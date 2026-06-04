import type { RawMindJourneySources } from './loadMindJourney';
import type {
  DailyEmotionalScore,
  JourneyAnalytics,
  JourneyStreaks,
} from './types';
import { computeWellnessSlope } from './predictionModel';

const ANXIETY_EMOTIONS = new Set([
  'anxiety',
  'moderate anxiety',
  'fear',
  'stress',
  'mild stress',
  'worry',
]);

export function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export interface RiskInputSignals {
  recentWellness: number;
  priorWellness: number;
  wellnessSlope: number;
  hiddenDrop: number;
  sessionsLast14: number;
  sessionsPrior14: number;
  activitiesLast30: number;
  streakBroken: boolean;
  daysSinceReflection: number;
  anxietyRecent: number;
  anxietyPrior: number;
  moodImprovementPct: number;
  consistencyScore: number;
  dataConfidence: number;
}

export function extractRiskSignals(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  analytics: JourneyAnalytics,
  streaks: JourneyStreaks,
): RiskInputSignals {
  const sorted = [...dailyScores].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const recent = sorted.slice(-7);
  const prior = sorted.slice(-14, -7);
  const recentWellness = recent.length ? avg(recent.map((d) => d.score)) : 50;
  const priorWellness = prior.length ? avg(prior.map((d) => d.score)) : recentWellness;
  const hiddenDrop = priorWellness - recentWellness;

  const today = new Date();
  const d14 = new Date(today);
  d14.setDate(d14.getDate() - 14);
  const d28 = new Date(today);
  d28.setDate(d28.getDate() - 28);

  const sessionsLast14 = sources.sessions.filter(
    (s) => new Date(s.started_at) >= d14,
  ).length;
  const sessionsPrior14 = sources.sessions.filter((s) => {
    const t = new Date(s.started_at);
    return t >= d28 && t < d14;
  }).length;

  const d30 = new Date(today);
  d30.setDate(d30.getDate() - 30);
  const activitiesLast30 = sources.activities.filter(
    (a) => a.completed_at && new Date(a.completed_at) >= d30,
  ).length;

  const lastKey = sorted[sorted.length - 1]?.dateKey;
  const daysSinceReflection = lastKey
    ? Math.round(
        (today.getTime() - new Date(`${lastKey}T12:00:00`).getTime()) / 86400000,
      )
    : 99;

  const mid = Math.floor(sources.sessions.length / 2);
  const recentSessions = sources.sessions.slice(mid);
  const priorSessions = sources.sessions.slice(0, mid);
  const anxietyRecent = anxietyShare(recentSessions);
  const anxietyPrior = anxietyShare(priorSessions);

  return {
    recentWellness,
    priorWellness,
    wellnessSlope: computeWellnessSlope(sorted.slice(-14)),
    hiddenDrop,
    sessionsLast14,
    sessionsPrior14,
    activitiesLast30,
    streakBroken: streaks.currentStreak === 0 && streaks.reflectionDays > 2,
    daysSinceReflection,
    anxietyRecent,
    anxietyPrior,
    moodImprovementPct: analytics.moodImprovementPct,
    consistencyScore: analytics.consistencyScore,
    dataConfidence: clamp(35 + sorted.length * 4 + sources.sessions.length * 2, 30, 92),
  };
}

function anxietyShare(
  sessions: RawMindJourneySources['sessions'],
): number {
  if (!sessions.length) return 0;
  const anxious = sessions.filter((s) =>
    ANXIETY_EMOTIONS.has((s.summary_emotion ?? '').toLowerCase()),
  );
  return anxious.length / sessions.length;
}
