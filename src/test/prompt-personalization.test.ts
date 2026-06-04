import { describe, it, expect } from 'vitest';
import {
  buildGenderPersonalization,
  buildLanguagePersonalization,
  buildPersonalizedSystemPrompt,
} from '@/lib/ai/promptPersonalization';

describe('promptPersonalization', () => {
  it('includes masculine Arabic guidance for male users', () => {
    const block = buildGenderPersonalization('male');
    expect(block).toMatch(/masculine/i);
    expect(block).toMatch(/أنتَ/);
  });

  it('includes feminine Arabic guidance for female users', () => {
    const block = buildGenderPersonalization('female');
    expect(block).toMatch(/feminine/i);
    expect(block).toMatch(/أنتِ/);
  });

  it('respects preferred language', () => {
    const block = buildLanguagePersonalization('ar');
    expect(block).toMatch(/Arabic/i);
  });

  it('builds full system prompt with nickname and memories', () => {
    const prompt = buildPersonalizedSystemPrompt({
      userProfile: { gender: 'Female', nickname: 'Sara', preferredLanguage: 'en' },
      memories: [{ topic: 'sleep', context: 'trouble falling asleep' }],
      emotionState: { primary: 'anxiety', intensity: 0.7, sentiment: -0.3, distortions: ['catastrophizing'] },
    });
    expect(prompt).toMatch(/Dr\. Sentinel/);
    expect(prompt).toMatch(/Sara/);
    expect(prompt).toMatch(/sleep/);
    expect(prompt).toMatch(/feminine/i);
    expect(prompt).toMatch(/anxiety/i);
  });
});
