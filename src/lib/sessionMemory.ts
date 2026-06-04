import { useEffect, useRef } from 'react';

const DRAFT_PREFIX = 'mind-sentinel.draft.';
const SCROLL_PREFIX = 'mind-sentinel.scroll.';

export function loadDraft(sessionId: string | null): string {
  if (!sessionId) return '';
  try { return localStorage.getItem(DRAFT_PREFIX + sessionId) ?? ''; } catch { return ''; }
}

export function saveDraft(sessionId: string | null, value: string) {
  if (!sessionId) return;
  try {
    if (value.trim()) localStorage.setItem(DRAFT_PREFIX + sessionId, value);
    else localStorage.removeItem(DRAFT_PREFIX + sessionId);
  } catch { /* ignore */ }
}

export function loadScroll(sessionId: string | null): number {
  if (!sessionId) return 0;
  try { return Number(localStorage.getItem(SCROLL_PREFIX + sessionId)) || 0; } catch { return 0; }
}

export function saveScroll(sessionId: string | null, top: number) {
  if (!sessionId) return;
  try { localStorage.setItem(SCROLL_PREFIX + sessionId, String(Math.round(top))); } catch { /* ignore */ }
}

/** Persist scroll position per session with throttled writes. */
export function useSessionScrollMemory(
  sessionId: string | null,
  scrollRef: React.RefObject<HTMLElement>,
) {
  const tRef = useRef<number | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !sessionId) return;
    const onScroll = () => {
      if (tRef.current) window.clearTimeout(tRef.current);
      tRef.current = window.setTimeout(() => saveScroll(sessionId, el.scrollTop), 220);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (tRef.current) window.clearTimeout(tRef.current);
    };
  }, [sessionId, scrollRef]);
}
