import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ScanFace } from 'lucide-react';
import type { DigitalTwinProfile } from '@/lib/mindJourney/types';

interface Props {
  twin: DigitalTwinProfile;
}

export default function JourneyDigitalTwin({ twin }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.98 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="glass rounded-3xl p-6 md:p-8 border border-primary/30 relative overflow-hidden"
    >
      <div className="absolute -top-20 end-0 w-56 h-56 rounded-full bg-primary/15 blur-[80px]" />
      <div className="relative flex flex-col md:flex-row gap-6">
        <div className="shrink-0">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/40 flex items-center justify-center">
            <ScanFace className="w-8 h-8 text-primary" />
          </div>
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <p className="text-[10px] font-ui tracking-[0.35em] text-primary/70 uppercase">
              {t('mindJourney.futureSelf.twin.label')}
            </p>
            <h4 className="text-2xl md:text-3xl font-display font-bold mt-1">{twin.archetype}</h4>
            <p className="text-sm text-muted-foreground mt-2">{twin.tagline}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <TwinColumn title={t('mindJourney.futureSelf.twin.strengths')} items={twin.strengths} />
            <TwinColumn title={t('mindJourney.futureSelf.twin.patterns')} items={twin.emotionalPatterns} />
            <TwinColumn title={t('mindJourney.futureSelf.twin.blindSpots')} items={twin.blindSpots} tone="amber" />
            <TwinColumn
              title={t('mindJourney.futureSelf.twin.opportunities')}
              items={twin.growthOpportunities}
              tone="emerald"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TwinColumn({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone?: 'amber' | 'emerald';
}) {
  const toneClass = tone === 'amber' ? 'text-amber-400/90' : tone === 'emerald' ? 'text-emerald-400/90' : '';
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{title}</p>
      <ul className={`space-y-1.5 text-xs leading-relaxed ${toneClass}`}>
        {items.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
