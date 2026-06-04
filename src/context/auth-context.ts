import { createContext, useContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';

export type AuthErrorCode =
  | 'emailNotConfirmed'
  | 'invalidCreds'
  | 'userExists'
  | 'weakPassword'
  | 'rateLimit'
  | 'redirectNotAllowed'
  | 'unknown';

export interface SignUpResult {
  user: User | null;
  session: Session | null;
  needsConfirmation: boolean;
  errorCode: AuthErrorCode | null;
  errorMessage: string | null;
}

export interface SignInResult {
  user: User | null;
  session: Session | null;
  errorCode: AuthErrorCode | null;
  errorMessage: string | null;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authReady: boolean;
  passwordRecoveryMode: boolean;
  signUpAnonymous: () => Promise<User | null>;
  signUpWithEmail: (email: string, password: string) => Promise<SignUpResult>;
  signInWithEmail: (email: string, password: string) => Promise<SignInResult>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithFacebook: () => Promise<{ error: string | null }>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
}

/** Stable module for context identity — avoids HMR duplicating createContext. */
export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
