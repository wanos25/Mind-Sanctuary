-- Production hardening: private chat-attachments + clinical staff RLS.

-- ---------------------------------------------------------------------------
-- Clinical staff helper (doctor OR admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_clinical_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'doctor'::public.app_role)
      OR public.has_role(_user_id, 'admin'::public.app_role);
$$;

-- ---------------------------------------------------------------------------
-- Storage: chat-attachments private + scoped SELECT
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
   SET public = false
 WHERE id = 'chat-attachments';

DROP POLICY IF EXISTS "Anyone can read chat attachments" ON storage.objects;

DROP POLICY IF EXISTS "Users read own chat attachments" ON storage.objects;
CREATE POLICY "Users read own chat attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Clinical staff read chat attachments" ON storage.objects;
CREATE POLICY "Clinical staff read chat attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND public.is_clinical_staff(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Doctor / admin read policies on core clinical tables
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "doctors read sessions" ON public.sessions;
CREATE POLICY "doctors read sessions"
  ON public.sessions FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));

DROP POLICY IF EXISTS "doctors read chat_messages" ON public.chat_messages;
CREATE POLICY "doctors read chat_messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));

DROP POLICY IF EXISTS "doctors read emotion_analyses" ON public.emotion_analyses;
CREATE POLICY "doctors read emotion_analyses"
  ON public.emotion_analyses FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));

DROP POLICY IF EXISTS "doctors read profiles" ON public.profiles;
CREATE POLICY "doctors read profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));

DROP POLICY IF EXISTS "clinical staff read activity_sessions" ON public.activity_sessions;
CREATE POLICY "clinical staff read activity_sessions"
  ON public.activity_sessions FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));

DROP POLICY IF EXISTS "clinical staff read analytics aggregates" ON public.analytics_aggregates;
CREATE POLICY "clinical staff read analytics aggregates"
  ON public.analytics_aggregates FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));

DROP POLICY IF EXISTS "clinical staff read ai insight summaries" ON public.ai_insight_summaries;
CREATE POLICY "clinical staff read ai insight summaries"
  ON public.ai_insight_summaries FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));

-- therapist_notes: extend doctor policies to admin
DROP POLICY IF EXISTS "Doctor reads any notes" ON public.therapist_notes;
CREATE POLICY "Doctor reads any notes"
  ON public.therapist_notes FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));

DROP POLICY IF EXISTS "Doctor inserts notes" ON public.therapist_notes;
CREATE POLICY "Doctor inserts notes"
  ON public.therapist_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_clinical_staff(auth.uid()) AND author_id = auth.uid());

DROP POLICY IF EXISTS "Doctor updates own notes" ON public.therapist_notes;
CREATE POLICY "Doctor updates own notes"
  ON public.therapist_notes FOR UPDATE TO authenticated
  USING (public.is_clinical_staff(auth.uid()) AND author_id = auth.uid())
  WITH CHECK (public.is_clinical_staff(auth.uid()) AND author_id = auth.uid());

DROP POLICY IF EXISTS "Doctor deletes own notes" ON public.therapist_notes;
CREATE POLICY "Doctor deletes own notes"
  ON public.therapist_notes FOR DELETE TO authenticated
  USING (public.is_clinical_staff(auth.uid()) AND author_id = auth.uid());

-- clinician_exports: admin parity
DROP POLICY IF EXISTS "Doctors view clinician exports" ON public.clinician_exports;
CREATE POLICY "Doctors view clinician exports"
  ON public.clinician_exports FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));

DROP POLICY IF EXISTS "Doctors insert clinician exports" ON public.clinician_exports;
CREATE POLICY "Doctors insert clinician exports"
  ON public.clinician_exports FOR INSERT TO authenticated
  WITH CHECK (public.is_clinical_staff(auth.uid()) AND auth.uid() = doctor_id);

-- ---------------------------------------------------------------------------
-- Crisis / review tables (from manual R4b — idempotent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crisis_flags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  severity    text NOT NULL,
  status      text NOT NULL DEFAULT 'open',
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crisis_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinical staff read crisis flags" ON public.crisis_flags;
CREATE POLICY "clinical staff read crisis flags"
  ON public.crisis_flags FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));

DROP POLICY IF EXISTS "clinical staff insert crisis flags" ON public.crisis_flags;
CREATE POLICY "clinical staff insert crisis flags"
  ON public.crisis_flags FOR INSERT TO authenticated
  WITH CHECK (public.is_clinical_staff(auth.uid()));

DROP POLICY IF EXISTS "clinical staff update crisis flags" ON public.crisis_flags;
CREATE POLICY "clinical staff update crisis flags"
  ON public.crisis_flags FOR UPDATE TO authenticated
  USING (public.is_clinical_staff(auth.uid()))
  WITH CHECK (public.is_clinical_staff(auth.uid()));

DROP POLICY IF EXISTS "patients read own crisis flags" ON public.crisis_flags;
CREATE POLICY "patients read own crisis flags"
  ON public.crisis_flags FOR SELECT TO authenticated
  USING (auth.uid() = patient_id);

CREATE INDEX IF NOT EXISTS idx_crisis_flags_patient ON public.crisis_flags(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crisis_flags_status ON public.crisis_flags(status);

GRANT SELECT, INSERT, UPDATE ON public.crisis_flags TO authenticated;
