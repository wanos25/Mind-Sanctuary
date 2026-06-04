/**
 * R5 — Activities Hub types.
 * Schema names mirror `public.activity_kind` enum + `activity_assets` / `activity_sessions` tables.
 */

export type ActivityKind =
  | 'cbt_flow'
  | 'image_interpretation'
  | 'educational_video'
  | 'spot_difference';

export interface CBTFlowContent {
  prompt: string;
  steps: { id: string; question: string; placeholder?: string }[];
}

export interface ImageInterpretationContent {
  image_url: string;
  prompt: string;
  hints?: string[];
}

export interface EducationalVideoContent {
  video_url: string;
  summary: string;
  questions?: { id: string; question: string }[];
}

export interface SpotDifferenceContent {
  image_a_url: string;
  image_b_url: string;
  total_differences: number;
}

export type ActivityContent =
  | CBTFlowContent
  | ImageInterpretationContent
  | EducationalVideoContent
  | SpotDifferenceContent
  // Permissive fallback to allow builder-authored shapes (v2 video playlists, spot-difference marker grids).
  | Record<string, any>;

export interface ActivityAsset {
  id: string;
  kind: ActivityKind;
  title: string;
  description: string | null;
  content: ActivityContent;
  locale: string;
  published: boolean;
  archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivitySession {
  id: string;
  user_id: string;
  asset_id: string;
  kind: ActivityKind;
  response: Record<string, unknown>;
  score: number | null;
  metadata: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  archived: boolean;
  created_at: string;
  session_id?: string | null;
}

export const MAX_RESPONSE_BYTES = 8 * 1024;
