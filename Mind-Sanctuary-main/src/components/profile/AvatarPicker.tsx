import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AVATARS from '@/data/avatars';

interface Props {
  open: boolean;
  current: string | undefined;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export default function AvatarPicker({ open, current, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="glass-strong rounded-3xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-display gold-text mb-1 text-center">{t('profile.avatar.title')}</h3>
            <p className="text-xs text-muted-foreground text-center mb-6">{t('profile.avatar.desc')}</p>

            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {AVATARS.map((a, i) => {
                const active = current === a.id;
                return (
                  <motion.button
                    key={a.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.015 }}
                    whileHover={{ scale: 1.08, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { onSelect(a.id); onClose(); }}
                    className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 border transition-all ${
                      active
                        ? 'border-primary/70 bg-primary/15 shadow-[0_0_24px_hsl(var(--primary)/0.4)]'
                        : 'border-border/30 bg-secondary/30 hover:border-primary/40'
                    }`}
                  >
                    <span className="text-3xl">{a.emoji}</span>
                    <span className="text-[9px] text-muted-foreground font-ui">{a.label}</span>
                    {active && (
                      <span className="absolute top-1.5 end-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={onClose} className="sentinel-btn-outline px-5 py-2 text-sm">{t('common.done')}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
