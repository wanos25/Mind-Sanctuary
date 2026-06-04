/**
 * Production error capture — in-memory ring + structured console.
 * Wire to Sentry/Datadog by forwarding `snapshotGlobalErrors()` in your host.
 */
import { notifyError } from '@/lib/reliability/notifyError';

export type GlobalErrorKind = 'react-boundary' | 'window-error' | 'unhandled-rejection';

export interface CapturedError {
  kind: GlobalErrorKind;
  message: string;
  stack?: string;
  scope?: string;
  componentStack?: string;
  at: number;
}

const ring: CapturedError[] = [];
const MAX = 80;

export function captureGlobalError(entry: Omit<CapturedError, 'at'>): void {
  const full: CapturedError = { ...entry, at: Date.now() };
  ring.push(full);
  if (ring.length > MAX) ring.splice(0, ring.length - MAX);

  if (import.meta.env.DEV) {
    console.error('[global-error]', full);
  }

  notifyError(new Error(full.message), {
    scope: full.scope ?? full.kind,
    severity: 'error',
    silent: true,
    meta: { kind: full.kind, componentStack: full.componentStack },
  });
}

export function snapshotGlobalErrors(): CapturedError[] {
  return ring.slice();
}

export function installGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    captureGlobalError({
      kind: 'window-error',
      message: event.message || 'Unknown error',
      stack: event.error instanceof Error ? event.error.stack : undefined,
      scope: 'window.onerror',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error ? reason.message : String(reason ?? 'unhandled rejection');
    captureGlobalError({
      kind: 'unhandled-rejection',
      message,
      stack: reason instanceof Error ? reason.stack : undefined,
      scope: 'unhandledrejection',
    });
  });
}
