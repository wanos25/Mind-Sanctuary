import { motion, AnimatePresence } from 'framer-motion';
import { CornerUpLeft, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ReplyTarget {
  id: string;
  role: 'user' | 'assistant';
  preview: string;
  isVoice?: boolean;
}

interface Props {
  target: ReplyTarget | null;
  onClear: () => void;
  onJump?: (id: string) => void;
}

export default function ReplyPreview({ target, onClear, onJump }: Props) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {target && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: 6, height: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => onJump?.(target.id)}
          className="w-full text-start glass border-s-2 border-primary/60 rounded-xl px-3 py-2 mb-2 flex items-center gap-2 hover:border-primary transition-colors"
          aria-label={t('chat.replyingToOriginal', { defaultValue: 'Replying to message — tap to jump' })}
        >
          <CornerUpLeft className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-ui uppercase tracking-[0.18em] text-primary/80">
              {target.role === 'assistant' ? t('chat.drSentinel') : t('common.you')}
              {target.isVoice ? ` · ${t('voice.voiceMessage')}` : ''}
            </p>
            <p className="text-xs font-ui text-foreground/85 truncate">{target.preview}</p>
          </div>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onClear(); } }}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 flex-shrink-0"
            aria-label={t('common.close')}
          >
            <X className="w-3.5 h-3.5" />
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
