import type { DailyEmotionalScore, BeforeNowComparison } from './types';

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function moodToStress(mood: number): number {
  return Math.round(Math.min(100, Math.max(0, 100 - mood)));
}

export function buildBeforeNowComparison(dailyScores: DailyEmotionalScore[]): BeforeNowComparison {
  const sorted = [...dailyScores].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const unavailable: BeforeNowComparison = {
    available: false,
    firstWeek: { stress: 0, mood: 0, label: '' },
    today: { stress: 0, mood: 0, label: '' },
    stressImprovementPct: 0,
    moodImprovementPct: 0,
  };

  if (sorted.length < 4) return unavailable;

  const firstSlice = sorted.slice(0, Math.min(7, Math.floor(sorted.length / 2)));
  const lastSlice = sorted.slice(-Math.min(7, sorted.length));
  if (firstSlice.length < 3 || lastSlice.length < 1) return unavailable;

  const firstMood = Math.round(avg(firstSlice.map((d) => d.score)));
  const todayMood = Math.round(avg(lastSlice.map((d) => d.score)));
  const firstStress = moodToStress(firstMood);
  const todayStress = moodToStress(todayMood);

  const moodImprovementPct =
    firstMood > 0 ? Math.round(((todayMood - firstMood) / firstMood) * 100) : 0;
  const stressImprovementPct =
    firstStress > 0 ? Math.round(((firstStress - todayStress) / firstStress) * 100) : 0;

  const fmt = (key: string) =>
    new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return {
    available: true,
    firstWeek: {
      mood: firstMood,
      stress: firstStress,
      label: `${fmt(firstSlice[0].dateKey)} – ${fmt(firstSlice[firstSlice.length - 1].dateKey)}`,
    },
    today: {
      mood: todayMood,
      stress: todayStress,
      label: `${fmt(lastSlice[0].dateKey)} – ${fmt(lastSlice[lastSlice.length - 1].dateKey)}`,
    },
    stressImprovementPct,
    moodImprovementPct,
  };
}
