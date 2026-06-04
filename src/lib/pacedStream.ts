/**
 * pacedStream — wraps a streaming onDelta consumer to release tokens at a
 * human-feeling cadence: variable speed, punctuation pauses, and a tiny
 * hesitation before emotionally-sensitive openings.
 *
 * Pure presentation layer. Does NOT touch the network, the backend, or the
 * shape of streamChat. It only buffers what the model already produced and
 * releases it visually with breathing-like timing.
 */

export interface PacedOptions {
  /** Base ms-per-character. Lower = faster. */
  baseCharMs?: number;
  /** Random jitter (+/-) applied per char. */
  jitter?: number;
  /** Extra pause after sentence-ending punctuation. */
  sentencePauseMs?: number;
  /** Extra pause after commas / semicolons. */
  clausePauseMs?: number;
  /** Initial hesitation if the response opens with a sensitive cue. */
  sensitiveLeadMs?: number;
  /** Cap so very long bursts don't backlog. */
  maxQueueChars?: number;
}

const SENSITIVE_CUES = [
  'i hear', 'i\'m sorry', 'that sounds', 'it\'s okay', 'it makes sense',
  'i understand', 'take your time', 'you\'re not alone',
];

export function createPacedDelta(
  realOnDelta: (chunk: string) => void,
  opts: PacedOptions = {},
) {
  const baseCharMs = opts.baseCharMs ?? 14;
  const jitter = opts.jitter ?? 6;
  const sentencePause = opts.sentencePauseMs ?? 180;
  const clausePause = opts.clausePauseMs ?? 70;
  const sensitiveLead = opts.sensitiveLeadMs ?? 380;
  const maxQueue = opts.maxQueueChars ?? 1200;

  let queue = '';
  let released = '';
  let running = false;
  let stopped = false;
  let leadApplied = false;
  let resolveDone: (() => void) | null = null;
  let donePromise: Promise<void> | null = null;

  const tick = async () => {
    if (running) return;
    running = true;
    while (!stopped && queue.length) {
      // If queue grows huge, accelerate to catch up.
      const speedup = queue.length > 200 ? 0.35 : queue.length > 80 ? 0.6 : 1;

      // Initial hesitation for emotionally sensitive openings.
      if (!leadApplied && released.length === 0 && queue.length >= 12) {
        leadApplied = true;
        const head = queue.slice(0, 40).toLowerCase();
        if (SENSITIVE_CUES.some((c) => head.includes(c))) {
          await wait(sensitiveLead);
          if (stopped) break;
        }
      }

      const ch = queue[0];
      queue = queue.slice(1);
      released += ch;
      realOnDelta(ch);

      let delay = (baseCharMs + (Math.random() * 2 - 1) * jitter) * speedup;
      if (ch === '.' || ch === '!' || ch === '?') delay += sentencePause * speedup;
      else if (ch === ',' || ch === ';' || ch === ':') delay += clausePause * speedup;
      else if (ch === '\n') delay += clausePause * 1.5 * speedup;

      await wait(Math.max(0, delay));
    }
    running = false;
    if (stopped || queue.length === 0) {
      resolveDone?.();
      resolveDone = null;
    }
  };

  return {
    /** Feed a model chunk into the paced queue. */
    push(chunk: string) {
      if (stopped) return;
      queue += chunk;
      // Hard cap — drop excess silently to keep memory bounded.
      if (queue.length > maxQueue) queue = queue.slice(-maxQueue);
      void tick();
    },
    /** Returns a promise that resolves when the queue has fully drained. */
    flush(): Promise<void> {
      if (!queue.length && !running) return Promise.resolve();
      if (!donePromise) {
        donePromise = new Promise<void>((res) => { resolveDone = res; });
      }
      void tick();
      return donePromise;
    },
    /** Immediately deliver everything remaining and stop. */
    finishNow() {
      if (queue.length) {
        realOnDelta(queue);
        released += queue;
        queue = '';
      }
      stopped = true;
      resolveDone?.();
      resolveDone = null;
    },
    cancel() {
      stopped = true;
      queue = '';
      resolveDone?.();
      resolveDone = null;
    },
  };
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
