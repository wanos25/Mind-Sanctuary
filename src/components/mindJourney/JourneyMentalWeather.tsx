import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Cloud, CloudLightning, CloudRain, Sun } from 'lucide-react';
import type { MentalWeather } from '@/lib/mindJourney/types';

const WEATHER_META: Record<
  MentalWeather,
  { icon: typeof Sun; className: string }
> = {
  stable: { icon: Sun, className: 'text-amber-300' },
  improving: { icon: Cloud, className: 'text-emerald-400' },
  storm_incoming: { icon: CloudLightning, className: 'text-amber-400' },
  recovery_phase: { icon: CloudRain, className: 'text-primary' },
};

interface Props {
  weather: MentalWeather;
}

export default function JourneyMentalWeather({ weather }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const meta = WEATHER_META[weather];
  const Icon = meta.icon;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-4 glass rounded-2xl px-5 py-4 border border-border/40"
      role="status"
      aria-label={t(`mindJourney.advanced.weather.${weather}`)}
    >
      <div className={`w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center ${meta.className}`}>
        <Icon className="w-7 h-7" aria-hidden />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {t('mindJourney.advanced.weather.label')}
        </p>
        <p className="text-lg font-display font-semibold">
          {t(`mindJourney.advanced.weather.${weather}`)}
        </p>
      </div>
    </motion.div>
  );
}
