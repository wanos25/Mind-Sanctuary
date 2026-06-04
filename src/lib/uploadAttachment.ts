import { supabase } from '@/integrations/supabase/client';
import { createChatAttachmentSignedUrl } from '@/lib/storage/chatAttachments';

export interface UploadedAttachment {
  url: string;
  path: string;
  name: string;
  size: number;
  type: string;
}

const ACCEPTED = [
  'image/', 'application/pdf', 'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/** 10 MB — aligns with typical Supabase storage limits per object */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function isAccepted(file: File): boolean {
  return ACCEPTED.some((t) => file.type.startsWith(t));
}

export function validateAttachmentFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const blocked = ['exe', 'bat', 'cmd', 'sh', 'js', 'html', 'svg'];
  if (blocked.includes(ext)) return 'blocked_extension';
  if (!isAccepted(file)) return 'unsupported_type';
  if (file.size > MAX_ATTACHMENT_BYTES) return 'file_too_large';
  return null;
}

export async function uploadChatAttachment(
  file: File,
  userId: string,
  onProgress?: (pct: number) => void,
  opts?: { chatId?: string | null; sessionId?: string | null },
): Promise<UploadedAttachment> {
  const validation = validateAttachmentFile(file);
  if (validation) {
    throw new Error(validation === 'file_too_large' ? 'File exceeds 10 MB limit' : 'File type not allowed');
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Organize storage paths by chat when known, falling back to session, then
  // user-root for legacy callers. The resulting URL is persisted on
  // chat_messages.content, so chat ownership is already enforced via the
  // chat_id column on the message row; the path prefix is for ops/auditing.
  const scope = opts?.chatId
    ? `${userId}/chats/${opts.chatId}`
    : opts?.sessionId
      ? `${userId}/sessions/${opts.sessionId}`
      : `${userId}`;
  const path = `${scope}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  onProgress?.(10);
  const { error } = await supabase.storage
    .from('chat-attachments')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  onProgress?.(90);

  const signedUrl = await createChatAttachmentSignedUrl(path);
  onProgress?.(100);

  return {
    url: signedUrl ?? path,
    path,
    name: file.name,
    size: file.size,
    type: file.type,
  };
}
