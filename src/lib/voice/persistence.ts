/**
 * Voice persistence adapter.
 *
 * Schema-adapter strategy: try the new normalized columns first; if they do
 * not exist yet (Postgres 42703 "undefined column"), silently no-op the
 * column write. The inline VOICE_TAG payload in `chat_messages.content`
 * remains the read-path source of truth until the migration ships, so
 * dropping the column write does not lose data.
 *
 * When the columns ARE present, every voice message gets durable, structured
 * metadata that survives reload without re-decoding the encoded blob.
 */
import { supabase } from '@/integrations/supabase/client';
import { emitVoiceEvent } from './telemetry';

// ── Waveform compression ─────────────────────────────────────────────────
// WhatsApp-style: ≤ 80 peaks normalized 0..1. Source arrays may be longer
// (recorder ~120, decoded audio thousands). We bucket-max into 80.
export const WAVEFORM_PEAKS = 80;

export function compressWaveform(input: ArrayLike<number> | number[], target = WAVEFORM_PEAKS): number[] {
  const n = input.length;
  if (n === 0) return [];
  if (n <= target) {
    // Pad-out short arrays so renderer is deterministic (no jitter on short clips).
    const out: number[] = [];
    for (let i = 0; i < target; i++) {
      const idx = Math.min(n - 1, Math.floor((i / target) * n));
      out.push(clamp01(input[idx]));
    }
    return normalize(out);
  }
  const bucket = n / target;
  const out: number[] = new Array(target);
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * bucket);
    const end = Math.min(n, Math.floor((i + 1) * bucket));
    let peak = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(input[j]);
      if (v > peak) peak = v;
    }
    out[i] = clamp01(peak);
  }
  return normalize(out);
}

function clamp01(v: number): number {
  if (!isFinite(v) || v < 0) return 0;
  return v > 1 ? 1 : v;
}

function normalize(arr: number[]): number[] {
  const max = arr.reduce((a, b) => (b > a ? b : a), 0);
  if (max <= 0) return arr.map(() => 0.04);
  if (max >= 0.85) return arr.map((v) => Math.max(0.04, v));
  const scale = 0.9 / max;
  return arr.map((v) => Math.max(0.04, Math.min(1, v * scale)));
}

// ── Persisted metadata shape ─────────────────────────────────────────────
export type VoiceStatus = 'queued' | 'uploading' | 'stt' | 'ready' | 'failed';
export type VoiceSource = 'user_record' | 'assistant_tts';

export interface VoiceMetrics {
  uploadMs?: number;
  sttMs?: number;
  ttsMs?: number;
  decodeMs?: number;
  retries?: number;
  // C2 extensions — stored in same JSONB column, no migration needed.
  recordingMs?: number;
  thinkMs?: number;
  totalRoundtripMs?: number;
  waveformGenerationMs?: number;
  transcriptConfidence?: number;
  transcriptLanguage?: string;
  autoplayResult?: 'success' | 'blocked' | 'failed' | 'skipped';
}

export interface VoiceMetaPayload {
  voice_url?: string | null;
  voice_mime?: string | null;
  voice_duration_ms?: number | null;
  voice_size_bytes?: number | null;
  voice_waveform?: number[] | null;
  voice_status?: VoiceStatus | null;
  voice_generation_source?: VoiceSource | null;
  voice_metrics?: VoiceMetrics | null;
  stt_transcript?: string | null;
  stt_language?: string | null;
}

let columnsAvailable: boolean | null = null;

/**
 * Persist normalized voice metadata onto a chat_messages row. Safe to call
 * even when the migration has not been applied — it will detect the missing
 * columns once and become a no-op thereafter.
 */
export async function persistVoiceMeta(
  messageId: string,
  meta: VoiceMetaPayload,
): Promise<{ persisted: boolean; reason?: string }> {
  if (!messageId) return { persisted: false, reason: 'no-message-id' };
  if (columnsAvailable === false) return { persisted: false, reason: 'schema-not-migrated' };

  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v !== undefined) payload[k] = v;
  }
  if (Object.keys(payload).length === 0) return { persisted: false, reason: 'empty-payload' };

  try {
    const { error } = await supabase.from('chat_messages').update(payload as never).eq('id', messageId);
    if (error) {
      // 42703 = undefined_column. Mark columns unavailable so we stop retrying.
      const code = (error as { code?: string }).code;
      if (code === '42703' || /column .* does not exist/i.test(error.message ?? '')) {
        columnsAvailable = false;
        emitVoiceEvent('persist_meta_failed', { messageId, errorCode: 'schema-not-migrated' });
        return { persisted: false, reason: 'schema-not-migrated' };
      }
      emitVoiceEvent('persist_meta_failed', { messageId, errorCode: error.message?.slice(0, 120) });
      return { persisted: false, reason: error.message };
    }
    columnsAvailable = true;
    emitVoiceEvent('persist_meta_completed', { messageId, meta: { status: meta.voice_status, src: meta.voice_generation_source } });
    return { persisted: true };
  } catch (e) {
    emitVoiceEvent('persist_meta_failed', { messageId, errorCode: (e as Error).message?.slice(0, 120) });
    return { persisted: false, reason: (e as Error).message };
  }
}

/**
 * Read durable waveform/duration/url from a chat_messages row when the
 * normalized columns are populated. Returns null if the row only has the
 * legacy encoded payload (caller should fall back to parseVoiceContent).
 */
export interface NormalizedVoice {
  url?: string;
  durationSec: number;
  waveform: number[];
  mime?: string;
  status: VoiceStatus;
  source: VoiceSource | null;
  transcript?: string;
}

interface MaybeVoiceRow {
  voice_url?: string | null;
  voice_mime?: string | null;
  voice_duration_ms?: number | null;
  voice_waveform?: unknown;
  voice_status?: string | null;
  voice_generation_source?: string | null;
  stt_transcript?: string | null;
}

export function readVoiceMeta(row: unknown): NormalizedVoice | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as MaybeVoiceRow;
  const wf = r.voice_waveform;
  const hasAny = r.voice_url != null || (Array.isArray(wf) && wf.length > 0) || r.voice_status != null;
  if (!hasAny) return null;
  const waveform = Array.isArray(wf) ? (wf as unknown[]).map((n) => (typeof n === 'number' ? n : 0)) : [];
  return {
    url: r.voice_url ?? undefined,
    durationSec: (r.voice_duration_ms ?? 0) / 1000,
    waveform,
    mime: r.voice_mime ?? undefined,
    status: ((r.voice_status as VoiceStatus) ?? 'ready'),
    source: (r.voice_generation_source as VoiceSource) ?? null,
    transcript: r.stt_transcript ?? undefined,
  };
}

/** Lightweight liveness probe used by diag panels. */
export function getSchemaAdapterState(): 'unknown' | 'columns-present' | 'columns-missing' {
  if (columnsAvailable === null) return 'unknown';
  return columnsAvailable ? 'columns-present' : 'columns-missing';
}

// Re-export supabase here so the pipeline can use a single import target.
export { supabase };
