import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { BeforeNowComparison } from '@/lib/mindJourney/types';

interface Props {
  comparison: BeforeNowComparison;
}

function MetricBlock({
  label,
  stress,
  mood,
  stressLabel,
  moodLabel,
}: {
  label: string;
  stress: number;
  mood: number;
  stressLabel: string;
  moodLabel: string;
}) {
  return (
    <div className="glass rounded-2xl p-5 border border-border/40 space-y-3 flex-1">
      <p className="text-[10px] font-ui tracking-[0.2em] text-muted-foreground uppercase">{label}</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-2xl font-display font-bold text-amber-400/90">{stress}</p>
          <p className="text-[10px] text-muted-foreground uppercase mt-1">{stressLabel}</p>
        </div>
        <div>
          <p className="text-2xl font-display font-bold text-emerald-400">{mood}</p>
          <p className="text-[10px] text-muted-foreground uppercase mt-1">{moodLabel}</p>
        </div>
      </div>
    </div>
  );
}

export default function JourneyBeforeNow({ comparison }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  if (!comparison.available) return null;

  const stressUp = comparison.stressImprovementPct > 0;
  const moodUp = comparison.moodImprovementPct > 0;
  const StressIcon = stressUp ? ArrowDown : comparison.stressImprovementPct < 0 ? ArrowUp : Minus;
  const MoodIcon = moodUp ? ArrowUp : comparison.moodImprovementPct < 0 ? ArrowDown : Minus;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="space-y-4"
    >
      <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase">
        {t('mindJourney.story.beforeNow.title')}
      </h3>
      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        <MetricBlock
          label={t('mindJourney.story.beforeNow.firstWeek')}
          stress={comparison.firstWeek.stress}
          mood={comparison.firstWeek.mood}
          stressLabel={t('mindJourney.story.beforeNow.stress')}
          moodLabel={t('mindJourney.story.beforeNow.mood')}
        />
        <div className="hidden md:flex flex-col items-center justify-center gap-2 px-2 text-muted-foreground">
          <StressIcon className={`w-5 h-5 ${stressUp ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-[10px] uppercase tracking-widest">
            {comparison.stressImprovementPct >= 0 ? '−' : '+'}
            {Math.abs(comparison.stressImprovementPct)}% stress
          </span>
          <MoodIcon className={`w-5 h-5 ${moodUp ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-[10px] uppercase tracking-widest">
            {moodUp ? '+' : ''}
            {comparison.moodImprovementPct}% mood
          </span>
        </div>
        <MetricBlock
          label={t('mindJourney.story.beforeNow.today')}
          stress={comparison.today.stress}
          mood={comparison.today.mood}
          stressLabel={t('mindJourney.story.beforeNow.stress')}
          moodLabel={t('mindJourney.story.beforeNow.mood')}
        />
      </div>
    </motion.div>
  );
}
