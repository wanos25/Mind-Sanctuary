import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Sprout } from 'lucide-react';
import CountUp from '@/components/ui/CountUp';
import type { GrowthScore } from '@/lib/mindJourney/types';

interface Props {
  growth: GrowthScore;
}

export default function JourneyGrowthScore({ growth }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glass rounded-3xl p-6 md:p-8 border border-primary/25 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5 pointer-events-none" />
      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <Sprout className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-ui tracking-[0.3em] text-primary/70 uppercase">
              {t('mindJourney.story.growth.label')}
            </p>
            <p className="text-4xl md:text-5xl font-display font-bold text-primary tabular-nums">
              <CountUp value={growth.current} />
              <span className="text-lg text-muted-foreground font-normal">/100</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
          <div className="glass rounded-xl px-4 py-3 border border-border/40">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t('mindJourney.story.growth.thisMonth')}
            </p>
            <p className="text-lg font-semibold text-emerald-400 tabular-nums">
              {growth.deltaThisMonth >= 0 ? '+' : ''}
              <CountUp value={growth.deltaThisMonth} />
            </p>
          </div>
          <div className="glass rounded-xl px-4 py-3 border border-border/40">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t('mindJourney.story.growth.sinceStart')}
            </p>
            <p className="text-lg font-semibold text-primary tabular-nums">
              {growth.deltaSinceStart >= 0 ? '+' : ''}
              <CountUp value={growth.deltaSinceStart} />
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
