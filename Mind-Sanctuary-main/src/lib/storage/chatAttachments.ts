import { supabase } from '@/integrations/supabase/client';

export const CHAT_ATTACHMENTS_BUCKET = 'chat-attachments';

/** Signed URL lifetime (7 days — refresh on display if needed). */
export const CHAT_ATTACHMENT_SIGNED_TTL_SEC = 60 * 60 * 24 * 7;

const PUBLIC_PATH_RE = /\/storage\/v1\/object\/public\/chat-attachments\/(.+)$/i;
const SIGN_PATH_RE = /\/storage\/v1\/object\/sign\/chat-attachments\/([^?]+)/i;

/** Extract storage object path from a public/signed Supabase URL or return raw path. */
export function extractChatAttachmentPath(urlOrPath: string): string | null {
  if (!urlOrPath) return null;
  const trimmed = urlOrPath.trim();
  if (!trimmed.includes('://') && !trimmed.startsWith('/')) {
    return trimmed.replace(/^\/+/, '');
  }
  try {
    const u = new URL(trimmed);
    const pub = u.pathname.match(PUBLIC_PATH_RE);
    if (pub?.[1]) return decodeURIComponent(pub[1]);
    const sign = u.pathname.match(SIGN_PATH_RE);
    if (sign?.[1]) return decodeURIComponent(sign[1]);
  } catch {
    /* not a URL */
  }
  return null;
}

export function isChatAttachmentStorageRef(urlOrPath: string): boolean {
  if (!urlOrPath) return false;
  if (!urlOrPath.includes('://')) return true;
  return urlOrPath.includes('/chat-attachments/');
}

/** Create a time-limited signed URL for a bucket object path. */
export async function createChatAttachmentSignedUrl(
  path: string,
  expiresIn = CHAT_ATTACHMENT_SIGNED_TTL_SEC,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) {
    console.warn('[storage] signed URL failed', { path, error: error.message });
    return null;
  }
  return data.signedUrl;
}

/**
 * Resolve a stored URL or path to an access URL for the current session.
 * Non–chat-attachment URLs are returned unchanged.
 */
export async function resolveChatAttachmentAccessUrl(
  urlOrPath: string | undefined | null,
  opts?: { path?: string | null },
): Promise<string | null> {
  if (!urlOrPath && !opts?.path) return null;
  const path = opts?.path?.trim() || (urlOrPath ? extractChatAttachmentPath(urlOrPath) : null);
  if (path && isChatAttachmentStorageRef(urlOrPath ?? path)) {
    const signed = await createChatAttachmentSignedUrl(path);
    if (signed) return signed;
  }
  return urlOrPath ?? null;
}
