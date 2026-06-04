import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Bot } from 'lucide-react';
import CountUp from '@/components/ui/CountUp';
import type { PersonalityTwinProfile } from '@/lib/mindJourney/types';
import JourneyCinematicBackdrop from './JourneyCinematicBackdrop';

interface Props {
  twin: PersonalityTwinProfile;
}

function TagList({ title, items, tone }: { title: string; items: string[]; tone?: string }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{title}</p>
      <ul className={`space-y-1.5 text-xs leading-relaxed ${tone ?? ''}`}>
        {items.map((item) => (
          <li key={item} className="glass rounded-lg px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function JourneyPersonalityTwinCard({ twin }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const memo = useMemo(() => twin, [twin]);

  return (
    <section
      className="relative rounded-[2rem] p-6 md:p-10 border border-primary/25 overflow-hidden"
      aria-labelledby="ai-twin-heading"
      data-testid="journey-personality-twin"
    >
      <JourneyCinematicBackdrop tone="beginning" />
      <motion.header
        initial={reduce ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative flex flex-col md:flex-row md:items-center gap-4 mb-8"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 border border-primary/40 flex items-center justify-center shrink-0 shadow-[0_0_40px_hsl(var(--primary)/0.25)]">
          <Bot className="w-8 h-8 text-primary" />
        </div>
        <div>
          <p className="text-[10px] tracking-[0.35em] text-primary/70 uppercase">
            {t('mindJourney.advanced.aiTwin.badge')}
          </p>
          <h3 id="ai-twin-heading" className="text-2xl md:text-4xl font-display font-bold">
            {t('mindJourney.advanced.aiTwin.title')}
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            {t('mindJourney.advanced.aiTwin.confidence')}:{' '}
            <span className="text-primary font-semibold tabular-nums">
              <CountUp value={memo.confidence} />%
            </span>
          </p>
        </div>
      </motion.header>

      <div className="relative flex flex-wrap gap-2 mb-6">
        {memo.coreTraits.map((trait) => (
          <span
            key={trait}
            className="text-xs font-ui tracking-wide px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30"
          >
            {trait}
          </span>
        ))}
      </div>

      <p className="relative text-sm text-foreground/85 italic mb-8 border-s-2 border-accent/50 ps-4">
        {memo.communicationStyle}
      </p>

      <div className="relative grid sm:grid-cols-2 gap-6 mb-8">
        <TagList title={t('mindJourney.advanced.aiTwin.triggers')} items={memo.emotionalTriggers} />
        <TagList
          title={t('mindJourney.advanced.aiTwin.strengths')}
          items={memo.recoveryStrengths}
          tone="text-emerald-400/90"
        />
        <TagList
          title={t('mindJourney.advanced.aiTwin.weaknesses')}
          items={memo.hiddenWeaknesses}
          tone="text-amber-400/90"
        />
        <TagList title={t('mindJourney.advanced.aiTwin.growth')} items={memo.growthOpportunities} />
      </div>

      <div className="relative grid md:grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            {t('mindJourney.advanced.aiTwin.evidence')}
          </p>
          <ul className="space-y-2 text-xs">
            {memo.evidence.map((e) => (
              <li key={e.label} className="glass rounded-lg px-3 py-2">
                <span className="font-semibold text-primary">{e.label}:</span> {e.detail}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            {t('mindJourney.advanced.aiTwin.changes')}
          </p>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {memo.changesOverTime.map((c) => (
              <li key={c} className="glass rounded-lg px-3 py-2">
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
