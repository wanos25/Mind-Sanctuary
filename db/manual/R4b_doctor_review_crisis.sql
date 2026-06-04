-- ============================================================================
-- R4b — Doctor Review Workflow & Crisis Management
-- Target backend: fsterbxivhhzipfgpvou (CANONICAL)
-- Also safe to apply to legacy Cloud backend for parity.
-- ============================================================================
-- Properties:
--   * APPEND-ONLY. No DROP TABLE / ALTER on existing tables / destructive ops.
--   * Idempotent (safe to re-run).
--   * Preserves all existing RLS, R1/R2/R3/R4a behaviors.
--   * Depends on R4a: public.has_role(uuid, public.app_role).
-- ============================================================================

-- 1) doctor_reviews ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctor_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  status      text NOT NULL CHECK (status IN ('pending','in_review','closed','escalated')),
  summary     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.doctor_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doctors read reviews"        ON public.doctor_reviews;
DROP POLICY IF EXISTS "doctors insert reviews"      ON public.doctor_reviews;
DROP POLICY IF EXISTS "patients read own reviews"   ON public.doctor_reviews;

CREATE POLICY "doctors read reviews"
  ON public.doctor_reviews FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "doctors insert reviews"
  ON public.doctor_reviews FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'doctor') AND doctor_id = auth.uid());

CREATE POLICY "patients read own reviews"
  ON public.doctor_reviews FOR SELECT
  USING (auth.uid() = patient_id);

-- Truly append-only: NO update / delete policies are created.

CREATE INDEX IF NOT EXISTS idx_doctor_reviews_patient    ON public.doctor_reviews(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_reviews_doctor     ON public.doctor_reviews(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_reviews_status     ON public.doctor_reviews(status);
CREATE INDEX IF NOT EXISTS idx_doctor_reviews_created    ON public.doctor_reviews(created_at DESC);

-- 2) treatment_notes ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.treatment_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   uuid REFERENCES public.doctor_reviews(id) ON DELETE CASCADE,
  doctor_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note        text NOT NULL,
  visibility  text NOT NULL DEFAULT 'doctor' CHECK (visibility IN ('doctor','patient_visible')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doctors read notes"           ON public.treatment_notes;
DROP POLICY IF EXISTS "doctors insert notes"         ON public.treatment_notes;
DROP POLICY IF EXISTS "patients read visible notes"  ON public.treatment_notes;

CREATE POLICY "doctors read notes"
  ON public.treatment_notes FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "doctors insert notes"
  ON public.treatment_notes FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'doctor') AND doctor_id = auth.uid());

CREATE POLICY "patients read visible notes"
  ON public.treatment_notes FOR SELECT
  USING (auth.uid() = patient_id AND visibility = 'patient_visible');

-- Append-only: no update / delete policies.

CREATE INDEX IF NOT EXISTS idx_treatment_notes_patient ON public.treatment_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_notes_review  ON public.treatment_notes(review_id);
CREATE INDEX IF NOT EXISTS idx_treatment_notes_created ON public.treatment_notes(created_at DESC);

-- 3) crisis_flags ------------------------------------------------------------
-- message_id FK is added conditionally so this file remains portable across
-- environments where public.chat_messages may not yet exist.
CREATE TABLE IF NOT EXISTS public.crisis_flags (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id       uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  message_id       uuid,
  severity         text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  source           text NOT NULL CHECK (source IN ('system','doctor','self_report')),
  reason           text,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  acknowledged_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_messages'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'crisis_flags'
      AND constraint_name = 'crisis_flags_message_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.crisis_flags
             ADD CONSTRAINT crisis_flags_message_id_fkey
             FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON DELETE SET NULL';
  END IF;
END $$;

ALTER TABLE public.crisis_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doctors read flags"          ON public.crisis_flags;
DROP POLICY IF EXISTS "doctors insert flags"        ON public.crisis_flags;
DROP POLICY IF EXISTS "doctors update flag ack"     ON public.crisis_flags;
DROP POLICY IF EXISTS "patients self insert flag"   ON public.crisis_flags;
DROP POLICY IF EXISTS "patients read own flags"     ON public.crisis_flags;

CREATE POLICY "doctors read flags"
  ON public.crisis_flags FOR SELECT
  USING (public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "doctors insert flags"
  ON public.crisis_flags FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "doctors update flag ack"
  ON public.crisis_flags FOR UPDATE
  USING (public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "patients self insert flag"
  ON public.crisis_flags FOR INSERT
  WITH CHECK (auth.uid() = patient_id AND source = 'self_report');

CREATE POLICY "patients read own flags"
  ON public.crisis_flags FOR SELECT
  USING (auth.uid() = patient_id);

CREATE INDEX IF NOT EXISTS idx_crisis_flags_status    ON public.crisis_flags(status);
CREATE INDEX IF NOT EXISTS idx_crisis_flags_severity  ON public.crisis_flags(severity);
CREATE INDEX IF NOT EXISTS idx_crisis_flags_patient   ON public.crisis_flags(patient_id);
CREATE INDEX IF NOT EXISTS idx_crisis_flags_created   ON public.crisis_flags(created_at DESC);
