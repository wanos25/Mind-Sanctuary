import { describe, it, expect } from 'vitest';
import {
  resolveVoiceProfile,
  normalizeGender,
  pickElevenLabsVoiceId,
} from '@/lib/voice/voiceProfileResolver';

describe('voiceProfileResolver', () => {
  it('routes Arabic to munsit primary when available', () => {
    const p = resolveVoiceProfile({
      language: 'ar',
      gender: 'Female',
      providers: { munsit: true, elevenlabs: true },
    });
    expect(p.baseLang).toBe('ar');
    expect(p.primaryProvider).toBe('munsit');
    expect(p.fallbackProvider).toBe('elevenlabs');
    expect(p.providerOrder).toEqual(['munsit', 'elevenlabs']);
  });

  it('routes English to elevenlabs primary when both available', () => {
    const p = resolveVoiceProfile({
      language: 'en-US',
      gender: 'Male',
      providers: { munsit: true, elevenlabs: true },
    });
    expect(p.primaryProvider).toBe('elevenlabs');
    expect(p.fallbackProvider).toBe('munsit');
  });

  it('picks distinct male/female English ElevenLabs voices', () => {
    const male = pickElevenLabsVoiceId('en', normalizeGender('Male'));
    const female = pickElevenLabsVoiceId('en', normalizeGender('Female'));
    expect(male).not.toBe(female);
  });

  it('picks distinct male/female Arabic ElevenLabs voices', () => {
    const male = pickElevenLabsVoiceId('ar', 'male');
    const female = pickElevenLabsVoiceId('ar', 'female');
    expect(male).not.toBe(female);
  });
});
