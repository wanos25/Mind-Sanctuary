import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Compass, ShieldAlert, Sparkles } from 'lucide-react';
import type { FuturePath } from '@/lib/mindJourney/types';

interface Props {
  futurePath: FuturePath;
}

function Column({
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

export default function JourneyFuturePath({ futurePath }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glass rounded-3xl p-6 md:p-8 border border-accent/20 space-y-6 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-accent/5 to-transparent pointer-events-none" />
      <div className="relative flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
          <Compass className="w-5 h-5 text-accent" />
        </div>
        <div>
          <p className="text-[10px] font-ui tracking-[0.3em] text-accent/80 uppercase mb-1">
            {t('mindJourney.story.future.title')}
          </p>
          <p className="text-sm text-muted-foreground">{t('mindJourney.story.future.subtitle')}</p>
        </div>
      </div>
      <div className="relative grid md:grid-cols-3 gap-6">
        <Column
          title={t('mindJourney.story.future.strengths')}
          items={futurePath.strengths}
          icon={Sparkles}
          tone="text-emerald-400"
        />
        <Column
          title={t('mindJourney.story.future.risks')}
          items={futurePath.risks}
          icon={ShieldAlert}
          tone="text-amber-400"
        />
        <Column
          title={t('mindJourney.story.future.actions')}
          items={futurePath.recommendedActions}
          icon={Compass}
          tone="text-primary"
        />
      </div>
    </motion.div>
  );
}
