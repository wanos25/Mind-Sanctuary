import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  /** Optional emotional summary line (e.g. "You moved from anxious to calm"). */
  summary?: string;
  /** Optional reassurance line. Defaults to a calm hopeful sentence. */
  hope?: string;
  onClose?: () => void;
}

/**
 * Session Closure Ritual — a slow, emotionally-intelligent cooldown overlay.
 * Designed to be opt-in (mounted by a parent when a session ends). Replaces
 * abrupt "conversation ended" feelings with a reflective de-intensification.
 *
 * - Honors reduced motion (fades instead of breathing).
 * - RTL-safe (logical alignment, symmetric gradients).
 * - GPU-cheap: a single radial gradient breathing in opacity.
 */
export function SessionClosureOverlay({ open, summary, hope, onClose }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const hopeLine =
    hope ??
    t('session.closure.hope', {
      defaultValue: 'Take a slow breath. You showed up — that matters.',
    });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={t('session.closure.title', { defaultValue: 'Session closing' })}
          className="fixed inset-0 z-[80] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
          onClick={onClose}
        >
          {/* atmosphere de-intensification veil */}
          <motion.div
            aria-hidden
            className="absolute inset-0 backdrop-blur-2xl"
            style={{
              background:
                'radial-gradient(ellipse at 50% 40%, hsl(var(--primary) / 0.18), hsl(230 30% 4% / 0.75) 70%)',
            }}
            animate={reduce ? undefined : { opacity: [0.7, 0.9, 0.7] }}
            transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.div
            className="relative max-w-md mx-auto px-8 py-10 text-center"
            initial={{ y: 24, opacity: 0, filter: 'blur(8px)' }}
            animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1], delay: 0.2 }}
          >
            <motion.div
              className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center bg-primary/10 border border-primary/30 backdrop-blur"
              animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
              transition={reduce ? undefined : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ boxShadow: '0 10px 40px -10px hsl(var(--primary) / 0.5)' }}
            >
              <Heart className="w-7 h-7 text-primary" />
            </motion.div>

            <h2 className="text-xl font-display text-foreground mb-3 tracking-tight">
              {t('session.closure.title', { defaultValue: 'Session closing gently' })}
            </h2>
            {summary && (
              <p className="text-sm text-muted-foreground/90 leading-relaxed mb-3">{summary}</p>
            )}
            <p className="text-[13px] text-foreground/75 italic leading-relaxed">{hopeLine}</p>

            <motion.p
              className="mt-8 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60"
              animate={reduce ? undefined : { opacity: [0.4, 0.8, 0.4] }}
              transition={reduce ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              {t('session.closure.touch', { defaultValue: 'Touch anywhere to continue' })}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SessionClosureOverlay;
