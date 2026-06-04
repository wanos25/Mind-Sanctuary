import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

import { useAuth } from '@/context/AuthContext';
import { listOpenFlags, acknowledgeFlag, resolveFlag, type CrisisFlag, type CrisisSeverity } from '@/lib/doctor/crisis';
import { toast } from 'sonner';

const SEVERITY_STYLE: Record<CrisisSeverity, string> = {
  critical: 'bg-destructive/15 text-destructive border-destructive/40',
  high:     'bg-orange-500/15 text-orange-500 border-orange-500/40',
  medium:   'bg-yellow-500/15 text-yellow-600 border-yellow-500/40',
  low:      'bg-muted text-muted-foreground border-border',
};

interface Props {
  onSelectPatient?: (patientId: string) => void;
}

export default function CrisisQueue({ onSelectPatient }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [flags, setFlags] = useState<CrisisFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      setFlags(await listOpenFlags());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const handleAck = async (id: string) => {
    if (!user) return;
    setBusyId(id);
    try { await acknowledgeFlag(id, user.id); await reload(); toast.success(t('doctor.crisis.acked')); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  };

  const handleResolve = async (id: string) => {
    if (!user) return;
    setBusyId(id);
    try { await resolveFlag(id, user.id); await reload(); toast.success(t('doctor.crisis.resolved')); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  };

  if (loading) return <p className="text-sm text-muted-foreground py-8 text-center">{t('common.loading')}</p>;
  if (error)   return <Card className="p-4 text-sm text-destructive">{error}</Card>;
  if (flags.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        tone="calm"
        title={t('doctor.crisis.empty')}
        description={t('doctor.crisis.emptyHint', { defaultValue: 'No active crisis flags. The system is watching quietly in the background — you will be the first to know.' })}
        hint={t('doctor.crisis.emptyTag', { defaultValue: 'All clear · Monitoring' })}
      />
    );
  }


  return (
    <ul className="space-y-2">
      {flags.map((f) => (
        <li key={f.id}>
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${SEVERITY_STYLE[f.severity]}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${SEVERITY_STYLE[f.severity]}`}>
                    {t(`doctor.crisis.severity.${f.severity}`)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(`doctor.crisis.source.${f.source}`)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(f.created_at).toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(`doctor.crisis.status.${f.status}`)}
                  </span>
                </div>
                <p className="text-sm mt-1 break-words">
                  {f.reason || t('doctor.crisis.noReason')}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  {f.patient_id.slice(0, 8)}…
                </p>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                {onSelectPatient && (
                  <Button size="sm" variant="ghost" onClick={() => onSelectPatient(f.patient_id)}>
                    {t('doctor.crisis.openPatient')}
                  </Button>
                )}
                {f.status === 'open' && (
                  <Button size="sm" variant="outline" disabled={busyId === f.id} onClick={() => handleAck(f.id)}>
                    {t('doctor.crisis.acknowledge')}
                  </Button>
                )}
                <Button size="sm" variant="default" disabled={busyId === f.id} onClick={() => handleResolve(f.id)}>
                  {t('doctor.crisis.resolve')}
                </Button>
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
