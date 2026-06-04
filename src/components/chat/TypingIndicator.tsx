import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

/**
 * Premium "thinking presence" — replaces three bouncing dots with a calm
 * inhale/exhale orb and a quiet horizontal cadence line. Communicates
 * intentional, thoughtful processing instead of mechanical typing.
 *
 * - Honors prefers-reduced-motion (falls back to a static glow).
 * - RTL-safe (uses logical alignment + symmetric gradients).
 * - GPU-cheap: two transform/opacity loops, no layout work.
 */
export default function TypingIndicator() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
      className="flex items-center gap-3 px-1"
      role="status"
      aria-live="polite"
      aria-label={t('chat.thinking', { defaultValue: 'Thinking…' })}
    >
      {/* Breathing presence orb */}
      <div className="relative w-9 h-9">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.55), hsl(var(--primary) / 0) 70%)',
            filter: 'blur(2px)',
          }}
          animate={reduce ? { opacity: 0.55 } : { opacity: [0.35, 0.85, 0.35], scale: [0.92, 1.08, 0.92] }}
          transition={reduce ? undefined : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          aria-hidden
          className="absolute inset-[6px] rounded-full bg-primary/25 border border-primary/40 backdrop-blur-sm"
          animate={reduce ? undefined : { scale: [1, 1.05, 1] }}
          transition={reduce ? undefined : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          aria-hidden
          className="absolute inset-[11px] rounded-full bg-primary/70"
          animate={reduce ? undefined : { opacity: [0.6, 1, 0.6] }}
          transition={reduce ? undefined : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Quiet cadence track */}
      <div className="glass rounded-full px-4 py-2.5 border border-primary/15 overflow-hidden relative min-w-[120px]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-ui tracking-wide text-muted-foreground/80">
            {t('chat.thinking', { defaultValue: 'Thinking' })}
          </span>
          <span className="relative flex-1 h-[2px] rounded-full bg-primary/10 overflow-hidden">
            {!reduce && (
              <motion.span
                aria-hidden
                className="absolute inset-y-0 w-1/3 rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.85), transparent)',
                }}
                animate={{ x: ['-110%', '210%'] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
