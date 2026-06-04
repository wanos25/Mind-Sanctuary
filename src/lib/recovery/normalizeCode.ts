/** Canonical recovery code normalization — single source of truth for client + SQL. */
export function normalizeRecoveryCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[-\s]+/g, '');
}

/** Display format: XXXX-XXXX-XXXX-XXXX (16 chars without separators). */
export function formatRecoveryCodeDisplay(normalized: string): string {
  const n = normalizeRecoveryCode(normalized);
  if (n.length < 16) return n;
  return `${n.slice(0, 4)}-${n.slice(4, 8)}-${n.slice(8, 12)}-${n.slice(12, 16)}`;
}

export function isValidRecoveryCodeFormat(raw: string): boolean {
  return normalizeRecoveryCode(raw).length >= 16;
}
