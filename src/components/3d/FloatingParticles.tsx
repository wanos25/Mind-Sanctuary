import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface Props {
  count?: number;
  className?: string;
}

/** Lightweight DOM-based ambient floating particles. Use globally. */
export default function FloatingParticles({ count = 28, className = '' }: Props) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: 8 + Math.random() * 14,
        delay: Math.random() * 6,
        opacity: 0.15 + Math.random() * 0.35,
      })),
    [count],
  );

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full bg-primary"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            filter: 'blur(0.5px)',
            boxShadow: '0 0 8px hsl(var(--gold) / 0.6)',
          }}
          animate={{
            y: [0, -40, 0],
            x: [0, 12, 0],
            opacity: [p.opacity * 0.4, p.opacity, p.opacity * 0.4],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
