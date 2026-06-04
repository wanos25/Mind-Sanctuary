import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Share2, Calendar, Clock, Activity, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SessionRow, ChatMessageRow, getSessionMessages } from '@/lib/sessions';
import { useApp } from '@/context/AppContext';
import EmotionalReplay from './EmotionalReplay';
import { formatDate, formatTime } from '@/lib/locale/format';
import { useDirection } from '@/hooks/useDirection';

interface Props {
  date: Date | null;
  sessions: SessionRow[];
}

export default function HistoryMomentPanel({ date, sessions }: Props) {
  const { t } = useTranslation();
  const { isRtl } = useDirection();
  const ForwardIcon = isRtl ? ArrowLeft : ArrowRight;
  const { openExistingSession } = useApp();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [view, setView] = useState<'preview' | 'replay'>('preview');

  useEffect(() => {
    if (sessions.length && !sessions.find(s => s.id === activeId)) {
      setActiveId(sessions[0].id);
    }
    if (!sessions.length) setActiveId(null);
  }, [sessions, activeId]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    getSessionMessages(activeId).then(setMessages).catch(() => setMessages([]));
  }, [activeId]);

  const active = sessions.find(s => s.id === activeId) ?? null;

  return (
    <div className="glass-strong rounded-2xl p-5 flex flex-col gap-4 h-full min-h-[520px]">
      <div>
        <p className="text-[10px] font-ui tracking-[0.3em] uppercase text-muted-foreground">
          {t('history.selectedMoment')}
        </p>
        <div className="mt-2 flex items-center gap-3 text-sm font-ui text-foreground">
          <Calendar className="w-3.5 h-3.5 text-gold" />
          {date ? formatDate(date, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : t('history.allTime')}
        </div>
        {active && (
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {formatTime(new Date(active.started_at))}
            <span>·</span>
            <span className="capitalize">{active.summary_emotion ?? t('history.reflection')}</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-3">
        <div className="space-y-1.5 max-h-32 overflow-y-auto pe-1">
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">{t('history.noConversationsAt')}</p>
          ) : sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`w-full text-start text-xs px-3 py-2 rounded-lg transition-all border ${
                s.id === activeId
                  ? 'bg-primary/15 border-primary/40 text-foreground'
                  : 'border-border/20 text-muted-foreground hover:border-primary/30 hover:text-foreground'
              }`}
            >
              <span className="tabular-nums me-2">
                {formatTime(new Date(s.started_at))}
              </span>
              <span className="capitalize">{s.summary_emotion ?? t('history.readyToCarry')}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-full border border-border/20 w-fit self-start">
          <button onClick={() => setView('preview')}
            className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 ${view === 'preview' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}>
            <MessageSquare className="w-3 h-3" /> {t('history.preview')}
          </button>
          <button onClick={() => setView('replay')}
            className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 ${view === 'replay' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}>
            <Activity className="w-3 h-3" /> {t('history.replay')}
          </button>
        </div>

        <div className="flex-1 min-h-0 rounded-xl border border-border/20 bg-background/30 overflow-hidden">
          <div className="h-full overflow-y-auto p-3 space-y-2">
            {view === 'replay' ? (
              <EmotionalReplay sessionId={activeId} />
            ) : (
              <AnimatePresence mode="popLayout">
                {messages.length === 0 ? (
                  <motion.p key="empty"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-muted-foreground italic text-center pt-8">
                    {active ? t('history.noMessagesYet') : t('history.selectToPreview')}
                  </motion.p>
                ) : messages.slice(0, 12).map((m, i) => (
                  <motion.div key={m.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-[11px] leading-snug font-body ${
                      m.role === 'user'
                        ? 'bg-primary/20 border border-primary/30 text-foreground'
                        : 'glass border-s-2 border-s-gold/50 text-foreground/90'
                    }`}>
                      {m.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          disabled={!active}
          onClick={() => active && openExistingSession(active.id)}
          className="sentinel-btn text-xs py-2 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('history.openInChat')} <ForwardIcon className="w-3 h-3" />
        </button>
        <button
          disabled={!active}
          onClick={() => {
            if (!active) return;
            const url = `${window.location.origin}/?session=${active.id}`;
            navigator.clipboard?.writeText(url).catch(() => {});
          }}
          className="sentinel-btn-outline text-xs py-2 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Share2 className="w-3 h-3" /> {t('history.shareMoment')}
        </button>
      </div>
    </div>
  );
}
