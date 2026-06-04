-- =============================================================
-- R7 — Advanced Therapeutic Activity System (additive only)
-- =============================================================

-- 1. video_watch_progress -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.video_watch_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  video_item_id text NOT NULL,
  position_sec real NOT NULL DEFAULT 0,
  duration_sec real,
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_watch_progress_unique UNIQUE (user_id, asset_id, video_item_id)
);

ALTER TABLE public.video_watch_progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view own video progress" ON public.video_watch_progress
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users insert own video progress" ON public.video_watch_progress
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own video progress" ON public.video_watch_progress
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_vwp_user_updated
  ON public.video_watch_progress (user_id, updated_at DESC);

COMMENT ON TABLE public.video_watch_progress IS
  'R7 — Per-user playback progress for educational video items. Owner-only RLS.';

-- 2. activity_templates -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  kind public.activity_kind NOT NULL,
  title text NOT NULL,
  description text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_shared boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Doctors view own or shared templates" ON public.activity_templates
    FOR SELECT TO authenticated
    USING (
      public.has_role(auth.uid(), 'doctor'::public.app_role)
      AND (created_by = auth.uid() OR is_shared = true)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Doctors insert own templates" ON public.activity_templates
    FOR INSERT TO authenticated
    WITH CHECK (
      public.has_role(auth.uid(), 'doctor'::public.app_role)
      AND created_by = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Doctors update own templates" ON public.activity_templates
    FOR UPDATE TO authenticated
    USING (
      public.has_role(auth.uid(), 'doctor'::public.app_role)
      AND created_by = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_act_templates_created_desc
  ON public.activity_templates (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_act_templates_owner
  ON public.activity_templates (created_by);

COMMENT ON TABLE public.activity_templates IS
  'R7 — Doctor-owned reusable CBT/activity templates. Shareable across doctors when is_shared=true.';

-- updated_at trigger
DO $$ BEGIN
  CREATE TRIGGER trg_activity_templates_updated_at
    BEFORE UPDATE ON public.activity_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_video_watch_progress_updated_at
    BEFORE UPDATE ON public.video_watch_progress
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
