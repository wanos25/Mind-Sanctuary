import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

/**
 * "First arrival" presence — shown briefly before the very first assistant
 * message renders content. Conveys "someone thoughtful is arriving" rather
 * than "text appeared". Calm, GPU-cheap, RTL-safe.
 *
 * Visible only while a streaming bubble has no content yet AND this is the
 * first assistant message of the session. Replaces the standard TypingIndicator
 * for that single moment — afterwards the standard indicator + bubble take over.
 */
export default function FirstArrivalPresence() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
      className="flex items-center gap-4 px-1 py-1"
      role="status"
      aria-live="polite"
      aria-label={t('chat.arrival', { defaultValue: 'Arriving…' })}
    >
      {/* Slow inhale/exhale halo */}
      <div className="relative w-12 h-12">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.55), hsl(var(--primary) / 0) 70%)',
            filter: 'blur(3px)',
          }}
          animate={
            reduce
              ? { opacity: 0.6 }
              : { opacity: [0.3, 0.85, 0.3], scale: [0.85, 1.12, 0.85] }
          }
          transition={reduce ? undefined : { duration: 4.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          aria-hidden
          className="absolute inset-[6px] rounded-full border border-primary/40 bg-primary/15 backdrop-blur-sm"
          animate={reduce ? undefined : { scale: [1, 1.05, 1] }}
          transition={reduce ? undefined : { duration: 4.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          aria-hidden
          className="absolute inset-[14px] rounded-full bg-primary/80"
          animate={reduce ? undefined : { opacity: [0.55, 1, 0.55] }}
          transition={reduce ? undefined : { duration: 4.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/80 font-ui">
          {t('chat.drSentinel', { defaultValue: 'Dr. Sentinel' })}
        </span>
        <motion.span
          className="text-[12px] font-ui text-foreground/75"
          animate={reduce ? undefined : { opacity: [0.55, 1, 0.55] }}
          transition={reduce ? undefined : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {t('chat.arriving', { defaultValue: 'gathering a thought for you…' })}
        </motion.span>
      </div>
    </motion.div>
  );
}
