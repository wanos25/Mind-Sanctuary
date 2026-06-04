import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import type { ImpactSource } from '@/lib/mindJourney/types';

interface Props {
  sources: ImpactSource[];
}

export default function JourneyWhatChangedYou({ sources }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  if (!sources.length) return null;

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        {t('mindJourney.futureSelf.impact.title')}
      </h4>
      <div className="space-y-3">
        {sources.map((src, i) => (
          <motion.div
            key={src.id}
            initial={reduce ? false : { opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: reduce ? 0 : i * 0.04 }}
            className="glass rounded-xl p-4 border border-border/30"
          >
            <div className="flex justify-between text-sm mb-2 gap-2">
              <span className="font-medium">{src.label}</span>
              <span className="text-primary font-semibold tabular-nums">{src.contributionPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                initial={reduce ? { width: `${src.contributionPct}%` } : { width: 0 }}
                whileInView={{ width: `${src.contributionPct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
