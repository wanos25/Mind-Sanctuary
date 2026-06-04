import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import type { MindJourneyFutureSelf } from '@/lib/mindJourney/types';
import JourneyCinematicBackdrop from './JourneyCinematicBackdrop';
import JourneyDigitalTwin from './JourneyDigitalTwin';
import JourneyPathSimulation from './JourneyPathSimulation';
import JourneyFutureSelfCards from './JourneyFutureSelfCards';
import JourneyEmotionalForecast from './JourneyEmotionalForecast';
import JourneyLifeChapters from './JourneyLifeChapters';
import JourneyWhatChangedYou from './JourneyWhatChangedYou';

interface Props {
  futureSelf: MindJourneyFutureSelf;
}

export default function JourneyFutureSelfSection({ futureSelf }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const memoized = useMemo(() => futureSelf, [futureSelf]);

  return (
    <section
      className="relative space-y-10 rounded-[2rem] p-6 md:p-10 border border-primary/20 overflow-hidden"
      aria-labelledby="future-self-heading"
      data-testid="journey-future-self"
    >
      <JourneyCinematicBackdrop tone="momentum" />
      <motion.header
        id="future-self-heading"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative text-center md:text-start"
      >
        <p className="text-xs font-ui tracking-[0.4em] text-accent/80 uppercase mb-2 flex items-center justify-center md:justify-start gap-2">
          <Sparkles className="w-4 h-4" />
          {t('mindJourney.futureSelf.badge')}
        </p>
        <h3 className="text-2xl md:text-4xl font-display font-bold">
          {t('mindJourney.futureSelf.title')}
        </h3>
        <p className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto md:mx-0">
          {t('mindJourney.futureSelf.subtitle')}
        </p>
      </motion.header>

      <div className="relative space-y-10">
        <JourneyDigitalTwin twin={memoized.digitalTwin} />
        <JourneyPathSimulation paths={memoized.paths} />
        <JourneyFutureSelfCards cards={memoized.cards} />
        <JourneyEmotionalForecast points={memoized.forecastChart} />
        <JourneyLifeChapters chapters={memoized.lifeChapters} />
        <JourneyWhatChangedYou sources={memoized.impactSources} />
      </div>
    </section>
  );
}
