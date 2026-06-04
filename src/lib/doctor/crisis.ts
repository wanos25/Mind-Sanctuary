import { sbExt } from '@/lib/supabaseExt';

export type CrisisSeverity = 'low' | 'medium' | 'high' | 'critical';
export type CrisisSource = 'system' | 'doctor' | 'self_report';
export type CrisisStatus = 'open' | 'acknowledged' | 'resolved';

export interface CrisisFlag {
  id: string;
  patient_id: string;
  session_id: string | null;
  message_id: string | null;
  severity: CrisisSeverity;
  source: CrisisSource;
  reason: string | null;
  status: CrisisStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

const SEVERITY_RANK: Record<CrisisSeverity, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};

export async function listOpenFlags(): Promise<CrisisFlag[]> {
  const { data, error } = await sbExt
    .from('crisis_flags')
    .select('*')
    .neq('status', 'resolved')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as CrisisFlag[];
  return rows.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

export async function listFlagsForPatient(patientId: string): Promise<CrisisFlag[]> {
  const { data, error } = await sbExt
    .from('crisis_flags')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CrisisFlag[];
}

export async function acknowledgeFlag(id: string, doctorId: string): Promise<void> {
  const { error } = await sbExt
    .from('crisis_flags')
    .update({ status: 'acknowledged', acknowledged_by: doctorId, acknowledged_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function resolveFlag(id: string, doctorId: string): Promise<void> {
  const { error } = await sbExt
    .from('crisis_flags')
    .update({ status: 'resolved', acknowledged_by: doctorId, acknowledged_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function raiseFlag(input: {
  patient_id: string;
  session_id?: string | null;
  message_id?: string | null;
  severity: CrisisSeverity;
  source: CrisisSource;
  reason?: string | null;
}): Promise<CrisisFlag> {
  const { data, error } = await sbExt
    .from('crisis_flags')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as CrisisFlag;
}
