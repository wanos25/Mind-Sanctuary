/**
 * H1 — Unified error notification pipeline.
 * Classifies errors into a stable shape, mirrors to console in dev, and
 * optionally surfaces a toast. Production-safe: never throws, never blocks.
 */
import { toast } from '@/hooks/use-toast';

export type ErrorSeverity = 'info' | 'warn' | 'error' | 'fatal';

export interface NotifyOptions {
  scope: string;
  severity?: ErrorSeverity;
  /** User-visible message. Omit to suppress toast. */
  userMessage?: string;
  /** Extra fields for diagnostics; never shown to user. */
  meta?: Record<string, unknown>;
  silent?: boolean;
}

interface NormalizedError {
  scope: string;
  severity: ErrorSeverity;
  message: string;
  code?: string;
  at: number;
  meta?: Record<string, unknown>;
}

const DEV = !!import.meta.env?.DEV;
const ring: NormalizedError[] = [];
const MAX = 100;

export function notifyError(err: unknown, opts: NotifyOptions): void {
  try {
    const e = err as { name?: string; code?: string | number; message?: string };
    const normalized: NormalizedError = {
      scope: opts.scope,
      severity: opts.severity ?? 'error',
      message: e?.message ?? String(err ?? 'unknown error'),
      code: e?.code != null ? String(e.code) : e?.name,
      at: Date.now(),
      meta: opts.meta,
    };
    ring.push(normalized);
    if (ring.length > MAX) ring.splice(0, ring.length - MAX);

    if (DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[notifyError:${normalized.scope}]`, normalized);
    }

    if (!opts.silent && opts.userMessage) {
      toast({
        title: opts.userMessage,
        description: DEV ? normalized.message : undefined,
        variant: normalized.severity === 'info' ? 'default' : 'destructive',
      });
    }
  } catch {
    /* notifier must never throw */
  }
}

export function snapshotErrors(): NormalizedError[] {
  return ring.slice();
}
