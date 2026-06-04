import type {
  CrisisPreventionProfile,
  PreventionRecommendations,
  PreventionWarning,
  RecoverySimulation,
  RiskLevel,
  TrendDirection,
} from './types';
import type { RiskInputSignals } from './riskSignals';
import { extractRiskSignals, clamp } from './riskSignals';
import type { RawMindJourneySources } from './loadMindJourney';
import type {
  DailyEmotionalScore,
  JourneyAnalytics,
  JourneyInsightBundle,
  JourneyStreaks,
} from './types';
import { projectHorizon } from './predictionModel';
import type { BaselineSignals } from './predictionModel';

const LOW_MOOD_EMOTIONS = new Set(['sadness', 'grief', 'despair', 'depression', 'hopeless', 'empty']);

function levelFromScore(score: number): RiskLevel {
  if (score >= 65) return 'high';
  if (score >= 38) return 'moderate';
  return 'low';
}

function trendFromSlope(slope: number, delta: number): TrendDirection {
  if (slope > 0.08 || delta >= 5) return 'improving';
  if (slope < -0.08 || delta <= -5) return 'worsening';
  return 'stable';
}

function computeDepression(s: RiskInputSignals, sources: RawMindJourneySources): number {
  let risk = 0;
  if (s.recentWellness < 42) risk += 30;
  if (s.wellnessSlope < -0.2) risk += 22;
  if (s.moodImprovementPct <= -8) risk += 20;
  const sadShare = sources.sessions.filter((sess) =>
    LOW_MOOD_EMOTIONS.has((sess.summary_emotion ?? '').toLowerCase()),
  ).length;
  if (sources.sessions.length && sadShare / sources.sessions.length >= 0.25) risk += 25;
  return clamp(risk, 0, 100);
}

function computeSocialWithdrawal(s: RiskInputSignals): number {
  let risk = 0;
  if (s.daysSinceReflection >= 7) risk += 35;
  if (s.sessionsLast14 === 0) risk += 30;
  if (s.streakBroken) risk += 20;
  if (s.sessionsLast14 < s.sessionsPrior14) risk += 15;
  return clamp(risk, 0, 100);
}

function computeRecoveryCollapse(
  s: RiskInputSignals,
  streaks: JourneyStreaks,
  recoveryProb: number,
): number {
  let risk = 0;
  if (recoveryProb < 45) risk += 35;
  if (streaks.currentStreak === 0 && streaks.longestStreak >= 4) risk += 25;
  if (s.hiddenDrop >= 10) risk += 25;
  if (s.consistencyScore < 35) risk += 15;
  return clamp(risk, 0, 100);
}

function overallLevel(scores: number[]): RiskLevel {
  const max = Math.max(...scores);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return levelFromScore(Math.round(max * 0.6 + avg * 0.4));
}

function buildPreventionWarnings(
  s: RiskInputSignals,
  scores: {
    burnout: number;
    anxiety: number;
    depression: number;
    withdrawal: number;
    collapse: number;
  },
): PreventionWarning[] {
  const items: Array<{ id: string; title: string; score: number; evidence: string[] }> = [
    {
      id: 'pw-burnout',
      title: 'Burnout risk',
      score: scores.burnout,
      evidence: [
        s.hiddenDrop >= 4 ? `Hidden wellness drop ~${Math.round(s.hiddenDrop)} pts week-over-week.` : 'Fatigue pattern in recent scores.',
      ],
    },
    {
      id: 'pw-anxiety',
      title: 'Anxiety escalation',
      score: scores.anxiety,
      evidence: [`Anxiety-linked sessions: ${Math.round(s.anxietyRecent * 100)}% recently.`],
    },
    {
      id: 'pw-depression',
      title: 'Depression risk',
      score: scores.depression,
      evidence: [
        `Recent wellness avg ${Math.round(s.recentWellness)}/100.`,
        s.moodImprovementPct < 0 ? 'Mood trajectory declining.' : 'Low mood cluster detected.',
      ],
    },
    {
      id: 'pw-withdrawal',
      title: 'Social withdrawal',
      score: scores.withdrawal,
      evidence: [
        s.daysSinceReflection >= 3
          ? `${s.daysSinceReflection} days since last reflection.`
          : 'Engagement frequency falling.',
      ],
    },
    {
      id: 'pw-collapse',
      title: 'Recovery collapse',
      score: scores.collapse,
      evidence: ['Recovery momentum may be reversing.'],
    },
  ];

  return items
    .filter((i) => i.score >= 32)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((i) => ({
      id: i.id,
      title: i.title,
      riskLevel: levelFromScore(i.score),
      confidence: clamp(Math.round(s.dataConfidence * (0.75 + i.score / 400)), 35, 92),
      evidence: i.evidence,
      trendDirection: trendFromSlope(s.wellnessSlope, -s.hiddenDrop),
    }));
}

