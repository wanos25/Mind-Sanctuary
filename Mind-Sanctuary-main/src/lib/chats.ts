/**
 * Chats helpers — additive layer over the new
 * sessions → chats → messages hierarchy (migration 11_chats_hierarchy.sql).
 *
 * The `chats` table is not yet present in the auto-generated Supabase types,
 * so we go through `sbExt` to avoid manual edits to `src/integrations/supabase/types.ts`.
 *
 * Backend lock: fsterbxivhhzipfgpvou. Do not switch backends here.
 */
import { sbExt } from '@/lib/supabaseExt';

export interface ChatRow {
  id: string;
  session_id: string;
  user_id: string;
  title: string | null;
  summary_emotion: string | null;
  summary_intensity: number | null;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

/** List all chats for a session, newest activity first. */
export async function listChatsForSession(sessionId: string): Promise<ChatRow[]> {
  const { data, error } = await sbExt
    .from('chats')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChatRow[];
}

/** Create a new chat inside an existing session. */
export async function createChat(
  sessionId: string,
  userId: string,
  title?: string | null,
): Promise<string | null> {
  const { data, error } = await sbExt
    .from('chats')
    .insert({ session_id: sessionId, user_id: userId, title: title ?? null })
    .select('id')
    .single();
  if (error) return null;
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Return the most recent chat for a session, creating one if none exists.
 * Triggers in the migration backfill one chat per legacy session, so this
 * is normally just a lookup. Falls back to insert on missing rows.
 */
export async function ensureLatestChatForSession(
  sessionId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await sbExt
    .from('chats')
    .select('id')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1);
  const existing = (data as Array<{ id: string }> | null)?.[0]?.id ?? null;
  if (existing) return existing;
  return createChat(sessionId, userId, null);
}

/** Rename a chat. RLS enforces ownership; safe to call from any owner. */
export async function renameChat(chatId: string, title: string): Promise<boolean> {
  const clean = (title ?? '').trim().slice(0, 120);
  const { error } = await sbExt
    .from('chats')
    .update({ title: clean || null })
    .eq('id', chatId);
  return !error;
}

/**
 * Delete a chat. ON DELETE CASCADE on chat_messages.chat_id removes any
 * linked messages (set up in 11_chats_hierarchy.sql).
 */
export async function deleteChat(chatId: string): Promise<boolean> {
  const { error } = await sbExt.from('chats').delete().eq('id', chatId);
  return !error;
}

