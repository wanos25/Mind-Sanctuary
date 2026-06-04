import type { DailyEmotionalScore, JourneyAnalytics, JourneyStreaks } from './types';
import type { RawMindJourneySources } from './loadMindJourney';

export type TrendLabel = 'rising' | 'stable' | 'declining';

export interface BaselineSignals {
  wellness: number;
  slopePerDay: number;
  consistency: number;
  resilience: number;
  engagementPerWeek: number;
  dataConfidence: number;
}

const HORIZONS = [30, 90, 180] as const;
export type HorizonDays = (typeof HORIZONS)[number];

export type PathKind = 'continue' | 'growth' | 'neglect';

const PATH_FACTORS: Record<
  PathKind,
  { slope: number; consistency: number; resilience: number; engagement: number }
> = {
  continue: { slope: 1, consistency: 0.02, resilience: 0.015, engagement: 0 },
  growth: { slope: 1.45, consistency: 0.08, resilience: 0.05, engagement: 0.12 },
  neglect: { slope: -0.65, consistency: -0.12, resilience: -0.08, engagement: -0.2 },
};

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Linear slope of wellness scores (points per day). */
export function computeWellnessSlope(dailyScores: DailyEmotionalScore[]): number {
  const sorted = [...dailyScores].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  if (sorted.length < 2) return 0;
  const first = new Date(`${sorted[0].dateKey}T12:00:00`).getTime();
  const xs: number[] = [];
  const ys: number[] = [];
  for (const d of sorted) {
    const t = (new Date(`${d.dateKey}T12:00:00`).getTime() - first) / 86400000;
    xs.push(t);
    ys.push(d.score);
  }
  const n = xs.length;
  const meanX = avg(xs);
  const meanY = avg(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den ? num / den : 0;
}

export function extractBaselineSignals(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  analytics: JourneyAnalytics,
  streaks: JourneyStreaks,
): BaselineSignals {
  const sorted = [...dailyScores].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const recent = sorted.slice(-14);
  const wellness = recent.length ? avg(recent.map((d) => d.score)) : 50;
  const slopePerDay = computeWellnessSlope(recent.length >= 3 ? recent : sorted);

  const spanDays =
    sorted.length >= 2
      ? Math.max(
          1,
          (new Date(`${sorted[sorted.length - 1].dateKey}T12:00:00`).getTime() -
            new Date(`${sorted[0].dateKey}T12:00:00`).getTime()) /
            86400000,
        )
      : 1;
  const engagementPerWeek = (sources.sessions.length / spanDays) * 7;

  const resilience = clamp(
    streaks.recoveryDays * 2 +
      streaks.longestStreak * 3 +
      Math.max(0, analytics.anxietyReductionPct) * 0.2 +
      20,
    0,
    100,
  );

  const dataConfidence = clamp(
    Math.round(
      Math.min(95, 35 + sorted.length * 4 + sources.sessions.length * 2),
    ),
    25,
    95,
  );

  return {
    wellness,
    slopePerDay,
    consistency: analytics.consistencyScore,
    resilience,
    engagementPerWeek,
    dataConfidence,
  };
}

export function trendFromDelta(delta: number): TrendLabel {
  if (delta >= 4) return 'rising';
  if (delta <= -4) return 'declining';
  return 'stable';
}

export function projectHorizon(
  baseline: BaselineSignals,
  kind: PathKind,
  horizonDays: HorizonDays,
): {
  emotionalTrend: TrendLabel;
  consistency: number;
  resilience: number;
  wellness: number;
} {
  const f = PATH_FACTORS[kind];
  const months = horizonDays / 30;
  const slopeEffect = baseline.slopePerDay * f.slope * horizonDays;
  const engagementBoost =
    (baseline.engagementPerWeek - 2) * f.engagement * months * 2;

  const wellness = clamp(
    Math.round(
      baseline.wellness + slopeEffect + engagementBoost,
    ),
    0,
    100,
  );

  const consistency = clamp(
    Math.round(
      baseline.consistency +
        f.consistency * horizonDays +
        (kind === 'growth' ? baseline.engagementPerWeek * 1.5 : 0) -
        (kind === 'neglect' ? horizonDays * 0.15 : 0),
    ),
    0,
    100,
  );

  const resilience = clamp(
    Math.round(
      baseline.resilience +
        f.resilience * horizonDays -
        (kind === 'neglect' ? months * 8 : 0),
    ),
    0,
    100,
  );

  const emotionalTrend = trendFromDelta(wellness - baseline.wellness);

  return { emotionalTrend, consistency, resilience, wellness };
}

export { HORIZONS };
