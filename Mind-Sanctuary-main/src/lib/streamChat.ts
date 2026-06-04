import {
  beginStream,
  patchStream,
  recordChunk,
  endStream,
  type StreamLifecycle,
} from '@/lib/voice/streamDiagnostics';
import { supabase } from '@/integrations/supabase/client';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const MAX_MESSAGES = 80;
const MAX_MESSAGE_CHARS = 12_000;
const MAX_SYSTEM_ADDENDA = 8;

export type ChatMsg = { role: 'user' | 'assistant'; content: string };

interface MemoryItem {
  topic: string;
  emotion_pattern?: string;
  context?: string;
}

export interface StreamLifecycleEvent {
  state: StreamLifecycle;
  streamId: string;
  httpStatus?: number;
  reason?: string;
  retryCount?: number;
}

interface StreamChatParams {
  messages: ChatMsg[];
  interviewContext?: Record<string, string>;
  emotionState?: { primary: string; intensity: number; sentiment: number; distortions: string[] };
  memories?: MemoryItem[];
  systemAddenda?: string[];
  userProfile?: { gender?: string; nickname?: string; preferredLanguage?: string };
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
  onLifecycle?: (e: StreamLifecycleEvent) => void;
  signal?: AbortSignal;
  /** Stalled-stream timeout (ms) since last chunk. Default 25s. */
  stallTimeoutMs?: number;
  /** Internal — retry count for diagnostics. */
  _retryCount?: number;
  streamId?: string;
}

const DEFAULT_MODEL = 'google/gemini-2.5-flash';

export async function streamChat(params: StreamChatParams) {
  const {
    messages, interviewContext, emotionState, memories, systemAddenda, userProfile,
    onDelta, onDone, onError, onLifecycle, signal,
    stallTimeoutMs = 25_000,
    _retryCount = 0,
  } = params;

  if (messages.length > MAX_MESSAGES) {
    onError('Conversation too long — start a new chat');
    return;
  }
  const totalChars = messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
  if (totalChars > MAX_MESSAGE_CHARS * MAX_MESSAGES) {
    onError('Message payload too large');
    return;
  }
  if ((systemAddenda?.length ?? 0) > MAX_SYSTEM_ADDENDA) {
    onError('Context limit exceeded');
    return;
  }

  const streamId = params.streamId ?? `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  beginStream(streamId, { model: DEFAULT_MODEL, provider: 'lovable-ai-gateway', retryCount: _retryCount });
  const fire = (state: StreamLifecycle, extra?: Partial<StreamLifecycleEvent>) =>
    onLifecycle?.({ state, streamId, retryCount: _retryCount, ...extra });
  fire('connecting');

  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  const resetStall = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      endStream(streamId, 'timeout', `stalled>${stallTimeoutMs}ms`);
      fire('timeout', { reason: `stalled>${stallTimeoutMs}ms` });
      try { (resp as any)?.body?.cancel?.(); } catch { /* noop */ }
      onError('Stream stalled');
    }, stallTimeoutMs);
  };

  let resp: Response;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
      endStream(streamId, 'errored', 'no-session');
      fire('errored', { reason: 'no-session' });
      onError('Not signed in');
      return;
    }

    resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ messages, interviewContext, emotionState, memories, systemAddenda, userProfile }),
      signal,
    });
  } catch (e: unknown) {
    const aborted = (e as { name?: string })?.name === 'AbortError';
    endStream(streamId, aborted ? 'aborted' : 'errored', aborted ? 'fetch-abort' : 'fetch-failed');
    fire(aborted ? 'aborted' : 'errored', { reason: aborted ? 'fetch-abort' : 'fetch-failed' });
    if (!aborted) onError('Network error');
    return;
  }

  patchStream(streamId, { httpStatus: resp.status });

  if (!resp.ok) {
    endStream(streamId, 'errored', `http-${resp.status}`);
    fire('errored', { httpStatus: resp.status, reason: `http-${resp.status}` });
    if (resp.status === 429) return onError('Rate limit exceeded. Please wait a moment.');
    if (resp.status === 402) return onError('AI credits depleted. Please add credits.');
    return onError('AI service temporarily unavailable');
  }
  if (!resp.body) {
    endStream(streamId, 'errored', 'no-body');
    fire('errored', { reason: 'no-body' });
    return onError('No response stream');
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let done = false;
  let sawFirst = false;
  resetStall();

  const processLine = (raw: string) => {
    let line = raw;
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (line.startsWith(':') || line.trim() === '') return;
    if (!line.startsWith('data: ')) return;
    const json = line.slice(6).trim();
    if (json === '[DONE]') { done = true; return; }
    try {
      const parsed = JSON.parse(json);
      const content = parsed.choices?.[0]?.delta?.content as string | undefined;
      if (content) {
        if (!sawFirst) {
          sawFirst = true;
          fire('first_chunk');
        }
        recordChunk(streamId, content.length);
        resetStall();
        onDelta(content);
      }
    } catch { /* swallow parse */ }
  };

  try {
    while (!done) {
      if (signal?.aborted) {
        try { await reader.cancel(); } catch { /* noop */ }
        break;
      }
      const { done: rdone, value } = await reader.read();
      if (rdone) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        processLine(line);
        if (done) break;
      }
    }
    if (buf.trim()) for (const r of buf.split('\n')) if (r) processLine(r);
  } catch (e: unknown) {
    if (stallTimer) clearTimeout(stallTimer);
    const aborted = (e as { name?: string })?.name === 'AbortError' || signal?.aborted;
    endStream(streamId, aborted ? 'aborted' : 'errored', aborted ? 'reader-abort' : 'reader-failed');
    fire(aborted ? 'aborted' : 'errored', { reason: aborted ? 'reader-abort' : 'reader-failed' });
    if (!aborted) onError('Stream interrupted');
    return;
  }

  if (stallTimer) clearTimeout(stallTimer);
  endStream(streamId, 'completed', 'done');
  fire('completed');
  onDone();
}
