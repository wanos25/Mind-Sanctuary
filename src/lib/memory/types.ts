export type MemoryType =
  | 'person' | 'goal' | 'fear' | 'trigger' | 'recovery'
  | 'achievement' | 'preference' | 'theme' | 'event' | 'habit';

export interface EmotionalMemory {
  id: string;
  user_id: string;
  type: MemoryType;
  title: string;
  content: string | null;
  emotion: string | null;
  emotional_weight: number;       // 0..1
  recurrence_score: number;       // ≥1
  confidence: number;             // 0..1
  tags: string[];
  source_session_ids: string[];
  embedding: unknown | null;
  last_referenced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryRelationship {
  id: string;
  user_id: string;
  from_memory_id: string;
  to_memory_id: string;
  relation_type: string;
  strength: number;
  created_at: string;
}

export interface MemoryDraft {
  type: MemoryType;
  title: string;
  content?: string;
  emotion?: string;
  emotional_weight?: number;
  confidence?: number;
  tags?: string[];
}
