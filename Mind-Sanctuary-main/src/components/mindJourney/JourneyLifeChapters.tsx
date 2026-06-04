import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Film } from 'lucide-react';
import type { LifeChapter } from '@/lib/mindJourney/types';
import JourneyCinematicBackdrop from './JourneyCinematicBackdrop';

const PHASE_TONE: Record<LifeChapter['lifePhase'], LifeChapter['emotionalTone']> = {
  beginning: 'beginning',
  struggle: 'challenge',
  recovery: 'progress',
  growth: 'momentum',
  momentum: 'present',
};

interface Props {
  chapters: LifeChapter[];
}

export default function JourneyLifeChapters({ chapters }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  if (!chapters.length) return null;

  return (
    <div className="space-y-6">
      <h4 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase flex items-center gap-2">
        <Film className="w-4 h-4 text-primary" />
        {t('mindJourney.futureSelf.lifeChapters.title')}
      </h4>
      <div className="space-y-8">
        {chapters.map((ch) => (
          <div key={ch.id}>
            <motion.article
              initial={reduce ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <JourneyCinematicBackdrop tone={PHASE_TONE[ch.lifePhase]} />
              <div className="relative glass rounded-3xl p-6 md:p-8 border border-border/40">
                <p className="text-[10px] tracking-[0.3em] text-primary/70 uppercase">{ch.documentaryIntro}</p>
                <h5 className="text-xl font-display font-bold mt-2">{ch.title}</h5>
                <p className="text-[10px] text-muted-foreground mt-1">{ch.dateRange.label}</p>
                <p className="text-sm text-foreground/85 mt-4 leading-relaxed">{ch.narrative}</p>
              </div>
            </motion.article>
            {ch.transitionToNext && (
              <motion.p
                initial={reduce ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-xs italic text-center text-muted-foreground/90 my-6 px-4 max-w-xl mx-auto border-s-2 border-primary/30 ps-4"
              >
                {ch.transitionToNext}
              </motion.p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
