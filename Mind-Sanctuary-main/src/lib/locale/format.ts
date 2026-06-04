import i18n from '@/lib/i18n';

/** BCP-47 locale for the active i18n language. Used by Intl.* APIs. */
export function currentLocale(): string {
  const lng = i18n.language || 'en';
  // Map our short codes to richer BCP-47 tags for more natural Intl output
  const map: Record<string, string> = {
    en: 'en-US', ar: 'ar-SA', es: 'es-ES', fr: 'fr-FR', it: 'it-IT',
  };
  return map[lng.split('-')[0]] ?? lng;
}

export function formatDate(value: Date | number | string, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(currentLocale(), opts ?? { dateStyle: 'medium' }).format(new Date(value));
}

export function formatTime(value: Date | number | string, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(currentLocale(), opts ?? { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function formatDateTime(value: Date | number | string) {
  return new Intl.DateTimeFormat(currentLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function formatNumber(n: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(currentLocale(), opts).format(n);
}

/** Locale-aware relative time (e.g. "5 minutes ago"). */
export function formatRelative(from: Date | number, to: Date | number = Date.now()) {
  const fromMs = from instanceof Date ? from.getTime() : from;
  const toMs = to instanceof Date ? to.getTime() : to;
  const diffSec = Math.round((fromMs - toMs) / 1000);
  const rtf = new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto' });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month');
  return rtf.format(Math.round(diffSec / 31536000), 'year');
}
