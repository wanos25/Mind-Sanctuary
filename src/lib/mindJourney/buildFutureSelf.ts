import type { RawMindJourneySources } from './loadMindJourney';
import type {
  DailyEmotionalScore,
  JourneyAnalytics,
  JourneyChapter,
  JourneyInsightBundle,
  JourneyStreaks,
  MindJourneyFutureSelf,
} from './types';
import { extractBaselineSignals } from './predictionModel';
import { simulateFuturePaths } from './simulateFuturePaths';
import { buildFutureSelfCards } from './buildFutureSelfCards';
import { buildDigitalTwin } from './buildDigitalTwin';
import { enrichLifeChapters } from './buildLifeChapters';
import { buildImpactRanking } from './buildImpactRanking';
import { buildEmotionalForecast } from './buildEmotionalForecast';

export function buildMindJourneyFutureSelf(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  chapters: JourneyChapter[],
  analytics: JourneyAnalytics,
  streaks: JourneyStreaks,
  insights: JourneyInsightBundle,
): MindJourneyFutureSelf {
  const baseline = extractBaselineSignals(sources, dailyScores, analytics, streaks);
  const paths = simulateFuturePaths(baseline);

  return {
    baseline,
    paths,
    cards: buildFutureSelfCards(paths, baseline, insights),
    digitalTwin: buildDigitalTwin(sources, dailyScores, analytics, streaks, baseline),
    lifeChapters: enrichLifeChapters(chapters),
    impactSources: buildImpactRanking(sources, streaks),
    forecastChart: buildEmotionalForecast(dailyScores, baseline),
  };
}
