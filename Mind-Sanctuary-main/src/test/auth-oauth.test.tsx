import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';

const mockOnAuthStateChange = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signInWithOAuth: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInAnonymously: vi.fn(),
      signOut: vi.fn(),
      resend: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { AuthProvider, useAuth } from '@/context/AuthContext';

function AuthProbe() {
  const { authReady, loading, user } = useAuth();
  return (
    <div>
      <span data-testid="ready">{authReady ? 'yes' : 'no'}</span>
      <span data-testid="loading">{loading ? 'yes' : 'no'}</span>
      <span data-testid="user">{user ? user.id : 'none'}</span>
    </div>
  );
}

describe('AuthContext OAuth hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: { user: { id: string } } | null) => void) => {
      cb('INITIAL_SESSION', null);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
  });

  it('waits for INITIAL_SESSION before marking authReady', async () => {
    const { getByTestId } = render(
      React.createElement(AuthProvider, null, React.createElement(AuthProbe)),
    );

    await waitFor(() => {
      expect(getByTestId('ready').textContent).toBe('yes');
      expect(getByTestId('loading').textContent).toBe('no');
    });
  });

  it('sets user after SIGNED_IN without requiring a separate getSession race', async () => {
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: { user: { id: string } } | null) => void) => {
      cb('INITIAL_SESSION', null);
      cb('SIGNED_IN', { user: { id: 'oauth-user-1' } });
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { getByTestId } = render(
      React.createElement(AuthProvider, null, React.createElement(AuthProbe)),
    );

    await waitFor(() => {
      expect(getByTestId('user').textContent).toBe('oauth-user-1');
      expect(getByTestId('ready').textContent).toBe('yes');
    });
  });
});
