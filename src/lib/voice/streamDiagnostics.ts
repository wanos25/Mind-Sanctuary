/**
 * Lightweight streaming diagnostics store. Subscribed to by the diagnostics
 * overlay. No PHI is captured — only timings, counts, statuses.
 */
export type StreamLifecycle =
  | 'idle'
  | 'connecting'
  | 'first_chunk'
  | 'streaming'
  | 'completed'
  | 'aborted'
  | 'errored'
  | 'timeout';

export interface StreamSnapshot {
  id: string;
  state: StreamLifecycle;
  startedAt: number;
  firstChunkAt: number | null;
  endedAt: number | null;
  chunkCount: number;
  lastChunkAt: number | null;
  avgChunkIntervalMs: number | null;
  totalChars: number;
  httpStatus: number | null;
  model: string | null;
  provider: string | null;
  retryCount: number;
  reason: string | null;
}

type Listener = (snaps: StreamSnapshot[]) => void;

const MAX = 12;
const snaps: StreamSnapshot[] = [];
const listeners = new Set<Listener>();

function emit() { listeners.forEach((l) => l([...snaps])); }

export function subscribeStreams(l: Listener): () => void {
  listeners.add(l);
  l([...snaps]);
  return () => { listeners.delete(l); };
}

export function getStreams(): StreamSnapshot[] { return [...snaps]; }

export function beginStream(id: string, meta?: { model?: string; provider?: string; retryCount?: number }): StreamSnapshot {
  const s: StreamSnapshot = {
    id,
    state: 'connecting',
    startedAt: performance.now(),
    firstChunkAt: null,
    endedAt: null,
    chunkCount: 0,
    lastChunkAt: null,
    avgChunkIntervalMs: null,
    totalChars: 0,
    httpStatus: null,
    model: meta?.model ?? null,
    provider: meta?.provider ?? null,
    retryCount: meta?.retryCount ?? 0,
    reason: null,
  };
  snaps.unshift(s);
  while (snaps.length > MAX) snaps.pop();
  emit();
  return s;
}

export function patchStream(id: string, patch: Partial<StreamSnapshot>) {
  const s = snaps.find((x) => x.id === id);
  if (!s) return;
  Object.assign(s, patch);
  emit();
}

export function recordChunk(id: string, chars: number) {
  const s = snaps.find((x) => x.id === id);
  if (!s) return;
  const now = performance.now();
  s.chunkCount += 1;
  s.totalChars += chars;
  if (!s.firstChunkAt) {
    s.firstChunkAt = now;
    s.state = 'streaming';
  }
  if (s.lastChunkAt != null) {
    const interval = now - s.lastChunkAt;
    const n = s.chunkCount - 1;
    s.avgChunkIntervalMs = s.avgChunkIntervalMs == null ? interval : (s.avgChunkIntervalMs * (n - 1) + interval) / Math.max(1, n);
  }
  s.lastChunkAt = now;
  emit();
}

export function endStream(id: string, state: StreamLifecycle, reason?: string) {
  const s = snaps.find((x) => x.id === id);
  if (!s) return;
  s.state = state;
  s.endedAt = performance.now();
  if (reason) s.reason = reason;
  emit();
}

export function isDiagnosticsEnabled(): boolean {
  try {
    if (import.meta.env.DEV) return true;
    return localStorage.getItem('diag.stream') === '1';
  } catch { return false; }
}
