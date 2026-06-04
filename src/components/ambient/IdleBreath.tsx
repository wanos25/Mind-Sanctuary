import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { requestHopefulSettle } from '@/lib/ambient/atmosphereInertia';

/**
 * IdleBreath — a barely-visible global breathing layer that activates only
 * after the user has been idle for a while. Its purpose is to make silence
 * feel *intentional* rather than empty: the room itself appears to inhale
 * and exhale at the cadence of a resting nervous system (~6s per cycle).
 *
 * Design rules (strict):
 *  - Inert during interaction. Fades in only after ~45s of no input.
 *  - Maximum opacity is ~5% — must never compete with route content.
 *  - GPU-cheap: a single transform/opacity loop on one absolutely-positioned
 *    element. No blur, no filter, no offscreen compositing.
 *  - Honors prefers-reduced-motion (renders nothing).
 *  - Pointer-events: none. Aria-hidden. Layered below PersistentAtmosphere
 *    contributors but above route bg (-z-10).
 *  - On wake (any input after a long idle), nudges the atmosphere toward a
 *    gentle hopeful warmth via `requestHopefulSettle()` — only if a recent
 *    intensity peak was recorded; otherwise it's a silent no-op.
 */

const IDLE_AFTER_MS = 45_000;

export default function IdleBreath() {
  const reduce = useReducedMotion();
  const [idle, setIdle] = useState(false);
  const lastActivity = useRef<number>(Date.now());
  const wasIdle = useRef(false);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const onActivity = () => {
      lastActivity.current = Date.now();
      if (wasIdle.current) {
        // User has returned from a long silence — let the room exhale.
        wasIdle.current = false;
        try { requestHopefulSettle(); } catch { /* never break */ }
      }
      if (idle) setIdle(false);
    };

    const tick = () => {
      const since = Date.now() - lastActivity.current;
      const nextIdle = since >= IDLE_AFTER_MS;
      if (nextIdle !== idle) setIdle(nextIdle);
      if (nextIdle) wasIdle.current = true;
      raf = requestAnimationFrame(() => setTimeout(tick, 1000));
    };
    tick();

    const opts = { passive: true } as AddEventListenerOptions;
    window.addEventListener('pointermove', onActivity, opts);
    window.addEventListener('pointerdown', onActivity, opts);
    window.addEventListener('keydown', onActivity, opts);
    window.addEventListener('scroll', onActivity, opts);
    window.addEventListener('touchstart', onActivity, opts);
    document.addEventListener('visibilitychange', onActivity);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onActivity);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('touchstart', onActivity);
      document.removeEventListener('visibilitychange', onActivity);
    };
  }, [idle, reduce]);

  if (reduce) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      initial={false}
      animate={{ opacity: idle ? 1 : 0 }}
      transition={{ duration: 3.6, ease: [0.4, 0, 0.2, 1] }}
      style={{ willChange: 'opacity' }}
    >
      <motion.div
        className="absolute -inset-[10%]"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 55%, hsl(var(--pa-warm, 38 55% 60%) / 0.045) 0%, transparent 70%)',
          willChange: 'transform, opacity',
        }}
        animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.012, 1] }}
        transition={{ duration: 6.2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}
