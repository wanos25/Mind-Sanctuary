import { sbExt } from '@/lib/supabaseExt';

function isVideoProgressUnavailable(error: unknown): boolean {
  const e = error as { code?: string; message?: string; status?: number };
  const msg = (e.message ?? '').toLowerCase();
  return (
    e.status === 404
    || e.code === '42P01'
    || e.code === 'PGRST205'
    || msg.includes('video_watch_progress')
    || msg.includes('could not find the table')
  );
}

export interface VideoProgressRow {
  id: string;
  user_id: string;
  asset_id: string;
  video_item_id: string;
  position_sec: number;
  duration_sec: number | null;
  completed: boolean;
  updated_at: string;
}

export async function getProgressForAsset(userId: string, assetId: string): Promise<VideoProgressRow[]> {
  const { data, error } = await sbExt
    .from('video_watch_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('asset_id', assetId);
  if (error) {
    if (isVideoProgressUnavailable(error)) return [];
    throw error;
  }
  return (data ?? []) as VideoProgressRow[];
}

export async function listContinueWatching(userId: string, limit = 8): Promise<VideoProgressRow[]> {
  const { data, error } = await sbExt
    .from('video_watch_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', false)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (isVideoProgressUnavailable(error)) return [];
    throw error;
  }
  return (data ?? []) as VideoProgressRow[];
}

export async function upsertProgress(input: {
  user_id: string;
  asset_id: string;
  video_item_id: string;
  position_sec: number;
  duration_sec?: number;
  completed?: boolean;
}): Promise<void> {
  const payload = {
    user_id: input.user_id,
    asset_id: input.asset_id,
    video_item_id: input.video_item_id,
    position_sec: Math.max(0, input.position_sec),
    duration_sec: input.duration_sec ?? null,
    completed: input.completed ?? false,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sbExt
    .from('video_watch_progress')
    .upsert([payload], { onConflict: 'user_id,asset_id,video_item_id' });
  if (error && !isVideoProgressUnavailable(error)) throw error;
}