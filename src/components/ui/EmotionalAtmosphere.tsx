import { useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EmotionState } from '@/context/AppContext';
import { publishAtmosphereTone } from '@/lib/ambient/atmosphereStore';

/**
 * Ambient emotional atmosphere — soft radial gradients that gently breathe and
 * re-tint based on emotion. R7 P5: interpolated transitions, intensity-driven
 * pulse, contextual lighting/glow states. Purely CSS/transform-based; no canvas.
 */

interface Props {
  emotion: EmotionState | null;
  active?: boolean;
  /** Pulse glow gently while the assistant streams. */
  streaming?: boolean;
  /** Optional context flag — e.g. crisis-aware softening. */
  crisis?: boolean;
}

interface Tone {
  warm: string;     // hsl values without hsl() wrapper
  cool: string;
  highlight: string;
  glow: number;     // 0..1 ambient glow multiplier
  saturation: number;
  pulseScale: number;
  pulseDur: number;
}

function toneFor(emotion: EmotionState | null, crisis = false): Tone {
  const p = (emotion?.primary || '').toLowerCase();
  const intensity = Math.max(0, Math.min(1, emotion?.intensity ?? 0.3));
  const base: Tone = { warm: '38 55% 60%', cool: '180 30% 40%', highlight: '45 70% 70%', glow: 0.55, saturation: 1, pulseScale: 1.025, pulseDur: 8 };

  let t = base;
  if (!emotion || p.includes('calm')) {
    t = { warm: '38 55% 60%', cool: '180 30% 40%', highlight: '45 70% 70%', glow: 0.55, saturation: 1, pulseScale: 1.02, pulseDur: 9 };
  } else if (p.includes('anxiety') || p.includes('stress')) {
    t = { warm: '28 45% 55%', cool: '210 35% 45%', highlight: '40 60% 65%', glow: 0.35 + intensity * 0.2, saturation: 0.75, pulseScale: 1.035, pulseDur: 5.5 };
  } else if (p.includes('depress') || p.includes('sad') || p.includes('grief')) {
    t = { warm: '230 25% 45%', cool: '260 25% 38%', highlight: '240 35% 60%', glow: 0.28, saturation: 0.55, pulseScale: 1.015, pulseDur: 11 };
  } else if (p.includes('anger')) {
    t = { warm: '14 55% 50%', cool: '20 40% 35%', highlight: '20 70% 60%', glow: 0.45, saturation: 0.85, pulseScale: 1.04, pulseDur: 6 };
  } else if (p.includes('burnout')) {
    t = { warm: '270 25% 45%', cool: '210 20% 35%', highlight: '260 30% 55%', glow: 0.32, saturation: 0.65, pulseScale: 1.02, pulseDur: 10 };
  } else if (p.includes('joy') || p.includes('hope')) {
    t = { warm: '40 70% 60%', cool: '180 50% 45%', highlight: '48 90% 70%', glow: 0.65, saturation: 1.05, pulseScale: 1.03, pulseDur: 7 };
  } else {
    t = { warm: '38 50% 55%', cool: '20 25% 30%', highlight: '40 60% 65%', glow: 0.5, saturation: 0.95, pulseScale: 1.025, pulseDur: 8 };
  }

  if (crisis) {
    // Soften everything: lower glow, calmer hues
    return { ...t, glow: Math.min(t.glow, 0.32), saturation: Math.min(t.saturation, 0.7), pulseDur: Math.max(t.pulseDur, 10) };
  }
  return t;
}

export default function EmotionalAtmosphere({ emotion, active = true, streaming = false, crisis = false }: Props) {
  const tone = useMemo(() => toneFor(emotion, crisis), [emotion, crisis]);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--atm-warm', tone.warm);
    el.style.setProperty('--atm-cool', tone.cool);
    el.style.setProperty('--atm-highlight', tone.highlight);
    el.style.setProperty('--atm-glow', String(tone.glow));
    el.style.setProperty('--atm-sat', String(tone.saturation));
    // Bleed the current emotional hue into the global persistent atmosphere
    // so the feeling carries across route transitions.
    publishAtmosphereTone({
      warm: tone.warm,
      cool: tone.cool,
      highlight: tone.highlight,
      glow: tone.glow,
      saturation: tone.saturation,
      streaming,
    });
  }, [tone, streaming]);

  if (!active) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        ['--atm-warm' as string]: tone.warm,
        ['--atm-cool' as string]: tone.cool,
        ['--atm-highlight' as string]: tone.highlight,
        ['--atm-glow' as string]: tone.glow,
        ['--atm-sat' as string]: tone.saturation,
        filter: `saturate(calc(var(--atm-sat) * 100%))`,
        transition: 'filter 2.4s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <motion.div
        className="absolute -inset-[10%]"
        style={{
          background:
            'radial-gradient(60% 50% at 25% 30%, hsl(var(--atm-warm) / calc(var(--atm-glow) * 0.20)) 0%, transparent 70%),' +
            'radial-gradient(55% 45% at 75% 70%, hsl(var(--atm-cool) / calc(var(--atm-glow) * 0.16)) 0%, transparent 70%),' +
            'radial-gradient(80% 60% at 50% 100%, hsl(var(--atm-warm) / calc(var(--atm-glow) * 0.10)) 0%, transparent 75%)',
          transition: 'background 2.4s cubic-bezier(0.4,0,0.2,1)',
          willChange: 'transform, opacity',
        }}
        animate={
          reduce
            ? undefined
            : {
                scale: [1, tone.pulseScale, 1],
                opacity: streaming ? [0.85, 1, 0.85] : [0.75, 0.92, 0.75],
              }
        }
        transition={{ duration: streaming ? Math.max(3.5, tone.pulseDur * 0.55) : tone.pulseDur, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Highlight halo — adapts to streaming/crisis. Tagged so low-tier CSS can drop. */}
      <motion.div
        data-ambient-mixblend
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(40% 30% at 50% 35%, hsl(var(--atm-highlight) / calc(var(--atm-glow) * 0.10)) 0%, transparent 80%)',
          mixBlendMode: 'screen',
        }}
        animate={reduce ? undefined : { opacity: streaming ? [0.35, 0.6, 0.35] : [0.25, 0.4, 0.25] }}
        transition={{ duration: streaming ? 3.6 : 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Depth vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(closest-side at 50% 60%, transparent 55%, hsl(20 12% 5% / 0.42) 100%)',
        }}
      />
    </div>
  );
}
