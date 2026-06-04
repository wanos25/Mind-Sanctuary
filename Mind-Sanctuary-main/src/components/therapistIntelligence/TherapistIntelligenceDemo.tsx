import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  Brain,
  ChevronRight,
  Stethoscope,
  Users,
} from 'lucide-react';
import type { DemoPatientRecord, TherapistIntelligenceDemo } from '@/lib/mindJourney/types';

interface Props {
  demo: TherapistIntelligenceDemo;
}

const RISK_STYLE = {
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  moderate: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  high: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
} as const;

export default function TherapistIntelligenceDemo({ demo }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [selectedId, setSelectedId] = useState(demo.patients[0]?.id ?? '');
  const memo = useMemo(() => demo, [demo]);
  const patient = memo.patients.find((p) => p.id === selectedId) ?? memo.patients[0];

  return (
    <section
      className="relative py-20 px-6 border-t border-border/30"
      aria-labelledby="therapist-demo-heading"
      data-testid="therapist-intelligence-demo"
    >
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="text-center md:text-start">
          <span className="inline-block text-[10px] font-ui tracking-[0.35em] uppercase px-3 py-1 rounded-full border border-primary/30 text-primary mb-3">
            {t('mindJourney.therapistDemo.badge')}
          </span>
          <h2
            id="therapist-demo-heading"
            className="text-2xl md:text-4xl font-display font-bold flex items-center justify-center md:justify-start gap-3"
          >
            <Stethoscope className="w-8 h-8 text-primary shrink-0" />
            {t('mindJourney.therapistDemo.title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto md:mx-0">
            {t('mindJourney.therapistDemo.subtitle')}
          </p>
        </header>

        <div className="grid grid-cols-3 gap-3 max-w-lg">
          <CohortPill label={t('mindJourney.therapistDemo.low')} count={memo.cohortSummary.low} tone="low" />
          <CohortPill
            label={t('mindJourney.therapistDemo.medium')}
            count={memo.cohortSummary.moderate}
            tone="moderate"
          />
          <CohortPill label={t('mindJourney.therapistDemo.high')} count={memo.cohortSummary.high} tone="high" />
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t('mindJourney.therapistDemo.patients')}
            </p>
            {memo.patients.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-start glass rounded-xl p-4 border transition-colors ${
                  selectedId === p.id ? 'border-primary bg-primary/10' : 'border-border/40'
                }`}
              >
                <div className="flex justify-between items-center gap-2">
                  <span className="font-semibold text-sm">{p.name}</span>
                  <span
                    className={`text-[9px] uppercase px-2 py-0.5 rounded-full border ${RISK_STYLE[p.riskLevel]}`}
                  >
                    {p.riskLevel}
                  </span>
                </div>
                <Sparkline values={p.moodSparkline} />
              </button>
            ))}
          </div>

          {patient && (
            <motion.div
              key={patient.id}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="lg:col-span-8 glass rounded-3xl p-6 md:p-8 border border-border/40 space-y-6"
            >
              <PatientDetail patient={patient} />
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}

function CohortPill({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: keyof typeof RISK_STYLE;
}) {
  return (
    <div className={`rounded-xl p-4 border text-center ${RISK_STYLE[tone]}`}>
      <p className="text-2xl font-bold tabular-nums">{count}</p>
      <p className="text-[10px] uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-8 mt-3" aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 bg-primary/50 rounded-t-sm min-w-[4px]"
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

function PatientDetail({ patient }: { patient: DemoPatientRecord }) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h3 className="text-xl font-display font-bold">{patient.name}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t('mindJourney.therapistDemo.lastSession')}: {patient.lastSession}
          </p>
        </div>
        <span className={`text-xs uppercase px-3 py-1 rounded-full border ${RISK_STYLE[patient.riskLevel]}`}>
          {patient.riskLevel} {t('mindJourney.therapistDemo.risk')}
        </span>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Metric label={t('mindJourney.therapistDemo.moodTrend')} value={`${patient.recoveryTrend >= 0 ? '+' : ''}${patient.recoveryTrend}%`} />
        <Metric label={t('mindJourney.therapistDemo.burnout')} value={`${patient.burnout}/100`} />
        <Metric label={t('mindJourney.therapistDemo.anxiety')} value={`${patient.anxiety}/100`} />
      </div>

      <div className="glass rounded-2xl p-5 border border-primary/20">
        <p className="text-[10px] uppercase tracking-widest text-primary/70 mb-2 flex items-center gap-2">
          <Brain className="w-4 h-4" />
          {t('mindJourney.therapistDemo.aiSummary')}
        </p>
        <p className="text-sm leading-relaxed">{patient.aiSummary}</p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {t('mindJourney.therapistDemo.interventions')}
        </p>
        <ul className="space-y-2">
          {patient.interventions.map((item) => (
            <li
              key={item}
              className="text-sm flex items-center gap-2 glass rounded-lg px-3 py-2"
            >
              <ChevronRight className="w-3 h-3 text-primary shrink-0 rtl:rotate-180" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          {t('mindJourney.therapistDemo.timeline')}
        </p>
        <ul className="space-y-2 border-s-2 border-primary/20 ps-4">
          {patient.timeline.map((ev) => (
            <li key={ev.at} className="text-xs">
              <span className="text-muted-foreground">{ev.at}</span> — {ev.title}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-4 border border-border/30">
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      <p className="text-lg font-bold text-primary mt-1">{value}</p>
    </div>
  );
}
