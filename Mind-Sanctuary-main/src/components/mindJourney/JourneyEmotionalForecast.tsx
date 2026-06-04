import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { ForecastChartPoint } from '@/lib/mindJourney/types';

interface Props {
  points: ForecastChartPoint[];
}

export default function JourneyEmotionalForecast({ points }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const presentIndex = useMemo(
    () => points.findIndex((p) => p.phase === 'present'),
    [points],
  );

  const chartData = useMemo(
    () =>
      points.map((p) => ({
        ...p,
        actual: p.phase !== 'forecast' ? p.score : undefined,
        projected: p.phase === 'forecast' || p.phase === 'present' ? p.score : undefined,
      })),
    [points],
  );

  if (points.length < 2) return null;

  return (
    <div className="space-y-4" data-testid="journey-emotional-forecast">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase">
          {t('mindJourney.futureSelf.forecast.title')}
        </h4>
        <div className="flex gap-3 text-[10px] uppercase tracking-widest">
          <span className="text-muted-foreground">{t('mindJourney.futureSelf.forecast.past')}</span>
          <span className="text-primary">→ {t('mindJourney.futureSelf.forecast.present')}</span>
          <span className="text-accent">→ {t('mindJourney.futureSelf.forecast.future')}</span>
        </div>
      </div>
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="glass rounded-3xl p-4 md:p-6 border border-border/40 h-56 md:h-64"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 11,
              }}
            />
            {presentIndex >= 0 && (
              <ReferenceLine
                x={points[presentIndex]?.date}
                stroke="hsl(var(--primary))"
                strokeDasharray="4 4"
              />
            )}
            <Line
              type="monotone"
              dataKey="actual"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={!reduce}
            />
            <Line
              type="monotone"
              dataKey="projected"
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ r: 2, fill: 'hsl(var(--accent))' }}
              connectNulls
              isAnimationActive={!reduce}
            />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
