import { sbExt } from '@/lib/supabaseExt';
import type { ActivityKind, ActivityContent } from './types';

export interface ActivityTemplate {
  id: string;
  created_by: string;
  kind: ActivityKind;
  title: string;
  description: string | null;
  content: ActivityContent;
  is_shared: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export async function listTemplates(): Promise<ActivityTemplate[]> {
  const { data, error } = await sbExt
    .from('activity_templates')
    .select('*')
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    if ((error as { code?: string }).code === '42P01') return [];
    throw error;
  }
  return (data ?? []) as ActivityTemplate[];
}

export async function saveTemplate(input: {
  created_by: string;
  kind: ActivityKind;
  title: string;
  description?: string;
  content: ActivityContent;
  is_shared?: boolean;
}): Promise<ActivityTemplate> {
  const { data, error } = await sbExt
    .from('activity_templates')
    .insert([{
      created_by: input.created_by,
      kind: input.kind,
      title: input.title,
      description: input.description ?? null,
      content: input.content,
      is_shared: input.is_shared ?? false,
    }])
    .select()
    .single();
  if (error) throw error;
  return data as ActivityTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await sbExt
    .from('activity_templates')
    .update({ archived: true })
    .eq('id', id);
  if (error) throw error;
}

/* ----------------------- local draft autosave ----------------------- */
const DRAFT_KEY = 'lov.activity.draft.v1';
export interface ActivityDraft {
  kind: ActivityKind;
  title: string;
  description: string;
  content: ActivityContent;
  savedAt: string;
}
export function saveDraftLocal(draft: ActivityDraft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* quota */ }
}
export function loadDraftLocal(): ActivityDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) as ActivityDraft : null;
  } catch { return null; }
}
export function clearDraftLocal() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
}