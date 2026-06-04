/**
 * Anonymous recovery codes — cross-device restoration for anonymous accounts.
 */
import { supabase } from '@/integrations/supabase/client';
import { listSessions } from '@/lib/sessions';
import { sbExt } from '@/lib/supabaseExt';
import {
  formatRecoveryCodeDisplay,
  isValidRecoveryCodeFormat,
  normalizeRecoveryCode,
} from '@/lib/recovery/normalizeCode';
import { trackProductEvent } from '@/lib/observability/productTelemetry';

export {
  formatRecoveryCodeDisplay,
  isValidRecoveryCodeFormat,
  normalizeRecoveryCode,
} from '@/lib/recovery/normalizeCode';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_GROUPS = 4;
const GROUP_LEN = 4;

export const RECOVERY_LOCAL_KEY = 'mind-sentinel.recoveryCode';
export const RECOVERY_REDEEMED_UID = 'mind-sentinel.recoveryRedeemedUid';
export const RECOVERY_PENDING_KEY = 'mind-sentinel.recoveryPending';
export const RECOVERY_ANON_PROFILE_KEY = 'mind-sentinel.recoveryAnonProfile';

export type RecoveryCodeStatus =
  | 'valid'
  | 'not_found'
  | 'already_used'
  | 'invalid_format';

export type RecoveryRestoreFailureReason =
  | 'invalid_format'
  | 'not_found'
  | 'already_used'
  | 'restore_failed'
  | 'database_error'
  | 'rpc_unavailable';

function isPostgrestRpcMissing(error: { code?: string; message?: string; status?: number }): boolean {
  const code = error.code ?? '';
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.status === 404
    || code === 'PGRST202'
    || code === 'PGRST204'
    || msg.includes('could not find the function')
    || msg.includes('function restore_anonymous_account')
    || msg.includes('404')
  );
}

export type RecoveryRestoreResult =
  | { ok: true; userId: string }
  | { ok: false; reason: RecoveryRestoreFailureReason; message?: string };

const RECOVERY_PENDING_EVENT = 'mind-sentinel:recovery-pending-change';

function notifyRecoveryPendingChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(RECOVERY_PENDING_EVENT));
}

export function setRecoveryPending(): void {
  try { sessionStorage.setItem(RECOVERY_PENDING_KEY, '1'); } catch { /* noop */ }
  notifyRecoveryPendingChange();
}

export function clearRecoveryPending(): void {
  try {
    sessionStorage.removeItem(RECOVERY_PENDING_KEY);
    sessionStorage.removeItem(RECOVERY_ANON_PROFILE_KEY);
    sessionStorage.removeItem(RECOVERY_LOCAL_KEY);
  } catch { /* noop */ }
  notifyRecoveryPendingChange();
}

export function isRecoveryPending(): boolean {
  try { return sessionStorage.getItem(RECOVERY_PENDING_KEY) === '1'; } catch { return false; }
}

export function getStoredRecoveryCode(): string | null {
  try { return sessionStorage.getItem(RECOVERY_LOCAL_KEY); } catch { return null; }
}

function storeRecoveryCodePlaintext(code: string): void {
  try { sessionStorage.setItem(RECOVERY_LOCAL_KEY, code); } catch { /* noop */ }
}

export function clearStoredRecoveryCode(): void {
  try { sessionStorage.removeItem(RECOVERY_LOCAL_KEY); } catch { /* noop */ }
}

export function stashPendingAnonProfile(profile: Record<string, unknown>): void {
  try { sessionStorage.setItem(RECOVERY_ANON_PROFILE_KEY, JSON.stringify(profile)); } catch { /* noop */ }
}

