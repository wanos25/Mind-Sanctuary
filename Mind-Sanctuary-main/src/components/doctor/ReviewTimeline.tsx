import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { listReviews, listNotes, type DoctorReview, type TreatmentNote } from '@/lib/doctor/reviews';
import { listFlagsForPatient, type CrisisFlag } from '@/lib/doctor/crisis';
import { AlertTriangle, FileText, MessageSquare } from 'lucide-react';

type Item =
  | { kind: 'review'; at: string; data: DoctorReview }
  | { kind: 'note'; at: string; data: TreatmentNote }
  | { kind: 'flag'; at: string; data: CrisisFlag };

interface Props {
  patientId: string;
  refreshKey?: number;
}

export default function ReviewTimeline({ patientId, refreshKey = 0 }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [reviews, notes, flags] = await Promise.all([
          listReviews(patientId),
          listNotes(patientId),
          listFlagsForPatient(patientId),
        ]);
        if (cancelled) return;
        const merged: Item[] = [
          ...reviews.map((r) => ({ kind: 'review' as const, at: r.created_at, data: r })),
          ...notes.map((n) => ({ kind: 'note' as const, at: n.created_at, data: n })),
          ...flags.map((f) => ({ kind: 'flag' as const, at: f.created_at, data: f })),
        ].sort((a, b) => b.at.localeCompare(a.at));
        setItems(merged);
        setError(null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId, refreshKey]);

  if (loading) {
    return <p className="text-xs text-muted-foreground">{t('common.loading')}</p>;
  }
  if (error) {
    return <p className="text-xs text-destructive">{error}</p>;
  }
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('doctor.review.empty')}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={`${it.kind}-${i}`}>
          <Card className="p-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {it.kind === 'review' && <FileText className="w-4 h-4" />}
              {it.kind === 'note' && <MessageSquare className="w-4 h-4" />}
              {it.kind === 'flag' && <AlertTriangle className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t(`doctor.timeline.${it.kind}`)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(it.at).toLocaleString()}
                </span>
              </div>
              {it.kind === 'review' && (
                <p className="text-sm mt-1">
                  <span className="text-primary me-2">[{it.data.status}]</span>
                  {it.data.summary || t('doctor.review.noSummary')}
                </p>
              )}
              {it.kind === 'note' && (
                <p className="text-sm mt-1 whitespace-pre-wrap break-words">{it.data.note}</p>
              )}
              {it.kind === 'flag' && (
                <p className="text-sm mt-1">
                  <span className="text-destructive me-2">[{it.data.severity}]</span>
                  {it.data.reason || t('doctor.crisis.noReason')}
                </p>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
