/**
 * AI Presence — a tiny, framework-free state machine that tracks the
 * assistant's conversational presence: idle, listening, thinking, speaking.
 *
 * Pure in-memory. Not persisted. Replay-safe (replaying a session does not
 * leak into the live presence). No telemetry side-effects here; callers may
 * emit their own events at transition points.
 */

import { useSyncExternalStore } from 'react';

export type PresenceMode = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface PresenceSnapshot {
  mode: PresenceMode;
  /** Conversational energy 0..1 — rises during exchange bursts, decays in silence. */
  energy: number;
  /** Optional warmth dial 0..1 — externally set from personality/emotion engine. */
  warmth: number;
  /** ms since last mode transition (computed at read time). */
  sinceMs: number;
  changedAt: number;
}

interface InternalState {
  mode: PresenceMode;
  energy: number;
  warmth: number;
  changedAt: number;
}

const state: InternalState = {
  mode: 'idle',
  energy: 0.25,
  warmth: 0.6,
  changedAt: Date.now(),
};

let snap: PresenceSnapshot = {
  mode: state.mode,
  energy: state.energy,
  warmth: state.warmth,
  sinceMs: 0,
  changedAt: state.changedAt,
};

const listeners = new Set<() => void>();

function rebuild() {
  snap = {
    mode: state.mode,
    energy: state.energy,
    warmth: state.warmth,
    sinceMs: Date.now() - state.changedAt,
    changedAt: state.changedAt,
  };
}

function notify() {
  rebuild();
  for (const l of listeners) {
    try { l(); } catch { /* listeners must not throw */ }
  }
}

export function setPresenceMode(mode: PresenceMode) {
  if (state.mode === mode) return;
  state.mode = mode;
  state.changedAt = Date.now();
  // Energy reacts to mode changes (bounded).
  if (mode === 'speaking' || mode === 'listening') {
    state.energy = Math.min(1, state.energy + 0.18);
  } else if (mode === 'thinking') {
    state.energy = Math.min(1, state.energy + 0.08);
  } else {
    state.energy = Math.max(0, state.energy - 0.12);
  }
  notify();
}

export function bumpEnergy(delta = 0.1) {
  state.energy = Math.max(0, Math.min(1, state.energy + delta));
  notify();
}

export function setWarmth(value: number) {
  const v = Math.max(0, Math.min(1, value));
  if (Math.abs(v - state.warmth) < 0.01) return;
  state.warmth = v;
  notify();
}

export function getPresenceSnapshot(): PresenceSnapshot {
  rebuild();
  return snap;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAIPresence(): PresenceSnapshot {
  return useSyncExternalStore(subscribe, () => snap, () => snap);
}

// Gentle energy decay (~ every 10s) so the orb settles when nothing is happening.
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (state.mode !== 'idle') return;
    const next = Math.max(0.15, state.energy - 0.04);
    if (Math.abs(next - state.energy) < 0.001) return;
    state.energy = next;
    notify();
  }, 10_000);
}
