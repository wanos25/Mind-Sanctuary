import type { User } from '@supabase/supabase-js';

/** True for Supabase anonymous auth users (not Google/email OAuth). */
export function isAnonymousUser(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.is_anonymous === true) return true;
  const provider = user.app_metadata?.provider as string | undefined;
  return provider === 'anonymous';
}
