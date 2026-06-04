import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Shield } from 'lucide-react';
import CountUp from '@/components/ui/CountUp';
import type { EarlyRiskProfile } from '@/lib/mindJourney/types';
import JourneyMentalWeather from './JourneyMentalWeather';
import JourneyCinematicBackdrop from './JourneyCinematicBackdrop';

interface Props {
  earlyRisk: EarlyRiskProfile;
}

function RiskMeter({
  label,
  value,
  invert,
}: {
  label: string;
  value: number;
  invert?: boolean;
}) {
  const tone =
    invert
      ? value >= 65
        ? 'text-emerald-400'
        : value >= 38
          ? 'text-primary'
          : 'text-muted-foreground'
      : value >= 65
        ? 'text-amber-400'
        : value >= 38
          ? 'text-amber-300/90'
          : 'text-emerald-400/90';

  return (
    <div className="glass rounded-2xl p-4 border border-border/40">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
      <p className={`text-2xl font-display font-bold tabular-nums ${tone}`}>
        <CountUp value={value} />/100
      </p>
    </div>
  );
}

const LEVEL_CLASS = {
  low: 'border-emerald-500/30 bg-emerald-500/5',
  moderate: 'border-amber-500/35 bg-amber-500/8',
  high: 'border-rose-500/40 bg-rose-500/10',
} as const;

export default function JourneyEarlyRiskSection({ earlyRisk }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const memo = useMemo(() => earlyRisk, [earlyRisk]);

  return (
    <section
      className="relative space-y-6 rounded-[2rem] p-6 md:p-8 border border-amber-500/20 overflow-hidden"
      aria-labelledby="early-risk-heading"
      data-testid="journey-early-risk"
    >
      <JourneyCinematicBackdrop tone="challenge" />
      <header className="relative">
        <p className="text-xs font-ui tracking-[0.35em] text-amber-400/80 uppercase flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {t('mindJourney.advanced.risk.badge')}
        </p>
        <h3 id="early-risk-heading" className="text-2xl md:text-3xl font-display font-bold mt-2">
          {t('mindJourney.advanced.risk.title')}
        </h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          {t('mindJourney.advanced.risk.subtitle')}
        </p>
      </header>

      <JourneyMentalWeather weather={memo.mentalWeather} />

      <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <RiskMeter label={t('mindJourney.advanced.risk.burnout')} value={memo.burnoutRisk} />
        <RiskMeter label={t('mindJourney.advanced.risk.anxiety')} value={memo.anxietyEscalationRisk} />
        <RiskMeter label={t('mindJourney.advanced.risk.isolation')} value={memo.isolationRisk} />
        <RiskMeter
          label={t('mindJourney.advanced.risk.recovery')}
          value={memo.recoveryProbability}
          invert
        />
      </div>

      <div className="relative space-y-4">
        <h4 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase flex items-center gap-2">
          <Shield className="w-4 h-4" />
          {t('mindJourney.advanced.risk.warningsTitle')}
        </h4>
        {memo.warnings.map((w, i) => (
          <motion.article
            key={w.id}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: reduce ? 0 : i * 0.05 }}
            className={`glass rounded-2xl p-5 border ${LEVEL_CLASS[w.riskLevel]}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <h5 className="font-display font-semibold text-sm md:text-base">{w.title}</h5>
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border border-border/50">
                {t(`mindJourney.advanced.risk.level.${w.riskLevel}`)} ·{' '}
                <CountUp value={w.confidence} />% {t('mindJourney.advanced.risk.confidence')}
              </span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 mb-3">
              {w.evidence.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
            <p className="text-sm text-foreground/90 glass rounded-xl px-3 py-2 border border-primary/15">
              {w.intervention}
            </p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
