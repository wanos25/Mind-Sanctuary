/**
 * Atmosphere Inertia — emotional easing layer on top of `atmosphereStore`.
 *
 * The raw store flips tone instantly. Real emotional environments have
 * *inertia*: after an intense exchange the room doesn't snap back to neutral,
 * it settles. After a difficult moment, warmth gently returns. This module
 * provides two opt-in helpers used by callers that want that quality:
 *
 *   easePublishTone(next, ms)  — interpolates HSL triplets + glow/saturation
 *                                from the current tone to `next` over `ms`.
 *   markIntensity(level)       — records a recent intensity peak; the next
 *                                idle window will gently bias warmth upward
 *                                ("hopeful settling") via a one-shot eased
 *                                publish.
 *
 * Pure client-side. No backend. No new dependencies. Reduced-motion aware:
 * when the user prefers reduced motion, transitions collapse to a single
 * publish at the target value.
 */

import {
  getAtmosphereTone,
  publishAtmosphereTone,
  type AtmosphereTone,
} from './atmosphereStore';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

// ---------- HSL triplet interpolation -------------------------------------

function parseHsl(triplet: string): [number, number, number] {
  // Expected format: "H S% L%"  e.g.  "38 55% 60%"
  const m = triplet.trim().match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/);
  if (!m) return [0, 0, 0];
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
}

function formatHsl(h: number, s: number, l: number): string {
  return `${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%`;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Shortest-path hue interpolation around the 360° wheel. */
function lerpHue(a: number, b: number, t: number) {
  const diff = ((b - a + 540) % 360) - 180;
  return (a + diff * t + 360) % 360;
}

function lerpHsl(a: string, b: string, t: number): string {
  const [ah, as, al] = parseHsl(a);
  const [bh, bs, bl] = parseHsl(b);
  return formatHsl(lerpHue(ah, bh, t), lerp(as, bs, t), lerp(al, bl, t));
}

// ---------- Eased publish --------------------------------------------------

let activeRaf: number | null = null;

/**
 * Smoothly interpolate from the currently-published tone to `next` over
 * `ms`. Cancels any in-flight ease so the latest call always wins.
 */
export function easePublishTone(
  next: Partial<AtmosphereTone>,
  ms = 1800,
): void {
  if (typeof window === 'undefined') return;
  const from = getAtmosphereTone();
  const target: AtmosphereTone = {
    ...from,
    ...next,
    ts: Date.now(),
  };

  if (prefersReducedMotion() || ms <= 16) {
    publishAtmosphereTone(target);
    return;
  }

  if (activeRaf != null) cancelAnimationFrame(activeRaf);
  const start = performance.now();

  const tick = (now: number) => {
    const raw = Math.min(1, (now - start) / ms);
    // easeOutCubic — settles softly, never overshoots.
    const t = 1 - Math.pow(1 - raw, 3);
    publishAtmosphereTone({
      warm: lerpHsl(from.warm, target.warm, t),
      cool: lerpHsl(from.cool, target.cool, t),
      highlight: lerpHsl(from.highlight, target.highlight, t),
      glow: lerp(from.glow, target.glow, t),
      saturation: lerp(from.saturation, target.saturation, t),
      streaming: target.streaming,
    });
    if (raw < 1) {
      activeRaf = requestAnimationFrame(tick);
    } else {
      activeRaf = null;
    }
  };
  activeRaf = requestAnimationFrame(tick);
}

// ---------- Intensity memory + hopeful settling ---------------------------

interface IntensityMemory {
  /** Highest intensity observed in the recent window (0..1). */
  peak: number;
  /** When the peak was observed (ms epoch). */
  peakAt: number;
  /** When we last applied a hopeful settle (debounce). */
  lastSettledAt: number;
}

const memory: IntensityMemory = { peak: 0, peakAt: 0, lastSettledAt: 0 };

/**
 * Record an emotional-intensity sample (0..1). The largest sample within
 * the last ~3 min is retained as the room's "weight". Callers can then
 * invoke `requestHopefulSettle()` on a calm transition (e.g. session
 * closure, route change to home) to gently bias the room back toward warm.
 */
export function markIntensity(level: number): void {
  const v = Math.max(0, Math.min(1, level));
  const now = Date.now();
  // Decay the stored peak after ~3 minutes.
  if (now - memory.peakAt > 180_000) memory.peak = 0;
  if (v >= memory.peak) {
    memory.peak = v;
    memory.peakAt = now;
  }
}

/**
 * If a meaningful intensity peak was recently observed, publish a one-shot
 * eased tone biased toward warmth + lowered saturation — the visual
 * equivalent of "the room exhales". Safe to call repeatedly; debounced.
 */
export function requestHopefulSettle(): void {
  const now = Date.now();
  if (memory.peak < 0.55) return;                      // nothing intense to settle
  if (now - memory.lastSettledAt < 12_000) return;     // debounce
  memory.lastSettledAt = now;

  const weight = Math.min(1, memory.peak);
  const warm = `38 ${(45 + 18 * weight).toFixed(0)}% ${(58 + 4 * weight).toFixed(0)}%`;
  const cool = `24 ${(28 + 8 * weight).toFixed(0)}% ${(32 + 3 * weight).toFixed(0)}%`;
  easePublishTone(
    {
      warm,
      cool,
      highlight: '45 70% 72%',
      glow: 0.42 + 0.10 * weight,
      saturation: 0.88,
      streaming: false,
    },
    2600,
  );

  // Slowly forget the peak so the next intense moment can register fresh.
  memory.peak *= 0.4;
}
