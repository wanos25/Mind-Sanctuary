import { lazy, Suspense, useMemo, useRef, useState, useEffect } from 'react';
import { buildTherapistIntelligenceDemo } from '@/lib/mindJourney/therapistDemo/buildDemoCohort';

const TherapistIntelligenceDemo = lazy(() => import('./TherapistIntelligenceDemo'));

function Fallback() {
  return (
    <section className="py-16 px-6 max-w-6xl mx-auto" aria-hidden>
      <div className="glass rounded-2xl h-64 animate-pulse" />
    </section>
  );
}

/** Demo-only therapist intelligence — static cohort, zero API calls. */
export default function TherapistIntelligenceDemoLazy() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const demo = useMemo(() => buildTherapistIntelligenceDemo(), []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '100px', threshold: 0.05 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={rootRef}>
      {visible && (
        <Suspense fallback={<Fallback />}>
          <TherapistIntelligenceDemo demo={demo} />
        </Suspense>
      )}
    </div>
  );
}
