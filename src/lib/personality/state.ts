import { supabase } from '@/integrations/supabase/client';
import { DailyPulse } from '@/lib/presence/pulse';

export type Tone = 'warm' | 'gentle' | 'grounded' | 'hopeful' | 'protective';
export type Pacing = 'slow' | 'measured' | 'natural';
export type Depth = 'light' | 'moderate' | 'deep';

export interface PersonalityState {
  user_id: string;
  tone: Tone;
  empathy_level: number;     // 0..1
  pacing: Pacing;
  depth: Depth;
  trust_level: number;       // 0..1
  notes: string | null;
  updated_at: string;
}

export async function loadPersonality(userId: string): Promise<PersonalityState | null> {
  const { data } = await supabase
    .from('ai_personality_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as unknown as PersonalityState) ?? null;
}

export async function ensurePersonality(userId: string): Promise<PersonalityState> {
  const existing = await loadPersonality(userId);
  if (existing) return existing;
  const row: Omit<PersonalityState, 'updated_at'> = {
    user_id: userId,
    tone: 'warm',
    empathy_level: 0.7,
    pacing: 'measured',
    depth: 'moderate',
    trust_level: 0.3,
    notes: null,
  };
  await supabase.from('ai_personality_state').insert(row);
  return { ...row, updated_at: new Date().toISOString() };
}

export interface EvolveInput {
  totalSessions: number;
  consecutiveDays: number;
  pulses: DailyPulse[];
  recentDistress: number;   // 0..1, recent average intensity
}

export async function evolvePersonality(userId: string, input: EvolveInput): Promise<PersonalityState> {
  const current = await ensurePersonality(userId);

  const trust = Math.min(1, 0.2 + input.totalSessions * 0.04 + input.consecutiveDays * 0.02);
  const empathy = Math.min(1, 0.6 + input.recentDistress * 0.35);

  let tone: Tone = current.tone;
  if (input.recentDistress > 0.75) tone = 'protective';
  else if (input.recentDistress > 0.55) tone = 'gentle';
  else if (trust > 0.7) tone = 'grounded';
  else if (input.consecutiveDays >= 5) tone = 'hopeful';
  else tone = 'warm';

  const pacing: Pacing = input.recentDistress > 0.7 ? 'slow' : trust > 0.6 ? 'natural' : 'measured';
  const depth: Depth = trust > 0.75 ? 'deep' : trust > 0.45 ? 'moderate' : 'light';

  const next: Partial<PersonalityState> = {
    tone, empathy_level: empathy, pacing, depth, trust_level: trust,
  };
  await supabase.from('ai_personality_state').update(next).eq('user_id', userId);
  return { ...current, ...next, updated_at: new Date().toISOString() };
}

export function personalityForSystemPrompt(p: PersonalityState | null): string {
  if (!p) return '';
  const toneCopy: Record<Tone, string> = {
    warm: 'Be warm and welcoming.',
    gentle: 'Be especially gentle, soft-spoken, and patient — the user is carrying weight right now.',
    grounded: 'Be grounded and steady — the user trusts this space; you can be more direct without losing care.',
    hopeful: 'Carry quiet hopefulness in your tone — the user has been showing up consistently.',
    protective: 'Be deeply protective and stabilising. Slow everything down. Prioritise safety, breath, and grounding before anything else.',
  };
  const pacingCopy: Record<Pacing, string> = {
    slow: 'Use very short paragraphs and pauses. Match a slower nervous system.',
    measured: 'Keep responses calm and unhurried.',
    natural: 'Speak more naturally and conversationally.',
  };
  const depthCopy: Record<Depth, string> = {
    light: 'Stay near the surface. Validate, reflect, ask gentle questions. Avoid heavy reframes yet.',
    moderate: 'You may offer light reframes and CBT-style observations.',
    deep: 'You have permission to go deeper — explore root patterns, attachments, and meaning.',
  };
  return [
    'EVOLVED PERSONALITY (apply to this response):',
    toneCopy[p.tone],
    pacingCopy[p.pacing],
    depthCopy[p.depth],
    `Empathy dial: ${Math.round(p.empathy_level * 100)}%. Trust level: ${Math.round(p.trust_level * 100)}%.`,
  ].join(' ');
}
