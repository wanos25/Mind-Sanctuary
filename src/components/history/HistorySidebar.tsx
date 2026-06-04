import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Sparkles, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { listSessions, SessionRow } from '@/lib/sessions';
import { groupByRecency, searchSessions, TimeGroup } from '@/lib/historyFilter';
import { formatDateTime } from '@/lib/locale/format';

interface Props {
  onSelect?: (id: string) => void;
  refreshKey?: number;
}

export default function HistorySidebar({ onSelect, refreshKey }: Props) {
  const { t } = useTranslation();
  const LABELS: Record<TimeGroup, string> = {
    today: t('history.groups.today'),
    yesterday: t('history.groups.yesterday'),
    thisWeek: t('history.groups.thisWeek'),
    older: t('history.groups.older'),
  };
  const { user } = useAuth();
  const { currentSessionId, startNewSession, openExistingSession } = useApp();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!user) return;
    listSessions(user.id).then(setSessions).catch(() => {});
  }, [user, refreshKey, currentSessionId]);

  const filtered = useMemo(() => searchSessions(sessions, q), [sessions, q]);
  const groups = useMemo(() => groupByRecency(filtered), [filtered]);

  return (
    <aside className="w-72 shrink-0 glass-strong border-r border-border/30 flex flex-col h-full">
      <div className="p-4 space-y-2 border-b border-border/30">
        <button
          onClick={startNewSession}
          className="sentinel-btn-outline w-full text-xs py-2.5 flex items-center justify-center gap-2 hover:gold-glow transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> {t('common.newChat')}
        </button>
        <button
          onClick={startNewSession}
          className="sentinel-btn w-full text-xs py-2.5 flex items-center justify-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5" /> {t('common.newSession')}
        </button>
        <div className="relative mt-1">
          <Search className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('history.searchMemories')}
            className="w-full ps-9 pe-3 py-2 rounded-lg bg-background/40 border border-border/30 text-xs font-ui text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {(Object.keys(groups) as TimeGroup[]).map(g => {
          const list = groups[g];
          if (!list.length) return null;
          return (
            <div key={g}>
              <p className="text-[10px] font-ui tracking-[0.3em] text-muted-foreground uppercase px-3 py-1.5">
                {LABELS[g]}
              </p>
              <div className="space-y-1">
                {list.map(s => {
                  const active = s.id === currentSessionId;
                  return (
                    <motion.button
                      key={s.id}
                      whileHover={{ x: i18nDirSign() * 3 }}
                      onClick={() => onSelect ? onSelect(s.id) : openExistingSession(s.id)}
                      className={`w-full text-start p-2.5 rounded-lg flex items-start gap-2 transition-all border ${
                        active
                          ? 'bg-primary/15 border-primary/40 gold-glow'
                          : 'border-transparent hover:bg-secondary/30 hover:border-border/30'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-gold/70 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-ui text-foreground truncate capitalize">
                          {s.summary_emotion ?? t('history.reflection')}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {formatDateTime(new Date(s.started_at))}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground px-3 italic">{t('history.noConversationsFound')}</p>
        )}
      </div>
    </aside>
  );
}

function i18nDirSign() {
  if (typeof document === 'undefined') return 1;
  return document.documentElement.dir === 'rtl' ? -1 : 1;
}
