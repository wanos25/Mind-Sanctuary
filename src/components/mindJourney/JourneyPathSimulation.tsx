import { useState, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { GitBranch } from 'lucide-react';
import type { FutureSimulationPath } from '@/lib/mindJourney/types';

interface Props {
  paths: FutureSimulationPath[];
}

const PATH_STYLES = {
  continue: 'border-primary/30 from-primary/10',
  growth: 'border-emerald-500/30 from-emerald-500/10',
  neglect: 'border-amber-500/30 from-amber-500/10',
} as const;

export default function JourneyPathSimulation({ paths }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const path = paths[active] ?? paths[0];

  const horizons = useMemo(() => path?.projections ?? [], [path]);

  if (!path) return null;

  return (
    <div className="space-y-4" data-testid="journey-path-simulation">
      <h4 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-accent" />
        {t('mindJourney.futureSelf.paths.title')}
      </h4>
      <div className="flex flex-wrap gap-2">
        {paths.map((p, i) => (
          <button
            key={p.kind}
            type="button"
            onClick={() => setActive(i)}
            className={`text-xs font-ui tracking-wide px-4 py-2 rounded-full border transition-colors ${
              active === i
                ? 'bg-primary/20 border-primary text-foreground'
                : 'glass border-border/40 text-muted-foreground hover:border-primary/40'
            }`}
          >
            {p.title}
          </button>
        ))}
      </div>
      <motion.p
        key={path.kind}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-sm text-muted-foreground"
      >
        {path.description}
      </motion.p>
      <div className="grid sm:grid-cols-3 gap-4">
        {horizons.map((h, i) => (
          <motion.div
            key={h.horizonDays}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : i * 0.05 }}
            className={`glass rounded-2xl p-5 border bg-gradient-to-br ${PATH_STYLES[path.kind]} to-transparent`}
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
              {t('mindJourney.futureSelf.paths.horizon', { days: h.horizonDays })}
            </p>
            <p className="text-2xl font-display font-bold text-primary mb-4">{h.wellness}</p>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('mindJourney.futureSelf.paths.emotional')}</dt>
                <dd className="capitalize">{t(`mindJourney.futureSelf.trend.${h.emotionalTrend}`)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('mindJourney.futureSelf.paths.consistency')}</dt>
                <dd>{h.consistency}/100</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('mindJourney.futureSelf.paths.resilience')}</dt>
                <dd>{h.resilience}/100</dd>
              </div>
            </dl>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
