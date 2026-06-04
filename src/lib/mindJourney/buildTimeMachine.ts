import type { EmotionalTimeMachine, TimeMachineMilestone, TimeSelfSnapshot } from './types';
import type { RawMindJourneySources } from './loadMindJourney';
import type {
  DailyEmotionalScore,
  JourneyHighlight,
  JourneyStreaks,
  MindJourneyFutureSelf,
} from './types';
import { avg, clamp } from './riskSignals';
import { projectHorizon } from './predictionModel';
import type { JourneyAnalytics } from './types';

function snapshotAt(
  label: 'past' | 'present' | 'future',
  wellness: number,
  resilience: number,
  consistency: number,
  recoveryCapacity: number,
  challenges: string[],
  dateLabel: string,
): TimeSelfSnapshot {
  return {
    label,
    dateLabel,
    emotionalScore: Math.round(wellness),
    resilience: Math.round(resilience),
    consistency: Math.round(consistency),
    recoveryCapacity: Math.round(recoveryCapacity),
    majorChallenges: challenges.slice(0, 4),
  };
}

function pickMilestones(
  events: Array<{ id: string; title: string; at: string; kind: string }>,
  highlights: JourneyHighlight[],
): TimeMachineMilestone[] {
  const fromEvents = events
    .filter((e) => e.kind === 'milestone' || e.kind === 'streak')
    .slice(0, 4)
    .map((e) => ({
      id: e.id,
      title: e.title,
      at: e.at,
      memory: e.title,
    }));
  const fromHighlights = highlights.slice(0, 3).map((h) => ({
    id: h.id,
    title: h.title,
    at: h.at,
    memory: h.subtitle ?? h.title,
  }));
  return [...fromEvents, ...fromHighlights].slice(0, 6);
}

export function buildTimeMachine(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  analytics: JourneyAnalytics,
  streaks: JourneyStreaks,
  futureSelf: MindJourneyFutureSelf,
  highlights: JourneyHighlight[],
  events: Array<{ id: string; title: string; at: string; kind: string }>,
): EmotionalTimeMachine {
  const sorted = [...dailyScores].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const baseline = futureSelf.baseline;
  const presentWellness = sorted.length
    ? sorted[sorted.length - 1].score
    : Math.round(baseline.wellness);

  const target90 = new Date();
  target90.setDate(target90.getDate() - 90);
  const targetMs = target90.getTime();

  const pastSlice =
    sorted.filter((d) => {
      const t = new Date(`${d.dateKey}T12:00:00`).getTime();
      return Math.abs(t - targetMs) <= 7 * 86400000;
    }) ||
    [];
  const pastFallback =
    pastSlice.length > 0 ? pastSlice : sorted.slice(0, Math.min(7, sorted.length));
  const pastSliceFinal = pastFallback;
  const pastWellness = pastSliceFinal.length
    ? avg(pastSliceFinal.map((d) => d.score))
    : presentWellness - 10;
  const pastLabel = pastSliceFinal[0]
    ? new Date(`${pastSliceFinal[0].dateKey}T12:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      })
    : '90 days ago';

  const proj90 = projectHorizon(baseline, 'continue', 90);
  const proj180 = projectHorizon(baseline, 'continue', 180);

  const pastChallenges: string[] = [];
  if (pastWellness < 50) pastChallenges.push('Lower wellness baseline');
  if (analytics.stressTrend === 'rising') pastChallenges.push('Stress was building');
  if (!pastChallenges.length) pastChallenges.push('Establishing reflection habit');

  const presentChallenges: string[] = [];
  if (streaks.currentStreak === 0) presentChallenges.push('Streak needs renewal');
  if (analytics.consistencyScore < 50) presentChallenges.push('Consistency still forming');
  if (presentChallenges.length === 0) presentChallenges.push('Sustaining momentum');

  const futureChallenges: string[] = [];
  if (proj90.wellness < presentWellness) futureChallenges.push('Risk of plateau without activities');
  else futureChallenges.push('Maintaining gains under life pressure');

  const past = snapshotAt(
    'past',
    pastWellness,
    baseline.resilience * 0.85,
    analytics.consistencyScore * 0.8,
    streaks.recoveryDays * 8,
    pastChallenges,
    pastLabel,
  );

  const present = snapshotAt(
    'present',
    presentWellness,
    baseline.resilience,
    analytics.consistencyScore,
    clamp(streaks.recoveryDays * 10 + streaks.longestStreak * 3, 0, 100),
    presentChallenges,
    'Today',
  );

  const future = snapshotAt(
    'future',
    proj180.wellness,
    proj180.resilience,
    proj90.consistency,
    proj90.resilience,
    futureChallenges,
    'If progress continues',
  );

  const narrativePast = `90 days ago, your emotional score averaged near ${Math.round(pastWellness)}/100 with ${past.majorChallenges[0]?.toLowerCase() ?? 'a quieter signal footprint'}.`;
  const narrativePresent = `Today you sit at ${present.emotionalScore}/100 — resilience ${present.resilience}/100, consistency ${present.consistency}/100.`;
  const narrativeFuture = `If progress continues, you may reach ~${future.emotionalScore}/100 wellness with resilience near ${future.resilience}/100 over the coming months.`;

  const timelinePoints = sorted.map((d) => ({
    dateKey: d.dateKey,
    date: d.date,
    score: d.score,
    phase: 'history' as const,
  }));

  timelinePoints.push({
    dateKey: 'present',
    date: 'Now',
    score: present.emotionalScore,
    phase: 'present',
  });

  return {
    past,
    present,
    future,
    narrative: {
      past: narrativePast,
      present: narrativePresent,
      future: narrativeFuture,
    },
    milestones: pickMilestones(events, highlights),
    timelinePoints: timelinePoints.slice(-24),
  };
}
