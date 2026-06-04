import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function CustomCursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 500, damping: 40, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 500, damping: 40, mass: 0.4 });
  const [hover, setHover] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    setEnabled(true);

    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const target = e.target as HTMLElement;
      setHover(!!target.closest('button, a, [role="button"], input, textarea'));
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [x, y]);

  if (!enabled) return null;

  return (
    <>
      <motion.div
        aria-hidden
        style={{
          translateX: sx, translateY: sy,
          x: '-50%', y: '-50%',
        }}
        animate={{ scale: hover ? 1.6 : 1, opacity: hover ? 0.8 : 0.5 }}
        className="pointer-events-none fixed left-0 top-0 z-[9999] h-8 w-8 rounded-full"
      >
        <div className="h-full w-full rounded-full border border-primary/60 bg-primary/10 backdrop-blur-sm" />
      </motion.div>
      <motion.div
        aria-hidden
        style={{ translateX: x, translateY: y, x: '-50%', y: '-50%' }}
        className="pointer-events-none fixed left-0 top-0 z-[9999] h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]"
      />
    </>
  );
}
