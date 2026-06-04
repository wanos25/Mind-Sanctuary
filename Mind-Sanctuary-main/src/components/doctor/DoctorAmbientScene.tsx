import { motion, useReducedMotion } from 'framer-motion';

/**
 * Lightweight DOM-only ambient scene for the Doctor Portal.
 * - No WebGL, no Canvas → safe on every device + RTL agnostic.
 * - Three slow-drifting radial halos + a faint grid for depth.
 */
export default function DoctorAmbientScene() {
  const reduced = useReducedMotion();
  const orbs = [
    { cls: 'bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.32),transparent_60%)]', x: '-10%', y: '-15%', size: 520, dur: 28 },
    { cls: 'bg-[radial-gradient(circle_at_center,hsl(var(--accent)/0.28),transparent_60%)]', x: '70%', y: '5%', size: 460, dur: 34 },
    { cls: 'bg-[radial-gradient(circle_at_center,hsl(190_85%_55%/0.22),transparent_65%)]', x: '20%', y: '70%', size: 600, dur: 40 },
  ];

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
      {/* base wash */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background/95" />
      {/* grid */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--foreground)/0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)/0.6) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
      {orbs.map((o, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-3xl ${o.cls}`}
          style={{ width: o.size, height: o.size, left: o.x, top: o.y }}
          animate={
            reduced
              ? { opacity: 0.7 }
              : { x: [0, 30, -20, 0], y: [0, -25, 20, 0], opacity: [0.55, 0.85, 0.6, 0.7] }
          }
          transition={{ duration: o.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {/* top glow line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
    </div>
  );
}
