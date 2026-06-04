import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface Props {
  value: number;
  /** Animation duration in ms. */
  durationMs?: number;
  /** Decimal places. */
  decimals?: number;
  /** Optional className passed through to the wrapper span. */
  className?: string;
}

/**
 * Tiny RAF-based number count-up. Honors prefers-reduced-motion (renders the
 * final value immediately, no animation). Re-animates from the previous value
 * whenever `value` changes — useful for metric tiles that update live.
 */
export default function CountUp({ value, durationMs = 900, decimals = 0, className }: Props) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState<number>(reduce ? value : 0);
  const fromRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    fromRef.current = display;
    startRef.current = performance.now();
    const target = value;
    const dur = Math.max(120, durationMs);
    const step = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / dur);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce, durationMs]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();
  return <span className={className}>{formatted}</span>;
}
