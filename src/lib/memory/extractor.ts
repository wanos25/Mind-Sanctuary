import { MemoryDraft, MemoryType } from './types';

/**
 * Heuristic emotional memory extractor.
 * Pure-function pipeline — no IO. Designed to be augmented by an AI pass later.
 *
 * It scans a single user message and produces zero or more typed memory drafts
 * with confidence + emotional weight. The store layer dedupes/reinforces.
 */

interface Pattern {
  type: MemoryType;
  /** match: returns titleSeed string when matched, else null */
  match: (text: string) => string | null;
  baseWeight: number;
  baseConfidence: number;
  tags?: string[];
}

const norm = (s: string) => s.toLowerCase();

// Simple nominal-name extractor (capitalised tokens, naive but effective enough).
function findNames(text: string): string[] {
  const names = new Set<string>();
  const re = /\b([A-Z][a-z]{2,15})\b/g;
  let m;
  const skip = new Set(['I', 'You', 'My', 'Me', 'We', 'They', 'Today', 'Yesterday', 'Tomorrow', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  while ((m = re.exec(text)) !== null) {
    if (!skip.has(m[1])) names.add(m[1]);
  }
  return Array.from(names).slice(0, 3);
}

const patterns: Pattern[] = [
  // GOALS
  {
    type: 'goal',
    baseWeight: 0.7, baseConfidence: 0.65,
    tags: ['goal'],
    match: (t) => {
      const m = t.match(/\b(?:i (?:want|wish|hope|plan|need|aim|am trying|am working) (?:to )?)([^.,!?\n]{6,80})/i);
      return m ? m[1].trim() : null;
    },
  },
  // FEARS
  {
    type: 'fear',
    baseWeight: 0.85, baseConfidence: 0.7,
    tags: ['fear'],
    match: (t) => {
      const m = t.match(/\b(?:i(?:'m| am)? (?:scared|afraid|terrified|fear) (?:of |that |to )?)([^.,!?\n]{4,80})/i)
        || t.match(/\bi fear ([^.,!?\n]{4,80})/i);
      return m ? m[1].trim() : null;
    },
  },
  // TRIGGERS
  {
    type: 'trigger',
    baseWeight: 0.75, baseConfidence: 0.6,
    tags: ['trigger'],
    match: (t) => {
      const m = t.match(/\b(?:every time|whenever|when) ([^.,!?\n]{6,80}?) (?:i feel|i get|i become|makes me feel|i'm)/i);
      return m ? m[1].trim() : null;
    },
  },
  // RECOVERY
  {
    type: 'recovery',
    baseWeight: 0.8, baseConfidence: 0.7,
    tags: ['recovery', 'coping'],
    match: (t) => {
      const m = t.match(/\b(?:helps me|made me feel better|calms me|grounds me|i felt better when) ([^.,!?\n]{4,80})/i)
        || t.match(/\b(walking|meditation|breathing|journaling|music|nature|therapy|sleep) (?:helps|calms|grounds)/i);
      return m ? (m[1] || m[0]).trim() : null;
    },
  },
  // ACHIEVEMENTS
  {
    type: 'achievement',
    baseWeight: 0.7, baseConfidence: 0.65,
    tags: ['achievement'],
    match: (t) => {
      const m = t.match(/\b(?:i (?:finally|managed to|did it|succeeded|completed|finished|accomplished) )([^.,!?\n]{4,80})/i)
        || t.match(/\bi('m| am) proud (?:of |that )([^.,!?\n]{4,80})/i);
      return m ? (m[2] || m[1] || '').trim() : null;
    },
  },
  // HABITS
  {
    type: 'habit',
    baseWeight: 0.5, baseConfidence: 0.55,
    tags: ['habit'],
    match: (t) => {
      const m = t.match(/\b(?:i (?:always|usually|often|tend to|keep)) ([^.,!?\n]{4,80})/i);
      return m ? m[1].trim() : null;
    },
  },
  // PREFERENCES
  {
    type: 'preference',
    baseWeight: 0.45, baseConfidence: 0.55,
    tags: ['preference'],
    match: (t) => {
      const m = t.match(/\b(?:i (?:love|enjoy|like|prefer|hate|can't stand|dislike)) ([^.,!?\n]{4,80})/i);
      return m ? m[1].trim() : null;
    },
  },
];

// Recurring stress source / theme keywords
const themes: Array<{ kw: string[]; title: string; tags: string[] }> = [
  { kw: ['work', 'boss', 'job', 'office', 'deadline'], title: 'Work pressure', tags: ['work'] },
  { kw: ['family', 'mother', 'father', 'parents', 'sibling'], title: 'Family dynamics', tags: ['family'] },
  { kw: ['relationship', 'partner', 'breakup', 'dating'], title: 'Relationship', tags: ['relationship'] },
  { kw: ['sleep', 'insomnia', "can't sleep"], title: 'Sleep difficulty', tags: ['sleep', 'health'] },
  { kw: ['money', 'finance', 'rent', 'debt'], title: 'Financial stress', tags: ['money'] },
  { kw: ['lonely', 'loneliness', 'isolated', 'alone'], title: 'Loneliness', tags: ['loneliness'] },
  { kw: ['self-esteem', 'worthless', 'not good enough'], title: 'Self-esteem', tags: ['self-esteem'] },
];

export interface ExtractContext {
  emotion?: string;
  intensity?: number;
}

export function extractMemories(message: string, ctx: ExtractContext = {}): MemoryDraft[] {
  if (!message || message.length < 8) return [];
  const drafts: MemoryDraft[] = [];
  const lower = norm(message);

  // People
  for (const name of findNames(message)) {
    drafts.push({
      type: 'person',
      title: name,
      content: `Mentioned in conversation`,
      emotion: ctx.emotion,
      emotional_weight: clamp((ctx.intensity ?? 0.4) * 0.9, 0.3, 0.95),
      confidence: 0.55,
      tags: ['person'],
    });
  }

  // Patterned drafts
  for (const p of patterns) {
    const seed = p.match(message);
    if (!seed) continue;
    drafts.push({
      type: p.type,
      title: truncateTitle(seed),
      content: message.slice(0, 200),
      emotion: ctx.emotion,
      emotional_weight: clamp(p.baseWeight + (ctx.intensity ?? 0) * 0.15, 0.2, 0.98),
      confidence: p.baseConfidence,
      tags: p.tags,
    });
  }

  // Themes
  for (const th of themes) {
    if (th.kw.some((k) => lower.includes(k))) {
      drafts.push({
        type: 'theme',
        title: th.title,
        content: message.slice(0, 200),
        emotion: ctx.emotion,
        emotional_weight: clamp(0.55 + (ctx.intensity ?? 0) * 0.3, 0.3, 0.95),
        confidence: 0.7,
        tags: th.tags,
      });
    }
  }

  return dedupe(drafts);
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
function truncateTitle(s: string) {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > 80 ? t.slice(0, 77) + '…' : t;
}
function dedupe(items: MemoryDraft[]) {
  const seen = new Set<string>();
  return items.filter((m) => {
    const k = `${m.type}::${norm(m.title)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Fuzzy match title for reinforcement detection. */
export function memoryKey(type: MemoryType, title: string) {
  return `${type}::${norm(title).replace(/\s+/g, ' ').slice(0, 80)}`;
}
