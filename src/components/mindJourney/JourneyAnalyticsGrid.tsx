import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Activity, Brain, Heart, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { JourneyAnalytics, JourneyStreaks } from '@/lib/mindJourney/types';

interface Props {
  analytics: JourneyAnalytics;
  streaks: JourneyStreaks;
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'up' | 'down' | 'default';
}) {
  const toneClass =
    tone === 'up' ? 'text-emerald-400' : tone === 'down' ? 'text-amber-400' : 'text-primary';

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="glass rounded-2xl p-5 border border-border/40"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-[10px] font-ui tracking-[0.2em] text-muted-foreground uppercase">{label}</p>
        <Icon className={`w-4 h-4 ${toneClass}`} />
      </div>
      <p className={`text-2xl font-display font-bold ${toneClass}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{hint}</p>
    </motion.div>
  );
}

export default function JourneyAnalyticsGrid({ analytics, streaks }: Props) {
  const { t } = useTranslation();

  const stressIcon =
    analytics.stressTrend === 'improving'
      ? TrendingDown
      : analytics.stressTrend === 'rising'
        ? TrendingUp
        : Minus;

  const moodTone = analytics.moodImprovementPct >= 0 ? 'up' : 'down';
  const anxTone = analytics.anxietyReductionPct >= 0 ? 'up' : 'down';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <MetricCard
        label={t('mindJourney.analytics.moodImprovement')}
        value={`${analytics.moodImprovementPct >= 0 ? '+' : ''}${analytics.moodImprovementPct}%`}
        hint={t('mindJourney.analytics.moodHint')}
        icon={Heart}
        tone={moodTone}
      />
      <MetricCard
        label={t('mindJourney.analytics.anxietyReduction')}
        value={`${analytics.anxietyReductionPct >= 0 ? '+' : ''}${analytics.anxietyReductionPct}%`}
        hint={t('mindJourney.analytics.anxietyHint')}
        icon={Brain}
        tone={anxTone}
      />
      <MetricCard
        label={t('mindJourney.analytics.stressTrend')}
        value={t(`mindJourney.analytics.stress.${analytics.stressTrend}`)}
        hint={t('mindJourney.analytics.stressHint')}
        icon={stressIcon}
        tone={analytics.stressTrend === 'improving' ? 'up' : analytics.stressTrend === 'rising' ? 'down' : 'default'}
      />
      <MetricCard
        label={t('mindJourney.analytics.consistency')}
        value={`${analytics.consistencyScore}/100`}
        hint={t('mindJourney.analytics.consistencyHint', { streak: streaks.currentStreak })}
        icon={Activity}
      />
    </div>
  );
}
