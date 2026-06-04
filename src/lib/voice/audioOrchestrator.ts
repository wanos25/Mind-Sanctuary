/**
 * Global single-active-player orchestrator (Pass 2).
 *
 * Pass 1 introduced ownership tokens; Pass 2 extends the contract with:
 *   - Rich presence metadata (role / messageId / sessionId / startedAt)
 *   - Interruption reasons (user_action / new_owner / visibility / navigation /
 *     ended / unmount / external)
 *   - Bounded session-wide playback metrics (completion, interruptions,
 *     replays, resumes, total speaking ms)
 *   - O(1) active-speaker switching with no listener fan-out per frame
 *   - React-friendly subscription via useSyncExternalStore
 *
 * The module is framework-free at its core so it remains unit-testable and
 * reusable from non-React surfaces (diagnostics dashboard, future call mode).
 */

import { useSyncExternalStore } from 'react';

export type SpeakerRole = 'user' | 'assistant';

export type InterruptReason =
  | 'new_owner'
  | 'user_action'
  | 'visibility'
  | 'navigation'
  | 'ended'
  | 'unmount'
  | 'external';

export interface SpeakerPresence {
  token: string;
  role: SpeakerRole;
  messageId?: string;
  sessionId?: string;
  startedAt: number;
}

interface ActiveEntry extends SpeakerPresence {
  onPause: (reason: InterruptReason) => void;
}

let active: ActiveEntry | null = null;
const listeners = new Set<() => void>();

// ── Snapshot identity discipline ─────────────────────────────────────────
// `useSyncExternalStore` requires referential stability for unchanged
// snapshots, otherwise React tears. We freeze a single object per state.
let snapshot: SpeakerPresence | null = null;
function rebuildSnapshot() {
  snapshot = active
    ? {
        token: active.token,
        role: active.role,
        messageId: active.messageId,
        sessionId: active.sessionId,
        startedAt: active.startedAt,
      }
    : null;
}
function notify() {
  rebuildSnapshot();
  for (const l of listeners) {
    try { l(); } catch { /* listeners must not throw */ }
  }
}

// ── Session metrics (bounded) ────────────────────────────────────────────
interface SessionAudioMetrics {
  playbacksStarted: number;
  playbacksCompleted: number;
  interruptions: number;
  resumes: number;
  replays: number;
  assistantSpeakingMs: number;
  userSpeakingMs: number;
  lastInterruption?: InterruptReason;
}

const metrics: SessionAudioMetrics = {
  playbacksStarted: 0,
  playbacksCompleted: 0,
  interruptions: 0,
  resumes: 0,
  replays: 0,
  assistantSpeakingMs: 0,
  userSpeakingMs: 0,
};

export function getAudioMetricsSnapshot(): Readonly<SessionAudioMetrics> {
  return { ...metrics };
}

// ── Claim API ────────────────────────────────────────────────────────────
export interface ClaimOptions {
  token: string;
  role: SpeakerRole;
  messageId?: string;
  sessionId?: string;
  /** Called when the orchestrator needs this player to pause. */
  onPause: (reason: InterruptReason) => void;
}

export interface AudioClaim {
  token: string;
  isActive: () => boolean;
  /** Voluntarily release ownership. `reason` defaults to 'ended'. */
  release: (reason?: InterruptReason) => void;
}

export function claimAudio(opts: ClaimOptions): AudioClaim {
  const { token, role, messageId, sessionId, onPause } = opts;

  // Re-claim by same token = no-op (idempotent).
  if (active && active.token === token) {
    active.onPause = onPause;
    return makeHandle(token);
  }

  // Interrupt previous owner if any.
  if (active) {
    const elapsed = Date.now() - active.startedAt;
    if (active.role === 'assistant') metrics.assistantSpeakingMs += elapsed;
    else metrics.userSpeakingMs += elapsed;
    metrics.interruptions += 1;
    metrics.lastInterruption = 'new_owner';
    const prev = active;
    active = null; // clear before invoking pause to keep callbacks reentrant-safe
    try { prev.onPause('new_owner'); } catch { /* noop */ }
  }

  active = {
    token, role, messageId, sessionId,
    startedAt: Date.now(),
    onPause,
  };
  metrics.playbacksStarted += 1;
  notify();
  return makeHandle(token);
}

function makeHandle(token: string): AudioClaim {
  return {
    token,
    isActive: () => active?.token === token,
    release: (reason: InterruptReason = 'ended') => {
      if (!active || active.token !== token) return;
      const elapsed = Date.now() - active.startedAt;
      if (active.role === 'assistant') metrics.assistantSpeakingMs += elapsed;
      else metrics.userSpeakingMs += elapsed;
      if (reason === 'ended') metrics.playbacksCompleted += 1;
      else if (reason !== 'new_owner') {
        metrics.interruptions += 1;
        metrics.lastInterruption = reason;
      }
      active = null;
      notify();
    },
  };
}

export function notePlaybackResumed() { metrics.resumes += 1; }
export function noteReplay() { metrics.replays += 1; }

// ── Subscriptions ────────────────────────────────────────────────────────
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot(): SpeakerPresence | null { return snapshot; }
function getServerSnapshot(): SpeakerPresence | null { return null; }

/** Reactive snapshot of the currently speaking entity (or null). */
export function useActiveSpeaker(): SpeakerPresence | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Optimised boolean hook — re-renders only when this messageId transitions
 * in/out of active state. Cheaper than useActiveSpeaker() for per-bubble use.
 */
export function useIsActiveSpeaker(messageId: string | undefined): boolean {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return !!messageId && s?.messageId === messageId;
}

// ── Per-session playback-speed memory (sessionStorage) ───────────────────
const SPEED_KEY = 'voice.playbackSpeed';
export function recallPlaybackSpeed(sessionId?: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${SPEED_KEY}:${sessionId ?? 'global'}`);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}
export function rememberPlaybackSpeed(sessionId: string | undefined, speed: number) {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(`${SPEED_KEY}:${sessionId ?? 'global'}`, String(speed)); }
  catch { /* quota / private mode */ }
}

// ── Lifecycle integration (browser only) ─────────────────────────────────
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const releaseFor = (reason: InterruptReason) => {
    if (!active) return;
    const prev = active;
    try { prev.onPause(reason); } catch { /* noop */ }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') releaseFor('visibility');
  });
  window.addEventListener('pagehide', () => releaseFor('navigation'));
}
