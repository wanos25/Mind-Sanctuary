/**
 * H1 — Reliability primitives.
 * Additive utility. Wraps a promise with a timeout that rejects with a
 * tagged `TimeoutError` so callers can classify and retry.
 */
export class TimeoutError extends Error {
  readonly code = 'TIMEOUT';
  constructor(public readonly ms: number, label?: string) {
    super(`${label ?? 'operation'} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label?: string,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new TimeoutError(ms, label));
    }, ms);

    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }

    promise.then(
      (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        signal?.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        signal?.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}
