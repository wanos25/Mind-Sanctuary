import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useApp, AppStage } from '@/context/AppContext';
import { useTranslation } from 'react-i18next';

const BACK_MAP: Partial<Record<AppStage, AppStage>> = {
  session: 'dashboard',
  insights: 'dashboard',
  history: 'dashboard',
  profile: 'dashboard',
  settings: 'dashboard',
  emergency: 'session',
};

export default function FloatingBackButton() {
  const { stage, setStage } = useApp();
  const { i18n, t } = useTranslation();
  const isRtl = i18n.dir(i18n.language) === 'rtl';
  const target = BACK_MAP[stage];
  const visible = !!target && stage !== 'dashboard' && stage !== 'login' && stage !== 'entry';
  const Arrow = isRtl ? ArrowRight : ArrowLeft;

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, x: isRtl ? 30 : -30, scale: 0.85 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: isRtl ? 30 : -30, scale: 0.85 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          onClick={() => target && setStage(target)}
          aria-label={t('aria.back')}
          data-testid="floating-back-button"
          className="fixed bottom-6 start-6 z-40 glass-strong rounded-full p-3.5 border border-primary/30 hover:border-primary/60 hover:gold-glow transition-colors group"
          style={{ backdropFilter: 'blur(24px)' }}
        >
          <Arrow className="w-5 h-5 text-primary transition-transform group-hover:scale-110" />
          <span className="absolute inset-0 rounded-full pointer-events-none animate-ping bg-primary/20 opacity-0 group-hover:opacity-100" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
