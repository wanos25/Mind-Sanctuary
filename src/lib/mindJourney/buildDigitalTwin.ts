import type { DigitalTwinProfile } from './types';
import type { BaselineSignals } from './predictionModel';
import type {
  DailyEmotionalScore,
  JourneyAnalytics,
  JourneyStreaks,
} from './types';
import type { RawMindJourneySources } from './loadMindJourney';

interface ArchetypeDef {
  id: string;
  name: string;
  tagline: string;
  score: number;
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

export function buildDigitalTwin(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  analytics: JourneyAnalytics,
  streaks: JourneyStreaks,
  baseline: BaselineSignals,
): DigitalTwinProfile {
  const sorted = [...dailyScores].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const meanWellness = sorted.length ? avg(sorted.map((d) => d.score)) : 50;
  const cbtCount = sources.activities.filter(
    (a) => a.completed_at && a.kind === 'cbt_flow',
  ).length;
  const completedActivities = sources.activities.filter((a) => a.completed_at).length;

  const candidates: ArchetypeDef[] = [
    {
      id: 'recovering_builder',
      name: 'The Recovering Builder',
      tagline: 'Rebuilding steadiness, one reflection at a time.',
      score:
        streaks.recoveryDays * 3 +
        Math.max(0, analytics.moodImprovementPct) +
        (meanWellness < 60 && baseline.slopePerDay > 0 ? 25 : 0),
    },
    {
      id: 'consistent_climber',
      name: 'The Consistent Climber',
      tagline: 'Rhythm is your superpower.',
      score:
        analytics.consistencyScore * 0.8 +
        streaks.longestStreak * 5 +
        streaks.currentStreak * 4,
    },
    {
      id: 'reflective_thinker',
      name: 'The Reflective Thinker',
      tagline: 'Depth over noise — you process before you act.',
      score:
        sources.sessions.length * 2 +
        (Math.abs(baseline.slopePerDay) < 0.15 ? 20 : 0) +
        sources.analyses.length,
    },
    {
      id: 'quiet_fighter',
      name: 'The Quiet Fighter',
      tagline: 'Progress happens beneath the surface.',
      score:
        (meanWellness < 58 ? 30 : 10) +
        Math.max(0, analytics.anxietyReductionPct) +
        (analytics.stressTrend === 'improving' ? 20 : 0),
    },
  ];

  const best = [...candidates].sort((a, b) => b.score - a.score)[0];

  const emotions: Record<string, number> = {};
  for (const d of sorted) {
    emotions[d.dominantEmotion] = (emotions[d.dominantEmotion] ?? 0) + 1;
  }
  const topEmotion = Object.entries(emotions).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'mixed';

  const strengths: string[] = [];
  if (streaks.longestStreak >= 3) {
    strengths.push(`${streaks.longestStreak}-day reflection streak shows commitment.`);
  }
  if (analytics.consistencyScore >= 55) {
    strengths.push(`Consistency score ${analytics.consistencyScore}/100 — you return to yourself.`);
  }
  if (cbtCount > 0) {
    strengths.push(`${cbtCount} completed CBT flow${cbtCount === 1 ? '' : 's'} build structured coping.`);
  }
  if (strengths.length === 0) {
    strengths.push('Early data shows willingness to start the journey.');
  }

  const emotionalPatterns = [
    `Dominant emotional tone: ${topEmotion.replace(/_/g, ' ')}.`,
    `Average wellness ${Math.round(meanWellness)}/100 across ${sorted.length || 0} tracked days.`,
    `Stress trend: ${analytics.stressTrend}.`,
  ];

  const blindSpots: string[] = [];
  if (completedActivities === 0) {
    blindSpots.push('Structured activities are underused — tools exist but stay idle.');
  }
  if (streaks.currentStreak === 0 && streaks.reflectionDays > 2) {
    blindSpots.push('Gaps between check-ins flatten momentum.');
  }
  if (analytics.moodImprovementPct < 0) {
    blindSpots.push('Recent wellness dip — easy to interpret as failure instead of data.');
  }
  if (blindSpots.length === 0) {
    blindSpots.push('Watch for over-relying on insight without rest days.');
  }

  const growthOpportunities: string[] = [];
  if (baseline.engagementPerWeek < 3) {
    growthOpportunities.push('Add one more weekly session to sharpen forecasts.');
  }
  if (analytics.consistencyScore < 70) {
    growthOpportunities.push('Anchor a fixed 5-minute daily check-in time.');
  }
  growthOpportunities.push(
    completedActivities < 3
      ? 'Layer educational or CBT activities to diversify your toolkit.'
      : 'Maintain activity variety to keep resilience scores rising.',
  );

  return {
    archetypeId: best.id,
    archetype: best.name,
    tagline: best.tagline,
    strengths: strengths.slice(0, 4),
    emotionalPatterns: emotionalPatterns.slice(0, 3),
    blindSpots: blindSpots.slice(0, 3),
    growthOpportunities: growthOpportunities.slice(0, 3),
  };
}
