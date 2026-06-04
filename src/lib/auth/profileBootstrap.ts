import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { UserProfile } from '@/context/AppContext';

export const OAUTH_AVATAR_KEY = 'mind-sentinel.oauthAvatar';
export const PENDING_PROFILE_KEY = 'mind-sentinel.pendingProfile';

export interface PendingProfile {
  avatar: string;
  email: string;
  age: string;
  gender: string;
}

function mapRowToProfile(
  data: Record<string, unknown>,
  user: User,
): UserProfile {
  return {
    avatar: (data.avatar as string) ?? 'default',
    identityMode: (data.identity_mode as 'anonymous' | 'real') ?? 'real',
    nickname: (data.nickname as string | null) ?? (data.display_name as string | null) ?? undefined,
    email: (data.email as string | null) ?? user.email ?? undefined,
    age: (data.age as string | null) ?? undefined,
    gender: (data.gender as string | null) ?? undefined,
    nicknameReason: (data.nickname_reason as string | null) ?? undefined,
    interviewAnswers: (data.interview_answers as Record<string, string>) ?? {},
  };
}

/** Apply email-signup prefs saved while waiting for confirmation. */
export async function applyPendingProfileIfAny(userId: string): Promise<void> {
  let pending: PendingProfile | null = null;
  try {
    const raw = localStorage.getItem(PENDING_PROFILE_KEY);
    if (raw) pending = JSON.parse(raw) as PendingProfile;
  } catch { /* noop */ }
  if (!pending) return;

  await supabase.from('profiles').update({
    avatar: pending.avatar,
    identity_mode: 'real',
    email: pending.email,
    age: pending.age,
    gender: pending.gender,
  }).eq('user_id', userId);

  try { localStorage.removeItem(PENDING_PROFILE_KEY); } catch { /* noop */ }
}

/**
 * Load profile for the signed-in user; create/update a minimal row if the
 * auth trigger did not run (OAuth/email edge cases).
 */
export async function fetchOrBootstrapProfile(user: User): Promise<UserProfile> {
  console.info('[profile-bootstrap] start', {
    userId: user.id,
    email: user.email,
    provider: user.app_metadata?.provider,
  });

  await applyPendingProfileIfAny(user.id);

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (data && !error) {
    console.info('[profile-bootstrap] loaded existing profile', { userId: user.id });
    return mapRowToProfile(data as Record<string, unknown>, user);
  }

  if (error) {
    console.warn('[profile-bootstrap] select failed', { userId: user.id, error });
  } else {
    console.info('[profile-bootstrap] no profile row — creating', { userId: user.id });
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  let avatar = 'default';
  try {
    const saved = localStorage.getItem(OAUTH_AVATAR_KEY);
    if (saved) avatar = saved;
  } catch { /* noop */ }

  const nickname =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    null;

  const row = {
    id: user.id,
    user_id: user.id,
    avatar,
    identity_mode: 'real' as const,
    email: user.email ?? null,
    nickname,
    display_name: nickname,
  };

  const { data: upserted, error: upsertErr } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .maybeSingle();

  if (upserted && !upsertErr) {
    console.info('[profile-bootstrap] upserted profile', { userId: user.id });
    try { localStorage.removeItem(OAUTH_AVATAR_KEY); } catch { /* noop */ }
    return mapRowToProfile(upserted as Record<string, unknown>, user);
  }

  if (upsertErr) {
    console.warn('[profile-bootstrap] upsert failed — using in-memory fallback', { upsertErr });
  }

  return {
    avatar,
    identityMode: 'real',
    email: user.email ?? undefined,
    nickname: nickname ?? undefined,
    interviewAnswers: {},
  };
}
