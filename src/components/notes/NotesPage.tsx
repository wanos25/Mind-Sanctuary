import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Check, Archive, Plus, Pencil, Trash2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import TopNav from '@/components/layout/TopNav';
import { toast } from 'sonner';

interface TherapistNote {
  id: string;
  patient_id: string;
  author_id: string;
  title: string;
  body: string;
  tags: string[];
  archived: boolean;
  read_at: string | null;
  created_at: string;
  updated_at?: string | null;
}

export default function NotesPage() {
  const { user } = useAuth();
  const { isDoctor } = useUserRole();
  const [notes, setNotes] = useState<TherapistNote[]>([]);
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id?: string; title: string; body: string } | null>(null);
  const [patientId, setPatientId] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const q = (supabase as typeof supabase & { from: (t: string) => ReturnType<typeof supabase.from> })
      .from('therapist_notes')
      .select('*')
      .order('created_at', { ascending: false });

    const filtered = isDoctor ? q : q.eq('patient_id', user.id).eq('archived', false);
    const { data, error } = await filtered;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as TherapistNote[];
    setNotes(rows);

    const authorIds = [...new Set(rows.map((n) => n.author_id))];
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, nickname, display_name, email')
        .in('user_id', authorIds);
      const map: Record<string, string> = {};
      (profiles ?? []).forEach((p) => {
        map[p.user_id] = p.nickname ?? p.display_name ?? p.email ?? 'Clinician';
      });
      setAuthorNames(map);
    }

    setLoading(false);
  }, [user, isDoctor]);

  useEffect(() => { load(); }, [load]);

  const unreadCount = useMemo(
    () => notes.filter((n) => !n.read_at && !isDoctor).length,
    [notes, isDoctor],
  );

  const markRead = async (id: string) => {
    const now = new Date().toISOString();
    const { error } = await (supabase as typeof supabase & { from: (t: string) => ReturnType<typeof supabase.from> })
      .from('therapist_notes')
      .update({ read_at: now })
      .eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: now } : n)));
  };

  const saveNote = async () => {
    if (!editing || !user) return;
    const title = editing.title.trim();
    const body = editing.body.trim();
    if (!title || !body) return;

    if (editing.id) {
      const { error } = await (supabase as typeof supabase & { from: (t: string) => ReturnType<typeof supabase.from> })
        .from('therapist_notes')
        .update({ title, body, updated_at: new Date().toISOString() })
        .eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const targetPatient = patientId.trim();
      if (!targetPatient) { toast.error('Patient user ID is required'); return; }
      const { error } = await (supabase as typeof supabase & { from: (t: string) => ReturnType<typeof supabase.from> })
        .from('therapist_notes')
        .insert({ title, body, author_id: user.id, patient_id: targetPatient });
      if (error) { toast.error(error.message); return; }
    }

    setEditing(null);
    setPatientId('');
    await load();
    toast.success('Saved');
  };

  const archive = async (id: string) => {
    const { error } = await (supabase as typeof supabase & { from: (t: string) => ReturnType<typeof supabase.from> })
      .from('therapist_notes')
      .update({ archived: true })
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as typeof supabase & { from: (t: string) => ReturnType<typeof supabase.from> })
      .from('therapist_notes')
      .delete()
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    await load();
  };

  const noteStatus = (n: TherapistNote) => {
    if (n.archived) return 'Archived';
    if (n.read_at) return 'Read';
    return 'New';
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display gold-text flex items-center gap-2">
              <FileText className="w-5 h-5" /> Therapist Notes
            </h1>
            {!isDoctor && unreadCount > 0 && (
              <p className="text-xs text-primary mt-1">{unreadCount} unread note{unreadCount === 1 ? '' : 's'}</p>
            )}
          </div>
          {isDoctor && (
            <button
              onClick={() => setEditing({ title: '', body: '' })}
              className="sentinel-btn flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" /> New note
            </button>
          )}
        </div>

        {editing && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-5 mb-6 space-y-3">
            {!editing.id && (
              <input
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="Patient user_id (UUID)"
                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm font-mono"
              />
            )}
            <input
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="Title"
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              value={editing.body}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              placeholder="Note body"
              rows={6}
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="sentinel-btn-outline text-sm">Cancel</button>
              <button onClick={saveNote} disabled={!editing.title || !editing.body} className="sentinel-btn text-sm disabled:opacity-30">
                Save
              </button>
            </div>
          </motion.div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : notes.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            No notes yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => {
              const status = noteStatus(n);
              return (
                <li
                  key={n.id}
                  className={`glass rounded-xl p-4 ${!isDoctor && !n.read_at ? 'border border-primary/30' : ''}`}
                  onClick={() => { if (!isDoctor && !n.read_at) markRead(n.id); }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-sm text-foreground flex items-center gap-2 flex-wrap">
                        {n.title}
                        <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${
                          status === 'New' ? 'text-primary border-primary/40 bg-primary/10' :
                          status === 'Read' ? 'text-muted-foreground border-border/50' :
                          'text-muted-foreground border-border/40'
                        }`}>
                          {status}
                        </span>
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{n.body}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/70 mt-2">
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {authorNames[n.author_id] ?? 'Clinician'}
                        </span>
                        <span>Created {new Date(n.created_at).toLocaleString()}</span>
                        {n.read_at && (
                          <span>Read {new Date(n.read_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {!isDoctor && !n.read_at && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                          title="Mark as read"
                          className="p-1.5 rounded-lg hover:bg-secondary/60"
                        >
                          <Check className="w-4 h-4 text-primary" />
                        </button>
                      )}
                      {isDoctor && n.author_id === user?.id && (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditing({ id: n.id, title: n.title, body: n.body })}
                            className="p-1.5 rounded-lg hover:bg-secondary/60"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => archive(n.id)} className="p-1.5 rounded-lg hover:bg-secondary/60">
                            <Archive className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => remove(n.id)} className="p-1.5 rounded-lg hover:bg-destructive/20">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
