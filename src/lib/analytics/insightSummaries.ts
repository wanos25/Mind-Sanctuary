/**
 * R6 foundation — read-only helper. No active writer yet.
 */
import { sbExt } from '@/lib/supabaseExt';

export interface AIInsightSummary {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  model: string | null;
  content: Record<string, unknown>;
  source_refs: unknown[];
  archived: boolean;
  created_at: string;
}

export async function listOwnInsightSummaries(userId: string): Promise<AIInsightSummary[]> {
  const { data, error } = await sbExt
    .from('ai_insight_summaries')
    .select('*')
    .eq('user_id', userId)
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as AIInsightSummary[];
}
