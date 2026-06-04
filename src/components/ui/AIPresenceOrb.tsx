import { motion, useReducedMotion } from 'framer-motion';
import { useAIPresence } from '@/lib/presence/aiPresence';

/**
 * AIPresenceOrb — a small, theme-aware orb that visualises the assistant's
 * current presence mode (idle / listening / thinking / speaking). Pure CSS
 * + GPU transforms, no canvas, no expensive filters. Reduced-motion safe.
 *
 * Intentionally minimal & non-distracting. Use in chat headers or sidebars.
 */
interface Props {
  size?: number;
  className?: string;
  /** Optional aria label override (defaults to mode-aware text). */
  label?: string;
}

const MODE_LABEL: Record<string, string> = {
  idle: 'AI is present',
  listening: 'AI is listening',
  thinking: 'AI is thinking',
  speaking: 'AI is speaking',
};

export default function AIPresenceOrb({ size = 14, className, label }: Props) {
  const reduce = useReducedMotion();
  const { mode, energy, warmth } = useAIPresence();

  // Glow intensity from energy + warmth (bounded).
  const glow = Math.min(1, 0.35 + energy * 0.5 + warmth * 0.15);

  // Per-mode timing (no infinite animations when idle + reduced motion).
  const pulse =
    mode === 'speaking' ? { dur: 1.1, scale: [1, 1.18, 1] }
    : mode === 'thinking' ? { dur: 1.8, scale: [1, 1.08, 1] }
    : mode === 'listening' ? { dur: 1.4, scale: [1, 1.12, 1] }
    : { dur: 3.6, scale: [1, 1.04, 1] };

  return (
    <span
      role="status"
      aria-label={label ?? MODE_LABEL[mode]}
      className={`relative inline-flex items-center justify-center ${className ?? ''}`}
      style={{ width: size * 2, height: size * 2 }}
    >
      {/* outer breath ring */}
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, hsl(var(--gold) / ${0.18 * glow}) 0%, transparent 70%)`,
        }}
        animate={reduce ? undefined : { scale: pulse.scale, opacity: [0.7, 1, 0.7] }}
        transition={{ duration: pulse.dur, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* core dot */}
      <span
        aria-hidden
        className="rounded-full bg-primary"
        style={{
          width: size,
          height: size,
          boxShadow: `0 0 ${10 + glow * 14}px hsl(var(--gold) / ${0.4 + glow * 0.4})`,
          opacity: 0.85 + warmth * 0.15,
        }}
      />
    </span>
  );
}
