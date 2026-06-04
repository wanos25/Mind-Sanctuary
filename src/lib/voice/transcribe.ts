import { supabase } from '@/integrations/supabase/client';
import { emitVoiceEvent } from './telemetry';

export async function transcribeVoice(
  blob: Blob,
  lang: string,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<string> {
  const audioBase64 = await blobToBase64(blob);
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const invokePromise = supabase.functions.invoke('transcribe-voice', {
    body: { audioBase64, mime: blob.type || 'audio/webm', lang },
  });
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<{ data: null; error: Error }>((resolve) => {
    timer = setTimeout(() => {
      emitVoiceEvent('stt_timeout', { lang, durationMs: timeoutMs });
      resolve({ data: null, error: new Error(`stt-timeout-${timeoutMs}ms`) });
    }, timeoutMs);
  });
  const aborted = new Promise<{ data: null; error: Error }>((resolve) => {
    if (!opts.signal) return;
    if (opts.signal.aborted) { resolve({ data: null, error: new Error('stt-aborted') }); return; }
    opts.signal.addEventListener('abort', () => resolve({ data: null, error: new Error('stt-aborted') }), { once: true });
  });
  const { data, error } = await Promise.race([invokePromise, timeout, aborted]);
  if (timer) clearTimeout(timer);
  if (error) throw error;
  const provider = (data?.provider ?? 'unknown').toString();
  emitVoiceEvent('stt_completed', {
    lang,
    durationMs: Number(data?.latencyMs) || undefined,
    meta: { provider },
  });
  return (data?.text ?? '').toString().trim();
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read audio'));
    reader.onload = () => {
      const result = reader.result?.toString() ?? '';
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.readAsDataURL(blob);
  });
}