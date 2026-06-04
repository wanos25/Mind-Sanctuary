import { motion, useReducedMotion } from 'framer-motion';

interface Props {
  tone?: 'beginning' | 'challenge' | 'progress' | 'momentum' | 'present' | 'default';
}

const GRADIENTS: Record<NonNullable<Props['tone']>, string> = {
  default: 'from-primary/15 via-accent/10 to-transparent',
  beginning: 'from-violet-500/20 via-primary/10 to-transparent',
  challenge: 'from-amber-500/15 via-rose-500/10 to-transparent',
  progress: 'from-emerald-500/15 via-primary/10 to-transparent',
  momentum: 'from-cyan-500/15 via-accent/15 to-transparent',
  present: 'from-primary/25 via-amber-400/10 to-transparent',
};

export default function JourneyCinematicBackdrop({ tone = 'default' }: Props) {
  const reduce = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className={`absolute inset-0 bg-gradient-to-b ${GRADIENTS[tone]} opacity-80`} />
      {!reduce && (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.span
              key={i}
              className="absolute w-1 h-1 rounded-full bg-primary/40"
              style={{
                left: `${12 + i * 14}%`,
                top: `${18 + (i % 3) * 22}%`,
              }}
              animate={{
                y: [0, -24, 0],
                opacity: [0.2, 0.7, 0.2],
              }}
              transition={{
                duration: 4 + i * 0.6,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.4,
              }}
            />
          ))}
          <div className="absolute bottom-0 start-1/4 w-64 h-64 rounded-full bg-accent/10 blur-[100px]" />
          <div className="absolute top-1/4 end-0 w-72 h-72 rounded-full bg-primary/10 blur-[120px]" />
        </>
      )}
    </div>
  );
}
