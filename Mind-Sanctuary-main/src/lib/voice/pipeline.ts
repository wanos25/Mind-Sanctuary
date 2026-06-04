/**
 * Production voice orchestration pipeline (Pass A).
 *
 * Single authoritative entry point for:
 *   - sendUserVoice          (upload + STT + persist meta)
 *   - generateAssistantVoice (paraphrase TTS + upload + persist meta)
 *   - persistVoiceMeta       (re-exported from ./persistence)
 *
 * Pass A scope:
 *   - structured telemetry on every stage
 *   - retry with exponential backoff for transient network failures
 *   - waveform compression to 80 peaks (WhatsApp-style)
 *   - schema-adapter persistence (columns when available, encoded fallback otherwise)
 *
 * Pass B/C will layer UI status, reply threading, and diag panel on top of
 * these primitives without changing their signatures.
 */
import { uploadVoiceMessage, type UploadedVoice } from './upload';
import { transcribeVoice } from './transcribe';
import { generateVoiceReply, uploadAssistantVoice, type VoiceReply } from './voiceReply';
import {
  compressWaveform,
  persistVoiceMeta,
  type VoiceMetaPayload,
} from './persistence';
import { emitVoiceEvent, timed } from './telemetry';

// ── Retry helper ─────────────────────────────────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts: number; baseDelayMs: number; label: string; sessionId?: string; messageId?: string },
): Promise<{ value: T; retries: number }> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt < opts.attempts) {
    try {
      const value = await fn();
      if (attempt > 0) {
        emitVoiceEvent('pipeline_recovered', {
          sessionId: opts.sessionId,
          messageId: opts.messageId,
          retries: attempt,
          meta: { label: opts.label },
        });
      }
      return { value, retries: attempt };
    } catch (e) {
      lastErr = e;
      attempt += 1;
      if (attempt >= opts.attempts) break;
      emitVoiceEvent('pipeline_retry', {
        sessionId: opts.sessionId,
        messageId: opts.messageId,
        retries: attempt,
        errorCode: (e as Error)?.message?.slice(0, 120),
        meta: { label: opts.label },
      });
      const delay = opts.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 120;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function mimeForBlob(blob: Blob): string {
  return blob.type || 'audio/webm';
}

// ── sendUserVoice ────────────────────────────────────────────────────────
export interface SendUserVoiceInput {
  blob: Blob;
  duration: number;          // seconds (best-effort, from recorder)
  waveform: number[];        // raw recorder peaks
  userId: string;
  sessionId: string;
  lang: string;
  /** Optional client-side transcript hint (e.g. Web Speech) — server STT wins if present. */
  clientTranscript?: string;
}

export interface SendUserVoiceResult {
  upload: UploadedVoice;
  transcript: string;
  waveform: number[];        // compressed 80-peak
  durationSec: number;
  metrics: { uploadMs: number; sttMs: number; retries: number };
  /** Ready-to-persist payload for the chat_messages row. */
  persist: VoiceMetaPayload;
}

/**
 * Upload + transcribe in parallel; both are independent network calls.
 * Telemetry is emitted per stage so the diag panel (Pass C) can see exactly
 * where latency lives.
 */
export async function sendUserVoice(input: SendUserVoiceInput): Promise<SendUserVoiceResult> {
  emitVoiceEvent('recording_completed', {
    sessionId: input.sessionId,
    lang: input.lang,
    bytes: input.blob.size,
    durationMs: Math.round(input.duration * 1000),
  });

  const compressedWaveform = compressWaveform(input.waveform);
  emitVoiceEvent('waveform_generated', {
    sessionId: input.sessionId,
    meta: { peaks: compressedWaveform.length, source: 'recorder' },
  });

  const uploadTask = timed(
    { start: 'upload_started', ok: 'upload_completed', fail: 'upload_failed' },
    { sessionId: input.sessionId, bytes: input.blob.size },
    () => withRetry(
      () => uploadVoiceMessage(input.blob, input.userId, input.duration, compressedWaveform),
      { attempts: 3, baseDelayMs: 400, label: 'user-voice-upload', sessionId: input.sessionId },
    ),
  );

  const sttTask = timed(
    { start: 'stt_started', ok: 'stt_completed', fail: 'stt_failed' },
    { sessionId: input.sessionId, lang: input.lang },
    () => withRetry(
      () => transcribeVoice(input.blob, input.lang),
      // STT failures are usually content-driven (silence, unsupported lang) — keep retries low.
      { attempts: 2, baseDelayMs: 600, label: 'stt', sessionId: input.sessionId },
    ),
  );

  const [uploadSettled, sttSettled] = await Promise.allSettled([uploadTask, sttTask]);

  if (uploadSettled.status === 'rejected') {
    throw uploadSettled.reason instanceof Error ? uploadSettled.reason : new Error('upload-failed');
  }
  const upload = uploadSettled.value.value;
  const uploadRetries = uploadSettled.value.retries;

  let transcript = (input.clientTranscript ?? '').trim();
  let sttRetries = 0;
  if (sttSettled.status === 'fulfilled') {
    const serverTranscript = sttSettled.value.value.trim();
    if (serverTranscript) transcript = serverTranscript;
    sttRetries = sttSettled.value.retries;
  }

  const durationSec = upload.duration || input.duration || 0;
  const persist: VoiceMetaPayload = {
    voice_url: upload.url,
    voice_mime: upload.mime || mimeForBlob(input.blob),
    voice_duration_ms: Math.round(durationSec * 1000),
    voice_size_bytes: input.blob.size,
    voice_waveform: compressedWaveform,
    voice_status: 'ready',
    voice_generation_source: 'user_record',
    voice_metrics: {
      uploadMs: 0, // populated by caller from telemetry snapshot if needed
      sttMs: 0,
      retries: uploadRetries + sttRetries,
    },
    stt_transcript: transcript || null,
    stt_language: input.lang,
  };

  return {
    upload,
    transcript,
    waveform: compressedWaveform,
    durationSec,
    metrics: { uploadMs: 0, sttMs: 0, retries: uploadRetries + sttRetries },
    persist,
  };
}

// ── generateAssistantVoice ───────────────────────────────────────────────
export interface GenerateAssistantVoiceInput {
  text: string;
  lang: string;
  emotion?: string;
  gender?: string;
  userId: string;
  sessionId: string;
  /** Optional id of the existing assistant chat row to persist meta onto. */
  messageId?: string;
}

export interface GenerateAssistantVoiceResult {
  reply: VoiceReply;
  url: string;
  storagePath: string;
  waveform: number[];
  durationSec: number;
  persist: VoiceMetaPayload;
}

export async function generateAssistantVoice(
  input: GenerateAssistantVoiceInput,
): Promise<GenerateAssistantVoiceResult> {
  const ttsResult = await timed(
    { start: 'tts_started', ok: 'tts_completed', fail: 'tts_failed' },
    { sessionId: input.sessionId, lang: input.lang, messageId: input.messageId },
    () => withRetry(
      async () => {
        const r = await generateVoiceReply({ text: input.text, lang: input.lang, emotion: input.emotion, gender: input.gender });
        if (!r) throw new Error('tts-empty');
        return r;
      },
      { attempts: 3, baseDelayMs: 500, label: 'tts', sessionId: input.sessionId, messageId: input.messageId },
    ),
  );

  const reply = ttsResult.value;
  const ttsRetries = ttsResult.retries;
  const compressedWaveform = compressWaveform(reply.waveform);
  emitVoiceEvent('waveform_generated', {
    sessionId: input.sessionId,
    messageId: input.messageId,
    meta: { peaks: compressedWaveform.length, source: 'assistant-tts' },
  });

  const uploadResult = await timed(
    { start: 'upload_started', ok: 'upload_completed', fail: 'upload_failed' },
    { sessionId: input.sessionId, messageId: input.messageId, bytes: reply.audioBlob.size },
    () => withRetry(
      async () => {
        const uploaded = await uploadAssistantVoice(reply.audioBlob, input.userId);
        if (!uploaded) throw new Error('assistant-upload-failed');
        return uploaded;
      },
      { attempts: 3, baseDelayMs: 400, label: 'assistant-voice-upload', sessionId: input.sessionId, messageId: input.messageId },
    ),
  );
  const uploaded = uploadResult.value;
  const url = uploaded.url;
  const storagePath = uploaded.path;
  const uploadRetries = uploadResult.retries;

  const durationSec = reply.duration || 0;
  const persist: VoiceMetaPayload = {
    voice_url: url,
    voice_mime: reply.audioBlob.type || 'audio/mpeg',
    voice_duration_ms: Math.round(durationSec * 1000),
    voice_size_bytes: reply.audioBlob.size,
    voice_waveform: compressedWaveform,
    voice_status: 'ready',
    voice_generation_source: 'assistant_tts',
    voice_metrics: { retries: ttsRetries + uploadRetries },
    stt_transcript: reply.paraphrase,
    stt_language: input.lang,
  };

  return { reply, url, storagePath, waveform: compressedWaveform, durationSec, persist };
}

// Re-exports so callers only import the pipeline.
export { persistVoiceMeta } from './persistence';
export { compressWaveform, readVoiceMeta, getSchemaAdapterState } from './persistence';
export type { VoiceMetaPayload, VoiceMetrics, VoiceStatus, VoiceSource, NormalizedVoice } from './persistence';
