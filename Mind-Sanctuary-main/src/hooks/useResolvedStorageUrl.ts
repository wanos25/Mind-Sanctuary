import { useEffect, useState } from 'react';
import { resolveChatAttachmentAccessUrl } from '@/lib/storage/chatAttachments';

/**
 * Resolves chat-attachment public URLs to signed URLs after bucket hardening.
 */
export function useResolvedStorageUrl(
  url: string | undefined,
  path?: string | null,
): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(url);

  useEffect(() => {
    let cancelled = false;
    if (!url && !path) {
      setResolved(undefined);
      return;
    }
    void resolveChatAttachmentAccessUrl(url, { path }).then((next) => {
      if (!cancelled) setResolved(next ?? url);
    });
    return () => { cancelled = true; };
  }, [url, path]);

  return resolved;
}
