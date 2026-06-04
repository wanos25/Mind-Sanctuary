import type { ImpactSource } from './types';
import type { JourneyStreaks } from './types';
import type { RawMindJourneySources } from './loadMindJourney';

const SOURCE_LABELS: Record<string, string> = {
  cbt: 'CBT',
  reflection: 'Reflection sessions',
  streaks: 'Streaks',
  educational_video: 'Educational videos',
  activities: 'Other activities',
};

export function buildImpactRanking(
  sources: RawMindJourneySources,
  streaks: JourneyStreaks,
): ImpactSource[] {
  const cbt = sources.activities.filter(
    (a) => a.completed_at && a.kind === 'cbt_flow',
  ).length;
  const edu = sources.activities.filter(
    (a) => a.completed_at && a.kind === 'educational_video',
  ).length;
  const otherActivities = sources.activities.filter(
    (a) =>
      a.completed_at &&
      a.kind !== 'cbt_flow' &&
      a.kind !== 'educational_video',
  ).length;
  const reflection = sources.sessions.length;
  const streakWeight = streaks.longestStreak * 2 + streaks.currentStreak;

  const raw: Array<{ id: string; weight: number }> = [
    { id: 'cbt', weight: cbt * 14 },
    { id: 'reflection', weight: reflection * 8 },
    { id: 'streaks', weight: streakWeight * 6 },
    { id: 'educational_video', weight: edu * 12 },
    { id: 'activities', weight: otherActivities * 10 },
  ];

  const total = raw.reduce((s, r) => s + r.weight, 0) || 1;

  const ranked = raw
    .filter((r) => r.weight > 0)
    .map((r) => ({
      id: r.id,
      label: SOURCE_LABELS[r.id] ?? r.id,
      contributionPct: Math.round((r.weight / total) * 100),
    }))
    .sort((a, b) => b.contributionPct - a.contributionPct);

  if (!ranked.length) {
    return [{ id: 'reflection', label: SOURCE_LABELS.reflection, contributionPct: 100 }];
  }

  const sum = ranked.reduce((s, x) => s + x.contributionPct, 0);
  if (sum !== 100) {
    ranked[0] = {
      ...ranked[0],
      contributionPct: ranked[0].contributionPct + (100 - sum),
    };
  }
  return ranked;
}
