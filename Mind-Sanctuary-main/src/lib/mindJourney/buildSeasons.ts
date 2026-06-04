import type { DailyEmotionalScore, EmotionalSeason, JourneyStreaks } from './types';

const WINDOW = 14;

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

type SeasonKind = 'recovery' | 'growth' | 'reflection' | 'consistency';

function classifyWindow(
  window: DailyEmotionalScore[],
  slope: number,
  streaks: JourneyStreaks,
): SeasonKind {
  const mean = avg(window.map((d) => d.score));
  const sessions = window.reduce((n, d) => n + d.sessionCount, 0);

  if (mean >= 62 && slope >= 3) return 'recovery';
  if (slope >= 5) return 'growth';
  if (sessions >= 6 && Math.abs(slope) < 4) return 'reflection';
  if (streaks.longestStreak >= 5 && window.length >= 5) return 'consistency';
  if (slope >= 2) return 'growth';
  if (mean >= 58) return 'recovery';
  return 'reflection';
}

const SEASON_NAMES: Record<SeasonKind, string> = {
  recovery: 'Season of Recovery',
  growth: 'Season of Growth',
  reflection: 'Season of Reflection',
  consistency: 'Season of Consistency',
};

const SEASON_SUMMARIES: Record<SeasonKind, (mean: number, slope: number) => string> = {
  recovery: (mean) =>
    `Wellness averaged ${Math.round(mean)} — a period where rest and reflection supported you.`,
  growth: (_, slope) =>
    `Scores climbed about ${Math.round(slope)} points across this window — visible forward motion.`,
  reflection: (mean, sessions) =>
    `You showed up ${sessions} times with an average wellness of ${Math.round(mean)} — depth over speed.`,
  consistency: () =>
    'Regular check-ins created a steady rhythm — consistency became your anchor.',
};

function dominantTrend(window: DailyEmotionalScore[], slope: number): string {
  const emotions: Record<string, number> = {};
  for (const d of window) {
    emotions[d.dominantEmotion] = (emotions[d.dominantEmotion] ?? 0) + 1;
  }
  const top = Object.entries(emotions).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'mixed';
  const dir = slope >= 5 ? 'rising wellness' : slope <= -5 ? 'easing intensity' : 'steady presence';
  return `${top.replace(/_/g, ' ')} · ${dir}`;
}

export function buildSeasons(
  dailyScores: DailyEmotionalScore[],
  streaks: JourneyStreaks,
): EmotionalSeason[] {
  const sorted = [...dailyScores].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  if (sorted.length < 5) return [];

  const raw: Array<{ kind: SeasonKind; start: string; end: string; window: DailyEmotionalScore[]; slope: number }> =
    [];

  for (let i = 0; i < sorted.length; i += WINDOW) {
    const window = sorted.slice(i, i + WINDOW);
    if (window.length < 3) continue;
    const slope = window[window.length - 1].score - window[0].score;
    const kind = classifyWindow(window, slope, streaks);
    raw.push({
      kind,
      start: window[0].dateKey,
      end: window[window.length - 1].dateKey,
      window,
      slope,
    });
  }

  const merged: typeof raw = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && last.kind === seg.kind) {
      last.end = seg.end;
      last.window = [...last.window, ...seg.window];
      last.slope = last.window[last.window.length - 1].score - last.window[0].score;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged.map((seg, idx) => {
    const mean = avg(seg.window.map((d) => d.score));
    const sessions = seg.window.reduce((n, d) => n + d.sessionCount, 0);
    return {
      id: `season-${idx + 1}`,
      name: SEASON_NAMES[seg.kind],
      dateRange: {
        start: seg.start,
        end: seg.end,
        label: formatRangeLabel(seg.start, seg.end),
      },
      summary:
        seg.kind === 'reflection'
          ? SEASON_SUMMARIES.reflection(mean, sessions)
          : SEASON_SUMMARIES[seg.kind](mean, seg.slope),
      dominantTrend: dominantTrend(seg.window, seg.slope),
    };
  });
}
