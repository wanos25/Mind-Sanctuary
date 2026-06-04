import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, MessageSquare } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { listSessions, SessionRow } from '@/lib/sessions';

interface Props {
  refreshKey?: number;
  onSelect?: (sessionId: string) => void;
}

export default function SessionsSidebar({ refreshKey, onSelect }: Props) {
  const { user } = useAuth();
  const { currentSessionId, startNewSession, openExistingSession } = useApp();
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  useEffect(() => {
    if (!user) return;
    listSessions(user.id).then(setSessions).catch(() => {});
  }, [user, refreshKey, currentSessionId]);

  return (
    <aside className="w-64 glass-strong border-r border-border/30 flex flex-col h-full">
      <div className="p-4 border-b border-border/30">
        <button
          onClick={startNewSession}
          className="sentinel-btn w-full text-xs py-2.5 flex items-center justify-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> New Session
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <p className="text-[10px] font-ui tracking-[0.25em] text-muted-foreground uppercase px-3 py-2">Sessions</p>
        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground px-3">No previous sessions</p>
        )}
        {sessions.map(s => {
          const active = s.id === currentSessionId;
          return (
            <motion.button
              key={s.id}
              whileHover={{ x: 2 }}
              onClick={() => onSelect ? onSelect(s.id) : openExistingSession(s.id)}
              className={`w-full text-left p-3 rounded-lg flex items-start gap-2 transition-all ${
                active ? 'bg-primary/15 border-l-2 border-l-primary' : 'hover:bg-secondary/40'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-primary/60 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-ui text-foreground truncate">
                  {new Date(s.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {' · '}
                  {new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-[10px] text-muted-foreground capitalize mt-0.5 truncate">
                  {s.summary_emotion ?? 'New session'}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </aside>
  );
}
