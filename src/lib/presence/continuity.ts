import type { DailyPulse } from './pulse';

/**
 * Continuity — soft, non-creepy "the room remembers" phrasing.
 *
 * Derives a single short whisper line from the recent emotional pulses the
 * client already loads for the greeting layer. Strict rules:
 *
 *  - No proper names, no dates, no specific topics.
 *  - No "you said yesterday…", no memory dumps.
 *  - Speaks about the *space/room/tone*, never the person directly.
 *  - At most one sentence. Lowercase, gentle. Always optional — returns
 *    null when there is no graceful continuity to draw.
 *
 * These lines are intended for the ambient whisper system / first-arrival
 * presence card, never for chat content.
 */

export interface ContinuityWhisper {
  /** Short line, ≤ 80 chars. */
  text: string;
  /** Coarse emotional bucket — useful for tinting. */
  tone: 'warm' | 'soft' | 'quiet' | 'recovering' | 'steady';
}

function dominantBucket(pulses: DailyPulse[]) {
  const m = new Map<string, number>();
  for (const p of pulses) {
    if (p.dominant_emotion) m.set(p.dominant_emotion, (m.get(p.dominant_emotion) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]?.toLowerCase() ?? '';
}

export function buildContinuityWhisper(
  pulses: DailyPulse[],
  opts: { hour?: number; daysSinceLastSession?: number | null } = {},
): ContinuityWhisper | null {
  const recent = pulses.slice(0, 7);
  if (recent.length === 0) return null;

  const avg =
    recent.reduce((a, p) => a + (p.avg_intensity ?? 0), 0) /
    Math.max(1, recent.filter((p) => typeof p.avg_intensity === 'number').length);
  const dom = dominantBucket(recent);
  const gap = opts.daysSinceLastSession ?? null;
  const hour = opts.hour ?? new Date().getHours();
  const late = hour >= 22 || hour < 5;

  // Long absence — gentlest re-entry.
  if (gap != null && gap >= 5) {
    return { text: 'the room kept its light on.', tone: 'warm' };
  }
  if (gap != null && gap >= 2) {
    return { text: 'this quiet has been waiting, unhurried.', tone: 'soft' };
  }

  // Heavy recent tone — acknowledge weight without naming it.
  if (avg > 0.7 || /depress|burnout|grief|anxiety/.test(dom)) {
    return { text: 'something heavy was held here recently — it can rest.', tone: 'quiet' };
  }

  // Calmer than average — recovery cue.
  if (avg < 0.35 && recent.length >= 3) {
    return { text: 'a softer tone is settling in.', tone: 'recovering' };
  }

  // Late hours — body-clock aware.
  if (late) {
    return { text: 'the night is listening too.', tone: 'soft' };
  }

  // Steady consistent rhythm — quiet acknowledgement, no praise.
  if (recent.length >= 4) {
    return { text: 'the rhythm of returning is becoming familiar.', tone: 'steady' };
  }

  return null;
}
