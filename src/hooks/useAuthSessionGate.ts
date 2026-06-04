import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApp, AppStage } from '@/context/AppContext';
import { fetchOrBootstrapProfile } from '@/lib/auth/profileBootstrap';
import { isAnonymousUser } from '@/lib/auth/isAnonymousUser';
import { isRecoveryPending } from '@/lib/recovery';

const PROTECTED_STAGES: AppStage[] = [
  'entry', 'interview', 'session', 'dashboard', 'insights',
  'history', 'profile', 'settings', 'notes', 'emergency',
];

/** Only block dashboard for anonymous users mid-recovery-code UX — never OAuth/email. */
function blocksDashboardForRecovery(user: NonNullable<ReturnType<typeof useAuth>['user']>): boolean {
  return isRecoveryPending() && isAnonymousUser(user);
}

function shouldAdvanceToDashboard(
  user: NonNullable<ReturnType<typeof useAuth>['user']>,
  stage: AppStage,
): boolean {
  return stage === 'login' && !blocksDashboardForRecovery(user);
}

/**
 * Keeps AppStage aligned with Supabase auth — fixes OAuth redirect loops where
 * `user` is set but `stage` stays on `login`, and signed-out users stuck on
 * protected stages. Also hydrates profile on startup restoration.
 */
export function useAuthSessionGate() {
  const { user, loading, authReady, session } = useAuth();
  const { stage, setStage, setProfile, profile } = useApp();
  const bootstrappingRef = useRef(false);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  useEffect(() => {
    if (!authReady || loading) {
      if (import.meta.env.DEV) {
        console.info('[auth-gate] waiting', { authReady, loading, hasUser: !!user, stage });
      }
      return;
    }

    if (!user) {
      bootstrappingRef.current = false;
      if (import.meta.env.DEV) {
        console.info('[auth-gate] no user', { stage, hasSession: !!session });
      }
      if (PROTECTED_STAGES.includes(stage)) {
        if (import.meta.env.DEV) {
          console.info('[auth-gate] redirecting to login from protected stage', { stage });
        }
        setStage('login');
      }
      return;
    }

    const onLogin = stage === 'login';
    const recoveryBlock = blocksDashboardForRecovery(user);
    const canAdvance = shouldAdvanceToDashboard(user, stage);

    if (import.meta.env.DEV) {
      console.info('[auth-gate] user present', {
        userId: user.id,
        isAnonymous: isAnonymousUser(user),
        provider: user.app_metadata?.provider,
        stage,
        hasProfile: !!profile,
        recoveryPending: isRecoveryPending(),
        recoveryBlock,
        canAdvance,
        hasSession: !!session,
      });
    }

    if (onLogin && canAdvance && profile) {
      if (import.meta.env.DEV) {
        console.info('[auth-gate] profile already loaded — advancing to dashboard');
      }
      setStage('dashboard');
      return;
    }

    const needsProfile = !profile;
    if (!needsProfile && !onLogin) return;
    if (!onLogin && !needsProfile) return;
    if (bootstrappingRef.current) return;

    bootstrappingRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        if (needsProfile) {
          const loaded = await fetchOrBootstrapProfile(user);
          if (cancelled) return;
          setProfile(loaded);
        }

        if (cancelled) return;

        const latestStage = stageRef.current;
        if (shouldAdvanceToDashboard(user, latestStage)) {
          if (import.meta.env.DEV) {
            console.info('[auth-gate] bootstrap complete — advancing to dashboard');
          }
          setStage('dashboard');
        } else if (latestStage === 'login' && recoveryBlock) {
          if (import.meta.env.DEV) {
            console.info('[auth-gate] dashboard blocked: anonymous recovery pending');
          }
        }
      } catch (e) {
        console.error('[auth-gate] profile bootstrap failed', e);
      } finally {
        bootstrappingRef.current = false;
      }
    })();

    return () => { cancelled = true; };
  }, [user, loading, authReady, session, stage, profile, setStage, setProfile]);
}
