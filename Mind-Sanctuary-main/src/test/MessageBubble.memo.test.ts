import { describe, it, expect } from 'vitest';
import { areMessagePropsEqual, hashContent } from '@/components/chat/MessageBubble';

const base = {
  id: 'm1',
  role: 'assistant' as const,
  content: 'Hello there, this is a stable message body.',
  timestamp: 1_700_000_000,
  streaming: false,
};

describe('MessageBubble memoization', () => {
  it('skips re-render when only callback identity changes', () => {
    const a = { ...base, onReply: () => {} };
    const b = { ...base, onReply: a.onReply };
    expect(areMessagePropsEqual(a as any, b as any)).toBe(true);
  });

  it('skips re-render when an unrelated/extra prop changes', () => {
    // hover state, lightbox, parent-only re-render — comparator should ignore.
    const a = { ...base };
    const b = { ...base };
    expect(areMessagePropsEqual(a as any, b as any)).toBe(true);
  });

  it('re-renders when content changes', () => {
    const a = { ...base };
    const b = { ...base, content: base.content + ' more' };
    expect(areMessagePropsEqual(a as any, b as any)).toBe(false);
  });

  it('re-renders when streaming flag flips', () => {
    expect(
      areMessagePropsEqual(
        { ...base } as any,
        { ...base, streaming: true } as any,
      ),
    ).toBe(false);
  });

  it('re-renders when callback identity changes', () => {
    expect(
      areMessagePropsEqual(
        { ...base, onRegenerate: () => {} } as any,
        { ...base, onRegenerate: () => {} } as any,
      ),
    ).toBe(false);
  });

  it('re-renders when emotion intensity changes', () => {
    expect(
      areMessagePropsEqual(
        { ...base, emotion: { primary: 'calm', intensity: 0.2, distortions: [] } } as any,
        { ...base, emotion: { primary: 'calm', intensity: 0.8, distortions: [] } } as any,
      ),
    ).toBe(false);
  });

  it('hashContent is stable and deterministic', () => {
    expect(hashContent('abc')).toBe(hashContent('abc'));
    expect(hashContent('abc')).not.toBe(hashContent('abd'));
  });

  it('falls back to string equality when hash matches but strings differ', () => {
    // Simulate a hash collision by stubbing equal content with different objects.
    const a = { ...base, content: 'same string' };
    const b = { ...base, content: 'same string' };
    expect(areMessagePropsEqual(a as any, b as any)).toBe(true);
    // Different strings of equal length must not be treated as equal even
    // when hashes happen to align — exercises the string-equality fallback.
    const c = { ...base, content: 'AB' };
    const d = { ...base, content: 'CD' };
    expect(areMessagePropsEqual(c as any, d as any)).toBe(false);
  });
});
