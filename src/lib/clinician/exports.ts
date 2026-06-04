/**
 * R6 foundation — read-only helper. No export worker wired yet.
 */
import { sbExt } from '@/lib/supabaseExt';

export interface ClinicianExport {
  id: string;
  doctor_id: string;
  target_user_id: string | null;
  format: string;
  filters: Record<string, unknown>;
  status: string;
  result_url: string | null;
  created_at: string;
}

export async function listOwnExports(doctorId: string): Promise<ClinicianExport[]> {
  const { data, error } = await sbExt
    .from('clinician_exports')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as ClinicianExport[];
}
