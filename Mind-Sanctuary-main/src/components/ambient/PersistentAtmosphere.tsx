import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { subscribeAtmosphere, type AtmosphereTone } from '@/lib/ambient/atmosphereStore';

/**
 * Global, route-persistent ambient atmosphere.
 *
 * Mounted once at the App root (above route content, below everything else
 * via `-z-20`). It reads the most recently published emotional tone from
 * `atmosphereStore` and renders a calm radial wash that breathes very slowly.
 * The effect is intentionally subtle — it should never compete with route
 * UI, only make the product feel like one continuous emotional environment.
 *
 * - GPU cheap: two transform/opacity loops on absolutely-positioned divs.
 * - Honors prefers-reduced-motion (static gradient, no breathing).
 * - Mobile/low-power respectful: gradients are tinted via CSS vars, no
 *   filters/blurs that hurt scrolling.
 * - Hue/glow fade smoothly when the store publishes a new tone.
 */
export default function PersistentAtmosphere() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [hasTone, setHasTone] = useState(false);

  useEffect(() => {
    const off = subscribeAtmosphere((t: AtmosphereTone) => {
      const el = ref.current;
      if (!el) return;
      el.style.setProperty('--pa-warm', t.warm);
      el.style.setProperty('--pa-cool', t.cool);
      el.style.setProperty('--pa-highlight', t.highlight);
      // The persistent layer is half-strength of the active atmosphere so it
      // reads as "memory of the room" rather than an active emotional state.
      el.style.setProperty('--pa-glow', String(Math.max(0.18, t.glow * 0.55)));
      el.style.setProperty('--pa-sat', String(t.saturation));
      if (t.ts > 0) setHasTone(true);
    });
    return off;
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-20 overflow-hidden"
      style={{
        // Calm baseline — these are overridden as soon as a tone is published.
        ['--pa-warm' as string]: '38 55% 60%',
        ['--pa-cool' as string]: '230 30% 30%',
        ['--pa-highlight' as string]: '45 70% 70%',
        ['--pa-glow' as string]: '0.22',
        ['--pa-sat' as string]: '0.9',
        filter: 'saturate(calc(var(--pa-sat) * 100%))',
        transition: 'filter 3.2s cubic-bezier(0.4,0,0.2,1)',
        opacity: hasTone ? 1 : 0.65,
      }}
    >
      <motion.div
        className="absolute -inset-[8%]"
        style={{
          background:
            'radial-gradient(55% 45% at 30% 25%, hsl(var(--pa-warm) / calc(var(--pa-glow) * 0.18)) 0%, transparent 70%),' +
            'radial-gradient(50% 40% at 75% 75%, hsl(var(--pa-cool) / calc(var(--pa-glow) * 0.16)) 0%, transparent 70%),' +
            'radial-gradient(70% 55% at 50% 110%, hsl(var(--pa-warm) / calc(var(--pa-glow) * 0.10)) 0%, transparent 75%)',
          transition: 'background 3.2s cubic-bezier(0.4,0,0.2,1)',
          willChange: 'transform, opacity',
        }}
        animate={reduce ? undefined : { opacity: [0.75, 0.95, 0.75], scale: [1, 1.015, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Very faint depth vignette — keeps content readable on bright route bg */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(closest-side at 50% 60%, transparent 60%, hsl(20 12% 4% / 0.30) 100%)',
        }}
      />
    </div>
  );
}
