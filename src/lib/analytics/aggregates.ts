/**
 * R6 foundation — read-only helper. No active writer/worker yet.
 */
import { sbExt } from '@/lib/supabaseExt';

export interface AnalyticsAggregate {
  id: string;
  user_id: string;
  period: string;
  period_start: string;
  period_end: string;
  dimension: string;
  metrics: Record<string, unknown>;
  archived: boolean;
  created_at: string;
}

export async function listOwnAggregates(userId: string): Promise<AnalyticsAggregate[]> {
  const { data, error } = await sbExt
    .from('analytics_aggregates')
    .select('*')
    .eq('user_id', userId)
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as AnalyticsAggregate[];
}
