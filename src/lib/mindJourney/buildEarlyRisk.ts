import type { EarlyRiskProfile, EarlyWarning, MentalWeather } from './types';
import type { RiskInputSignals } from './riskSignals';
import { extractRiskSignals } from './riskSignals';
import { clamp } from './riskSignals';
import type { RawMindJourneySources } from './loadMindJourney';
import type {
  DailyEmotionalScore,
  JourneyAnalytics,
  JourneyStreaks,
} from './types';

export type RiskLevel = 'low' | 'moderate' | 'high';

function levelFromScore(score: number): RiskLevel {
  if (score >= 65) return 'high';
  if (score >= 38) return 'moderate';
  return 'low';
}

function computeBurnout(s: RiskInputSignals): number {
  let risk = 0;
  if (s.hiddenDrop >= 6) risk += 28;
  if (s.wellnessSlope < -0.25) risk += 22;
  if (s.recentWellness < 45) risk += 20;
  if (s.sessionsLast14 > s.sessionsPrior14 + 2 && s.recentWellness < s.priorWellness) {
    risk += 18;
  }
  if (s.consistencyScore < 40) risk += 12;
  return clamp(risk, 0, 100);
}

function computeAnxietyEscalation(s: RiskInputSignals): number {
  let risk = 0;
  const anxietyRise = s.anxietyRecent - s.anxietyPrior;
  if (anxietyRise >= 0.15) risk += 35;
  if (s.moodImprovementPct <= -5) risk += 20;
  if (s.hiddenDrop >= 4) risk += 15;
  if (s.anxietyRecent >= 0.4) risk += 25;
  return clamp(risk, 0, 100);
}

function computeIsolation(s: RiskInputSignals): number {
  let risk = 0;
  if (s.streakBroken) risk += 30;
  if (s.daysSinceReflection >= 5) risk += 28;
  if (s.sessionsLast14 < Math.max(1, s.sessionsPrior14 - 1)) risk += 18;
  if (s.activitiesLast30 === 0) risk += 15;
  if (s.sessionsLast14 === 0 && s.sessionsPrior14 > 0) risk += 25;
  return clamp(risk, 0, 100);
}

function computeRecoveryProbability(
  s: RiskInputSignals,
  burnout: number,
  anxiety: number,
  isolation: number,
): number {
  const threat = (burnout + anxiety + isolation) / 3;
  let prob = 70;
  prob += s.moodImprovementPct * 0.3;
  prob += s.consistencyScore * 0.15;
  prob -= threat * 0.45;
  if (s.wellnessSlope > 0.1) prob += 12;
  if (s.recentWellness >= 60) prob += 8;
  return clamp(Math.round(prob), 5, 98);
}

function deriveMentalWeather(
  s: RiskInputSignals,
  burnout: number,
  anxiety: number,
  recoveryProb: number,
): MentalWeather {
  if (recoveryProb >= 68 && s.hiddenDrop >= 5 && s.wellnessSlope > -0.1) {
    return 'recovery_phase';
  }
  if (burnout >= 55 || anxiety >= 58 || (s.hiddenDrop >= 8 && s.wellnessSlope < 0)) {
    return 'storm_incoming';
  }
  if (s.wellnessSlope > 0.12 || s.moodImprovementPct >= 8) {
    return 'improving';
  }
  return 'stable';
}

function buildWarnings(
  s: RiskInputSignals,
  burnout: number,
  anxiety: number,
  isolation: number,
): EarlyWarning[] {
  const warnings: EarlyWarning[] = [];

  if (burnout >= 38) {
    warnings.push({
      id: 'warn-burnout',
      title: 'Burnout pattern forming',
      riskLevel: levelFromScore(burnout),
      evidence: [
        s.hiddenDrop >= 4
          ? `Wellness dipped ${Math.round(s.hiddenDrop)} points before the trend line shows it.`
          : 'Recent scores run below your prior-week baseline.',
        s.sessionsLast14 > 0
          ? `${s.sessionsLast14} sessions in 14 days with weakening recovery signals.`
          : 'Engagement exists but recovery quality is thinning.',
      ],
      confidence: clamp(Math.round(s.dataConfidence * 0.9), 40, 90),
      intervention:
        'Schedule one low-intensity check-in and pause new commitments for 48 hours.',
    });
  }

  if (anxiety >= 38) {
    warnings.push({
      id: 'warn-anxiety',
      title: 'Anxiety escalation risk',
      riskLevel: levelFromScore(anxiety),
      evidence: [
        `Anxiety-tagged sessions at ${Math.round(s.anxietyRecent * 100)}% recently.`,
        s.anxietyRecent > s.anxietyPrior
          ? 'Share of anxious sessions increased versus your earlier period.'
          : 'Anxiety signals remain elevated in recent reflections.',
      ],
      confidence: clamp(Math.round(s.dataConfidence * 0.85), 40, 88),
      intervention: 'Try a grounding activity or CBT flow before your next full session.',
    });
  }

  if (isolation >= 38) {
    warnings.push({
      id: 'warn-isolation',
      title: 'Isolation drift detected',
      riskLevel: levelFromScore(isolation),
      evidence: [
        s.daysSinceReflection >= 3
          ? `${s.daysSinceReflection} days since your last reflection day.`
          : 'Reflection rhythm has gaps forming.',
        s.streakBroken ? 'Active streak has broken.' : 'Consistency score is weakening.',
      ],
      confidence: clamp(Math.round(s.dataConfidence * 0.8), 38, 85),
      intervention: 'Set a 5-minute daily reminder — connection beats intensity.',
    });
  }

  if (warnings.length === 0) {
    warnings.push({
      id: 'warn-clear',
      title: 'No early deterioration detected',
      riskLevel: 'low',
      evidence: ['Signals stay within your recent baseline.'],
      confidence: s.dataConfidence,
      intervention: 'Keep your current rhythm; revisit after your next session.',
    });
  }

  return warnings.slice(0, 4);
}

export function buildEarlyRisk(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  analytics: JourneyAnalytics,
  streaks: JourneyStreaks,
): EarlyRiskProfile {
  const signals = extractRiskSignals(sources, dailyScores, analytics, streaks);
  const burnoutRisk = computeBurnout(signals);
  const anxietyEscalationRisk = computeAnxietyEscalation(signals);
  const isolationRisk = computeIsolation(signals);
  const recoveryProbability = computeRecoveryProbability(
    signals,
    burnoutRisk,
    anxietyEscalationRisk,
    isolationRisk,
  );

  return {
    burnoutRisk,
    anxietyEscalationRisk,
    isolationRisk,
    recoveryProbability,
    mentalWeather: deriveMentalWeather(
      signals,
      burnoutRisk,
      anxietyEscalationRisk,
      recoveryProbability,
    ),
    warnings: buildWarnings(signals, burnoutRisk, anxietyEscalationRisk, isolationRisk),
    confidence: signals.dataConfidence,
  };
}
