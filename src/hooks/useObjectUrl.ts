/**
 * Refcounted object-URL hook — Phase R1 reliability.
 *
 * Multiple components can call useObjectUrl(blob) with the same Blob and share
 * a single URL; the URL is only revoked when the last consumer unmounts. This
 * eliminates the race where a replay started just before unmount tries to fetch
 * an already-revoked URL.
 */
import { useEffect, useMemo } from 'react';
import { emitVoiceEvent } from '@/lib/voice/telemetry';

interface Entry { url: string; refs: number }
const registry = new WeakMap<Blob, Entry>();

export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const url = useMemo(() => {
    if (!blob) return null;
    const existing = registry.get(blob);
    if (existing) { existing.refs += 1; return existing.url; }
    const created = URL.createObjectURL(blob);
    registry.set(blob, { url: created, refs: 1 });
    emitVoiceEvent('objecturl_created', { bytes: blob.size });
    return created;
  }, [blob]);

  useEffect(() => {
    return () => {
      if (!blob) return;
      const entry = registry.get(blob);
      if (!entry) return;
      entry.refs -= 1;
      if (entry.refs <= 0) {
        try { URL.revokeObjectURL(entry.url); } catch { /* */ }
        registry.delete(blob);
        emitVoiceEvent('objecturl_revoked', { bytes: blob.size });
      }
    };
  }, [blob]);

  return url;
}