import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import PageShell from '@/components/layout/PageShell';
import { useAuth } from '@/context/AuthContext';
import { listSessions, SessionRow } from '@/lib/sessions';
import RadialHistoryClock from './RadialHistoryClock';
import HistoryMomentPanel from './HistoryMomentPanel';
import HistorySidebar from './HistorySidebar';
import { filterByDial } from '@/lib/historyFilter';
import { formatDate } from '@/lib/locale/format';

export default function HistoryPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) return;
    listSessions(user.id).then(s => { setSessions(s); setLoading(false); });
  }, [user]);

  const matched = useMemo(
    () => filterByDial(sessions, { date: filterDate, hour: null }),
    [sessions, filterDate],
  );

  return (
    <PageShell title={t('history.title')} subtitle={t('history.subtitle')}>
      <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr_22rem] gap-6 min-h-[640px]">
        {/* Left sidebar */}
        <div className="hidden lg:block h-[640px]">
          <HistorySidebar />
        </div>

        {/* Center — Time Vault Navigator */}
        <div className="relative flex flex-col items-center justify-start gap-6 py-4">
          <p className="text-[10px] font-ui tracking-[0.35em] uppercase text-muted-foreground">
            {t('history.dragHint')}
          </p>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 80, damping: 18 }}
            className="relative"
          >
            <div
              aria-hidden
              className="absolute -inset-20 rounded-full opacity-60 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, hsl(var(--gold)/0.10) 0%, transparent 60%)',
                filter: 'blur(40px)',
              }}
            />
            <RadialHistoryClock
              size="lg"
              selectedDate={filterDate ?? new Date()}
              onDateSelect={setFilterDate}
            />
          </motion.div>

          <div className="flex flex-col items-center gap-2">
            <div className="text-base font-display gold-text tracking-wider">
              {formatDate(filterDate ?? new Date(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground tabular-nums">
                {matched.length} {matched.length === 1 ? t('history.conversation') : t('history.conversations')}
              </span>
              {filterDate && (
                <button
                  onClick={() => setFilterDate(null)}
                  className="text-[10px] font-ui tracking-[0.25em] uppercase text-muted-foreground hover:text-foreground transition-colors border border-border/30 rounded-full px-3 py-1"
                >
                  {t('history.clear')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right — Selected moment panel */}
        <div className="h-[640px]">
          <HistoryMomentPanel
            date={filterDate}
            sessions={matched}
          />
        </div>
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground mt-6 text-center">{t('history.loadingMemories')}</p>
      )}
    </PageShell>
  );
}
