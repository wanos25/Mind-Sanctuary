/**
 * Voice Profile Resolver — selects TTS provider, voice id, and fallback chain.
 * Preserves Munsit (Arabic-first), ElevenLabs, and existing edge routing.
 */

export type VoiceProviderName = 'munsit' | 'elevenlabs';

export type NormalizedGender = 'male' | 'female' | 'neutral';

export interface VoiceProviderAvailability {
  munsit?: boolean;
  elevenlabs?: boolean;
}

export interface VoiceProfileInput {
  language: string;
  gender?: string | null;
  providers?: VoiceProviderAvailability;
}

export interface VoiceProfile {
  language: string;
  baseLang: string;
  gender: NormalizedGender;
  primaryProvider: VoiceProviderName;
  fallbackProvider: VoiceProviderName | null;
  voiceId: string;
  munsitVoiceId: string | null;
  providerOrder: VoiceProviderName[];
}

/** ElevenLabs voice IDs — gender × language. */
const ELEVEN_FEMALE: Record<string, string> = {
  en: 'EXAVITQu4vr4xnSDxMaL', // Sarah
  ar: 'XrExE9yKIg1WjnnlVkGX', // Matilda
  es: 'XrExE9yKIg1WjnnlVkGX',
  fr: 'XrExE9yKIg1WjnnlVkGX',
  it: 'XrExE9yKIg1WjnnlVkGX',
};

const ELEVEN_MALE: Record<string, string> = {
  en: 'JBFqnCBsd6RMkjVDRZzb', // George
  ar: 'onwK4e9ZLuTAKqWW03F9', // Daniel
  es: 'onwK4e9ZLuTAKqWW03F9',
  fr: 'onwK4e9ZLuTAKqWW03F9',
  it: 'onwK4e9ZLuTAKqWW03F9',
};

export function normalizeGender(gender?: string | null): NormalizedGender {
  const g = (gender ?? '').trim().toLowerCase();
  if (g === 'male' || g === 'm' || g === 'man' || g === 'ذكر') return 'male';
  if (g === 'female' || g === 'f' || g === 'woman' || g === 'أنثى' || g === 'انثى') return 'female';
  return 'neutral';
}

export function normalizeBaseLang(language: string): string {
  return language.trim().toLowerCase().split('-')[0] || 'en';
}

export function pickElevenLabsVoiceId(baseLang: string, gender: NormalizedGender): string {
  const table = gender === 'male' ? ELEVEN_MALE : ELEVEN_FEMALE;
  return table[baseLang] ?? table.en;
}

/**
 * Resolve voice routing for TTS.
 * Arabic: Munsit primary when available, ElevenLabs fallback.
 * Other languages: ElevenLabs primary, Munsit fallback.
 */
export function resolveVoiceProfile(input: VoiceProfileInput): VoiceProfile {
  const baseLang = normalizeBaseLang(input.language);
  const gender = normalizeGender(input.gender);
  const voiceId = pickElevenLabsVoiceId(baseLang, gender);

  const munsitReady = input.providers?.munsit !== false;
  const elevenReady = input.providers?.elevenlabs !== false;
  const isArabic = baseLang === 'ar';

  const order: VoiceProviderName[] = [];
  if (isArabic) {
    if (munsitReady) order.push('munsit');
    if (elevenReady) order.push('elevenlabs');
  } else {
    if (elevenReady) order.push('elevenlabs');
    if (munsitReady) order.push('munsit');
  }

  const primaryProvider = order[0] ?? 'elevenlabs';
  const fallbackProvider = order[1] ?? null;

  return {
    language: input.language,
    baseLang,
    gender,
    primaryProvider,
    fallbackProvider,
    voiceId,
    munsitVoiceId: null,
    providerOrder: order,
  };
}

/** Browser-side availability — edge function passes real env flags. */
export function resolveVoiceProfileClient(
  language: string,
  gender?: string | null,
): VoiceProfile {
  return resolveVoiceProfile({
    language,
    gender,
    providers: { munsit: true, elevenlabs: true },
  });
}
