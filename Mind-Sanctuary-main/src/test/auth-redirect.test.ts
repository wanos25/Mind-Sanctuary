import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAuthRedirectUrl, isLegacyAuthHost } from '@/lib/auth/redirectUrl';

describe('auth redirect URL', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.stubGlobal('location', { ...originalLocation, origin: 'http://localhost:8080' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses current origin for Supabase redirects', () => {
    expect(getAuthRedirectUrl()).toBe('http://localhost:8080/');
  });

  it('flags legacy Lovable hosts', () => {
    expect(isLegacyAuthHost('https://wannos-1-4.lovable.app')).toBe(true);
    expect(isLegacyAuthHost('http://localhost:8080')).toBe(false);
  });
});
