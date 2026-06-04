import type { RawMindJourneySources } from './loadMindJourney';
import type {
  DailyEmotionalScore,
  GrowthScore,
  JourneyAnalytics,
  JourneyStreaks,
} from './types';

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function scoreFromSignals(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  analytics: JourneyAnalytics,
  streaks: JourneyStreaks,
): number {
  const moodPart = Math.min(25, Math.max(0, 12.5 + analytics.moodImprovementPct / 4));

  const completed = sources.activities.filter((a) => a.completed_at).length;
  const activityPart = Math.min(25, (completed / Math.max(1, sources.activities.length)) * 25);

  const streakPart = Math.min(
    20,
    (streaks.currentStreak / Math.max(streaks.longestStreak, 1)) * 20,
  );

  const engagementPart = Math.min(25, sources.sessions.length * 2.5);

  const scores = dailyScores.map((d) => d.score);
  const mean = avg(scores);
  const variance = scores.length
    ? avg(scores.map((s) => (s - mean) ** 2))
    : 50;
  const stabilityPart = Math.max(0, Math.min(15, 15 - variance / 12));

  return Math.round(
    Math.min(100, Math.max(0, moodPart + activityPart + streakPart + engagementPart + stabilityPart)),
  );
}

function avgForDateKeys(daily: DailyEmotionalScore[], keys: Set<string>): number {
  const subset = daily.filter((d) => keys.has(d.dateKey));
  return subset.length ? avg(subset.map((d) => d.score)) : 0;
}

export function computeGrowthScore(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  analytics: JourneyAnalytics,
  streaks: JourneyStreaks,
): GrowthScore {
  const current = scoreFromSignals(sources, dailyScores, analytics, streaks);

  const sorted = [...dailyScores].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const twoMonthsAgo = new Date(today);
  twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);

  const recentKeys = new Set<string>();
  const priorMonthKeys = new Set<string>();
  for (const d of sorted) {
    const dt = new Date(`${d.dateKey}T12:00:00`);
    if (dt >= monthAgo) recentKeys.add(d.dateKey);
    else if (dt >= twoMonthsAgo && dt < monthAgo) priorMonthKeys.add(d.dateKey);
  }

  const recentAvg = avgForDateKeys(sorted, recentKeys);
  const priorAvg = avgForDateKeys(sorted, priorMonthKeys);
  const deltaThisMonth =
    recentKeys.size && priorMonthKeys.size
      ? Math.round(recentAvg - priorAvg)
      : recentKeys.size
        ? Math.round(recentAvg - avg(sorted.slice(0, Math.max(1, Math.floor(sorted.length / 2))).map((d) => d.score)))
        : 0;

  const firstWeekKeys = new Set(sorted.slice(0, Math.min(7, sorted.length)).map((d) => d.dateKey));
  const earlyAvg = avgForDateKeys(sorted, firstWeekKeys);
  const deltaSinceStart =
    sorted.length >= 2 ? Math.round(current - Math.max(0, Math.min(100, earlyAvg))) : 0;

  return {
    current,
    deltaThisMonth,
    deltaSinceStart,
  };
}
