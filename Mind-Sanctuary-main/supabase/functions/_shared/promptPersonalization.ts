/**
 * AI prompt personalization — gender, language, and session context.
 * Used by chat edge function; mirrors src/lib/ai/promptPersonalization.ts
 */

export interface UserProfileInput {
  gender?: string;
  nickname?: string;
  preferredLanguage?: string;
}

export interface EmotionStateInput {
  primary: string;
  intensity: number;
  sentiment: number;
  distortions?: string[];
}

export interface MemoryInput {
  topic: string;
  emotion_pattern?: string;
  context?: string;
}

export interface PromptPersonalizationInput {
  isInterview?: boolean;
  interviewSystemOverride?: string;
  userProfile?: UserProfileInput;
  emotionState?: EmotionStateInput;
  memories?: MemoryInput[];
  interviewContext?: unknown;
  systemAddenda?: string[];
}

function normalizeGender(gender?: string): 'male' | 'female' | 'neutral' {
  const g = (gender ?? '').trim().toLowerCase();
  if (g === 'male' || g === 'm' || g === 'man' || g === 'ذكر') return 'male';
  if (g === 'female' || g === 'f' || g === 'woman' || g === 'أنثى' || g === 'انثى') return 'female';
  return 'neutral';
}

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'Arabic',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
};

export function buildGenderPersonalization(gender: 'male' | 'female' | 'neutral'): string {
  if (gender === 'male') {
    return `Gender personalization (male user):
- In Arabic: use masculine verb forms, masculine second-person pronouns (أنتَ), and masculine agreement on adjectives (e.g. متعب/حزين/قلق when addressing him). Avoid feminine conjugations (تَفْعَلِين, أنتِ).
- In English: natural masculine framing only when appropriate; default to neutral warmth otherwise.`;
  }
  if (gender === 'female') {
    return `Gender personalization (female user):
- In Arabic: use feminine verb forms, feminine second-person pronouns (أنتِ), and feminine agreement (e.g. متعبة/حزينة/قلقة). Avoid masculine conjugations (تَفْعَل, أنتَ).
- In English: natural feminine framing only when appropriate; default to neutral warmth otherwise.`;
  }
  return `Gender personalization (unspecified):
- Prefer gender-neutral phrasing in all languages.
- In Arabic, avoid strongly gendered verb endings when addressing the user; use inclusive or neutral constructions where possible.`;
}

export function buildLanguagePersonalization(
  preferredLanguage?: string,
  lastUserLanguageHint?: string,
): string {
  const pref = (preferredLanguage ?? '').trim().toLowerCase().split('-')[0];
  const hint = (lastUserLanguageHint ?? '').trim().toLowerCase().split('-')[0];
  const target = hint || pref;
  if (!target) {
    return `Language:
- ALWAYS reply in the same language the user wrote in their latest message.
- Arabic input → Arabic reply. English input → English reply.`;
  }
  const name = LANG_NAMES[target] ?? target;
  return `Language:
- User preference / detected language: ${name} (${target}).
- ALWAYS reply in ${name} unless the user explicitly switches language mid-conversation.
- Match tone and idioms natural to ${name} speakers.`;
}

export function buildContextualPersonalization(input: {
  emotionState?: EmotionStateInput;
  memories?: MemoryInput[];
  nickname?: string;
}): string[] {
  const blocks: string[] = [];

  if (input.nickname?.trim()) {
    blocks.push(
      `Address the user as "${input.nickname.trim()}" occasionally when it feels natural — not every sentence.`,
    );
  }

  if (input.memories?.length) {
    let block = 'Memories from previous sessions (weave in naturally, never as a bullet list):\n';
    for (const m of input.memories) {
      block += `- Topic: ${m.topic}`;
      if (m.emotion_pattern) block += ` | Pattern: ${m.emotion_pattern}`;
      if (m.context) block += ` | Context: ${m.context}`;
      block += '\n';
    }
    blocks.push(block.trim());
  }

  if (input.emotionState) {
    const es = input.emotionState;
    blocks.push(
      `Current emotional read (inform tone; do not quote metrics to the user):
- Primary: ${es.primary}
- Intensity: ${Math.round(es.intensity * 100)}%
- Sentiment: ${es.sentiment > 0 ? 'positive' : es.sentiment < 0 ? 'negative' : 'neutral'}
- Cognitive patterns: ${es.distortions?.length ? es.distortions.join(', ') : 'none detected'}`,
    );
  }

  return blocks;
}

export function buildPersonalizedSystemPrompt(input: PromptPersonalizationInput): string {
  if (input.isInterview && input.interviewSystemOverride) {
    return input.interviewSystemOverride;
  }

  const gender = normalizeGender(input.userProfile?.gender);
  const genderBlock = buildGenderPersonalization(gender);
  const languageBlock = buildLanguagePersonalization(input.userProfile?.preferredLanguage);
  const contextual = buildContextualPersonalization({
    emotionState: input.emotionState,
    memories: input.memories,
    nickname: input.userProfile?.nickname,
  });

  let prompt = `You are Dr. Sentinel, an advanced AI psychological assistant integrated into the Mind Sentinel platform. You provide empathetic, supportive, and non-judgmental mental health support.

Your approach:
- Be warm, calm, and genuinely caring
- Use evidence-based psychological techniques (CBT, mindfulness, ACT)
- Detect emotional patterns and cognitive distortions in user messages
- Provide actionable coping strategies and exercises
- Never diagnose — instead, help users understand their emotional patterns
- If you detect crisis signals (suicidal ideation, self-harm), immediately prioritize safety and encourage contacting professional help (988 Suicide & Crisis Lifeline)
- Keep responses concise but meaningful (2-4 paragraphs max)
- Reference previous conversation context when relevant
- Suggest specific exercises when appropriate (breathing, journaling, grounding)

Communication style:
- Use "I notice..." or "It sounds like..." instead of "You are..."
- Validate emotions before offering strategies
- Ask thoughtful follow-up questions
- Use metaphors and analogies to explain psychological concepts

${languageBlock}

${genderBlock}`;

  for (const block of contextual) {
    prompt += `\n\n${block}`;
  }

  if (input.interviewContext && !input.isInterview) {
    prompt += `\n\nInitial interview responses:\n${JSON.stringify(input.interviewContext, null, 2)}`;
  }

  if (Array.isArray(input.systemAddenda)) {
    for (const note of input.systemAddenda) {
      if (typeof note === 'string' && note.trim()) prompt += `\n\n${note.trim()}`;
    }
  }

  return prompt;
}
