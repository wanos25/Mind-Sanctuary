/**
 * Extended content shapes authored by the Dynamic Activity Builder.
 * Existing simple shapes in `types.ts` remain valid; these supersede them at runtime.
 */

export interface VideoPlaylistItem {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  storage_path?: string;
  thumbnail_url?: string;
  duration_sec?: number;
  tags?: string[];
  difficulty?: 'gentle' | 'moderate' | 'challenging';
  emotional_goal?: string;
}

export interface VideoPlaylistContent {
  version: 2;
  playlists: {
    id: string;
    name: string;
    description?: string;
    items: VideoPlaylistItem[];
  }[];
}

export interface SpotMarker {
  id: string;
  /** Normalized 0..1 coordinates relative to image A. */
  x: number;
  y: number;
  /** Radius in normalized units. */
  r: number;
  label?: string;
}

export interface SpotDifferenceBuilderContent {
  version: 2;
  image_a_url: string;
  image_a_path?: string;
  image_b_url: string;
  image_b_path?: string;
  /** Authoring grid: normalized 0..1 marker coordinates. */
  markers: SpotMarker[];
  /** Tolerance radius (0..1) for accepting a tap as a hit on a marker. */
  tap_tolerance?: number;
  /** R7 gameplay options. */
  difficulty?: 'easy' | 'medium' | 'hard';
  time_limit_sec?: number;
  hint_penalty?: number;
  hints_enabled?: boolean;
}

export function isVideoPlaylistContent(c: unknown): c is VideoPlaylistContent {
  return !!c && typeof c === 'object' && (c as { version?: number }).version === 2 && Array.isArray((c as VideoPlaylistContent).playlists);
}

export function isSpotBuilderContent(c: unknown): c is SpotDifferenceBuilderContent {
  return !!c && typeof c === 'object' && (c as { version?: number }).version === 2 && Array.isArray((c as SpotDifferenceBuilderContent).markers);
}

/* --------------------------------------------------------------------------
 * R7 — CBT Flow v2 (Therapeutic Session Builder)
 * -------------------------------------------------------------------------- */

export type CBTNodeKind = 'reflection' | 'question' | 'checkpoint' | 'scoring' | 'branch';

export interface CBTNodeBase {
  id: string;
  kind: CBTNodeKind;
  title?: string;
  prompt?: string;
  weight?: number;
}

export interface CBTReflectionNode extends CBTNodeBase { kind: 'reflection'; body: string; }
export interface CBTQuestionNode extends CBTNodeBase {
  kind: 'question';
  question: string;
  placeholder?: string;
  min_chars?: number;
}
export interface CBTCheckpointNode extends CBTNodeBase {
  kind: 'checkpoint';
  label: string;
  /** Patient slider 0..10 capturing felt emotional intensity. */
  scale_min?: number;
  scale_max?: number;
}
export interface CBTScoringNode extends CBTNodeBase {
  kind: 'scoring';
  component: string;
  formula?: 'avg_checkpoints' | 'sum_weights' | 'constant';
  constant?: number;
}
export interface CBTBranchNode extends CBTNodeBase {
  kind: 'branch';
  description?: string;
}

export type CBTNode =
  | CBTReflectionNode
  | CBTQuestionNode
  | CBTCheckpointNode
  | CBTScoringNode
  | CBTBranchNode;

/**
 * Edge predicate. `to` is the destination node id. `when` is evaluated against
 * the accumulated answers/checkpoint values: missing predicate = unconditional.
 */
export interface CBTEdge {
  id: string;
  from: string;
  to: string;
  when?: {
    /** node id whose value is checked */
    var: string;
    op: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq' | 'contains' | 'truthy';
    value?: string | number;
  };
}

export interface CBTFlowV2Content {
  version: 2;
  start_node_id: string;
  nodes: CBTNode[];
  edges: CBTEdge[];
  /** Optional human-readable template label this asset was derived from. */
  template_meta?: { template_id?: string; name?: string };
  scoring?: { goal?: string; max_score?: number };
}

export function isCBTFlowV2(c: unknown): c is CBTFlowV2Content {
  return !!c
    && typeof c === 'object'
    && (c as { version?: number }).version === 2
    && Array.isArray((c as CBTFlowV2Content).nodes)
    && Array.isArray((c as CBTFlowV2Content).edges);
}

/** Validation result for publish-gate. */
export interface CBTValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCBTFlow(c: CBTFlowV2Content): CBTValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set(c.nodes.map(n => n.id));
  if (!c.start_node_id) errors.push('Missing start_node_id');
  else if (!ids.has(c.start_node_id)) errors.push(`start_node_id "${c.start_node_id}" not found in nodes`);
  if (c.nodes.length === 0) errors.push('Flow has no nodes');

  // dangling edges
  for (const e of c.edges) {
    if (!ids.has(e.from)) errors.push(`Edge ${e.id} references missing source ${e.from}`);
    if (!ids.has(e.to)) errors.push(`Edge ${e.id} references missing target ${e.to}`);
  }

  // reachability (BFS from start)
  const reach = new Set<string>();
  if (c.start_node_id && ids.has(c.start_node_id)) {
    const q = [c.start_node_id];
    while (q.length) {
      const n = q.shift()!;
      if (reach.has(n)) continue;
      reach.add(n);
      for (const e of c.edges) if (e.from === n) q.push(e.to);
    }
  }
  for (const n of c.nodes) {
    if (!reach.has(n.id)) warnings.push(`Node "${n.id}" is unreachable from start`);
  }

  // simple cycle detection via DFS
  const adj = new Map<string, string[]>();
  for (const e of c.edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  c.nodes.forEach(n => color.set(n.id, WHITE));
  let hasCycle = false;
  function dfs(u: string) {
    color.set(u, GRAY);
    for (const v of adj.get(u) ?? []) {
      const cv = color.get(v);
      if (cv === GRAY) { hasCycle = true; return; }
      if (cv === WHITE) dfs(v);
    }
    color.set(u, BLACK);
  }
  if (c.start_node_id && ids.has(c.start_node_id)) dfs(c.start_node_id);
  if (hasCycle) errors.push('Flow contains a cycle (infinite loop)');

  return { ok: errors.length === 0, errors, warnings };
}

/** Evaluate which edge to follow next from a node given accumulated values. */
export function nextNodeId(
  flow: CBTFlowV2Content,
  fromId: string,
  vars: Record<string, unknown>,
): string | null {
  const candidates = flow.edges.filter(e => e.from === fromId);
  // conditional first
  for (const e of candidates) {
    if (!e.when) continue;
    const v = vars[e.when.var];
    if (matchPredicate(v, e.when)) return e.to;
  }
  // fallback unconditional
  const fallback = candidates.find(e => !e.when);
  return fallback ? fallback.to : null;
}

function matchPredicate(v: unknown, when: NonNullable<CBTEdge['when']>): boolean {
  const target = when.value;
  switch (when.op) {
    case 'truthy': return !!v;
    case 'eq':  return v === target;
    case 'neq': return v !== target;
    case 'gt':  return typeof v === 'number' && typeof target === 'number' && v > target;
    case 'gte': return typeof v === 'number' && typeof target === 'number' && v >= target;
    case 'lt':  return typeof v === 'number' && typeof target === 'number' && v < target;
    case 'lte': return typeof v === 'number' && typeof target === 'number' && v <= target;
    case 'contains':
      return typeof v === 'string' && typeof target === 'string' && v.toLowerCase().includes(target.toLowerCase());
    default: return false;
  }
}
