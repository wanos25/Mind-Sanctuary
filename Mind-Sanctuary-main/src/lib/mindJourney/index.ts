import { loadMindJourneySources } from './loadMindJourney';
import {
  buildAnalytics,
  buildDailyScores,
  buildTimelineEvents,
  computeStreaks,
} from './computeMetrics';
import { generateJourneyInsights } from './generateInsights';
import { buildMindJourneyStory } from './buildStory';
import { buildMindJourneyFutureSelf } from './buildFutureSelf';
import { buildMindJourneyAdvanced } from './buildAdvancedLayers';
import type { MindJourneyData } from './types';

export type {
  MindJourneyData,
  MindJourneyStory,
  MindJourneyFutureSelf,
  MindJourneyAdvanced,
  EarlyRiskProfile,
  PersonalityTwinProfile,
  EmotionalTimeMachine,
  JourneyTimelineEvent,
  JourneyAnalytics,
  JourneyChapter,
  LifeChapter,
  GrowthScore,
} from './types';
export { wellnessScore, colorForEmotion } from './computeMetrics';

export async function loadMindJourney(userId: string): Promise<MindJourneyData> {
  const sources = await loadMindJourneySources(userId);
  const dailyScores = buildDailyScores(sources);
  const streaks = computeStreaks(dailyScores);
  const analytics = buildAnalytics(sources, dailyScores, streaks);
  const events = buildTimelineEvents(sources, dailyScores, streaks);
  const insights = generateJourneyInsights(sources, analytics, streaks);
  const story = buildMindJourneyStory(
    sources,
    dailyScores,
    events,
    streaks,
    analytics,
    insights,
  );
  const futureSelf = buildMindJourneyFutureSelf(
    sources,
    dailyScores,
    story.chapters,
    analytics,
    streaks,
    insights,
  );
  const advanced = buildMindJourneyAdvanced(
    sources,
    dailyScores,
    analytics,
    streaks,
    futureSelf,
    story.highlights,
    events,
    insights,
  );

  return {
    sessions: sources.sessions,
    analyses: sources.analyses,
    dailyScores,
    events,
    streaks,
    analytics,
    insights,
    story,
    futureSelf,
    advanced,
  };
}
