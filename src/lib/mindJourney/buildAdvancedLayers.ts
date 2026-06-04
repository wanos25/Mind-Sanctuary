import type { RawMindJourneySources } from './loadMindJourney';
import type {
  DailyEmotionalScore,
  JourneyAnalytics,
  JourneyHighlight,
  JourneyInsightBundle,
  JourneyStreaks,
  JourneyTimelineEvent,
  MindJourneyAdvanced,
  MindJourneyFutureSelf,
} from './types';
import { buildEarlyRisk } from './buildEarlyRisk';
import { buildPersonalityTwin } from './buildPersonalityTwin';
import { buildTimeMachine } from './buildTimeMachine';
import { buildCrisisPrevention } from './buildCrisisPrevention';
import { buildTherapeuticMemory } from './buildTherapeuticMemory';
import { buildTherapistIntelligenceDemo } from './therapistDemo/buildDemoCohort';

export function buildMindJourneyAdvanced(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  analytics: JourneyAnalytics,
  streaks: JourneyStreaks,
  futureSelf: MindJourneyFutureSelf,
  highlights: JourneyHighlight[],
  events: JourneyTimelineEvent[],
  _insights: JourneyInsightBundle,
): MindJourneyAdvanced {
  const earlyRisk = buildEarlyRisk(sources, dailyScores, analytics, streaks);

  return {
    earlyRisk,
    personalityTwin: buildPersonalityTwin(sources, dailyScores, analytics, streaks),
    timeMachine: buildTimeMachine(
      sources,
      dailyScores,
      analytics,
      streaks,
      futureSelf,
      highlights,
      events.map((e) => ({ id: e.id, title: e.title, at: e.at, kind: e.kind })),
    ),
    crisisPrevention: buildCrisisPrevention(
      sources,
      dailyScores,
      analytics,
      streaks,
      _insights,
      futureSelf.baseline,
    ),
    therapeuticMemory: buildTherapeuticMemory(sources, dailyScores, analytics, streaks),
    therapistDemo: buildTherapistIntelligenceDemo(),
  };
}
