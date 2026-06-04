import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { EmotionState } from '@/context/AppContext';

interface MoodTrackerProps {
  emotionLog: EmotionState[];
  elapsed: number;
  breathingUsed: number;
}

const MoodTracker = forwardRef<HTMLDivElement, MoodTrackerProps>(({ emotionLog, elapsed, breathingUsed }, ref) => {
  const { t } = useTranslation();

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  const avgSentiment = emotionLog.length > 0
    ? emotionLog.reduce((a, e) => a + e.sentiment, 0) / emotionLog.length
    : 0;

  const avgIntensity = emotionLog.length > 0
    ? emotionLog.reduce((a, e) => a + e.intensity, 0) / emotionLog.length
    : 0;

  const trendLabel = avgSentiment > 0.2 ? t('mood.improving') : avgSentiment < -0.2 ? t('mood.challenging') : t('mood.steady');
  const trendEmoji = avgSentiment > 0.2 ? '📈' : avgSentiment < -0.2 ? '📉' : '➡️';

  return (
    <div ref={ref} className="space-y-4">
      <div>
        <p className="text-xs font-ui text-muted-foreground mb-1">{t('mood.sessionDuration')}</p>
        <p className="text-lg font-display text-foreground">{formatTime(elapsed)}</p>
      </div>

      <div>
        <p className="text-xs font-ui text-muted-foreground mb-1">{t('mood.moodTrend')}</p>
        <div className="flex items-center gap-2">
          <span className="text-lg">{trendEmoji}</span>
          <span className="text-sm font-ui text-foreground">{trendLabel}</span>
        </div>
      </div>

      {emotionLog.length > 0 && (
        <div>
          <p className="text-xs font-ui text-muted-foreground mb-2">{t('mood.intensityOverTime')}</p>
          <div className="flex items-end gap-0.5 h-12">
            {emotionLog.slice(-15).map((e, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${e.intensity * 100}%` }}
                className="flex-1 rounded-t-sm min-w-1"
                style={{
                  background: e.sentiment > 0
                    ? 'hsl(var(--primary) / 0.6)'
                    : e.sentiment < 0
                    ? 'hsl(var(--destructive) / 0.5)'
                    : 'hsl(var(--muted-foreground) / 0.4)',
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-ui text-muted-foreground mb-1">{t('mood.averageIntensity')}</p>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--gradient-gold)' }}
            animate={{ width: `${avgIntensity * 100}%` }}
          />
        </div>
      </div>

      {breathingUsed > 0 && (
        <div>
          <p className="text-xs font-ui text-muted-foreground mb-1">{t('mood.breathingExercises')}</p>
          <p className="text-sm font-ui text-foreground">{t('mood.completed', { count: breathingUsed })}</p>
        </div>
      )}
    </div>
  );
});

MoodTracker.displayName = 'MoodTracker';

export default MoodTracker;
