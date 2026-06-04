import { useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Clock, History } from 'lucide-react';
import type { EmotionalTimeMachine, TimeSelfSnapshot } from '@/lib/mindJourney/types';
import JourneyCinematicBackdrop from './JourneyCinematicBackdrop';

interface Props {
  timeMachine: EmotionalTimeMachine;
}

const TAB_ORDER: Array<TimeSelfSnapshot['label']> = ['past', 'present', 'future'];

function SelfPanel({ snap }: { snap: TimeSelfSnapshot }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{snap.dateLabel}</p>
      <div className="grid grid-cols-2 gap-3">
        <Metric label={t('mindJourney.advanced.time.emotional')} value={snap.emotionalScore} />
        <Metric label={t('mindJourney.advanced.time.resilience')} value={snap.resilience} />
        <Metric label={t('mindJourney.advanced.time.consistency')} value={snap.consistency} />
        <Metric label={t('mindJourney.advanced.time.recovery')} value={snap.recoveryCapacity} />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          {t('mindJourney.advanced.time.challenges')}
        </p>
        <ul className="text-xs space-y-1 text-muted-foreground">
          {snap.majorChallenges.map((c) => (
            <li key={c} className="glass rounded-lg px-3 py-2">
              {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-xl p-3 border border-border/30">
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      <p className="text-xl font-display font-bold text-primary tabular-nums">{value}</p>
    </div>
  );
}

export default function JourneyTimeMachineSection({ timeMachine }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<TimeSelfSnapshot['label']>('present');
  const memo = useMemo(() => timeMachine, [timeMachine]);

  const snaps: Record<TimeSelfSnapshot['label'], TimeSelfSnapshot> = {
    past: memo.past,
    present: memo.present,
    future: memo.future,
  };

  return (
    <section
      className="relative space-y-8 rounded-[2rem] p-6 md:p-10 border border-accent/25 overflow-hidden"
      aria-labelledby="time-machine-heading"
      data-testid="journey-time-machine"
    >
      <JourneyCinematicBackdrop tone="momentum" />
      <header className="relative">
        <p className="text-xs font-ui tracking-[0.35em] text-accent/80 uppercase flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {t('mindJourney.advanced.time.badge')}
        </p>
        <h3 id="time-machine-heading" className="text-2xl md:text-4xl font-display font-bold mt-2">
          {t('mindJourney.advanced.time.title')}
        </h3>
      </header>

      <div className="relative space-y-4 text-sm leading-relaxed">
        <p className="glass rounded-xl px-4 py-3 border border-border/30">{memo.narrative.past}</p>
        <p className="glass rounded-xl px-4 py-3 border border-primary/20">{memo.narrative.present}</p>
        <p className="glass rounded-xl px-4 py-3 border border-accent/20">{memo.narrative.future}</p>
      </div>

      <div className="relative flex flex-wrap gap-2">
        {TAB_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`text-xs font-ui tracking-wide px-4 py-2 rounded-full border transition-colors ${
              tab === key
                ? 'bg-accent/20 border-accent text-foreground'
                : 'glass border-border/40 text-muted-foreground'
            }`}
          >
            {t(`mindJourney.advanced.time.tab.${key}`)}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={reduce ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -12 }}
          transition={{ duration: 0.35 }}
          className="relative glass rounded-3xl p-6 md:p-8 border border-border/40"
        >
          <SelfPanel snap={snaps[tab]} />
        </motion.div>
      </AnimatePresence>

      <div className="relative overflow-x-auto pb-2">
        <div className="flex items-end gap-1 min-w-[320px] h-24 px-2">
          {memo.timelinePoints.map((pt, i) => (
            <motion.div
              key={`${pt.dateKey}-${i}`}
              className="flex-1 min-w-[8px] max-w-[20px] rounded-t-md origin-bottom"
              style={{
                height: `${Math.max(12, pt.score)}%`,
                background:
                  pt.phase === 'present'
                    ? 'hsl(var(--primary))'
                    : 'hsl(var(--muted-foreground) / 0.45)',
              }}
              initial={reduce ? false : { scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ delay: reduce ? 0 : i * 0.02 }}
              title={`${pt.date}: ${pt.score}`}
            />
          ))}
        </div>
      </div>

      {memo.milestones.length > 0 && (
        <div className="relative space-y-3">
          <h4 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase flex items-center gap-2">
            <History className="w-4 h-4" />
            {t('mindJourney.advanced.time.memories')}
          </h4>
          <div className="flex gap-3 overflow-x-auto snap-x pb-2">
            {memo.milestones.map((m) => (
              <div
                key={m.id}
                className="glass rounded-xl p-4 min-w-[200px] max-w-[240px] snap-start shrink-0 border border-primary/15"
              >
                <p className="text-sm font-semibold">{m.title}</p>
                <p className="text-xs text-muted-foreground mt-2">{m.memory}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
