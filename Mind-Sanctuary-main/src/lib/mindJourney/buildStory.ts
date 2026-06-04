import type { RawMindJourneySources } from './loadMindJourney';
import type {
  JourneyAnalytics,
  JourneyInsightBundle,
  JourneyStreaks,
  JourneyTimelineEvent,
  MindJourneyStory,
} from './types';
import type { DailyEmotionalScore } from './types';
import { buildChapters } from './buildChapters';
import { buildBeforeNowComparison } from './buildComparison';
import { buildHighlights } from './buildHighlights';
import { buildSeasons } from './buildSeasons';
import { computeGrowthScore } from './computeGrowthScore';
import { generateFuturePath } from './generateFuturePath';

export function buildMindJourneyStory(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  events: JourneyTimelineEvent[],
  streaks: JourneyStreaks,
  analytics: JourneyAnalytics,
  insights: JourneyInsightBundle,
): MindJourneyStory {
  return {
    chapters: buildChapters(sources, dailyScores, events, streaks, analytics),
    growthScore: computeGrowthScore(sources, dailyScores, analytics, streaks),
    comparison: buildBeforeNowComparison(dailyScores),
    highlights: buildHighlights(sources, dailyScores, streaks),
    seasons: buildSeasons(dailyScores, streaks),
    futurePath: generateFuturePath(sources, analytics, streaks, insights),
  };
}
