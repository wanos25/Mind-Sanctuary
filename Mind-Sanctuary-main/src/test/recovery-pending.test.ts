import { describe, it, expect, beforeEach } from 'vitest';
import {
  setRecoveryPending,
  clearRecoveryPending,
  isRecoveryPending,
  RECOVERY_PENDING_KEY,
} from '@/lib/recovery';

describe('recovery pending flag', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('tracks pending state for auth session gate', () => {
    expect(isRecoveryPending()).toBe(false);
    setRecoveryPending();
    expect(sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBe('1');
    expect(isRecoveryPending()).toBe(true);
    clearRecoveryPending();
    expect(isRecoveryPending()).toBe(false);
  });
});
