import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { JourneyTimelineEvent } from '@/lib/mindJourney/types';
import JourneyTimelineItem from './JourneyTimelineItem';
import { useVirtualTimeline } from './useVirtualTimeline';

const ITEM_HEIGHT = 96;
const VIEWPORT_HEIGHT = 420;

interface Props {
  events: JourneyTimelineEvent[];
}

export default function JourneyTimelineVirtual({ events }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start end', 'end start'] });
  const pathHeight = useTransform(scrollYProgress, [0.05, 0.9], ['0%', '100%']);
  const { start, end } = useVirtualTimeline(events.length, ITEM_HEIGHT, containerRef);

  const totalHeight = events.length * ITEM_HEIGHT;
  const visible = events.slice(start, end);

  if (!events.length) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
        {t('mindJourney.timeline.empty')}
      </div>
    );
  }

  return (
    <div ref={trackRef} className="relative">
      <div className="absolute start-1/2 top-0 bottom-0 w-px bg-border/30 -translate-x-1/2 rtl:translate-x-1/2 pointer-events-none" />
      <motion.div
        style={reduce ? { height: '100%' } : { height: pathHeight }}
        className="absolute start-1/2 top-0 w-px -translate-x-1/2 rtl:translate-x-1/2 origin-top pointer-events-none"
      >
        <div className="w-full h-full bg-gradient-to-b from-primary via-accent/80 to-transparent shadow-[0_0_24px_hsl(var(--primary)/0.45)]" />
      </motion.div>

      <div
        ref={containerRef}
        className="relative overflow-y-auto overscroll-contain rounded-2xl glass border border-border/30"
        style={{ height: VIEWPORT_HEIGHT, maxHeight: 'min(70vh, 520px)' }}
        role="list"
        aria-label={t('mindJourney.timeline.aria')}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visible.map((event, i) => {
            const index = start + i;
            const side = index % 2 === 0 ? 'start' : 'end';
            return (
              <div
                key={event.id}
                role="listitem"
                className="absolute inset-x-0 px-4 md:px-8"
                style={{ top: index * ITEM_HEIGHT, height: ITEM_HEIGHT }}
              >
                <JourneyTimelineItem event={event} side={side} />
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/70 text-center mt-3">
        {t('mindJourney.timeline.showing', { visible: visible.length, total: events.length })}
      </p>
    </div>
  );
}
