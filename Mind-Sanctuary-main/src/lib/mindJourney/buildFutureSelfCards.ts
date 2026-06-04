import type { FutureSelfCard, FutureSimulationPath } from './types';
import type { BaselineSignals, TrendLabel } from './predictionModel';
import type { JourneyInsightBundle } from './types';

function stateLabel(trend: TrendLabel, wellness: number): string {
  if (trend === 'rising' && wellness >= 65) return 'Steady uplift — calmer and more grounded';
  if (trend === 'rising') return 'Gentle improvement — momentum building';
  if (trend === 'declining') return 'Needs care — energy may feel heavier';
  if (wellness >= 70) return 'Stable strength — holding your ground';
  return 'Balanced — room to deepen practice';
}

export function buildFutureSelfCards(
  paths: FutureSimulationPath[],
  baseline: BaselineSignals,
  insights: JourneyInsightBundle,
): FutureSelfCard[] {
  const primary = paths.find((p) => p.kind === 'continue') ?? paths[0];

  return primary.projections.map((proj) => {
    const growth = paths.find((p) => p.kind === 'growth');
    const neglect = paths.find((p) => p.kind === 'neglect');
    const gProj = growth?.projections.find((h) => h.horizonDays === proj.horizonDays);
    const nProj = neglect?.projections.find((h) => h.horizonDays === proj.horizonDays);

    const strengths: string[] = [];
    const risks: string[] = [];
    const recommendedActions: string[] = [];

    if (proj.emotionalTrend === 'rising') {
      strengths.push(`Projected wellness around ${proj.wellness}/100 if you stay consistent.`);
    } else if (proj.emotionalTrend === 'stable') {
      strengths.push(`Resilience may hold near ${proj.resilience}/100 with your current habits.`);
    }

    if (proj.consistency >= 60) {
      strengths.push(`Consistency could remain at ${proj.consistency}/100.`);
    }

    if (gProj && gProj.wellness - proj.wellness >= 8) {
      strengths.push(
        `Growth path reaches ~${gProj.wellness} wellness — more activities unlock upside.`,
      );
      recommendedActions.push('Complete one structured activity this week to lean into the growth path.');
    }

    if (nProj && proj.wellness - nProj.wellness >= 10) {
      risks.push(
        `Disengagement could pull wellness toward ${nProj.wellness}/100 over ${proj.horizonDays} days.`,
      );
    }

    if (proj.emotionalTrend === 'declining') {
      risks.push('Emotional trend points down without renewed check-ins.');
    }

    if (proj.resilience < 50) {
      risks.push('Resilience may thin — protect sleep and short daily reflections.');
    }

    recommendedActions.push(...insights.recommendations.slice(0, 1));
    if (recommendedActions.length < 2) {
      recommendedActions.push('Schedule your next session within 48 hours to anchor this projection.');
    }

    const confidence = clampConfidence(
      baseline.dataConfidence - (proj.horizonDays === 180 ? 18 : proj.horizonDays === 90 ? 10 : 0),
    );

    return {
      horizonDays: proj.horizonDays,
      projectedState: stateLabel(proj.emotionalTrend, proj.wellness),
      strengths: [...new Set(strengths)].slice(0, 3),
      risks: [...new Set(risks)].slice(0, 2),
      recommendedActions: [...new Set(recommendedActions)].slice(0, 3),
      confidence,
      wellness: proj.wellness,
      emotionalTrend: proj.emotionalTrend,
    };
  });
}

function clampConfidence(n: number): number {
  return Math.min(92, Math.max(30, Math.round(n)));
}
