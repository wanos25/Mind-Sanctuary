import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Activity, Award, Flame, MessageCircle, Sparkles, TrendingUp,
} from 'lucide-react';
import type { JourneyHighlight } from '@/lib/mindJourney/types';

const ICONS = {
  streak: Flame,
  activity: Activity,
  consistency: Award,
  emotion: TrendingUp,
  session: MessageCircle,
} as const;

interface Props {
  highlights: JourneyHighlight[];
}

export default function JourneyHighlights({ highlights }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  if (!highlights.length) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        {t('mindJourney.story.highlights.title')}
      </h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {highlights.map((hl, i) => {
          const Icon = ICONS[hl.kind] ?? Sparkles;
          return (
            <motion.div
              key={hl.id}
              initial={reduce ? false : { opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: reduce ? 0 : i * 0.05 }}
              whileHover={reduce ? undefined : { y: -3 }}
              className="glass rounded-2xl p-5 border border-primary/15 hover:border-primary/35 transition-colors"
            >
              <Icon className="w-5 h-5 text-primary mb-3" />
              <h4 className="text-sm font-display font-semibold">{hl.title}</h4>
              {hl.subtitle && (
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{hl.subtitle}</p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
