import { useEffect, useState } from 'react';
import { loadMindJourney, type MindJourneyData } from '@/lib/mindJourney';

export function useMindJourney(userId: string | undefined, enabled: boolean) {
  const [data, setData] = useState<MindJourneyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadMindJourney(userId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load journey');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId, enabled]);

  return { data, loading, error };
}
