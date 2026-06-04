import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { InsightsData, colorForEmotion } from '@/lib/insightsAggregator';

interface Props { data: InsightsData; }

function useCounter(value: number, duration = 1200) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0; const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return n;
}

export default function InsightHero({ data }: Props) {
  const sessions = useCounter(data.totals.sessions);
  const intensity = useCounter(data.totals.avgIntensity);
  const days = useCounter(data.totals.consistencyDays);
  const auraColor = colorForEmotion(data.totals.dominantEmotion);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative glass rounded-3xl p-8 md:p-10 overflow-hidden"
    >
      {/* Aura */}
      <motion.div
        aria-hidden
        className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${auraColor}55, transparent 70%)` }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.7, 0.95, 0.7] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-40 -left-32 w-[26rem] h-[26rem] rounded-full blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, hsl(var(--primary) / 0.25), transparent 70%)` }}
        animate={{ scale: [1.05, 1, 1.05], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
        <div className="md:col-span-2">
          <p className="text-[10px] font-ui tracking-[0.4em] text-primary/80 uppercase mb-3">Emotional Observatory</p>
          <motion.h2
            key={data.headline}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl md:text-3xl font-display text-foreground leading-snug"
          >
            {data.headline}
          </motion.h2>
          <p className="text-sm text-muted-foreground mt-3 capitalize">
            Dominant pattern · <span className="text-primary">{data.totals.dominantEmotion}</span>
            {data.totals.intensityDelta !== 0 && data.totals.sessions > 1 && (
              <>
                {'   ·   '}Intensity shift{' '}
                <span className={data.totals.intensityDelta < 0 ? 'text-emerald-400' : 'text-orange-400'}>
                  {data.totals.intensityDelta > 0 ? '+' : ''}{data.totals.intensityDelta}%
                </span>
              </>
            )}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Sessions" value={sessions} />
          <Stat label="Avg Intensity" value={`${intensity}%`} />
          <Stat label="Active Days" value={days} />
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center px-2 py-3 rounded-xl bg-secondary/30 border border-border/30">
      <p className="text-2xl md:text-3xl font-display gold-text">{value}</p>
      <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
