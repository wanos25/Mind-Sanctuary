/**
 * Persistent emotional atmosphere store.
 *
 * A tiny pub/sub layer that lets the EmotionalAtmosphere (active inside the
 * session) bleed its current emotional hue into a global background layer
 * (`PersistentAtmosphere`) that lives in App.tsx and therefore survives route
 * transitions. This creates the perception of one continuous emotional
 * environment across Home / Chat / Activities / Doctor / closure states —
 * the hue carries over even after the session unmounts.
 *
 * Additive only: nothing reads/writes here unless it opts in. The default
 * tone is the calm baseline and is safe for every screen.
 */

export interface AtmosphereTone {
  /** HSL triplet "H S% L%" used inside hsl(...) — no wrapper. */
  warm: string;
  cool: string;
  highlight: string;
  /** 0..1 ambient glow multiplier. */
  glow: number;
  /** 0..1 saturation. */
  saturation: number;
  /** true while the assistant is actively streaming — softly amplifies pulse. */
  streaming?: boolean;
  /** Last updated timestamp (ms). Consumers can fade out stale tones. */
  ts: number;
}

const DEFAULT_TONE: AtmosphereTone = {
  warm: '38 55% 60%',
  cool: '180 30% 40%',
  highlight: '45 70% 70%',
  glow: 0.42,
  saturation: 0.9,
  streaming: false,
  ts: 0,
};

let current: AtmosphereTone = DEFAULT_TONE;
const listeners = new Set<(t: AtmosphereTone) => void>();

export function getAtmosphereTone(): AtmosphereTone {
  return current;
}

export function publishAtmosphereTone(next: Partial<AtmosphereTone>): void {
  current = { ...current, ...next, ts: Date.now() };
  listeners.forEach((l) => {
    try { l(current); } catch { /* ignore */ }
  });
}

export function subscribeAtmosphere(fn: (t: AtmosphereTone) => void): () => void {
  listeners.add(fn);
  // Push current state immediately so subscribers paint correctly on mount.
  try { fn(current); } catch { /* ignore */ }
  return () => { listeners.delete(fn); };
}
