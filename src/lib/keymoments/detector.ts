import { supabase } from '@/integrations/supabase/client';
import { EmotionState } from '@/context/AppContext';

export type MomentType = 'breakthrough' | 'spike' | 'recovery' | 'distortion' | 'crisis';

export interface KeyMomentInput {
  userId: string;
  sessionId: string;
  messageId: string | null;
  position: number;
  emotion: EmotionState;
  text: string;
  prevEmotion: EmotionState | null;
}

const breakthroughCues = [
  'i realize', 'i realized', 'now i see', 'makes sense', 'i understand',
  'for the first time', 'i forgive', 'i let go', 'i can let it go',
  'i feel lighter', 'i feel free',
];

export interface DetectedMoment {
  moment_type: MomentType;
  intensity: number;
  emotion?: string;
  summary?: string;
}

export function detectMoment(input: KeyMomentInput): DetectedMoment | null {
  const { emotion, text, prevEmotion } = input;
  const lower = text.toLowerCase();

  if (breakthroughCues.some((c) => lower.includes(c))) {
    return {
      moment_type: 'breakthrough',
      intensity: emotion.intensity,
      emotion: emotion.primary,
      summary: text.slice(0, 160),
    };
  }
  if (emotion.intensity >= 0.85) {
    return {
      moment_type: emotion.primary.includes('depress') || emotion.intensity >= 0.92 ? 'crisis' : 'spike',
      intensity: emotion.intensity,
      emotion: emotion.primary,
      summary: text.slice(0, 160),
    };
  }
  if (prevEmotion && prevEmotion.intensity - emotion.intensity >= 0.35 && emotion.intensity < 0.5) {
    return {
      moment_type: 'recovery',
      intensity: 1 - emotion.intensity,
      emotion: emotion.primary,
      summary: 'Intensity eased — a softer turn.',
    };
  }
  if (emotion.distortions.length >= 2) {
    return {
      moment_type: 'distortion',
      intensity: emotion.intensity,
      emotion: emotion.primary,
      summary: `Patterns: ${emotion.distortions.join(', ')}`,
    };
  }
  return null;
}

export async function persistMoment(input: KeyMomentInput, moment: DetectedMoment) {
  await supabase.from('key_moments').insert({
    user_id: input.userId,
    session_id: input.sessionId,
    message_id: input.messageId,
    moment_type: moment.moment_type,
    intensity: moment.intensity,
    emotion: moment.emotion ?? null,
    summary: moment.summary ?? null,
    position: input.position,
  });
}

export async function listMomentsForSession(userId: string, sessionId: string) {
  const { data } = await supabase
    .from('key_moments')
    .select('*')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('position', { ascending: true });
  return (data ?? []) as unknown as Array<{
    id: string; moment_type: MomentType; intensity: number;
    emotion: string | null; summary: string | null; position: number;
    message_id: string | null; created_at: string;
  }>;
}
