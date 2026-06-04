/**
 * Central voice telemetry bus. Replaces ad-hoc console.logs scattered across
 * SessionChat, recorder, upload, tts. Pass A: in-memory ring buffer + optional
 * console mirror in dev. Pass C will wire this into a DB sink + diag panel.
 */

export type VoiceEventName =
  | 'recording_started'
  | 'recording_completed'
  | 'recording_failed'
  | 'upload_started'
  | 'upload_completed'
  | 'upload_failed'
  | 'stt_started'
  | 'stt_completed'
  | 'stt_failed'
  | 'tts_started'
  | 'tts_completed'
  | 'tts_failed'
  | 'waveform_generated'
  | 'autoplay_started'
  | 'autoplay_blocked'
  | 'autoplay_failed'
  | 'pipeline_retry'
  | 'pipeline_recovered'
  | 'persist_meta_completed'
  | 'persist_meta_failed'
  // Pass B — UX-level events
  | 'action_copy'
  | 'action_share'
  | 'action_like'
  | 'action_dislike'
  | 'action_reply'
  | 'replay_voice'
  | 'waveform_scrub'
  | 'playback_speed_changed'
  | 'reply_navigate'
  // Pass 2 — global audio intelligence
  | 'playback_started'
  | 'playback_interrupted'
  | 'playback_resumed'
  | 'playback_completed'
  | 'playback_visibility_paused'
  | 'playback_focus_released'
  | 'active_speaker_changed'
  | 'assistant_speaking_started'
  | 'assistant_speaking_completed'
  // Pass 3 — composer / recording UX
  | 'recording_locked'
  | 'recording_paused'
  | 'recording_resumed'
  | 'recording_cancelled'
  | 'recording_discarded'
  | 'waveform_capture_started'
  | 'waveform_capture_completed'
  // Pass 4 — cinematic streaming + chat surface
  | 'stream_started'
  | 'first_token_rendered'
  | 'stream_completed'
  | 'auto_scroll_interrupted'
  | 'unread_marker_shown'
  | 'jump_to_latest_used'
  | 'grouped_message_rendered'
  | 'speaking_indicator_started'
  | 'speaking_indicator_completed'
  // Pass R1 — real-device + network reliability
  | 'recording_interrupted'
  | 'mic_reacquired'
  | 'mic_device_changed'
  | 'upload_aborted'
  | 'upload_timeout'
  | 'stt_timeout'
  | 'tts_timeout'
  | 'stall_detected'
  | 'objecturl_created'
  | 'objecturl_revoked'
  | 'autoplay_recovery';

export interface VoiceEvent {
  name: VoiceEventName;
  at: number;
  durationMs?: number;
  messageId?: string;
  sessionId?: string;
  lang?: string;
  bytes?: number;
  retries?: number;
  errorCode?: string;
  meta?: Record<string, unknown>;
}

type Listener = (e: VoiceEvent) => void;

const MAX_EVENTS = 200;
const buffer: VoiceEvent[] = [];
const listeners = new Set<Listener>();
const DEV = typeof import.meta !== 'undefined' && !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;

export function emitVoiceEvent(name: VoiceEventName, payload: Omit<VoiceEvent, 'name' | 'at'> = {}) {
  const evt: VoiceEvent = { name, at: Date.now(), ...payload };
  buffer.push(evt);
  if (buffer.length > MAX_EVENTS) buffer.splice(0, buffer.length - MAX_EVENTS);
  if (DEV) {
    // Tagged so it's easy to filter, never noisy at info level.
    console.debug('[voice-telemetry]', evt.name, evt);
  }
  for (const l of listeners) {
    try { l(evt); } catch { /* listeners must not throw */ }
  }
}

export function onVoiceEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function snapshotVoiceTelemetry(): VoiceEvent[] {
  return buffer.slice();
}

/** Convenience wrapper for timing a block. Resolves with the value AND emits start/complete/fail. */
export async function timed<T>(
  name: { start: VoiceEventName; ok: VoiceEventName; fail: VoiceEventName },
  base: Omit<VoiceEvent, 'name' | 'at' | 'durationMs'>,
  fn: () => Promise<T>,
): Promise<T> {
  const t0 = Date.now();
  emitVoiceEvent(name.start, base);
  try {
    const out = await fn();
    emitVoiceEvent(name.ok, { ...base, durationMs: Date.now() - t0 });
    return out;
  } catch (e) {
    emitVoiceEvent(name.fail, {
      ...base,
      durationMs: Date.now() - t0,
      errorCode: (e as Error)?.message?.slice(0, 200),
    });
    throw e;
  }
}
