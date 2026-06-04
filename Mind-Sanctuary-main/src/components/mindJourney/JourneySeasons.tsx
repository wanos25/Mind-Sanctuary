import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { CloudSun } from 'lucide-react';
import type { EmotionalSeason } from '@/lib/mindJourney/types';

interface Props {
  seasons: EmotionalSeason[];
}

export default function JourneySeasons({ seasons }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  if (!seasons.length) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase flex items-center gap-2">
        <CloudSun className="w-4 h-4 text-accent" />
        {t('mindJourney.story.seasons.title')}
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory overscroll-x-contain">
        {seasons.map((season) => (
          <motion.div
            key={season.id}
            initial={reduce ? false : { opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-5 border border-border/40 min-w-[260px] max-w-[320px] snap-start shrink-0"
          >
            <p className="text-[10px] text-muted-foreground mb-1">{season.dateRange.label}</p>
            <h4 className="text-base font-display font-semibold text-primary">{season.name}</h4>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{season.summary}</p>
            <p className="text-[10px] font-ui tracking-wide text-accent/90 mt-3 uppercase">
              {season.dominantTrend}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
