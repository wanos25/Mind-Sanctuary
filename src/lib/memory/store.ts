import { supabase } from '@/integrations/supabase/client';
import { EmotionalMemory, MemoryDraft, MemoryRelationship } from './types';
import { memoryKey } from './extractor';

/**
 * Memory store — write/read/reinforce emotional memories.
 * Reinforcement: if a near-duplicate memory exists, bump recurrence_score
 * and emotional_weight rather than inserting a new row.
 */

export async function listMemories(userId: string, limit = 200): Promise<EmotionalMemory[]> {
  const { data, error } = await supabase
    .from('emotional_memories')
    .select('*')
    .eq('user_id', userId)
    .order('emotional_weight', { ascending: false })
    .limit(limit);
  if (error) { console.warn('listMemories', error); return []; }
  return (data ?? []) as unknown as EmotionalMemory[];
}

export async function listRelationships(userId: string): Promise<MemoryRelationship[]> {
  const { data, error } = await supabase
    .from('memory_relationships')
    .select('*')
    .eq('user_id', userId);
  if (error) { console.warn('listRelationships', error); return []; }
  return (data ?? []) as unknown as MemoryRelationship[];
}

/**
 * Insert new memories or reinforce existing ones.
 * Returns the affected memory ids.
 */
export async function upsertMemories(
  userId: string,
  drafts: MemoryDraft[],
  sessionId?: string | null,
): Promise<string[]> {
  if (!drafts.length) return [];
  const existing = await listMemories(userId, 500);
  const byKey = new Map(existing.map((m) => [memoryKey(m.type, m.title), m]));
  const ids: string[] = [];

  for (const d of drafts) {
    const key = memoryKey(d.type, d.title);
    const prior = byKey.get(key);
    if (prior) {
      const newRec = prior.recurrence_score + 1;
      const newWeight = Math.min(0.99, prior.emotional_weight + 0.05);
      const newConf = Math.min(0.99, prior.confidence + 0.05);
      const sources = sessionId && !prior.source_session_ids.includes(sessionId)
        ? [...prior.source_session_ids, sessionId]
        : prior.source_session_ids;
      const { error } = await supabase
        .from('emotional_memories')
        .update({
          recurrence_score: newRec,
          emotional_weight: newWeight,
          confidence: newConf,
          source_session_ids: sources,
          last_referenced_at: new Date().toISOString(),
          emotion: d.emotion ?? prior.emotion,
        })
        .eq('id', prior.id);
      if (!error) {
        ids.push(prior.id);
        await logEvent(userId, prior.id, sessionId ?? null, 'reinforce', d.emotional_weight ?? 0.5);
      }
    } else {
      const { data, error } = await supabase
        .from('emotional_memories')
        .insert({
          user_id: userId,
          type: d.type,
          title: d.title,
          content: d.content ?? null,
          emotion: d.emotion ?? null,
          emotional_weight: d.emotional_weight ?? 0.5,
          confidence: d.confidence ?? 0.5,
          tags: d.tags ?? [],
          source_session_ids: sessionId ? [sessionId] : [],
        })
        .select('id')
        .single();
      const newId = (data as { id?: string } | null)?.id;
      if (!error && newId) {
        ids.push(newId);
        await logEvent(userId, newId, sessionId ?? null, 'create', d.emotional_weight ?? 0.5);
      } else if (error) {
        console.warn('insert memory', error);
      }
    }
  }
  return ids;
}

async function logEvent(
  userId: string, memoryId: string, sessionId: string | null,
  eventType: string, intensity: number,
) {
  await supabase.from('memory_events').insert({
    user_id: userId,
    memory_id: memoryId,
    session_id: sessionId,
    event_type: eventType,
    intensity,
  });
}

export async function touchMemories(userId: string, ids: string[]) {
  if (!ids.length) return;
  await supabase
    .from('emotional_memories')
    .update({ last_referenced_at: new Date().toISOString() })
    .in('id', ids)
    .eq('user_id', userId);
  for (const id of ids) await logEvent(userId, id, null, 'recall', 0.5);
}

/**
 * Build relationships between memories that share tags / sessions.
 * Idempotent-ish — skips pairs that already exist.
 */
export async function reconcileRelationships(userId: string) {
  const memories = await listMemories(userId, 500);
  const existing = await listRelationships(userId);
  const seen = new Set(existing.map((r) => `${r.from_memory_id}::${r.to_memory_id}`));
  const inserts: Array<{ user_id: string; from_memory_id: string; to_memory_id: string; relation_type: string; strength: number }> = [];
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const a = memories[i], b = memories[j];
      const sharedTags = a.tags.filter((t) => b.tags.includes(t));
      const sharedSessions = a.source_session_ids.filter((s) => b.source_session_ids.includes(s));
      if (sharedTags.length === 0 && sharedSessions.length === 0) continue;
      const strength = Math.min(1, sharedTags.length * 0.3 + sharedSessions.length * 0.4);
      if (strength < 0.3) continue;
      const key = `${a.id}::${b.id}`;
      if (seen.has(key)) continue;
      inserts.push({
        user_id: userId,
        from_memory_id: a.id,
        to_memory_id: b.id,
        relation_type: sharedSessions.length ? 'co-session' : 'shared-tag',
        strength,
      });
      if (inserts.length >= 100) break;
    }
    if (inserts.length >= 100) break;
  }
  if (inserts.length) {
    await supabase.from('memory_relationships').insert(inserts);
  }
}
