/**
 * Lightweight product telemetry — in-memory ring buffer.
 * No third-party SDK; safe for privacy-sensitive mental-health context.
 * Forward events server-side when a sink is configured.
 */

export type ProductEventName =
  | 'auth.sign_in'
  | 'auth.sign_up'
  | 'auth.oauth'
  | 'auth.recovery_redeem'
  | 'auth.recovery_generate'
  | 'activity.start'
  | 'activity.complete'
  | 'chat.message_sent'
  | 'chat.stream_completed'
  | 'chat.stream_aborted'
  | 'voice.recorded'
  | 'voice.tts_completed'
  | 'doctor.portal_open'
  | 'admin.role_change'
  | 'app.error_boundary';

export interface ProductEvent {
  name: ProductEventName;
  at: number;
  userId?: string;
  meta?: Record<string, string | number | boolean>;
}

const ring: ProductEvent[] = [];
const MAX = 200;

export function trackProductEvent(
  name: ProductEventName,
  meta?: Record<string, string | number | boolean>,
  userId?: string,
): void {
  const evt: ProductEvent = { name, at: Date.now(), userId, meta };
  ring.push(evt);
  if (ring.length > MAX) ring.splice(0, ring.length - MAX);
  if (import.meta.env.DEV) {
    console.info('[telemetry]', name, meta ?? '');
  }
}

export function snapshotProductEvents(): ProductEvent[] {
  return ring.slice();
}
