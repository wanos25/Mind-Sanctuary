import type { ForecastChartPoint } from './types';
import type { DailyEmotionalScore } from './types';
import type { BaselineSignals } from './predictionModel';
import { projectHorizon } from './predictionModel';

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(key: string): string {
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function buildEmotionalForecast(
  dailyScores: DailyEmotionalScore[],
  baseline: BaselineSignals,
): ForecastChartPoint[] {
  const sorted = [...dailyScores].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  if (!sorted.length) return [];

  const points: ForecastChartPoint[] = sorted.map((d, i) => ({
    dateKey: d.dateKey,
    date: d.date,
    score: d.score,
    phase: i === sorted.length - 1 ? 'present' : 'past',
  }));

  const lastKey = sorted[sorted.length - 1].dateKey;
  const w30 = projectHorizon(baseline, 'continue', 30).wellness;
  const w90 = projectHorizon(baseline, 'continue', 90).wellness;
  const w180 = projectHorizon(baseline, 'continue', 180).wellness;
  const w0 = Math.round(baseline.wellness);

  const forecastAt = (days: number): number => {
    if (days <= 30) return w0 + ((w30 - w0) * days) / 30;
    if (days <= 90) return w30 + ((w90 - w30) * (days - 30)) / 60;
    return w90 + ((w180 - w90) * (days - 90)) / 90;
  };

  for (const days of [30, 60, 90, 120, 150, 180]) {
    const key = addDays(lastKey, days);
    points.push({
      dateKey: key,
      date: formatDate(key),
      score: clampScore(forecastAt(days)),
      phase: 'forecast',
    });
  }

  return points;
}

function clampScore(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}
