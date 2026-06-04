import type { EmotionState } from '@/context/AppContext';

const REFLECT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reflect`;

const TRIGGER_EMOTIONS = [
  'sad', 'sadness', 'lonely', 'loneliness', 'grief', 'grieving',
  'exhaust', 'burnout', 'depress', 'hopeless', 'numb', 'empty',
  'anxiety', 'anxious', 'panic', 'fear', 'overwhelmed',
  'shame', 'guilt', 'vulnerable',
];

const VULNERABILITY_HINTS = /\b(i feel|i don'?t know|i can'?t|i'?m tired|i'?m alone|i miss|i lost|i hate myself|why me|nobody|no one|exhausted|breakdown|cry|crying)\b/i;

const BREAKTHROUGH_HINTS = /\b(i realized|i understand now|for the first time|finally|i see|i think i|breakthrough|i'?m ready)\b/i;

export interface ReflectionDecision {
  trigger: boolean;
  reason: string;
}

export function shouldReflect(userText: string, emotion: EmotionState | null | undefined): ReflectionDecision {
  if (!userText || userText.trim().length < 18) return { trigger: false, reason: 'too-short' };
  if (emotion) {
    const p = (emotion.primary || '').toLowerCase();
    const matchEmotion = TRIGGER_EMOTIONS.some((k) => p.includes(k));
    if (matchEmotion && emotion.intensity >= 0.55) return { trigger: true, reason: 'emotion' };
    if ((emotion.distortions?.length ?? 0) >= 2) return { trigger: true, reason: 'distortions' };
  }
  if (VULNERABILITY_HINTS.test(userText)) return { trigger: true, reason: 'vulnerability' };
  if (BREAKTHROUGH_HINTS.test(userText)) return { trigger: true, reason: 'breakthrough' };
  return { trigger: false, reason: 'baseline' };
}

export async function fetchReflection(params: {
  userMessage: string;
  assistantMessage: string;
  emotion?: EmotionState | null;
}): Promise<string | null> {
  try {
    const r = await fetch(REFLECT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(params),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const text: string = (data?.reflection ?? '').trim();
    if (!text) return null;
    // Guard against accidental near-duplication
    if (similarity(text, params.assistantMessage) > 0.78) return null;
    if (text.length > params.assistantMessage.length * 0.95) {
      // Reflection should be shorter; truncate at sentence boundary.
      const cut = text.slice(0, Math.max(60, Math.floor(params.assistantMessage.length * 0.6)));
      const dot = cut.lastIndexOf('.');
      return (dot > 30 ? cut.slice(0, dot + 1) : cut).trim();
    }
    return text;
  } catch {
    return null;
  }
}

// Cheap word-overlap similarity to catch near-duplicate reflections.
function similarity(a: string, b: string): number {
  const norm = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
  const A = norm(a); const B = norm(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}
