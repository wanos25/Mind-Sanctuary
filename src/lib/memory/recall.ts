import { EmotionalMemory } from './types';
import { listMemories, touchMemories } from './store';

export interface RecallItem {
  topic: string;
  emotion_pattern?: string;
  context?: string;
}

/**
 * Score memories for relevance to current message + emotion.
 * Mixes: keyword overlap, type weight, recurrence, freshness, emotion match.
 */
export async function recallForChat(
  userId: string,
  currentMessage: string,
  currentEmotion?: string,
  k = 6,
): Promise<{ recall: RecallItem[]; ids: string[] }> {
  const all = await listMemories(userId, 300);
  if (!all.length) return { recall: [], ids: [] };

  const tokens = tokenize(currentMessage);
  const now = Date.now();
  const scored = all.map((m) => ({ m, score: scoreMemory(m, tokens, currentEmotion, now) }))
    .sort((a, b) => b.score - a.score)
    .filter((x) => x.score > 0.15)
    .slice(0, k);

  const ids = scored.map((s) => s.m.id);
  // Fire-and-forget reinforcement
  touchMemories(userId, ids).catch(() => {});

  return {
    ids,
    recall: scored.map(({ m }) => ({
      topic: `${labelType(m.type)}: ${m.title}`,
      emotion_pattern: m.emotion ?? undefined,
      context: m.content ?? undefined,
    })),
  };
}

function tokenize(s: string) {
  return new Set(s.toLowerCase().match(/[a-z]{3,}/g) ?? []);
}

function scoreMemory(m: EmotionalMemory, tokens: Set<string>, emotion: string | undefined, now: number) {
  const titleTokens = (m.title.toLowerCase().match(/[a-z]{3,}/g) ?? []);
  const overlap = titleTokens.filter((t) => tokens.has(t)).length;
  const overlapScore = Math.min(1, overlap * 0.4);

  const typeWeight = ({
    fear: 0.9, trigger: 0.85, recovery: 0.8, person: 0.7,
    goal: 0.7, theme: 0.65, achievement: 0.6, habit: 0.5,
    preference: 0.4, event: 0.55,
  } as Record<string, number>)[m.type] ?? 0.5;

  const recurrenceBoost = Math.min(0.4, Math.log2(1 + m.recurrence_score) * 0.15);
  const ageDays = (now - new Date(m.updated_at).getTime()) / 86400000;
  const freshness = Math.max(0, 1 - ageDays / 90);
  const emotionMatch = emotion && m.emotion && emotion.toLowerCase().includes(m.emotion.toLowerCase()) ? 0.25 : 0;

  return (
    overlapScore * 1.2 +
    typeWeight * 0.4 +
    m.emotional_weight * 0.3 +
    recurrenceBoost +
    freshness * 0.2 +
    emotionMatch
  );
}

function labelType(t: string) {
  return ({
    person: 'Person', goal: 'Goal', fear: 'Fear', trigger: 'Trigger',
    recovery: 'What helps', achievement: 'Achievement', preference: 'Preference',
    theme: 'Theme', event: 'Event', habit: 'Habit',
  } as Record<string, string>)[t] ?? t;
}
