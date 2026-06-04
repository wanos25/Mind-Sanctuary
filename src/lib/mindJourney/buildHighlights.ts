import type { RawMindJourneySources } from './loadMindJourney';
import { wellnessScore } from './computeMetrics';
import type { DailyEmotionalScore, JourneyHighlight, JourneyStreaks } from './types';

export function buildHighlights(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  streaks: JourneyStreaks,
): JourneyHighlight[] {
  const highlights: JourneyHighlight[] = [];

  if (streaks.longestStreak >= 3) {
    const at =
      dailyScores[dailyScores.length - 1]?.dateKey
        ? `${dailyScores[dailyScores.length - 1].dateKey}T12:00:00.000Z`
        : new Date().toISOString();
    highlights.push({
      id: 'hl-streak',
      kind: 'streak',
      title: 'First recovery streak',
      subtitle: `${streaks.longestStreak} days of sustained reflection`,
      at,
    });
  }

  const firstCbt = sources.activities.find(
    (a) => a.completed_at && a.kind === 'cbt_flow',
  );
  if (firstCbt?.completed_at) {
    highlights.push({
      id: 'hl-cbt',
      kind: 'activity',
      title: 'Completed first CBT activity',
      subtitle: 'CBT Flow',
      at: firstCbt.completed_at,
    });
  }

  if (streaks.longestStreak >= 7) {
    highlights.push({
      id: 'hl-consistency-7',
      kind: 'consistency',
      title: '7 day consistency streak',
      subtitle: `${streaks.longestStreak} days at your peak`,
      at: dailyScores[dailyScores.length - 1]
        ? `${dailyScores[dailyScores.length - 1].dateKey}T12:00:00.000Z`
        : new Date().toISOString(),
    });
  }

  const sorted = [...dailyScores].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  let bestDelta = 0;
  let bestDay: DailyEmotionalScore | null = null;
  for (let i = 1; i < sorted.length; i++) {
    const delta = sorted[i].score - sorted[i - 1].score;
    if (delta > bestDelta) {
      bestDelta = delta;
      bestDay = sorted[i];
    }
  }
  if (bestDay && bestDelta >= 10) {
    highlights.push({
      id: 'hl-emotion-improve',
      kind: 'emotion',
      title: 'Strongest emotional improvement',
      subtitle: `Wellness rose ${Math.round(bestDelta)} points on ${bestDay.date}`,
      at: `${bestDay.dateKey}T12:00:00.000Z`,
    });
  }

  const reflective = [...sources.sessions].sort(
    (a, b) =>
      wellnessScore(b.summary_intensity ?? 0.5) - wellnessScore(a.summary_intensity ?? 0.5),
  )[0];
  if (reflective && wellnessScore(reflective.summary_intensity ?? 0.5) >= 55) {
    highlights.push({
      id: 'hl-reflective',
      kind: 'session',
      title: 'Most reflective session',
      subtitle: reflective.summary_emotion ?? 'Deep check-in',
      at: reflective.started_at,
    });
  }

  const firstActivity = sources.activities.find((a) => a.completed_at);
  if (firstActivity?.completed_at && !firstCbt) {
    highlights.push({
      id: 'hl-first-activity',
      kind: 'activity',
      title: 'First structured activity',
      subtitle: firstActivity.kind.replace(/_/g, ' '),
      at: firstActivity.completed_at,
    });
  }

  return highlights.slice(0, 6);
}
