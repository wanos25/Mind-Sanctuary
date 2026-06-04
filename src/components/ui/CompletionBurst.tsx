import { motion, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  onDone: () => void;
  durationMs?: number;
}

/**
 * Cinematic, GPU-light celebration overlay shown after meaningful completions
 * (activity finished, milestone reached). Respects prefers-reduced-motion:
 * particles collapse to a static glow, durations shorten.
 */
export default function CompletionBurst({ open, title, subtitle, onDone, durationMs = 1800 }: Props) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onDone, reduce ? 900 : durationMs);
    return () => clearTimeout(t);
  }, [open, onDone, durationMs, reduce]);

  if (!open) return null;

  const particles = reduce ? [] : Array.from({ length: 14 });

  return (
    <motion.div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Soft warm vignette */}
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--gold)/0.18),transparent_60%)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      />

      {/* Particles */}
      {particles.map((_, i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const dist = 140 + Math.random() * 80;
        return (
          <motion.span
            key={i}
            aria-hidden
            className="absolute w-1.5 h-1.5 rounded-full bg-[hsl(var(--gold))] shadow-[0_0_10px_hsl(var(--gold)/0.8)]"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              opacity: [0, 1, 0],
              scale: [0.6, 1.1, 0.4],
            }}
            transition={{ duration: 1.2, ease: [0.22, 0.61, 0.36, 1], delay: 0.05 + i * 0.01 }}
          />
        );
      })}

      {/* Center medallion */}
      <motion.div
        initial={{ scale: reduce ? 1 : 0.7, opacity: 0, filter: 'blur(6px)' }}
        animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="relative flex flex-col items-center gap-3 px-8 py-6 rounded-2xl border border-[hsl(var(--gold)/0.4)] bg-card/80 backdrop-blur-xl shadow-[0_20px_60px_-20px_hsl(var(--gold)/0.55)]"
      >
        <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-light))] flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-[hsl(var(--background))]" strokeWidth={2.5} />
          {!reduce && (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full ring-2 ring-[hsl(var(--gold)/0.6)]"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 1.2, repeat: 1, ease: 'easeOut' }}
            />
          )}
        </div>
        <div className="text-center">
          <div className="font-display text-lg tracking-wide flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-[hsl(var(--gold))]" />
            {title}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1 max-w-[16rem]">{subtitle}</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}