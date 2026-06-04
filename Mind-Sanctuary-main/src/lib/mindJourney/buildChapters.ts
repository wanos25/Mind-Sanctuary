import type { RawMindJourneySources } from './loadMindJourney';
import type {
  DailyEmotionalScore,
  JourneyAnalytics,
  JourneyChapter,
  JourneyStreaks,
  JourneyTimelineEvent,
} from './types';

const CHAPTER_TITLES = [
  'The Beginning',
  'Early Challenges',
  'First Signs of Progress',
  'Building Momentum',
  'Current You',
] as const;

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function formatRangeLabel(startKey: string, endKey: string): string {
  const fmt = (key: string) =>
    new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  return `${fmt(startKey)} – ${fmt(endKey)}`;
}

function chapterCountForData(dayCount: number): number {
  if (dayCount < 2) return 1;
  if (dayCount < 5) return 2;
  if (dayCount < 10) return 3;
  if (dayCount < 15) return 4;
  return 5;
}

function buildNarrative(
  scores: DailyEmotionalScore[],
  sessionsInRange: number,
  activitiesInRange: number,
  scoreDelta: number,
): string {
  if (!scores.length) {
    return 'This chapter marks the start of your recorded journey.';
  }
  const mean = Math.round(avg(scores.map((d) => d.score)));
  const days = scores.length;
  let text = `Across ${days} reflection day${days === 1 ? '' : 's'}, your average wellness score was ${mean}.`;
  if (sessionsInRange > 0) {
    text += ` You completed ${sessionsInRange} session${sessionsInRange === 1 ? '' : 's'}.`;
  }
  if (activitiesInRange > 0) {
    text += ` ${activitiesInRange} structured activit${activitiesInRange === 1 ? 'y' : 'ies'} landed on your timeline.`;
  }
  if (scoreDelta >= 8) {
    text += ' Wellness trended upward in this period.';
  } else if (scoreDelta <= -8) {
    text += ' Scores dipped here — a natural part of growth.';
  } else {
    text += ' Your path stayed relatively steady.';
  }
  return text;
}

function eventsInRange(
  events: JourneyTimelineEvent[],
  startKey: string,
  endKey: string,
): JourneyTimelineEvent[] {
  return events.filter((e) => {
    const key = new Date(e.at).toISOString().slice(0, 10);
    return key >= startKey && key <= endKey;
  });
}

export function buildChapters(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  events: JourneyTimelineEvent[],
  streaks: JourneyStreaks,
  analytics: JourneyAnalytics,
): JourneyChapter[] {
  const sorted = [...dailyScores].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  if (!sorted.length && !sources.sessions.length) return [];

  const fallbackKey = sources.sessions[0]
    ? new Date(sources.sessions[0].started_at).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const effectiveDays =
    sorted.length > 0
      ? sorted
      : [
          {
            dateKey: fallbackKey,
            date: new Date(`${fallbackKey}T12:00:00`).toLocaleDateString(),
            score: 50,
            sessionCount: sources.sessions.length,
            dominantEmotion: '—',
          },
        ];

  const n = chapterCountForData(effectiveDays.length);
  const chunk = Math.ceil(effectiveDays.length / n);
  const chapters: JourneyChapter[] = [];

  for (let i = 0; i < n; i++) {
    const slice = effectiveDays.slice(i * chunk, (i + 1) * chunk);
    if (!slice.length) continue;

    const startKey = slice[0].dateKey;
    const endKey = slice[slice.length - 1].dateKey;
    const sliceScores = slice.map((d) => d.score);
    const scoreDelta = sliceScores[sliceScores.length - 1] - sliceScores[0];

    const sessionsInRange = sources.sessions.filter((s) => {
      const key = new Date(s.started_at).toISOString().slice(0, 10);
      return key >= startKey && key <= endKey;
    }).length;

    const activitiesInRange = sources.activities.filter((a) => {
      if (!a.completed_at) return false;
      const key = new Date(a.completed_at).toISOString().slice(0, 10);
      return key >= startKey && key <= endKey;
    }).length;

    const rangeEvents = eventsInRange(events, startKey, endKey);
    const keyEvents = rangeEvents
      .filter((e) => e.kind === 'milestone' || e.kind === 'streak' || e.kind === 'activity')
      .slice(0, 4)
      .map((e) => ({ id: e.id, title: e.title, at: e.at }));

    if (keyEvents.length < 3) {
      const extras = rangeEvents
        .filter((e) => e.kind === 'session' || e.kind === 'daily_score')
        .slice(0, 5 - keyEvents.length)
        .map((e) => ({ id: e.id, title: e.title, at: e.at }));
      keyEvents.push(...extras);
    }

    const titleIndex = Math.min(i, CHAPTER_TITLES.length - 1);
    const tones: JourneyChapter['emotionalTone'][] = [
      'beginning',
      'challenge',
      'progress',
      'momentum',
      'present',
    ];

    chapters.push({
      id: `chapter-${i + 1}`,
      index: i + 1,
      title: CHAPTER_TITLES[titleIndex],
      dateRange: {
        start: startKey,
        end: endKey,
        label: formatRangeLabel(startKey, endKey),
      },
      narrative: buildNarrative(slice, sessionsInRange, activitiesInRange, scoreDelta),
      keyEvents,
      emotionalTone: tones[titleIndex],
      avgScore: Math.round(avg(sliceScores)),
      moodDelta: Math.round(scoreDelta),
      streakNote:
        i === n - 1 && streaks.currentStreak >= 2
          ? `${streaks.currentStreak}-day active streak`
          : i === n - 1 && analytics.consistencyScore >= 60
            ? 'Strong consistency'
            : undefined,
    });
  }

  return chapters;
}
