import { motion } from 'framer-motion';
import { Check, Loader2, X, AlertTriangle, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type StageStatus = 'pending' | 'active' | 'success' | 'warning' | 'failure';

export interface Stage {
  key: string;
  labelKey: string;
  status: StageStatus;
  ms?: number;
  detail?: string;
}

const tone: Record<StageStatus, string> = {
  pending: 'border-border/40 text-muted-foreground bg-secondary/30',
  active: 'border-primary/60 text-primary bg-primary/10 shadow-[0_0_18px_hsl(var(--primary)/0.35)]',
  success: 'border-emerald-500/50 text-emerald-300 bg-emerald-500/10',
  warning: 'border-yellow-500/50 text-yellow-300 bg-yellow-500/10',
  failure: 'border-red-500/50 text-red-300 bg-red-500/10',
};

function Icon({ status }: { status: StageStatus }) {
  if (status === 'active') return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
  if (status === 'success') return <Check className="w-3.5 h-3.5" />;
  if (status === 'failure') return <X className="w-3.5 h-3.5" />;
  if (status === 'warning') return <AlertTriangle className="w-3.5 h-3.5" />;
  return <Circle className="w-3.5 h-3.5" />;
}

export default function StageTimeline({ stages }: { stages: Stage[] }) {
  const { t } = useTranslation();
  return (
    <ol className="flex flex-col gap-1.5">
      {stages.map((s, i) => (
        <motion.li
          key={s.key}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.025, duration: 0.2 }}
          className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${tone[s.status]}`}
        >
          <div className="flex items-center justify-center w-6 h-6 rounded-full border border-current/40 flex-shrink-0">
            <Icon status={s.status} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-ui font-medium truncate">{t(s.labelKey)}</p>
            {s.detail && <p className="text-[10px] text-current/70 truncate">{s.detail}</p>}
          </div>
          {typeof s.ms === 'number' && (
            <span className="text-[10px] font-mono tabular-nums opacity-80 flex-shrink-0">
              {s.ms < 1000 ? `${s.ms}ms` : `${(s.ms / 1000).toFixed(2)}s`}
            </span>
          )}
        </motion.li>
      ))}
    </ol>
  );
}
