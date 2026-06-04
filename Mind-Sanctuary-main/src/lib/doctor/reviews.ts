import { sbExt } from '@/lib/supabaseExt';

export type ReviewStatus = 'pending' | 'in_review' | 'closed' | 'escalated';
export type NoteVisibility = 'doctor' | 'patient_visible';

export interface DoctorReview {
  id: string;
  doctor_id: string;
  patient_id: string;
  session_id: string | null;
  status: ReviewStatus;
  summary: string | null;
  created_at: string;
}

export interface TreatmentNote {
  id: string;
  review_id: string | null;
  doctor_id: string;
  patient_id: string;
  note: string;
  visibility: NoteVisibility;
  created_at: string;
}

export async function listReviews(patientId: string): Promise<DoctorReview[]> {
  const { data, error } = await sbExt
    .from('doctor_reviews')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DoctorReview[];
}

export async function createReview(input: {
  doctor_id: string;
  patient_id: string;
  session_id?: string | null;
  status: ReviewStatus;
  summary?: string | null;
}): Promise<DoctorReview> {
  const { data, error } = await sbExt
    .from('doctor_reviews')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as DoctorReview;
}

export async function listNotes(patientId: string): Promise<TreatmentNote[]> {
  const { data, error } = await sbExt
    .from('treatment_notes')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TreatmentNote[];
}

export async function addNote(input: {
  doctor_id: string;
  patient_id: string;
  review_id?: string | null;
  note: string;
  visibility?: NoteVisibility;
}): Promise<TreatmentNote> {
  const { data, error } = await sbExt
    .from('treatment_notes')
    .insert({ visibility: 'doctor', ...input })
    .select('*')
    .single();
  if (error) throw error;
  return data as TreatmentNote;
}
