import { motion } from 'framer-motion';
import {
  Activity, Calendar, Flag, Flame, MessageCircle, Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { colorForEmotion } from '@/lib/mindJourney';
import type { JourneyTimelineEvent } from '@/lib/mindJourney/types';

const ICONS = {
  daily_score: Calendar,
  milestone: Flag,
  session: MessageCircle,
  activity: Activity,
  moment: Sparkles,
  streak: Flame,
} as const;

interface Props {
  event: JourneyTimelineEvent;
  side: 'start' | 'end';
}

export default function JourneyTimelineItem({ event, side }: Props) {
  const { t } = useTranslation();
  const Icon = ICONS[event.kind] ?? Sparkles;
  const color = event.emotion ? colorForEmotion(event.emotion) : 'hsl(var(--primary))';

  return (
    <div
      className={`relative flex gap-4 items-stretch ${
        side === 'end' ? 'flex-row-reverse text-end' : 'flex-row text-start'
      }`}
      style={{ minHeight: 80 }}
    >
      <div className={`flex-1 max-w-md ${side === 'end' ? 'ms-auto' : 'me-auto'}`}>
        <motion.div
          layout
          className="glass rounded-2xl p-4 border border-border/40 hover:border-primary/30 transition-colors"
        >
          <p className="text-[10px] font-ui tracking-[0.25em] text-primary/70 uppercase mb-1">
            {t(`mindJourney.event.${event.kind}`, { defaultValue: event.kind })}
          </p>
          <h4 className="text-base font-display font-semibold capitalize">{event.title}</h4>
          {event.subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{event.subtitle}</p>
          )}
          {event.score != null && (
            <p className="text-xs mt-2 text-foreground/80">
              {t('mindJourney.wellnessScore', { defaultValue: 'Wellness' })}:{' '}
              <span className="font-semibold text-primary">{event.score}</span>/100
            </p>
          )}
        </motion.div>
      </div>

      <div className="relative z-10 flex flex-col items-center shrink-0 w-12">
        <motion.div
          className="w-11 h-11 rounded-full glass-strong border flex items-center justify-center"
          style={{ borderColor: `${color}`, boxShadow: `0 0 18px ${color}40` }}
          whileHover={{ scale: 1.08 }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </motion.div>
      </div>

      <div className="flex-1 hidden md:block" aria-hidden />
    </div>
  );
}
