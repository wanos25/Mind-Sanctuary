/**
 * H1 — Exponential backoff retry helper. Additive, opt-in.
 * Does NOT auto-rewrite existing call sites. Classification helpers below.
 */
export type RetryClass = 'transient' | 'permanent' | 'aborted';

export interface RetryOptions {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  jitter?: boolean;
  signal?: AbortSignal;
  classify?: (err: unknown) => RetryClass;
  onAttempt?: (attempt: number, err: unknown) => void;
}

const defaultClassify = (err: unknown): RetryClass => {
  const e = err as { name?: string; code?: string | number; status?: number; message?: string };
  if (e?.name === 'AbortError') return 'aborted';
  if (e?.code === 'TIMEOUT') return 'transient';
  const status = typeof e?.status === 'number' ? e.status : 0;
  if (status === 408 || status === 429 || (status >= 500 && status <= 599)) return 'transient';
  if (status >= 400 && status < 500) return 'permanent';
  // network-level fetch failures land here
  if (/network|fetch|load failed/i.test(e?.message ?? '')) return 'transient';
  return 'transient';
};

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const retries = opts.retries ?? 2;
  const baseMs = opts.baseMs ?? 300;
  const maxMs = opts.maxMs ?? 4000;
  const classify = opts.classify ?? defaultClassify;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      return await fn(attempt);
    } catch (err) {
      const kind = classify(err);
      opts.onAttempt?.(attempt, err);
      if (kind !== 'transient' || attempt >= retries) throw err;
      const delay = Math.min(maxMs, baseMs * 2 ** attempt);
      const jitter = opts.jitter === false ? 0 : Math.random() * delay * 0.25;
      await new Promise((r) => setTimeout(r, delay + jitter));
      attempt += 1;
    }
  }
}
