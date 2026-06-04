import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { UserRound } from 'lucide-react';
import CountUp from '@/components/ui/CountUp';
import type { FutureSelfCard } from '@/lib/mindJourney/types';

interface Props {
  cards: FutureSelfCard[];
}

export default function JourneyFutureSelfCards({ cards }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {cards.map((card, i) => (
        <motion.article
          key={card.horizonDays}
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: reduce ? 0 : i * 0.08 }}
          className="relative glass rounded-3xl p-6 border border-accent/25 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-primary/5 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <UserRound className="w-5 h-5 text-accent" />
              <h4 className="text-sm font-display font-semibold">
                {t('mindJourney.futureSelf.cards.title', { days: card.horizonDays })}
              </h4>
            </div>
            <p className="text-xs text-primary/90 mb-2">
              {t('mindJourney.futureSelf.cards.confidence')}:{' '}
              <CountUp value={card.confidence} className="font-semibold" />%
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed mb-4">{card.projectedState}</p>
            <p className="text-lg font-bold text-primary mb-4">
              {t('mindJourney.futureSelf.cards.wellness')}: {card.wellness}/100
            </p>
            {card.strengths.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1 mb-3">
                {card.strengths.map((s) => (
                  <li key={s} className="text-emerald-400/90">+ {s}</li>
                ))}
              </ul>
            )}
            {card.risks.length > 0 && (
              <ul className="text-xs space-y-1 mb-3">
                {card.risks.map((r) => (
                  <li key={r} className="text-amber-400/90">! {r}</li>
                ))}
              </ul>
            )}
            {card.recommendedActions[0] && (
              <p className="text-[11px] glass rounded-lg px-3 py-2 text-muted-foreground">
                {card.recommendedActions[0]}
              </p>
            )}
          </div>
        </motion.article>
      ))}
    </div>
  );
}
