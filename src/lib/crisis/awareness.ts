import { EmotionState } from '@/context/AppContext';

export type CrisisLevel = 'none' | 'soft' | 'elevated' | 'acute';

const acute = [
  'kill myself', 'suicide', 'end it all', 'want to die', 'no reason to live',
  'better off dead', 'end my life', 'taking my life',
];
const elevated = [
  'self harm', 'hurt myself', 'cut myself', 'cant go on', "can't go on",
  'give up on life', 'nothing matters anymore',
];
const soft = [
  'hopeless', 'worthless', 'numb', 'empty inside', 'so tired of everything',
  'no one would notice', 'pointless', "what's the point",
];

export function assessCrisis(text: string, emotion?: EmotionState | null): CrisisLevel {
  const lower = text.toLowerCase();
  if (acute.some((p) => lower.includes(p))) return 'acute';
  if (elevated.some((p) => lower.includes(p))) return 'elevated';
  if (soft.some((p) => lower.includes(p))) return 'soft';
  if (emotion && emotion.intensity >= 0.92 && /depress|despair|hopeless/i.test(emotion.primary)) return 'elevated';
  return 'none';
}

export function softeningSystemNote(level: CrisisLevel): string {
  if (level === 'none') return '';
  if (level === 'soft') {
    return 'CRISIS-AWARE: The user shows soft distress signals. Slow down. Validate feelings deeply before suggesting anything. Offer grounding or breath. Do not minimise.';
  }
  if (level === 'elevated') {
    return 'CRISIS-AWARE: The user shows elevated distress. Drop any agenda. Be very gentle and present. Offer grounding (5-4-3-2-1, slow breath). Mention that talking to a professional or trusted person may help. Do not lecture.';
  }
  return 'CRISIS-AWARE — ACUTE: The user expressed crisis-level language. Prioritise safety above all else. Acknowledge the pain. Encourage immediate contact with a crisis line (988 in the US, local equivalents). Stay calm, warm, brief. No reframing, no exercises beyond a single grounding breath. Make sure they feel heard and safe.';
}
