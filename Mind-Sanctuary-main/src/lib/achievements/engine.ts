import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Achievement {
  code: string;
  title: string;
  description: string;
}

export const CATALOG: Record<string, Achievement> = {
  first_reflection: { code: 'first_reflection', title: 'First Reflection', description: 'You opened the door.' },
  consistency_7: { code: 'consistency_7', title: '7-Day Consistency', description: 'A week of presence with yourself.' },
  consistency_30: { code: 'consistency_30', title: '30-Day Consistency', description: 'A month of inner work.' },
  breakthrough: { code: 'breakthrough', title: 'Emotional Breakthrough', description: 'A new clarity emerged.' },
  night_thinker: { code: 'night_thinker', title: 'Night Thinker', description: 'You met yourself in the quiet hours.' },
  recovery_arc: { code: 'recovery_arc', title: 'Recovery Arc', description: 'You moved from heaviness to lightness.' },
  calm_streak: { code: 'calm_streak', title: 'Calm Streak', description: 'Three days of steady presence.' },
  deep_reflection: { code: 'deep_reflection', title: 'Deep Reflection', description: 'A long, considered conversation.' },
  memory_keeper: { code: 'memory_keeper', title: 'Memory Keeper', description: 'Twenty memories woven into your inner map.' },
};

interface UnlockedRow { code: string }

export async function loadAchievements(userId: string) {
  const { data } = await supabase
    .from('achievements')
    .select('*')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false });
  return (data ?? []) as unknown as Array<Achievement & { unlocked_at: string }>;
}

async function unlockedCodes(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('achievements')
    .select('code')
    .eq('user_id', userId);
  return new Set(((data ?? []) as UnlockedRow[]).map((r) => r.code));
}

async function unlock(userId: string, code: string) {
  const a = CATALOG[code];
  if (!a) return;
  const { error } = await supabase.from('achievements').insert({
    user_id: userId, code: a.code, title: a.title, description: a.description,
  });
  if (!error) {
    toast(`✦ ${a.title}`, { description: a.description, duration: 6000 });
  }
}

export interface AchievementSignals {
  totalSessions: number;
  totalMessages: number;
  consecutiveDays: number;
  hadBreakthrough: boolean;
  isNightSession: boolean;
  recoveryArcDetected: boolean;
  calmStreakDays: number;
  longSession: boolean;
  memoryCount: number;
}

export async function evaluate(userId: string, s: AchievementSignals) {
  const have = await unlockedCodes(userId);
  const tasks: Promise<void>[] = [];
  const tryUnlock = (code: string, cond: boolean) => {
    if (cond && !have.has(code)) tasks.push(unlock(userId, code));
  };

  tryUnlock('first_reflection', s.totalSessions >= 1);
  tryUnlock('consistency_7', s.consecutiveDays >= 7);
  tryUnlock('consistency_30', s.consecutiveDays >= 30);
  tryUnlock('breakthrough', s.hadBreakthrough);
  tryUnlock('night_thinker', s.isNightSession);
  tryUnlock('recovery_arc', s.recoveryArcDetected);
  tryUnlock('calm_streak', s.calmStreakDays >= 3);
  tryUnlock('deep_reflection', s.longSession);
  tryUnlock('memory_keeper', s.memoryCount >= 20);

  await Promise.all(tasks);
}
