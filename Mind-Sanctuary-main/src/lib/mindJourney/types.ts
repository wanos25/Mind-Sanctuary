import type { SessionRow } from '@/lib/sessions';
import type { EmotionAnalysisRow } from '@/lib/insightsAggregator';

export type JourneyEventKind =
  | 'daily_score'
  | 'milestone'
  | 'session'
  | 'activity'
  | 'moment'
  | 'streak';

export interface JourneyTimelineEvent {
  id: string;
  kind: JourneyEventKind;
  at: string;
  title: string;
  subtitle?: string;
  score?: number;
  emotion?: string;
  meta?: Record<string, string | number>;
}

export interface DailyEmotionalScore {
  date: string;
  dateKey: string;
  score: number;
  sessionCount: number;
  dominantEmotion: string;
}

export interface JourneyStreaks {
  reflectionDays: number;
  currentStreak: number;
  longestStreak: number;
  recoveryDays: number;
}

export interface JourneyAnalytics {
  moodImprovementPct: number;
  anxietyReductionPct: number;
  stressTrend: 'improving' | 'stable' | 'rising';
  consistencyScore: number;
}

export interface JourneyInsightBundle {
  summary: string;
  improvements: string[];
  regressions: string[];
  recommendations: string[];
}

export type ChapterEmotionalTone =
  | 'beginning'
  | 'challenge'
  | 'progress'
  | 'momentum'
  | 'present';

export interface JourneyChapter {
  id: string;
  index: number;
  title: string;
  dateRange: { start: string; end: string; label: string };
  narrative: string;
  keyEvents: Array<{ id: string; title: string; at: string }>;
  emotionalTone: ChapterEmotionalTone;
  avgScore: number;
  moodDelta: number;
  streakNote?: string;
}

export type LifePhase = 'beginning' | 'struggle' | 'recovery' | 'growth' | 'momentum';

export interface LifeChapter extends JourneyChapter {
  lifePhase: LifePhase;
  documentaryIntro: string;
  transitionToNext?: string;
}

export type FuturePathKind = 'continue' | 'growth' | 'neglect';

export type HorizonDays = 30 | 90 | 180;

export interface PathHorizonProjection {
  horizonDays: HorizonDays;
  emotionalTrend: 'rising' | 'stable' | 'declining';
  consistency: number;
  resilience: number;
  wellness: number;
}

export interface FutureSimulationPath {
  kind: FuturePathKind;
  title: string;
  description: string;
  projections: PathHorizonProjection[];
}

export interface FutureSelfCard {
  horizonDays: HorizonDays;
  projectedState: string;
  strengths: string[];
  risks: string[];
  recommendedActions: string[];
  confidence: number;
  wellness: number;
  emotionalTrend: 'rising' | 'stable' | 'declining';
}

export interface DigitalTwinProfile {
  archetypeId: string;
  archetype: string;
  tagline: string;
  strengths: string[];
  emotionalPatterns: string[];
  blindSpots: string[];
  growthOpportunities: string[];
}

export interface ImpactSource {
  id: string;
  label: string;
  contributionPct: number;
}

export interface ForecastChartPoint {
  dateKey: string;
  date: string;
  score: number;
  phase: 'past' | 'present' | 'forecast';
}

export interface MindJourneyFutureSelf {
  baseline: {
    wellness: number;
    slopePerDay: number;
    consistency: number;
    resilience: number;
    engagementPerWeek: number;
    dataConfidence: number;
  };
  paths: FutureSimulationPath[];
  cards: FutureSelfCard[];
  digitalTwin: DigitalTwinProfile;
  lifeChapters: LifeChapter[];
  impactSources: ImpactSource[];
  forecastChart: ForecastChartPoint[];
}

export interface GrowthScore {
  current: number;
  deltaThisMonth: number;
  deltaSinceStart: number;
}

export interface BeforeNowComparison {
  available: boolean;
  firstWeek: { stress: number; mood: number; label: string };
  today: { stress: number; mood: number; label: string };
  stressImprovementPct: number;
  moodImprovementPct: number;
}

export type HighlightKind =
  | 'streak'
  | 'activity'
  | 'consistency'
  | 'emotion'
  | 'session';

export interface JourneyHighlight {
  id: string;
  title: string;
  subtitle?: string;
  at: string;
  kind: HighlightKind;
}

export interface EmotionalSeason {
  id: string;
  name: string;
  dateRange: { start: string; end: string; label: string };
  summary: string;
  dominantTrend: string;
}

export interface FuturePath {
  strengths: string[];
  risks: string[];
  recommendedActions: string[];
}

export interface MindJourneyStory {
  chapters: JourneyChapter[];
  growthScore: GrowthScore;
  comparison: BeforeNowComparison;
  highlights: JourneyHighlight[];
  seasons: EmotionalSeason[];
  futurePath: FuturePath;
}

