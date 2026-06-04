import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SessionRow } from '@/lib/sessions';
import { formatTime } from '@/lib/locale/format';
import { useDirection } from '@/hooks/useDirection';

interface Props {
  session: SessionRow;
  active?: boolean;
  onClick?: () => void;
}

export default function SessionPreviewCard({ session, active, onClick }: Props) {
  const { t } = useTranslation();
  const { flipX } = useDirection();
  const d = new Date(session.started_at);
  const intensity = Math.round((session.summary_intensity ?? 0) * 100);
  return (
    <motion.button
      whileHover={{ x: 3 * flipX, scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      onClick={onClick}
      className={`w-full text-start rounded-xl p-3 flex items-start gap-3 transition-all border ${
        active
          ? 'bg-primary/10 border-primary/40 gold-glow'
          : 'glass border-border/30 hover:border-primary/30'
      }`}
    >
      <div className="mt-0.5 w-2 h-2 rounded-full bg-gold shadow-[0_0_8px_hsl(var(--gold))]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-ui text-foreground truncate">
            {session.summary_emotion ?? t('history.reflection')}
          </p>
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            {formatTime(d)}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate flex items-center gap-1">
          <MessageSquare className="w-2.5 h-2.5" /> {t('history.intensityPct', { pct: intensity })}
        </p>
      </div>
    </motion.button>
  );
}
