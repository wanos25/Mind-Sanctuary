import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Sparkles, X, Menu, Search, ChevronDown, ChevronRight, MessageCircle, Pencil, Trash2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { listSessions, SessionRow } from '@/lib/sessions';
import { listChatsForSession, renameChat, deleteChat, ChatRow } from '@/lib/chats';
import { Skeleton } from '@/components/ui/skeleton';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';

interface Props {
  onNewChat: () => void;
  refreshKey?: number;
}

const STORAGE_KEY = 'mind-sentinel.sidebar.open';
const EXPANDED_KEY = 'mind-sentinel.sidebar.expanded';

type Group = 'today' | 'yesterday' | 'thisWeek' | 'older';

function groupOf(d: Date): Group {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const ts = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const day = 86400000;
  if (ts === today) return 'today';
  if (ts === today - day) return 'yesterday';
  if (ts > today - 7 * day) return 'thisWeek';
  return 'older';
}

export default function ChatSidebar({ onNewChat, refreshKey }: Props) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir(i18n.language) === 'rtl';
  const { user } = useAuth();
  const {
    currentSessionId, currentChatId,
    startNewSession, openExistingSession,
    openExistingChat, startNewChatInSession,
    setCurrentChatId,
  } = useApp();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Per-session lazy chats cache + expanded state (persisted).
  const [chatsBySession, setChatsBySession] = useState<Record<string, ChatRow[] | 'loading' | undefined>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(EXPANDED_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch { return new Set(); }
  });
  useEffect(() => {
    try { localStorage.setItem(EXPANDED_KEY, JSON.stringify(Array.from(expanded))); } catch { /* ignore */ }
  }, [expanded]);

  useLockBodyScroll(open);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setSessions(null);
    listSessions(user.id)
      .then((s) => { if (!cancelled) setSessions(s); })
      .catch(() => { if (!cancelled) setSessions([]); });
    return () => { cancelled = true; };
  }, [user, refreshKey, currentSessionId, currentChatId]);

  // Auto-expand the active session and lazy-load its chats.
  useEffect(() => {
    if (!currentSessionId) return;
    setExpanded((prev) => {
      if (prev.has(currentSessionId)) return prev;
      const next = new Set(prev); next.add(currentSessionId); return next;
    });
  }, [currentSessionId]);

  const loadChatsFor = useCallback((sessionId: string) => {
    setChatsBySession((prev) => {
      if (prev[sessionId] && prev[sessionId] !== 'loading') return prev;
      return { ...prev, [sessionId]: 'loading' };
    });
    listChatsForSession(sessionId)
      .then((rows) => setChatsBySession((prev) => ({ ...prev, [sessionId]: rows })))
      .catch(() => setChatsBySession((prev) => ({ ...prev, [sessionId]: [] })));
  }, []);

  // Trigger load whenever an expanded session lacks data.
  useEffect(() => {
    for (const sid of expanded) {
      if (chatsBySession[sid] === undefined) loadChatsFor(sid);
    }
  }, [expanded, chatsBySession, loadChatsFor]);

  // When a new chat is created (currentChatId changes), refresh its session's chats.
  useEffect(() => {
    if (currentSessionId && currentChatId) {
      loadChatsFor(currentSessionId);
    }
  }, [currentChatId, currentSessionId, loadChatsFor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, open ? '1' : '0'); } catch { /* ignore */ }
  }, [open]);

  const filtered = useMemo(() => {
    if (!sessions) return null;
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const summary = (s.summary_emotion ?? '').toLowerCase();
      const when = new Date(s.started_at).toLocaleString().toLowerCase();
      if (summary.includes(q) || when.includes(q)) return true;
      const chats = chatsBySession[s.id];
      if (Array.isArray(chats)) {
        return chats.some((c) =>
          (c.title ?? '').toLowerCase().includes(q) ||
          (c.summary_emotion ?? '').toLowerCase().includes(q),
        );
      }
      return false;
    });
  }, [sessions, query, chatsBySession]);

  const grouped = useMemo(() => {
    if (!filtered) return null;
    const buckets: Record<Group, SessionRow[]> = {
      'today': [], 'yesterday': [], 'thisWeek': [], 'older': [],
    };
    for (const s of filtered) buckets[groupOf(new Date(s.started_at))].push(s);
    return (Object.entries(buckets) as [Group, SessionRow[]][]).filter(([, list]) => list.length > 0);
  }, [filtered]);

  const closeMobile = () => setOpen(false);

  const toggleExpand = (sessionId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const commitRename = useCallback(async (sessionId: string, chatId: string) => {
    const next = renameValue.trim();
    setRenamingId(null);
    if (!next) return;
    const ok = await renameChat(chatId, next);
    if (ok) {
      setChatsBySession((prev) => {
        const list = prev[sessionId];
        if (!Array.isArray(list)) return prev;
        return { ...prev, [sessionId]: list.map((c) => c.id === chatId ? { ...c, title: next } : c) };
      });
    }
  }, [renameValue]);

  const handleDeleteChat = useCallback(async (sessionId: string, chatId: string) => {
    if (!window.confirm(t('chat.confirmDeleteChat'))) return;
    const ok = await deleteChat(chatId);
    if (!ok) return;
    setChatsBySession((prev) => {
      const list = prev[sessionId];
      if (!Array.isArray(list)) return prev;
      return { ...prev, [sessionId]: list.filter((c) => c.id !== chatId) };
    });
    if (currentChatId === chatId) {
      // Drop into the session's latest remaining chat, or clear chat id.
      setCurrentChatId(null);
    }
  }, [t, currentChatId, setCurrentChatId]);

  const renderChat = (sessionId: string, c: ChatRow) => {
    const active = c.id === currentChatId;
    const title = c.title?.trim() || c.summary_emotion || t('chat.untitledChat');
    const sub = new Date(c.last_message_at ?? c.created_at).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
    const isRenaming = renamingId === c.id;
    return (
      <div
        key={c.id}
        className={`group w-full py-2 rounded-md flex items-start gap-2 transition-all ${
          isRtl ? 'pr-8 pl-2' : 'pl-8 pr-2'
        } ${active
          ? 'bg-primary/15 border border-primary/30'
          : 'hover:bg-secondary/40 border border-transparent'}`}
      >
        <MessageCircle className={`w-3 h-3 mt-0.5 flex-shrink-0 ${active ? 'text-primary' : 'text-primary/40'}`} />
        {isRenaming ? (
          <div className="min-w-0 flex-1 flex items-center gap-1">
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename(sessionId, c.id); }
                if (e.key === 'Escape') { e.preventDefault(); setRenamingId(null); }
              }}
              onBlur={() => commitRename(sessionId, c.id)}
              className="min-w-0 flex-1 bg-background/60 border border-primary/40 rounded px-1.5 py-0.5 text-[11px] font-ui text-foreground focus:outline-none"
              maxLength={120}
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commitRename(sessionId, c.id)}
              className="p-1 rounded text-primary/80 hover:text-primary"
              aria-label={t('common.save')}
            >
              <Check className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => { openExistingChat(sessionId, c.id); closeMobile(); }}
              className="min-w-0 flex-1 text-start"
            >
              <p className="text-[11px] font-ui text-foreground truncate">{title}</p>
              <p className="text-[9px] text-muted-foreground/80 truncate">
                {sub}{c.message_count ? ` · ${c.message_count}` : ''}
              </p>
            </button>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setRenameValue(c.title ?? ''); setRenamingId(c.id); }}
                className="p-1 rounded hover:bg-primary/15 text-muted-foreground/70 hover:text-primary"
                aria-label={t('chat.renameChat')}
                title={t('chat.renameChat')}
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDeleteChat(sessionId, c.id); }}
                className="p-1 rounded hover:bg-destructive/15 text-muted-foreground/70 hover:text-destructive"
                aria-label={t('chat.deleteChat')}
                title={t('chat.deleteChat')}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderSession = (s: SessionRow) => {
    const active = s.id === currentSessionId;
    const isExpanded = expanded.has(s.id);
    const chats = chatsBySession[s.id];
    return (
      <div key={s.id} className="space-y-0.5">
        <motion.div
          whileHover={{ x: isRtl ? -3 : 3 }}
          className={`w-full text-start p-2.5 rounded-lg flex items-start gap-2 transition-all relative ${
            active
              ? 'bg-primary/12 border border-primary/30 shadow-[0_0_18px_-4px_hsl(var(--gold)/0.45)]'
              : 'hover:bg-secondary/40 border border-transparent'
          }`}
        >
          <button
            type="button"
            onClick={() => toggleExpand(s.id)}
            className="mt-0.5 text-muted-foreground/70 hover:text-foreground transition-colors"
            aria-label={isExpanded ? t('chat.collapseChats') : t('chat.expandChats')}
          >
            {isExpanded
              ? <ChevronDown className="w-3 h-3" />
              : (isRtl ? <ChevronRight className="w-3 h-3 rotate-180" /> : <ChevronRight className="w-3 h-3" />)}
          </button>
          <button
            type="button"
            onClick={() => { openExistingSession(s.id); closeMobile(); }}
            className="min-w-0 flex-1 flex items-start gap-2 text-start"
          >
            <MessageSquare
              className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${active ? 'text-primary' : 'text-primary/50'}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-ui text-foreground truncate">
                {new Date(s.started_at).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                {' · '}
                {new Date(s.started_at).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize mt-0.5 truncate">
                {s.summary_emotion ?? t('chat.newConversation')}
                {s.summary_intensity != null && ` · ${Math.round((s.summary_intensity ?? 0) * 100)}%`}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); startNewChatInSession(s.id); closeMobile(); }}
            className="mt-0.5 p-1 rounded hover:bg-primary/15 text-primary/70 hover:text-primary transition-colors"
            aria-label={t('chat.newChatInSession')}
            title={t('chat.newChatInSession')}
          >
            <Plus className="w-3 h-3" />
          </button>
          {active && (
            <motion.span
              layoutId="active-session-dot"
              className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shadow-[0_0_8px_hsl(var(--gold))]"
            />
          )}
        </motion.div>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="space-y-0.5 py-0.5">
                {chats === 'loading' || chats === undefined ? (
                  <div className="space-y-1 px-2">
                    <Skeleton className="h-7 w-full rounded-md bg-secondary/30" />
                    <Skeleton className="h-7 w-3/4 rounded-md bg-secondary/30" />
                  </div>
                ) : chats.length === 0 ? (
                  <p className={`text-[10px] text-muted-foreground/70 py-1 ${isRtl ? 'pr-8' : 'pl-8'}`}>
                    {t('chat.noChatsYet')}
                  </p>
                ) : (
                  chats.map((c) => renderChat(s.id, c))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const handleNewChat = () => {
    if (currentSessionId) startNewChatInSession(currentSessionId);
    else startNewSession();
    onNewChat();
    closeMobile();
  };

  const content = (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border/30 space-y-2">
        <button
          onClick={handleNewChat}
          className="sentinel-btn-outline w-full text-xs py-2.5 flex items-center justify-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> {t('common.newChat')}
        </button>
        <button
          onClick={() => { startNewSession(); closeMobile(); }}
          className="sentinel-btn w-full text-xs py-2.5 flex items-center justify-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5" /> {t('common.newSession')}
        </button>
        <div className="relative pt-1">
          <Search className={`w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 text-muted-foreground/60 ${isRtl ? 'right-3' : 'left-3'}`} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('chat.searchSessions')}
            className={`w-full bg-secondary/30 border border-border/40 rounded-lg text-xs font-ui py-2 focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50 ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sessions === null && (
          <div className="space-y-2 px-2 mt-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg bg-secondary/30" />
            ))}
          </div>
        )}

        {sessions !== null && grouped && grouped.length === 0 && (
          <div className="px-3 py-10 text-center">
            <MessageSquare className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">
              {query ? t('chat.noMatches') : t('chat.noConversations')}
            </p>
          </div>
        )}

        {grouped?.map(([label, list]) => (
          <div key={label} className="mb-3">
            <p className="text-[10px] font-ui tracking-[0.25em] text-muted-foreground/80 uppercase px-3 py-2">
              {t(`chat.${label}`)}
            </p>
            <div className="space-y-1">{list.map(renderSession)}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid="chat-sidebar-toggle"
        className={`md:hidden fixed top-4 z-30 glass-strong p-2.5 rounded-xl border border-border/40 ${
          isRtl ? 'right-4' : 'left-4'
        }`}
        aria-label={t('chat.openSessions')}
      >
        <Menu className="w-4 h-4 text-foreground" />
      </button>

      <aside
        data-testid="chat-sidebar"
        className={`hidden md:flex w-[280px] glass-strong flex-col flex-shrink-0 ${
          isRtl ? 'border-l border-border/30' : 'border-r border-border/30'
        }`}
      >
        {content}
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMobile}
              className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-md"
            />
            <motion.aside
              initial={{ x: isRtl ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? '100%' : '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className={`md:hidden fixed top-0 bottom-0 z-50 w-[85vw] max-w-[320px] glass-strong flex flex-col ${
                isRtl ? 'right-0 border-l border-border/30' : 'left-0 border-r border-border/30'
              }`}
              role="dialog"
              aria-modal="true"
              aria-label={t('chat.sessionsTitle')}
            >
              <button
                onClick={closeMobile}
                className={`absolute top-3 p-2 rounded-lg hover:bg-secondary/50 z-10 ${
                  isRtl ? 'left-3' : 'right-3'
                }`}
                aria-label={t('common.close')}
              >
                <X className="w-4 h-4" />
              </button>
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
