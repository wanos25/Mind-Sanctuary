import { sbExt } from '@/lib/supabaseExt';
import type { ActivityAsset, ActivityKind, ActivityContent } from './types';

export async function listPublishedAssets(kind?: ActivityKind): Promise<ActivityAsset[]> {
  let q = sbExt
    .from('activity_assets')
    .select('*')
    .eq('published', true)
    .eq('archived', false)
    .order('created_at', { ascending: false });
  if (kind) q = q.eq('kind', kind);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ActivityAsset[];
}

export async function listAllAssets(): Promise<ActivityAsset[]> {
  const { data, error } = await sbExt
    .from('activity_assets')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ActivityAsset[];
}

export async function createAsset(input: {
  kind: ActivityKind;
  title: string;
  description?: string;
  content: ActivityContent;
  locale?: string;
  published?: boolean;
}): Promise<ActivityAsset> {
  const { data, error } = await sbExt
    .from('activity_assets')
    .insert([
      {
        kind: input.kind,
        title: input.title,
        description: input.description ?? null,
        content: input.content,
        locale: input.locale ?? 'en',
        published: input.published ?? false,
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return data as ActivityAsset;
}

export async function updateAsset(
  id: string,
  patch: Partial<Pick<ActivityAsset, 'title' | 'description' | 'content' | 'published' | 'archived' | 'locale'>>
): Promise<void> {
  const { error } = await sbExt.from('activity_assets').update(patch).eq('id', id);
  if (error) throw error;
}

export async function archiveAsset(id: string): Promise<void> {
  return updateAsset(id, { archived: true, published: false });
}
