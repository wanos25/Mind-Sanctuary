import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props { insights: string[]; }

export default function AIInsightCards({ insights }: Props) {
  const { t } = useTranslation();
  if (insights.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6"
    >
      <div className="flex items-center gap-2 mb-5">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase">{t('insights.aiReflections')}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((text, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ y: -3 }}
            className="relative p-4 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/5 opacity-0 hover:opacity-100 transition-opacity" />
            <p className="relative text-sm font-body text-foreground/90 leading-relaxed">{text}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
