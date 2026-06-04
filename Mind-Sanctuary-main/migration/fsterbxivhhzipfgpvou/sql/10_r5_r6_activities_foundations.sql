-- =========================================================
-- Doctor role infrastructure (idempotent — only if missing)
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles (role);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =========================================================
-- R5: Activities Hub
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.activity_kind AS ENUM (
    'cbt_flow','image_interpretation','educational_video','spot_difference'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.activity_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.activity_kind NOT NULL,
  title text NOT NULL,
  description text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  locale text NOT NULL DEFAULT 'en',
  published boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Doctors can insert activity assets" ON public.activity_assets;
CREATE POLICY "Doctors can insert activity assets"
  ON public.activity_assets FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'doctor'::public.app_role));

DROP POLICY IF EXISTS "Doctors can update activity assets" ON public.activity_assets;
CREATE POLICY "Doctors can update activity assets"
  ON public.activity_assets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'::public.app_role));

DROP POLICY IF EXISTS "Doctors can view all activity assets" ON public.activity_assets;
CREATE POLICY "Doctors can view all activity assets"
  ON public.activity_assets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'::public.app_role));

DROP POLICY IF EXISTS "Users can view published activity assets" ON public.activity_assets;
CREATE POLICY "Users can view published activity assets"
  ON public.activity_assets FOR SELECT TO authenticated
  USING (published = true AND archived = false);

CREATE INDEX IF NOT EXISTS idx_activity_assets_kind ON public.activity_assets (kind);
CREATE INDEX IF NOT EXISTS idx_activity_assets_published ON public.activity_assets (published, archived);
CREATE INDEX IF NOT EXISTS idx_activity_assets_created_at ON public.activity_assets (created_at DESC);

DROP TRIGGER IF EXISTS update_activity_assets_updated_at ON public.activity_assets;
CREATE TRIGGER update_activity_assets_updated_at
  BEFORE UPDATE ON public.activity_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.activity_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES public.activity_assets(id) ON DELETE CASCADE,
  kind public.activity_kind NOT NULL,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  score real,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_sessions_response_size CHECK (octet_length(response::text) < 64000)
);

-- Defensive FK guard to sessions (optional link)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sessions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='activity_sessions' AND column_name='session_id'
    ) THEN
      ALTER TABLE public.activity_sessions
        ADD COLUMN session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

ALTER TABLE public.activity_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own activity sessions select" ON public.activity_sessions;
CREATE POLICY "Users manage own activity sessions select"
  ON public.activity_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'doctor'::public.app_role));

DROP POLICY IF EXISTS "Users manage own activity sessions insert" ON public.activity_sessions;
CREATE POLICY "Users manage own activity sessions insert"
  ON public.activity_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own activity sessions update" ON public.activity_sessions;
CREATE POLICY "Users manage own activity sessions update"
  ON public.activity_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_activity_sessions_user ON public.activity_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_sessions_asset ON public.activity_sessions (asset_id);
CREATE INDEX IF NOT EXISTS idx_activity_sessions_kind ON public.activity_sessions (kind);

-- =========================================================
-- R6: Foundation tables (no active writers yet)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.analytics_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  dimension text NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.analytics_aggregates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own analytics aggregates" ON public.analytics_aggregates;
CREATE POLICY "Users view own analytics aggregates"
  ON public.analytics_aggregates FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_aggregates_user_created ON public.analytics_aggregates (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_aggregates_period ON public.analytics_aggregates (user_id, period, period_start DESC);
COMMENT ON TABLE public.analytics_aggregates IS 'R6 foundation — no active writer yet. Periodic rollups for dashboards.';

CREATE TABLE IF NOT EXISTS public.ai_insight_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  model text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_insight_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own ai insight summaries" ON public.ai_insight_summaries;
CREATE POLICY "Users view own ai insight summaries"
  ON public.ai_insight_summaries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insight_summaries_user_created ON public.ai_insight_summaries (user_id, created_at DESC);
COMMENT ON TABLE public.ai_insight_summaries IS 'R6 foundation — no active writer yet. AI-authored long-form period summaries.';

CREATE TABLE IF NOT EXISTS public.notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own notification queue" ON public.notification_queue;
CREATE POLICY "Users view own notification queue"
  ON public.notification_queue FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_created ON public.notification_queue (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status_scheduled ON public.notification_queue (status, scheduled_for);
COMMENT ON TABLE public.notification_queue IS 'R6 foundation — no active worker/provider yet. Stub queue for future reminders.';

CREATE TABLE IF NOT EXISTS public.activity_score_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_session_id uuid NOT NULL REFERENCES public.activity_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  component text NOT NULL,
  value real NOT NULL DEFAULT 0,
  weight real NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_score_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own activity score components" ON public.activity_score_components;
CREATE POLICY "Users view own activity score components"
  ON public.activity_score_components FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_activity_score_components_session ON public.activity_score_components (activity_session_id);
CREATE INDEX IF NOT EXISTS idx_activity_score_components_user_created ON public.activity_score_components (user_id, created_at DESC);
COMMENT ON TABLE public.activity_score_components IS 'R6 foundation — no active writer yet. Extensible per-session score breakdown.';

CREATE TABLE IF NOT EXISTS public.clinician_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL,
  target_user_id uuid,
  format text NOT NULL DEFAULT 'pdf',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  result_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clinician_exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Doctors view clinician exports" ON public.clinician_exports;
CREATE POLICY "Doctors view clinician exports"
  ON public.clinician_exports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'::public.app_role));
DROP POLICY IF EXISTS "Doctors insert clinician exports" ON public.clinician_exports;
CREATE POLICY "Doctors insert clinician exports"
  ON public.clinician_exports FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'doctor'::public.app_role) AND auth.uid() = doctor_id);
CREATE INDEX IF NOT EXISTS idx_clinician_exports_doctor_created ON public.clinician_exports (doctor_id, created_at DESC);
COMMENT ON TABLE public.clinician_exports IS 'R6 foundation — no active export worker yet. Future PDF/CSV exports for clinicians.';