function buildRecommendations(
  level: RiskLevel,
  s: RiskInputSignals,
  insights: JourneyInsightBundle,
): PreventionRecommendations {
  if (level === 'high') {
    return {
      immediate: 'Pause demanding tasks. Complete a 3-minute grounding exercise and name one safe person to contact.',
      next24Hours:
        'Book a short reflection session. Avoid isolation — one brief check-in counts.',
      next7Days:
        'Daily 5-minute reflections, one CBT or educational activity, and review Early Warnings after each session.',
    };
  }
  if (level === 'moderate') {
    return {
      immediate: insights.recommendations[0] ?? 'Open a calm session and log your current emotional temperature.',
      next24Hours: 'Restore your reflection streak with a single scheduled check-in.',
      next7Days: 'Alternate reflection days with one structured activity; track wellness scores twice weekly.',
    };
  }
  return {
    immediate: 'Maintain rhythm — your signals are within baseline.',
    next24Hours: 'Optional: note one win from today in a 2-line journal entry.',
    next7Days: insights.recommendations[0] ?? 'Keep weekly reviews of your journey map.',
  };
}

function buildSimulation(baseline: BaselineSignals, recoveryProb: number): RecoverySimulation {
  const neglect = projectHorizon(baseline, 'neglect', 30);
  const growth = projectHorizon(baseline, 'growth', 30);
  return {
    ifNothingChanges: {
      wellness30: neglect.wellness,
      label: 'Wellness may drift toward this level in ~30 days.',
    },
    ifActionsFollowed: {
      wellness30: growth.wellness,
      label: 'Structured engagement could lift wellness toward this level.',
    },
    delta: growth.wellness - neglect.wellness,
    recoveryProbability: recoveryProb,
  };
}

export function buildCrisisPrevention(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  analytics: JourneyAnalytics,
  streaks: JourneyStreaks,
  insights: JourneyInsightBundle,
  baseline: BaselineSignals,
): CrisisPreventionProfile {
  const signals = extractRiskSignals(sources, dailyScores, analytics, streaks);

  let burnout = 0;
  if (signals.hiddenDrop >= 6) burnout += 28;
  if (signals.wellnessSlope < -0.25) burnout += 22;
  if (signals.recentWellness < 45) burnout += 20;
  burnout = clamp(burnout, 0, 100);

  let anxiety = 0;
  const anxietyRise = signals.anxietyRecent - signals.anxietyPrior;
  if (anxietyRise >= 0.15) anxiety += 35;
  if (signals.anxietyRecent >= 0.4) anxiety += 25;
  anxiety = clamp(anxiety, 0, 100);

  const depression = computeDepression(signals, sources);
  const socialWithdrawal = computeSocialWithdrawal(signals);

  const recoveryProb = clamp(
    70 +
      analytics.moodImprovementPct * 0.3 -
      (burnout + anxiety + depression) / 6,
    5,
    98,
  );
  const recoveryCollapse = computeRecoveryCollapse(signals, streaks, recoveryProb);

  const risks = {
    burnout,
    anxietyEscalation: anxiety,
    depression,
    socialWithdrawal,
    recoveryCollapse,
  };

  const overall = overallLevel(Object.values(risks));
  const earlyWarnings = buildPreventionWarnings(signals, {
    burnout,
    anxiety,
    depression,
    withdrawal: socialWithdrawal,
    collapse: recoveryCollapse,
  });

  if (!earlyWarnings.length) {
    earlyWarnings.push({
      id: 'pw-clear',
      title: 'No acute prevention flags',
      riskLevel: 'low',
      confidence: signals.dataConfidence,
      evidence: ['Patterns remain within your personal baseline.'],
      trendDirection: trendFromSlope(signals.wellnessSlope, -signals.hiddenDrop),
    });
  }

  return {
    risks,
    overallLevel: overall,
    earlyWarnings,
    recommendations: buildRecommendations(overall, signals, insights),
    simulation: buildSimulation(baseline, recoveryProb),
    emergencyGlow: overall === 'high' || risks.recoveryCollapse >= 60,
    confidence: signals.dataConfidence,
  };
}
