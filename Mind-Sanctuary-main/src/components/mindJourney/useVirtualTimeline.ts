import { useEffect, useState, type RefObject } from 'react';

const OVERSCAN = 4;

export function useVirtualTimeline(
  itemCount: number,
  itemHeight: number,
  containerRef: RefObject<HTMLElement | null>,
) {
  const [range, setRange] = useState({ start: 0, end: Math.min(itemCount, 12) });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || itemCount === 0) {
      setRange({ start: 0, end: 0 });
      return;
    }

    const update = () => {
      const scrollTop = el.scrollTop;
      const viewH = el.clientHeight || 400;
      const start = Math.max(0, Math.floor(scrollTop / itemHeight) - OVERSCAN);
      const end = Math.min(itemCount, Math.ceil((scrollTop + viewH) / itemHeight) + OVERSCAN);
      setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [itemCount, itemHeight, containerRef]);

  return range;
}
