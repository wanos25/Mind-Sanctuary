import { useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session, AuthChangeEvent, AuthError } from '@supabase/supabase-js';
import { getAuthRedirectUrl } from '@/lib/auth/redirectUrl';
import { clearRecoveryPending } from '@/lib/recovery';
import {
  AuthContext,
  type AuthErrorCode,
  type SignInResult,
  type SignUpResult,
} from '@/context/auth-context';

export type { AuthErrorCode, SignInResult, SignUpResult } from '@/context/auth-context';
export { useAuth } from '@/context/auth-context';

function logOAuth(event: string, detail?: Record<string, unknown>) {
  console.info('[oauth]', event, detail ?? '');
}

function formatAuthError(error: AuthError): string {
  const parts = [error.message];
  if (error.status) parts.push(`(HTTP ${error.status})`);
  if (error.code) parts.push(`[${error.code}]`);
  return parts.filter(Boolean).join(' ');
}

function classifyError(msg: string | undefined): AuthErrorCode {
  if (!msg) return 'unknown';
  const m = msg.toLowerCase();
  if (m.includes('not confirmed') || m.includes('confirm')) return 'emailNotConfirmed';
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'invalidCreds';
  if (m.includes('already registered') || m.includes('user already')) return 'userExists';
  if (m.includes('password') && (m.includes('short') || m.includes('weak') || m.includes('6 characters') || m.includes('characters'))) return 'weakPassword';
  if (m.includes('rate') || m.includes('too many')) return 'rateLimit';
  if (m.includes('redirect') || m.includes('allowlist') || m.includes('not allowed')) return 'redirectNotAllowed';
  return 'unknown';
}

function hasOAuthCallbackParams(): boolean {
  if (typeof window === 'undefined') return false;
  const { search, hash } = window.location;
  return search.includes('code=') || hash.includes('access_token');
}

function stripAuthParamsFromUrl(): void {
  if (typeof window === 'undefined') return;
  const { pathname, hash, search } = window.location;
  if (hash.includes('access_token') || hash.includes('type=recovery') || search.includes('code=')) {
    window.history.replaceState({}, document.title, pathname);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let ready = false;
    let oauthExchangePending = hasOAuthCallbackParams();

    const markReady = (reason: string) => {
      if (cancelled || ready) return;
      ready = true;
      oauthExchangePending = false;
      logOAuth('authReady', { reason });
      setLoading(false);
      setAuthReady(true);
    };

    const applySession = (next: Session | null, event?: AuthChangeEvent) => {
      if (cancelled) return;
      setSession(next);
      setUser(next?.user ?? null);
      if (event) {
        logOAuth('session', {
          event,
          hasSession: !!next,
          userId: next?.user?.id,
          provider: next?.user?.app_metadata?.provider,
        });
      }
    };

    const onAuthChange = (event: AuthChangeEvent, nextSession: Session | null) => {
      applySession(nextSession, event);

      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryMode(true);
        markReady('PASSWORD_RECOVERY');
        return;
      }

      if (event === 'INITIAL_SESSION') {
        if (oauthExchangePending && !nextSession) {
          logOAuth('INITIAL_SESSION deferred — waiting for PKCE exchange');
          return;
        }
        if (!oauthExchangePending) markReady('INITIAL_SESSION');
      }

      if (event === 'SIGNED_IN') {
        oauthExchangePending = false;
        markReady('SIGNED_IN');
        stripAuthParamsFromUrl();
      }

      if (event === 'TOKEN_REFRESHED' && nextSession) {
        applySession(nextSession, event);
      }

      if (event === 'SIGNED_OUT') {
        setPasswordRecoveryMode(false);
        markReady('SIGNED_OUT');
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(onAuthChange);

    if (oauthExchangePending) {
      logOAuth('callback detected — calling getSession');
      supabase.auth.getSession().then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          logOAuth('getSession error', { message: error.message });
          markReady('getSession_error');
          return;
        }
        if (data.session) {
          applySession(data.session, 'SIGNED_IN');
          markReady('getSession');
          stripAuthParamsFromUrl();
        }
      });
    }

    const fallbackTimer = window.setTimeout(
      () => {
        if (oauthExchangePending) {
          logOAuth('fallback_timer — OAuth exchange timed out');
        }
        markReady('fallback_timer');
      },
      oauthExchangePending ? 15000 : 4000,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signUpAnonymous = async (): Promise<User | null> => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) { console.error('Anonymous sign-in error:', error); return null; }
    return data.user;
  };

  const signUpWithEmail = async (email: string, password: string): Promise<SignUpResult> => {
    clearRecoveryPending();
    const redirectTo = getAuthRedirectUrl();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      const message = formatAuthError(error);
      console.error('[auth] signUp failed', { redirectTo, message, status: error.status, code: error.code });
      return {
        user: null, session: null, needsConfirmation: false,
        errorCode: classifyError(error.message), errorMessage: message,
      };
    }
    return {
      user: data.user, session: data.session,
      needsConfirmation: !data.session && !!data.user,
      errorCode: null, errorMessage: null,
    };
  };

  const signInWithEmail = async (email: string, password: string): Promise<SignInResult> => {
    clearRecoveryPending();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return {
        user: null, session: null,
        errorCode: classifyError(error.message), errorMessage: formatAuthError(error),
      };
    }
    return { user: data.user, session: data.session, errorCode: null, errorMessage: null };
  };

  const signInWithOAuth = async (provider: 'google' | 'facebook') => {
    clearRecoveryPending();
    const redirectTo = getAuthRedirectUrl();
    logOAuth('signInWithOAuth start', { provider, redirectTo });
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: false,
        queryParams: provider === 'google'
          ? { access_type: 'offline', prompt: 'consent' }
          : undefined,
      },
    });
    if (error) {
      console.error('[auth] OAuth failed', { provider, redirectTo, message: error.message });
      return { error: formatAuthError(error) };
    }
    return { error: null };
  };

  const signInWithGoogle = () => signInWithOAuth('google');
  const signInWithFacebook = () => signInWithOAuth('facebook');

  const resendConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: getAuthRedirectUrl() },
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: formatAuthError(error) };
    setPasswordRecoveryMode(false);
    stripAuthParamsFromUrl();
    return { error: null };
  };

  const clearPasswordRecovery = () => {
    setPasswordRecoveryMode(false);
    stripAuthParamsFromUrl();
  };

  const signOut = async () => {
    clearRecoveryPending();
    setPasswordRecoveryMode(false);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading, authReady, passwordRecoveryMode,
      signUpAnonymous, signUpWithEmail, signInWithEmail,
      signInWithGoogle, signInWithFacebook,
      resendConfirmation, updatePassword, clearPasswordRecovery, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
