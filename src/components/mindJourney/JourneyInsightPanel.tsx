import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import type { JourneyInsightBundle } from '@/lib/mindJourney/types';

interface Props {
  insights: JourneyInsightBundle;
}

function InsightList({
  title,
  items,
  icon: Icon,
  tone,
}: {
  title: string;
  items: string[];
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      <h4 className={`text-xs font-ui tracking-[0.2em] uppercase flex items-center gap-2 ${tone}`}>
        <Icon className="w-3.5 h-3.5" />
        {title}
      </h4>
      <ul className="space-y-2">
        {items.map((line) => (
          <li key={line} className="text-sm text-muted-foreground leading-relaxed glass rounded-xl px-3 py-2">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function JourneyInsightPanel({ insights }: Props) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glass rounded-3xl p-6 md:p-8 border border-primary/20 space-y-6"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-ui tracking-[0.3em] text-primary/70 uppercase mb-1">
            {t('mindJourney.insights.label')}
          </p>
          <p className="text-sm md:text-base text-foreground/90 leading-relaxed">{insights.summary}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <InsightList
          title={t('mindJourney.insights.improvements')}
          items={insights.improvements}
          icon={TrendingUp}
          tone="text-emerald-400"
        />
        <InsightList
          title={t('mindJourney.insights.regressions')}
          items={insights.regressions}
          icon={TrendingDown}
          tone="text-amber-400"
        />
        <InsightList
          title={t('mindJourney.insights.recommendations')}
          items={insights.recommendations}
          icon={ArrowRight}
          tone="text-primary"
        />
      </div>
    </motion.div>
  );
}
