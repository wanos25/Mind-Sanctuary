import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { AlertOctagon, ArrowRight, ShieldAlert } from 'lucide-react';
import CountUp from '@/components/ui/CountUp';
import type { CrisisPreventionProfile } from '@/lib/mindJourney/types';
import JourneyCinematicBackdrop from './JourneyCinematicBackdrop';

interface Props {
  crisis: CrisisPreventionProfile;
}

const LEVEL_BORDER = {
  low: 'border-emerald-500/25',
  moderate: 'border-amber-500/35',
  high: 'border-rose-500/50',
} as const;

export default function JourneyCrisisPreventionSection({ crisis }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const memo = useMemo(() => crisis, [crisis]);

  return (
    <section
      className={`relative space-y-8 rounded-[2rem] p-6 md:p-10 border overflow-hidden ${
        memo.emergencyGlow
          ? 'border-rose-500/50 shadow-[0_0_60px_hsl(0_70%_50%/0.15)]'
          : 'border-rose-500/20'
      }`}
      data-testid="journey-crisis-prevention"
      aria-labelledby="crisis-prevention-heading"
    >
      {memo.emergencyGlow && (
        <div
          className="absolute inset-0 bg-gradient-to-br from-rose-500/10 via-transparent to-amber-500/5 pointer-events-none animate-pulse"
          aria-hidden
        />
      )}
      <JourneyCinematicBackdrop tone="challenge" />

      <header className="relative">
        <p className="text-xs font-ui tracking-[0.35em] text-rose-400/90 uppercase flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          {t('mindJourney.crisis.badge')}
        </p>
        <h3 id="crisis-prevention-heading" className="text-2xl md:text-4xl font-display font-bold mt-2">
          {t('mindJourney.crisis.title')}
        </h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          {t('mindJourney.crisis.subtitle')}
        </p>
      </header>

      <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(
          [
            ['burnout', memo.risks.burnout],
            ['anxiety', memo.risks.anxietyEscalation],
            ['depression', memo.risks.depression],
            ['withdrawal', memo.risks.socialWithdrawal],
            ['collapse', memo.risks.recoveryCollapse],
          ] as const
        ).map(([key, val]) => (
          <div key={key} className="glass rounded-xl p-3 border border-border/40">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
              {t(`mindJourney.crisis.risk.${key}`)}
            </p>
            <p className="text-lg font-bold text-primary tabular-nums">
              <CountUp value={val} />
            </p>
          </div>
        ))}
      </div>

      <div className="relative space-y-4">
        <h4 className="text-xs font-ui tracking-[0.25em] uppercase flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-amber-400" />
          {t('mindJourney.crisis.warningsTitle')}
        </h4>
        {memo.earlyWarnings.map((w, i) => (
          <motion.article
            key={w.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: reduce ? 0 : i * 0.04 }}
            className={`glass rounded-2xl p-5 border ${LEVEL_BORDER[w.riskLevel]}`}
          >
            <div className="flex flex-wrap justify-between gap-2 mb-2">
              <h5 className="font-semibold text-sm">{w.title}</h5>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t(`mindJourney.advanced.risk.level.${w.riskLevel}`)} ·{' '}
                {t(`mindJourney.crisis.trend.${w.trendDirection}`)}
              </span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 mb-2">
              {w.evidence.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
            <p className="text-[10px] text-primary/80">
              {t('mindJourney.advanced.risk.confidence')}: {w.confidence}%
            </p>
          </motion.article>
        ))}
      </div>

      <div className="relative grid md:grid-cols-3 gap-4">
        <RecCard title={t('mindJourney.crisis.immediate')} text={memo.recommendations.immediate} urgent />
        <RecCard title={t('mindJourney.crisis.hours24')} text={memo.recommendations.next24Hours} />
        <RecCard title={t('mindJourney.crisis.days7')} text={memo.recommendations.next7Days} />
      </div>

      <div className="relative grid sm:grid-cols-2 gap-4">
        <SimulationCard
          title={t('mindJourney.crisis.nothingChanges')}
          wellness={memo.simulation.ifNothingChanges.wellness30}
          label={memo.simulation.ifNothingChanges.label}
          tone="warning"
        />
        <SimulationCard
          title={t('mindJourney.crisis.actionsFollowed')}
          wellness={memo.simulation.ifActionsFollowed.wellness30}
          label={memo.simulation.ifActionsFollowed.label}
          tone="positive"
        />
      </div>
      <p className="relative text-center text-xs text-muted-foreground">
        {t('mindJourney.crisis.delta', { delta: memo.simulation.delta })}
      </p>
    </section>
  );
}

function RecCard({ title, text, urgent }: { title: string; text: string; urgent?: boolean }) {
  return (
    <div
      className={`glass rounded-2xl p-5 border ${
        urgent ? 'border-rose-500/40 bg-rose-500/5' : 'border-border/40'
      }`}
    >
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
        {urgent && <ArrowRight className="w-3 h-3 text-rose-400" />}
        {title}
      </p>
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function SimulationCard({
  title,
  wellness,
  label,
  tone,
}: {
  title: string;
  wellness: number;
  label: string;
  tone: 'warning' | 'positive';
}) {
  return (
    <div
      className={`glass rounded-2xl p-6 border ${
        tone === 'warning' ? 'border-amber-500/30' : 'border-emerald-500/30'
      }`}
    >
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{title}</p>
      <p
        className={`text-3xl font-display font-bold tabular-nums ${
          tone === 'warning' ? 'text-amber-400' : 'text-emerald-400'
        }`}
      >
        <CountUp value={wellness} />/100
      </p>
      <p className="text-xs text-muted-foreground mt-3">{label}</p>
    </div>
  );
}
