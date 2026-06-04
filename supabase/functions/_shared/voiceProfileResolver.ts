/**
 * Voice Profile Resolver (edge) — shared with src/lib/voice/voiceProfileResolver.ts
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
  /** Optional per-gender Munsit voice ids from secrets */
  munsitVoiceIds?: { default?: string; male?: string; female?: string };
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

const ELEVEN_FEMALE: Record<string, string> = {
  en: 'EXAVITQu4vr4xnSDxMaL',
  ar: 'XrExE9yKIg1WjnnlVkGX',
  es: 'XrExE9yKIg1WjnnlVkGX',
  fr: 'XrExE9yKIg1WjnnlVkGX',
  it: 'XrExE9yKIg1WjnnlVkGX',
};

const ELEVEN_MALE: Record<string, string> = {
  en: 'JBFqnCBsd6RMkjVDRZzb',
  ar: 'onwK4e9ZLuTAKqWW03F9',
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

export function pickMunsitVoiceId(
  gender: NormalizedGender,
  ids: { default?: string; male?: string; female?: string },
): string | null {
  if (gender === 'male' && ids.male) return ids.male;
  if (gender === 'female' && ids.female) return ids.female;
  return ids.default ?? ids.female ?? ids.male ?? null;
}

export function resolveVoiceProfile(input: VoiceProfileInput): VoiceProfile {
  const baseLang = normalizeBaseLang(input.language);
  const gender = normalizeGender(input.gender);
  const voiceId = pickElevenLabsVoiceId(baseLang, gender);
  const munsitVoiceId = pickMunsitVoiceId(gender, input.munsitVoiceIds ?? {});

  const munsitReady = !!input.providers?.munsit && !!munsitVoiceId;
  const elevenReady = !!input.providers?.elevenlabs;
  const isArabic = baseLang === 'ar';

  const order: VoiceProviderName[] = [];
  if (isArabic) {
    if (munsitReady) order.push('munsit');
    if (elevenReady) order.push('elevenlabs');
  } else {
    if (elevenReady) order.push('elevenlabs');
    if (munsitReady) order.push('munsit');
  }

  return {
    language: input.language,
    baseLang,
    gender,
    primaryProvider: order[0] ?? 'elevenlabs',
    fallbackProvider: order[1] ?? null,
    voiceId,
    munsitVoiceId,
    providerOrder: order,
  };
}
