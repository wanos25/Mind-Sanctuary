import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Brain, Sparkles, TrendingUp } from 'lucide-react';
import CountUp from '@/components/ui/CountUp';
import type { TherapeuticMemoryProfile } from '@/lib/mindJourney/types';
import JourneyCinematicBackdrop from './JourneyCinematicBackdrop';

interface Props {
  memory: TherapeuticMemoryProfile;
}

export default function JourneyTherapeuticMemorySection({ memory }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const memo = useMemo(() => memory, [memory]);

  return (
    <section
      className="relative space-y-8 rounded-[2rem] p-6 md:p-10 border border-primary/25 overflow-hidden"
      data-testid="journey-therapeutic-memory"
      aria-labelledby="therapeutic-memory-heading"
    >
      <JourneyCinematicBackdrop tone="progress" />
      <header className="relative">
        <p className="text-xs font-ui tracking-[0.35em] text-primary/70 uppercase flex items-center gap-2">
          <Brain className="w-4 h-4" />
          {t('mindJourney.memory.badge')}
        </p>
        <h3 id="therapeutic-memory-heading" className="text-2xl md:text-4xl font-display font-bold mt-2">
          {t('mindJourney.memory.title')}
        </h3>
        <p className="text-sm text-muted-foreground mt-2">
          {t('mindJourney.memory.confidence')}:{' '}
          <span className="text-primary font-semibold tabular-nums">
            <CountUp value={memo.confidence} />%
          </span>
        </p>
      </header>

      <div className="relative grid md:grid-cols-2 gap-6">
        <PatternBlock
          title={t('mindJourney.memory.themes')}
          items={memo.emotionalThemes}
        />
        <PatternBlock
          title={t('mindJourney.memory.triggers')}
          items={memo.recurringTriggers}
        />
        <ListBlock title={t('mindJourney.memory.growth')} items={memo.growthAreas} />
        <ListBlock title={t('mindJourney.memory.goals')} items={memo.longTermGoals} />
      </div>

      <div className="relative grid md:grid-cols-2 gap-6">
        <motion.div
          initial={reduce ? false : { opacity: 0, x: -12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="glass rounded-2xl p-6 border border-border/40"
        >
          <h4 className="text-xs font-ui tracking-[0.2em] uppercase flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-accent" />
            {t('mindJourney.memory.keepsAppearing')}
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {memo.keepsAppearing.map((line) => (
              <li key={line} className="glass rounded-lg px-3 py-2">
                {line}
              </li>
            ))}
          </ul>
        </motion.div>
        <motion.div
          initial={reduce ? false : { opacity: 0, x: 12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="glass rounded-2xl p-6 border border-emerald-500/20"
        >
          <h4 className="text-xs font-ui tracking-[0.2em] uppercase flex items-center gap-2 mb-4 text-emerald-400">
            <TrendingUp className="w-4 h-4" />
            {t('mindJourney.memory.improved')}
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {memo.improvedOverTime.map((line) => (
              <li key={line} className="glass rounded-lg px-3 py-2 text-emerald-400/90">
                {line}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}

function PatternBlock({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; count: number; detail: string }>;
}) {
  if (!items.length) return null;
  return (
    <div className="glass rounded-2xl p-5 border border-border/40 space-y-3">
      <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</h4>
      {items.map((item) => (
        <div key={item.label} className="flex justify-between gap-2 text-sm">
          <span className="capitalize font-medium">{item.label}</span>
          <span className="text-primary tabular-nums shrink-0">×{item.count}</span>
        </div>
      ))}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="glass rounded-2xl p-5 border border-border/40">
      <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{title}</h4>
      <ul className="text-xs space-y-2 text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="glass rounded-lg px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
