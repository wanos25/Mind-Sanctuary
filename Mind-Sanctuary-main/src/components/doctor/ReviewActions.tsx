import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { createReview, addNote, type ReviewStatus, type NoteVisibility } from '@/lib/doctor/reviews';
import { raiseFlag, type CrisisSeverity } from '@/lib/doctor/crisis';
import { toast } from 'sonner';

interface Props {
  patientId: string;
  onChanged?: () => void;
}

export default function ReviewActions({ patientId, onChanged }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [summary, setSummary] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteVisibility, setNoteVisibility] = useState<NoteVisibility>('doctor');
  const [status, setStatus] = useState<ReviewStatus>('in_review');
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const submitReview = async () => {
    setBusy(true);
    try {
      await createReview({ doctor_id: user.id, patient_id: patientId, status, summary: summary.trim() || null });
      setSummary('');
      toast.success(t('doctor.review.created'));
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitNote = async () => {
    if (!noteText.trim()) return;
    setBusy(true);
    try {
      await addNote({ doctor_id: user.id, patient_id: patientId, note: noteText.trim(), visibility: noteVisibility });
      setNoteText('');
      toast.success(t('doctor.notes.added'));
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const escalate = async (severity: CrisisSeverity) => {
    setBusy(true);
    try {
      await raiseFlag({ patient_id: patientId, severity, source: 'doctor', reason: summary.trim() || null });
      toast.success(t('doctor.crisis.raised'));
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const statuses: ReviewStatus[] = ['pending', 'in_review', 'closed', 'escalated'];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="p-3 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('doctor.review.new')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`text-xs px-2 py-1 rounded-md border ${
                status === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent/40'
              }`}
            >
              {t(`doctor.review.status.${s}`)}
            </button>
          ))}
        </div>
        <Textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder={t('doctor.review.summaryPlaceholder')}
          rows={3}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={submitReview}>
            {t('doctor.review.submit')}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => escalate('high')}>
            {t('doctor.crisis.escalateHigh')}
          </Button>
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => escalate('critical')}>
            {t('doctor.crisis.escalateCritical')}
          </Button>
        </div>
      </Card>

      <Card className="p-3 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('doctor.notes.new')}
        </p>
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder={t('doctor.notes.placeholder')}
          rows={3}
        />
        <div className="flex items-center gap-2 text-xs">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={noteVisibility === 'patient_visible'}
              onChange={(e) => setNoteVisibility(e.target.checked ? 'patient_visible' : 'doctor')}
            />
            <span className="text-muted-foreground">{t('doctor.notes.patientVisible')}</span>
          </label>
        </div>
        <Button size="sm" disabled={busy || !noteText.trim()} onClick={submitNote}>
          {t('doctor.notes.add')}
        </Button>
      </Card>
    </div>
  );
}
