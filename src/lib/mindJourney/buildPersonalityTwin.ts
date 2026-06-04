import type { PersonalityTwinProfile, TraitEvidence } from './types';
import type { RawMindJourneySources } from './loadMindJourney';
import type {
  DailyEmotionalScore,
  JourneyAnalytics,
  JourneyStreaks,
} from './types';
import { avg, clamp } from './riskSignals';

const ANXIETY_EMOTIONS = new Set(['anxiety', 'fear', 'stress', 'worry', 'moderate anxiety']);

export function buildPersonalityTwin(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  analytics: JourneyAnalytics,
  streaks: JourneyStreaks,
): PersonalityTwinProfile {
  const sorted = [...dailyScores].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const meanWellness = sorted.length ? avg(sorted.map((d) => d.score)) : 50;
  const mid = Math.floor(sources.sessions.length / 2);
  const earlySessions = sources.sessions.slice(0, mid);
  const lateSessions = sources.sessions.slice(mid);
  const earlyWellness = avg(earlySessions.map((s) => 100 - (s.summary_intensity ?? 0.5) * 100));
  const lateWellness = avg(lateSessions.map((s) => 100 - (s.summary_intensity ?? 0.5) * 100));
  const wellnessShift = Math.round(lateWellness - earlyWellness);

  const emotions: Record<string, number> = {};
  for (const s of sources.sessions) {
    const e = (s.summary_emotion ?? 'unknown').toLowerCase();
    emotions[e] = (emotions[e] ?? 0) + 1;
  }
  const topEmotions = Object.entries(emotions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([e]) => e.replace(/_/g, ' '));

  const completedActivities = sources.activities.filter((a) => a.completed_at).length;
  const cbtCount = sources.activities.filter(
    (a) => a.completed_at && a.kind === 'cbt_flow',
  ).length;

  const coreTraits: string[] = [];
  if (streaks.longestStreak >= 4) coreTraits.push('Steadfast');
  if (sources.sessions.length >= 8) coreTraits.push('Introspective');
  if (cbtCount >= 1) coreTraits.push('Structured');
  if (analytics.moodImprovementPct >= 5) coreTraits.push('Adaptive');
  if (coreTraits.length < 2) coreTraits.push('Emerging', 'Curious');

  const emotionalTriggers = topEmotions
    .filter((e) => ANXIETY_EMOTIONS.has(e) || e.includes('stress') || e.includes('anxiety'))
    .slice(0, 3);
  if (!emotionalTriggers.length && topEmotions.length) {
    emotionalTriggers.push(
      `Shifts when ${topEmotions[0]} surfaces repeatedly in sessions.`,
    );
  }
  if (!emotionalTriggers.length) {
    emotionalTriggers.push('Intensity spikes after gaps in reflection.');
  }

  const recoveryStrengths: string[] = [];
  if (streaks.recoveryDays >= 3) {
    recoveryStrengths.push(`${streaks.recoveryDays} high-wellness days logged.`);
  }
  if (analytics.anxietyReductionPct >= 5) {
    recoveryStrengths.push(
      `Anxiety intensity down ~${analytics.anxietyReductionPct}% across your timeline.`,
    );
  }
  if (completedActivities >= 2) {
    recoveryStrengths.push('Structured activities reinforce your resets.');
  }
  if (!recoveryStrengths.length) {
    recoveryStrengths.push('You return after dips — that pattern is a strength.');
  }

  const hiddenWeaknesses: string[] = [];
  if (streaks.currentStreak === 0) {
    hiddenWeaknesses.push('Momentum fades when daily rhythm breaks.');
  }
  if (completedActivities === 0) {
    hiddenWeaknesses.push('Relies on reflection alone — tools stay unused.');
  }
  if (analytics.stressTrend === 'rising') {
    hiddenWeaknesses.push('May push through stress without pausing.');
  }
  if (!hiddenWeaknesses.length) {
    hiddenWeaknesses.push('Can over-analyze without action steps.');
  }

  let communicationStyle = 'Measured and reflective — you process before responding.';
  if (sources.sessions.length >= 10) {
    communicationStyle = 'Verbal processor — frequent sessions show you think out loud.';
  } else if (completedActivities > sources.sessions.length * 0.5) {
    communicationStyle = 'Action-oriented — you prefer exercises over long dialogue.';
  }

  const growthOpportunities: string[] = [];
  if (analytics.consistencyScore < 65) {
    growthOpportunities.push('Anchor a fixed micro-habit to raise consistency.');
  }
  if (cbtCount === 0) {
    growthOpportunities.push('Add one CBT flow to build cognitive flexibility.');
  }
  growthOpportunities.push(
    wellnessShift > 0
      ? 'Lean into what worked in your recent chapter — scores are climbing.'
      : 'Pair reflection with one weekly activity to stabilize mood.',
  );

  const evidence: TraitEvidence[] = [
    {
      label: 'Session depth',
      detail: `${sources.sessions.length} reflections · avg wellness ${Math.round(meanWellness)}`,
    },
    {
      label: 'Streak behavior',
      detail: `Longest ${streaks.longestStreak} days · current ${streaks.currentStreak}`,
    },
    {
      label: 'Activity mix',
      detail: `${completedActivities} completed activities (${cbtCount} CBT)`,
    },
  ];

  const changesOverTime: string[] = [];
  if (wellnessShift !== 0) {
    changesOverTime.push(
      `Wellness ${wellnessShift > 0 ? 'improved' : 'softened'} ~${Math.abs(wellnessShift)} pts from early to recent sessions.`,
    );
  }
  if (lateSessions.length > earlySessions.length) {
    changesOverTime.push('Engagement shifted toward more frequent check-ins.');
  }
  if (analytics.consistencyScore >= 60) {
    changesOverTime.push(`Consistency holds at ${analytics.consistencyScore}/100.`);
  }

  const confidence = clamp(
    40 + sources.sessions.length * 3 + sorted.length * 2 + completedActivities * 2,
    45,
    94,
  );

  return {
    coreTraits: coreTraits.slice(0, 5),
    emotionalTriggers: emotionalTriggers.slice(0, 4),
    recoveryStrengths: recoveryStrengths.slice(0, 4),
    hiddenWeaknesses: hiddenWeaknesses.slice(0, 3),
    communicationStyle,
    growthOpportunities: growthOpportunities.slice(0, 3),
    confidence,
    evidence,
    changesOverTime: changesOverTime.slice(0, 4),
    displayName: 'Your AI Twin',
  };
}
