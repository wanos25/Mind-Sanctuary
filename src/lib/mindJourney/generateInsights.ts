import type { JourneyAnalytics, JourneyInsightBundle, JourneyStreaks } from './types';
import type { RawMindJourneySources } from './loadMindJourney';

export function generateJourneyInsights(
  sources: RawMindJourneySources,
  analytics: JourneyAnalytics,
  streaks: JourneyStreaks,
): JourneyInsightBundle {
  const improvements: string[] = [];
  const regressions: string[] = [];
  const recommendations: string[] = [];

  if (sources.sessions.length === 0) {
    return {
      summary: 'Your mental journey map will appear after your first reflection session.',
      improvements: [],
      regressions: [],
      recommendations: ['Start a session from the dashboard to begin tracking your emotional path.'],
    };
  }

  if (analytics.moodImprovementPct >= 5) {
    improvements.push(
      `Your daily wellness score improved about ${analytics.moodImprovementPct}% compared with earlier in your journey.`,
    );
  } else if (analytics.moodImprovementPct <= -5) {
    regressions.push(
      `Wellness scores dipped about ${Math.abs(analytics.moodImprovementPct)}% recently — be gentle with yourself.`,
    );
  }

  if (analytics.anxietyReductionPct >= 5) {
    improvements.push(
      `Anxiety-related intensity decreased roughly ${analytics.anxietyReductionPct}% across recent sessions.`,
    );
  } else if (analytics.anxietyReductionPct <= -10) {
    regressions.push(
      'Anxiety signals have been slightly higher lately. Consider a grounding activity or shorter check-ins.',
    );
  }

  if (analytics.stressTrend === 'improving') {
    improvements.push('Stress trend is easing — your consistency is paying off.');
  } else if (analytics.stressTrend === 'rising') {
    regressions.push('Stress trend is rising. Pause before major decisions and prioritize rest.');
  }

  if (streaks.currentStreak >= 3) {
    improvements.push(`You are on a ${streaks.currentStreak}-day reflection streak — remarkable consistency.`);
  }

  if (streaks.longestStreak >= 5) {
    improvements.push(`Your longest streak reached ${streaks.longestStreak} days of engaged reflection.`);
  }

  if (analytics.consistencyScore < 40) {
    recommendations.push('Try a 5-minute daily check-in at the same time to raise your consistency score.');
  } else if (analytics.consistencyScore >= 70) {
    improvements.push('Your consistency score is strong — you show up for yourself regularly.');
  }

  if (sources.activities.filter((a) => a.completed_at).length === 0) {
    recommendations.push('Explore Activities to add structured exercises to your timeline.');
  }

  if (regressions.length > 0 && improvements.length === 0) {
    recommendations.push('Open a calm session and name one small win from today — it helps reset the trend.');
  } else if (improvements.length >= 2) {
    recommendations.push('Keep your current rhythm; revisit Insights weekly to spot patterns early.');
  } else {
    recommendations.push('Schedule your next session within 48 hours to maintain momentum.');
  }

  const summary =
    improvements.length > regressions.length
      ? 'Overall, your journey shows forward movement. The path below highlights where you have grown.'
      : regressions.length > 0
        ? 'Your journey has had some bumps recently — that is normal. Use the timeline to see what still supports you.'
        : 'Your emotional path is steady. Small, regular reflections will deepen the picture over time.';

  return {
    summary,
    improvements: improvements.slice(0, 4),
    regressions: regressions.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
  };
}
