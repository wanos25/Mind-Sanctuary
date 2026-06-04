import type { RecurringPattern, TherapeuticMemoryProfile } from './types';
import type { RawMindJourneySources } from './loadMindJourney';
import type { DailyEmotionalScore, JourneyAnalytics, JourneyStreaks } from './types';
import { clamp } from './riskSignals';

const ANXIETY_EMOTIONS = new Set(['anxiety', 'fear', 'stress', 'worry', 'moderate anxiety', 'mild stress']);

function countEmotions(sources: RawMindJourneySources): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sources.sessions) {
    const e = (s.summary_emotion ?? 'unknown').toLowerCase().trim();
    if (e && e !== 'unknown') map.set(e, (map.get(e) ?? 0) + 1);
  }
  for (const a of sources.analyses) {
    const e = (a.primary_emotion ?? 'unknown').toLowerCase().trim();
    if (e && e !== 'unknown') map.set(e, (map.get(e) ?? 0) + 1);
  }
  for (const m of sources.moments) {
    if (m.emotion) {
      const e = m.emotion.toLowerCase().trim();
      map.set(e, (map.get(e) ?? 0) + 1);
    }
  }
  return map;
}

function toPatterns(map: Map<string, number>, minCount: number): RecurringPattern[] {
  return [...map.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label: label.replace(/_/g, ' '),
      count,
      detail: `Appeared ${count} time${count === 1 ? '' : 's'} across your journey.`,
    }));
}

function detectTriggers(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
): RecurringPattern[] {
  const triggers: RecurringPattern[] = [];
  const sorted = [...dailyScores].sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  let gapAnxiety = 0;
  for (let i = 1; i < sources.sessions.length; i++) {
    const prev = new Date(sources.sessions[i - 1].started_at).getTime();
    const cur = new Date(sources.sessions[i].started_at).getTime();
    const gapDays = (cur - prev) / 86400000;
    const em = (sources.sessions[i].summary_emotion ?? '').toLowerCase();
    if (gapDays >= 4 && ANXIETY_EMOTIONS.has(em)) gapAnxiety += 1;
  }
  if (gapAnxiety >= 2) {
    triggers.push({
      label: 'Return-after-gap anxiety',
      count: gapAnxiety,
      detail: 'Anxiety-tagged sessions often follow multi-day breaks.',
    });
  }

  const lowDays = new Set(sorted.filter((d) => d.score < 45).map((d) => d.dateKey));
  const afterLow = sources.sessions.filter((s) => {
    const key = new Date(s.started_at).toISOString().slice(0, 10);
    const prev = new Date(s.started_at);
    prev.setDate(prev.getDate() - 1);
    const prevKey = prev.toISOString().slice(0, 10);
    return lowDays.has(prevKey);
  });
  if (afterLow.length >= 2) {
    triggers.push({
      label: 'Low-wellness rebound sessions',
      count: afterLow.length,
      detail: 'You often reflect right after difficult score days.',
    });
  }

  const topAnx = sources.sessions.filter((s) =>
    ANXIETY_EMOTIONS.has((s.summary_emotion ?? '').toLowerCase()),
  ).length;
  if (topAnx >= 3) {
    triggers.push({
      label: 'Stress & anxiety cluster',
      count: topAnx,
      detail: `${topAnx} sessions tagged with stress or anxiety.`,
    });
  }

  return triggers.slice(0, 4);
}

function inferGoals(sources: RawMindJourneySources, streaks: JourneyStreaks): string[] {
  const goals: string[] = [];
  if (streaks.longestStreak >= 3) {
    goals.push(`Sustain reflection streaks (peak: ${streaks.longestStreak} days).`);
  }
  const cbt = sources.activities.filter((a) => a.completed_at && a.kind === 'cbt_flow').length;
  if (cbt > 0) goals.push('Complete structured CBT flows to build coping skills.');
  else goals.push('Complete your first CBT activity.');
  const edu = sources.activities.filter((a) => a.completed_at && a.kind === 'educational_video').length;
  if (edu > 0) goals.push('Continue learning through educational activities.');
  goals.push('Improve weekly wellness average by showing up consistently.');
  return goals.slice(0, 4);
}

export function buildTherapeuticMemory(
  sources: RawMindJourneySources,
  dailyScores: DailyEmotionalScore[],
  analytics: JourneyAnalytics,
  streaks: JourneyStreaks,
): TherapeuticMemoryProfile {
  const emotionMap = countEmotions(sources);
  const minCount = sources.sessions.length >= 8 ? 3 : 2;
  const emotionalThemes = toPatterns(emotionMap, minCount).slice(0, 5);
  const recurringTriggers = detectTriggers(sources, dailyScores);

  const growthAreas: string[] = [];
  if (analytics.consistencyScore < 70) growthAreas.push('Daily reflection rhythm');
  if (!sources.activities.some((a) => a.completed_at)) {
    growthAreas.push('Structured activity practice');
  }
  if (analytics.stressTrend === 'rising') growthAreas.push('Stress regulation');
  if (analytics.moodImprovementPct >= 5) growthAreas.push('Consolidate recent mood gains');
  if (!growthAreas.length) growthAreas.push('Deepen self-awareness through regular check-ins');

  const longTermGoals = inferGoals(sources, streaks);

  const keepsAppearing: string[] = [];
  for (const t of emotionalThemes.slice(0, 2)) {
    keepsAppearing.push(`${t.label} keeps appearing (${t.count}×).`);
  }
  for (const tr of recurringTriggers.slice(0, 2)) {
    keepsAppearing.push(tr.detail);
  }
  if (!keepsAppearing.length) {
    keepsAppearing.push('Your journey is still forming — patterns will sharpen with more sessions.');
  }

  const improvedOverTime: string[] = [];
  if (analytics.moodImprovementPct >= 5) {
    improvedOverTime.push(`Mood wellness up ~${analytics.moodImprovementPct}% vs earlier period.`);
  }
  if (analytics.anxietyReductionPct >= 5) {
    improvedOverTime.push(`Anxiety intensity down ~${analytics.anxietyReductionPct}%.`);
  }
  if (streaks.longestStreak >= 4) {
    improvedOverTime.push(`Built a ${streaks.longestStreak}-day reflection streak.`);
  }
  if (sources.activities.filter((a) => a.completed_at).length >= 2) {
    improvedOverTime.push('Multiple structured activities completed.');
  }
  if (!improvedOverTime.length) {
    improvedOverTime.push('Consistency and self-tracking are themselves early wins.');
  }

  const confidence = clamp(
    38 + sources.sessions.length * 3 + emotionMap.size * 2,
    40,
    93,
  );

  return {
    emotionalThemes,
    recurringTriggers,
    growthAreas: growthAreas.slice(0, 4),
    longTermGoals,
    keepsAppearing: keepsAppearing.slice(0, 5),
    improvedOverTime: improvedOverTime.slice(0, 5),
    confidence,
  };
}
