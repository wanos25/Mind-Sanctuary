import { supabase } from '@/integrations/supabase/client';
import { emitVoiceEvent } from './telemetry';
import { createChatAttachmentSignedUrl } from '@/lib/storage/chatAttachments';

export interface UploadedVoice {
  url: string;
  path: string;
  duration: number;
  waveform: number[];
  mime: string;
}

// Reuse `chat-attachments` bucket (private; access via signed URLs).
export const MAX_VOICE_BYTES = 8 * 1024 * 1024;

export async function uploadVoiceMessage(
  blob: Blob,
  userId: string,
  duration: number,
  waveform: number[],
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<UploadedVoice> {
  if (blob.size > MAX_VOICE_BYTES) {
    throw new Error('voice_file_too_large');
  }
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  const path = `${userId}/voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const uploadPromise = supabase.storage
    .from('chat-attachments')
    .upload(path, blob, { contentType: blob.type, upsert: false });
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<{ error: Error }>((resolve) => {
    timer = setTimeout(() => {
      emitVoiceEvent('upload_timeout', { bytes: blob.size, durationMs: timeoutMs });
      resolve({ error: new Error(`upload-timeout-${timeoutMs}ms`) });
    }, timeoutMs);
  });
  const aborted = new Promise<{ error: Error }>((resolve) => {
    if (!opts.signal) return;
    if (opts.signal.aborted) {
      emitVoiceEvent('upload_aborted', { bytes: blob.size });
      resolve({ error: new Error('upload-aborted') });
      return;
    }
    opts.signal.addEventListener('abort', () => {
      emitVoiceEvent('upload_aborted', { bytes: blob.size });
      resolve({ error: new Error('upload-aborted') });
    }, { once: true });
  });
  const race = await Promise.race([uploadPromise, timeout, aborted]);
  if (timer) clearTimeout(timer);
  if ('error' in race && race.error) throw race.error;

  const signedUrl = await createChatAttachmentSignedUrl(path);
  return { url: signedUrl ?? path, path, duration, waveform, mime: blob.type };
}

// ─── Inline voice payload encoded into chat_messages.content ───
const VOICE_TAG = '\u0001VOICE\u0001';

export interface VoicePayload {
  url?: string;
  path?: string;
  duration: number;
  waveform: number[];
  transcript: string;
  pending?: boolean;
}

export function encodeVoiceContent(p: VoicePayload): string {
  const meta = JSON.stringify({
    url: p.url,
    path: p.path,
    duration: p.duration,
    waveform: p.waveform,
    pending: p.pending,
  });
  return `${p.transcript || '[Voice message]'}${VOICE_TAG}${meta}`;
}

export function parseVoiceContent(content: string): { text: string; voice: Omit<VoicePayload, 'transcript'> | null } {
  const idx = content.indexOf(VOICE_TAG);
  if (idx < 0) return { text: content, voice: null };
  const text = content.slice(0, idx);
  try {
    const meta = JSON.parse(content.slice(idx + VOICE_TAG.length));
    return { text, voice: { url: meta.url, path: meta.path, duration: meta.duration || 0, waveform: meta.waveform || [], pending: !!meta.pending } };
  } catch {
    return { text, voice: null };
  }
}

// ─── Reflection marker (used by assistant softer responses) ───
export const REFLECTION_TAG = '\u0001REFLECT\u0001';
export function encodeReflection(text: string) { return `${REFLECTION_TAG}${text}`; }
export function isReflection(content: string) { return content.startsWith(REFLECTION_TAG); }
export function reflectionText(content: string) { return content.slice(REFLECTION_TAG.length); }
