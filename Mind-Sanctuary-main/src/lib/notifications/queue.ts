/**
 * R6 foundation — read-only helper. No worker/provider wired yet.
 */
import { sbExt } from '@/lib/supabaseExt';

export interface NotificationQueueItem {
  id: string;
  user_id: string;
  channel: string;
  payload: Record<string, unknown>;
  scheduled_for: string;
  status: string;
  created_at: string;
}

export async function listOwnQueue(userId: string): Promise<NotificationQueueItem[]> {
  const { data, error } = await sbExt
    .from('notification_queue')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as NotificationQueueItem[];
}
