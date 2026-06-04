/** Supabase Auth redirect target — always the current app origin (never a legacy host). */
const LEGACY_HOST_PATTERN = /lovable\.(app|dev|project)|lovableproject\.com/i;

export function getAppOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

/**
 * Post-auth redirect used for email signup, OAuth, and password recovery.
 * Must match an entry in Supabase Dashboard → Authentication → Redirect URLs.
 */
export function getAuthRedirectUrl(): string {
  const origin = getAppOrigin();
  if (!origin) return '/';
  if (LEGACY_HOST_PATTERN.test(origin)) {
    console.warn(
      '[auth] App is running on a legacy Lovable preview host. Set Supabase Site URL and Redirect URLs to your real deployment.',
    );
  }
  return `${origin}/`;
}

export function isLegacyAuthHost(url: string): boolean {
  return LEGACY_HOST_PATTERN.test(url);
}
