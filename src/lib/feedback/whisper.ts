import { toast } from 'sonner';

/**
 * Subtle "whisper" reinforcement layer.
 *
 * Used for low-key emotional acknowledgements ("you showed up today",
 * "first reflection of the week", "session closing gently"). It deliberately
 * avoids gamification language and noisy badges.
 *
 * Behavior:
 * - Rate-limited: each `key` can only whisper once per cooldown window.
 * - Calm visual styling via sonner classNames.
 * - Auto-dismiss; never blocks interaction.
 */

const COOLDOWN_MS = 5 * 60 * 1000;
const lastByKey = new Map<string, number>();

interface WhisperOptions {
  /** Stable identity used for rate-limiting; same key won't fire twice within cooldown. */
  key: string;
  /** Optional sub-line, italicized. */
  hint?: string;
  /** Override cooldown for this whisper (ms). */
  cooldownMs?: number;
  /** Display duration (ms). Default 4200. */
  durationMs?: number;
}

export function whisper(message: string, opts: WhisperOptions): void {
  if (typeof window === 'undefined') return;
  const cooldown = opts.cooldownMs ?? COOLDOWN_MS;
  const last = lastByKey.get(opts.key) ?? 0;
  const now = Date.now();
  if (now - last < cooldown) return;
  lastByKey.set(opts.key, now);

  toast.message(message, {
    description: opts.hint,
    duration: opts.durationMs ?? 4200,
    className:
      'border border-primary/25 bg-background/85 backdrop-blur-xl shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.35)]',
  });
}

/** Convenience: reset a whisper key (e.g. on user logout / new session). */
export function resetWhisper(key?: string) {
  if (key) lastByKey.delete(key);
  else lastByKey.clear();
}
