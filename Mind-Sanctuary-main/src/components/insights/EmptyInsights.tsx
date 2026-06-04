import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, Activity } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from 'react-i18next';

export default function EmptyInsights() {
  const { t } = useTranslation();
  const { startNewSession } = useApp();
  const features = [
    { icon: TrendingUp, key: 'trends' as const },
    { icon: Activity, key: 'weeklyRhythm' as const },
    { icon: Sparkles, key: 'ai' as const },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl p-10 text-center relative overflow-hidden"
    >
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity }}
        style={{ background: 'radial-gradient(circle at 50% 0%, hsl(var(--primary) / 0.15), transparent 70%)' }}
      />
      <div className="relative z-10 max-w-lg mx-auto">
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="text-5xl mb-4"
        >
          🌌
        </motion.div>
        <h3 className="text-xl font-display gold-text mb-2">{t('insights.empty.title')}</h3>
        <p className="text-sm text-muted-foreground mb-6">{t('insights.empty.desc')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {features.map((f, i) => (
            <motion.div
              key={f.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="p-3 rounded-xl bg-secondary/30 border border-border/30"
            >
              <f.icon className="w-4 h-4 text-primary mx-auto mb-2" />
              <p className="text-xs text-foreground/80">{t(`insights.empty.${f.key}`)}</p>
            </motion.div>
          ))}
        </div>
        <button onClick={startNewSession} className="sentinel-btn px-6 py-2.5 text-sm">
          {t('insights.empty.cta')}
        </button>
      </div>
    </motion.div>
  );
}