export function readPendingAnonProfile<T>(): T | null {
  try {
    const raw = sessionStorage.getItem(RECOVERY_ANON_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function randomChars(n: number): string {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

export function generateRecoveryCodePlaintext(): string {
  const normalized = Array.from({ length: CODE_GROUPS }, () => randomChars(GROUP_LEN)).join('');
  return formatRecoveryCodeDisplay(normalized);
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Hash using canonical normalized form (no dashes/spaces, uppercase). */
export async function hashRecoveryCode(raw: string): Promise<string> {
  return sha256Hex(normalizeRecoveryCode(raw));
}

/** Probe DB for code status (requires authenticated session). */
export async function getRecoveryCodeStatus(raw: string): Promise<RecoveryCodeStatus | 'database_error'> {
  const normalized = normalizeRecoveryCode(raw);
  if (!isValidRecoveryCodeFormat(raw)) return 'invalid_format';

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return 'database_error';

  const { data, error } = await (supabase as any).rpc('get_recovery_code_status', { _code: raw });
  if (error) {
    console.warn('[recovery] status lookup failed', { normalized, error });
    return 'database_error';
  }
  const status = data as RecoveryCodeStatus | null;
  console.info('[recovery] status lookup', { normalized, status });
  return status ?? 'not_found';
}

/** Generate, persist hash to DB, return dashed plaintext for display. */
export async function generateAndStoreRecoveryCode(userId: string): Promise<string> {
  const displayCode = generateRecoveryCodePlaintext();
  const normalized = normalizeRecoveryCode(displayCode);
  const code_hash = await hashRecoveryCode(displayCode);
  const code_hint = normalized.slice(0, 4);

  console.info('[recovery] generate', {
    displayCode,
    normalized,
    code_hint,
    hashPrefix: code_hash.slice(0, 16),
  });

  try { storeRecoveryCodePlaintext(displayCode); } catch { /* noop */ }
  setRecoveryPending();
  notifyRecoveryPendingChange();

  const { error: insertError } = await (supabase as any)
    .from('anonymous_recovery_codes')
    .insert({ user_id: userId, code_hash, code_hint });

  if (insertError) {
    const { error: updateError } = await (supabase as any)
      .from('anonymous_recovery_codes')
      .update({ code_hash, code_hint })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[recovery] persist failed', { insertError, updateError, normalized });
      throw new Error('Failed to save recovery code to database');
    }
    console.info('[recovery] persist updated existing row', { userId, normalized });
  } else {
    console.info('[recovery] persist inserted row', { userId, normalized });
  }

  trackProductEvent('auth.recovery_generate');
  return displayCode;
}

/** Legacy redeem — returns original user_id without transfer. */
export async function redeemRecoveryCode(code: string): Promise<string | null> {
  if (!isValidRecoveryCodeFormat(code)) return null;
  const normalized = normalizeRecoveryCode(code);
  const { data, error } = await (supabase as any).rpc('redeem_anonymous_recovery_code', { _code: code });
  if (error) {
    console.warn('[recovery] redeem failed', { normalized, error });
    return null;
  }
  console.info('[recovery] redeem result', { normalized, userId: data });
  return (data as string | null) ?? null;
}

/**
 * Restore an anonymous account onto the current session.
 * Requires an active anonymous auth session (call signInAnonymously first).
 */
export async function restoreAnonymousAccount(code: string): Promise<RecoveryRestoreResult> {
  const normalized = normalizeRecoveryCode(code);

  if (!isValidRecoveryCodeFormat(code)) {
    console.warn('[recovery] restore invalid format', { normalized, length: normalized.length });
    return { ok: false, reason: 'invalid_format' };
  }

  const status = await getRecoveryCodeStatus(code);
  if (status === 'invalid_format') {
    return { ok: false, reason: 'invalid_format' };
  }
  if (status === 'not_found') {
    console.warn('[recovery] restore not found', { normalized });
    return { ok: false, reason: 'not_found' };
  }
  if (status === 'already_used') {
    console.warn('[recovery] restore already used', { normalized });
    return { ok: false, reason: 'already_used' };
  }
  if (status === 'database_error') {
    return { ok: false, reason: 'database_error', message: 'Could not verify recovery code' };
  }

  const { data, error } = await (supabase as any).rpc('restore_anonymous_account', { _code: code });

  if (error) {
    console.error('[recovery] restore RPC error', { normalized, error });
    if (isPostgrestRpcMissing(error)) {
      return {
        ok: false,
        reason: 'rpc_unavailable',
        message: 'restore_anonymous_account is not deployed on this Supabase project',
      };
    }
    return { ok: false, reason: 'database_error', message: error.message };
  }

  const uid = (data as string | null) ?? null;
  console.info('[recovery] restore result', { normalized, userId: uid });

  if (!uid) {
    return { ok: false, reason: 'restore_failed' };
  }

  try { localStorage.setItem(RECOVERY_REDEEMED_UID, uid); } catch { /* noop */ }
  trackProductEvent('auth.recovery_redeem', { ok: true });
  return { ok: true, userId: uid };
}

export function recoveryErrorMessage(
  reason: RecoveryRestoreFailureReason,
  t: (key: string, opts?: Record<string, string>) => string,
): string {
  const key = `login.recovery.errors.${reason}`;
  const translated = t(key);
  if (translated !== key) return translated;
  const fallbacks: Record<RecoveryRestoreFailureReason, string> = {
    invalid_format: 'Recovery code format is invalid. Use the full code with or without dashes.',
    not_found: 'No account found for this recovery code. Check the code and try again.',
    already_used: 'This recovery code was already used and cannot be reused.',
    restore_failed: 'Recovery failed. Please try again or contact support.',
    database_error: 'Could not reach the server to verify your recovery code.',
    rpc_unavailable:
      'Recovery restore is not configured on the server. Run sql/19_restore_schema_safe.sql in Supabase, then try again.',
  };
  return fallbacks[reason];
}

/** Pick the most recent session/chat ids after recovery for AppContext restoration. */
export async function loadLatestSessionPointers(userId: string): Promise<{
  sessionId: string | null;
  chatId: string | null;
}> {
  try {
    const sessions = await listSessions(userId);
    const latest = sessions[0];
    if (!latest) return { sessionId: null, chatId: null };

    const { data: chats } = await sbExt
      .from('chats')
      .select('id, last_message_at, created_at')
      .eq('session_id', latest.id)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1);

    const chatRow = (chats ?? [])[0] as { id: string } | undefined;
    return { sessionId: latest.id, chatId: chatRow?.id ?? null };
  } catch {
    return { sessionId: null, chatId: null };
  }
}

export function downloadRecoveryCode(code: string) {
  const blob = new Blob(
    [
      'Mind Sentinel — Anonymous Recovery Code\n',
      '========================================\n\n',
      `Code: ${code}\n`,
      `Generated: ${new Date().toISOString()}\n\n`,
      'Keep this code private. Anyone with this code can restore access to your anonymous account.\n',
      'If you lose it, your anonymous data cannot be recovered.\n',
    ],
    { type: 'text/plain' },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mind-sentinel-recovery.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
