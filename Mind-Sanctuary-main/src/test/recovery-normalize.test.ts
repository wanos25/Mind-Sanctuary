import { describe, it, expect } from 'vitest';
import {
  normalizeRecoveryCode,
  formatRecoveryCodeDisplay,
  isValidRecoveryCodeFormat,
} from '@/lib/recovery/normalizeCode';
import { hashRecoveryCode } from '@/lib/recovery';

describe('recovery code normalization', () => {
  it('strips dashes and spaces and uppercases', () => {
    expect(normalizeRecoveryCode(' ab23-7klm 9pqr-xyz4 ')).toBe('AB237KLM9PQRXYZ4');
  });

  it('formats display from normalized body', () => {
    expect(formatRecoveryCodeDisplay('AB237KLM9PQRXYZ4')).toBe('AB23-7KLM-9PQR-XYZ4');
  });

  it('validates minimum length', () => {
    expect(isValidRecoveryCodeFormat('AB23-7KLM-9PQR-XYZ4')).toBe(true);
    expect(isValidRecoveryCodeFormat('SHORT')).toBe(false);
  });

  it('hashes normalized form regardless of input formatting', async () => {
    const dashed = 'AB23-7KLM-9PQR-XYZ4';
    const plain = 'AB237KLM9PQRXYZ4';
    const h1 = await hashRecoveryCode(dashed);
    const h2 = await hashRecoveryCode(plain);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });
});
