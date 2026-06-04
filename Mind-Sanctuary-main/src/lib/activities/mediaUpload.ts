import { supabase } from '@/integrations/supabase/client';

export interface UploadedMedia {
  path: string;
  publicUrl: string;
  size: number;
  mime: string;
}

const BUCKET = 'activity-media';

export async function uploadActivityMedia(
  file: File,
  opts: { kind: string; folder?: string }
): Promise<UploadedMedia> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? 'anon';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const ts = Date.now();
  const path = `${opts.kind}/${uid}/${opts.folder ?? 'misc'}/${ts}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl, size: file.size, mime: file.type };
}

export async function deleteActivityMedia(path: string): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