export type RiskLevel = 'low' | 'moderate' | 'high';

export type MentalWeather = 'stable' | 'improving' | 'storm_incoming' | 'recovery_phase';

export interface EarlyWarning {
  id: string;
  title: string;
  riskLevel: RiskLevel;
  evidence: string[];
  confidence: number;
  intervention: string;
}

export interface EarlyRiskProfile {
  burnoutRisk: number;
  anxietyEscalationRisk: number;
  isolationRisk: number;
  recoveryProbability: number;
  mentalWeather: MentalWeather;
  warnings: EarlyWarning[];
  confidence: number;
}

export interface TraitEvidence {
  label: string;
  detail: string;
}

export interface PersonalityTwinProfile {
  displayName: string;
  coreTraits: string[];
  emotionalTriggers: string[];
  recoveryStrengths: string[];
  hiddenWeaknesses: string[];
  communicationStyle: string;
  growthOpportunities: string[];
  confidence: number;
  evidence: TraitEvidence[];
  changesOverTime: string[];
}

export interface TimeSelfSnapshot {
  label: 'past' | 'present' | 'future';
  dateLabel: string;
  emotionalScore: number;
  resilience: number;
  consistency: number;
  recoveryCapacity: number;
  majorChallenges: string[];
}

export interface TimeMachineMilestone {
  id: string;
  title: string;
  at: string;
  memory: string;
}

export interface TimeMachineTimelinePoint {
  dateKey: string;
  date: string;
  score: number;
  phase: 'history' | 'present';
}

export interface EmotionalTimeMachine {
  past: TimeSelfSnapshot;
  present: TimeSelfSnapshot;
  future: TimeSelfSnapshot;
  narrative: { past: string; present: string; future: string };
  milestones: TimeMachineMilestone[];
  timelinePoints: TimeMachineTimelinePoint[];
}

export type TrendDirection = 'improving' | 'stable' | 'worsening';

export interface CrisisRiskScores {
  burnout: number;
  anxietyEscalation: number;
  depression: number;
  socialWithdrawal: number;
  recoveryCollapse: number;
}

export interface PreventionWarning {
  id: string;
  title: string;
  riskLevel: RiskLevel;
  confidence: number;
  evidence: string[];
  trendDirection: TrendDirection;
}

export interface PreventionRecommendations {
  immediate: string;
  next24Hours: string;
  next7Days: string;
}

export interface RecoverySimulation {
  ifNothingChanges: { wellness30: number; label: string };
  ifActionsFollowed: { wellness30: number; label: string };
  delta: number;
  recoveryProbability: number;
}

export interface CrisisPreventionProfile {
  risks: CrisisRiskScores;
  overallLevel: RiskLevel;
  earlyWarnings: PreventionWarning[];
  recommendations: PreventionRecommendations;
  simulation: RecoverySimulation;
  emergencyGlow: boolean;
  confidence: number;
}

export interface RecurringPattern {
  label: string;
  count: number;
  detail: string;
}

export interface TherapeuticMemoryProfile {
  emotionalThemes: RecurringPattern[];
  recurringTriggers: RecurringPattern[];
  growthAreas: string[];
  longTermGoals: string[];
  keepsAppearing: string[];
  improvedOverTime: string[];
  confidence: number;
}

export interface DemoPatientTimelineEvent {
  at: string;
  title: string;
}

export interface DemoPatientRecord {
  id: string;
  name: string;
  riskLevel: RiskLevel;
  burnout: number;
  anxiety: number;
  moodSparkline: number[];
  recoveryTrend: number;
  lastSession: string;
  dominantEmotion: string;
  interventions: string[];
  timeline: DemoPatientTimelineEvent[];
  aiSummary: string;
}

export interface TherapistIntelligenceDemo {
  demoMode: true;
  patients: DemoPatientRecord[];
  cohortSummary: { low: number; moderate: number; high: number };
}

export interface MindJourneyAdvanced {
  earlyRisk: EarlyRiskProfile;
  personalityTwin: PersonalityTwinProfile;
  timeMachine: EmotionalTimeMachine;
  crisisPrevention: CrisisPreventionProfile;
  therapeuticMemory: TherapeuticMemoryProfile;
  therapistDemo: TherapistIntelligenceDemo;
}

export interface MindJourneyData {
  sessions: SessionRow[];
  analyses: EmotionAnalysisRow[];
  dailyScores: DailyEmotionalScore[];
  events: JourneyTimelineEvent[];
  streaks: JourneyStreaks;
  analytics: JourneyAnalytics;
  insights: JourneyInsightBundle;
  story: MindJourneyStory;
  futureSelf: MindJourneyFutureSelf;
  advanced: MindJourneyAdvanced;
}
