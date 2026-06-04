import type { JourneyAnalytics, JourneyInsightBundle, JourneyStreaks } from './types';
import type { RawMindJourneySources } from './loadMindJourney';
import type { FuturePath } from './types';

export function generateFuturePath(
  sources: RawMindJourneySources,
  analytics: JourneyAnalytics,
  streaks: JourneyStreaks,
  insights: JourneyInsightBundle,
): FuturePath {
  const strengths: string[] = [];
  const risks: string[] = [];
  const recommendedActions: string[] = [];

  if (analytics.moodImprovementPct >= 5) {
    strengths.push('Your recent wellness trajectory shows measurable uplift.');
  }
  if (analytics.consistencyScore >= 60) {
    strengths.push('You maintain a dependable reflection rhythm.');
  }
  if (streaks.currentStreak >= 3) {
    strengths.push(`A ${streaks.currentStreak}-day streak proves you return to yourself.`);
  }
  if (sources.activities.some((a) => a.completed_at)) {
    strengths.push('Structured activities already complement your sessions.');
  }
  if (analytics.anxietyReductionPct >= 5) {
    strengths.push('Anxiety-related intensity has softened across recent data.');
  }

  if (analytics.stressTrend === 'rising') {
    risks.push('Stress signals are trending up — pace decisions and rest.');
  }
  if (analytics.moodImprovementPct <= -5) {
    risks.push('Wellness scores dipped recently; avoid self-judgment during the dip.');
  }
  if (streaks.currentStreak === 0 && streaks.reflectionDays > 3) {
    risks.push('Your active streak paused — gaps can flatten momentum.');
  }
  if (analytics.consistencyScore < 40) {
    risks.push('Irregular check-ins make patterns harder to read.');
  }
  if (sources.activities.filter((a) => a.completed_at).length === 0) {
    risks.push('No completed activities yet — your toolkit stays underused.');
  }

  strengths.push(...insights.improvements.slice(0, 2));
  risks.push(...insights.regressions.slice(0, 2));
  recommendedActions.push(...insights.recommendations);

  if (recommendedActions.length === 0) {
    if (analytics.consistencyScore < 50) {
      recommendedActions.push('Book a 5-minute check-in at the same time tomorrow.');
    } else {
      recommendedActions.push('Revisit this story after your next session to refresh your growth score.');
    }
  }

  if (strengths.length === 0) {
    strengths.push('Every session you complete adds clarity to this map.');
  }

  return {
    strengths: [...new Set(strengths)].slice(0, 4),
    risks: [...new Set(risks)].slice(0, 3),
    recommendedActions: [...new Set(recommendedActions)].slice(0, 3),
  };
}
