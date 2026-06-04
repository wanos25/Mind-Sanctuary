import { useEffect, useState } from 'react';
import { StickyNote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Note {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

interface Props {
  chatId: string | null;
  sessionId: string | null;
  userId: string | null;
}

/**
 * Inline therapist-note preview cards rendered at the top of a chat.
 * Read-only for the patient. Falls back to session-pinned notes when no
 * chat-pinned notes exist. Silent on errors (RLS will simply return [] for
 * users who shouldn't see anything).
 */
export default function SessionNotesInline({ chatId, sessionId, userId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const base = (supabase as any).from('therapist_notes')
        .select('id, title, body, created_at')
        .eq('patient_id', userId)
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .limit(3);
      const filter = chatId
        ? base.eq('chat_id', chatId)
        : sessionId
          ? base.eq('session_id', sessionId)
          : base.is('chat_id', null).is('session_id', null);
      const { data, error } = await filter;
      if (cancelled || error) return;
      setNotes((data ?? []) as Note[]);
    })();
    return () => { cancelled = true; };
  }, [chatId, sessionId, userId]);

  if (notes.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {notes.map(n => (
        <div
          key={n.id}
          className="rounded-lg border border-accent/30 bg-accent/5 backdrop-blur-sm p-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <StickyNote className="w-3.5 h-3.5 text-accent" />
            <p className="text-xs font-medium text-accent uppercase tracking-wider">
              {n.title}
            </p>
            <span className="text-[10px] text-muted-foreground ms-auto tabular-nums">
              {new Date(n.created_at).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {n.body}
          </p>
        </div>
      ))}
    </div>
  );
}
