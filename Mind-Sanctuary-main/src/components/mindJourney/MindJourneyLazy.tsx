import { lazy, Suspense } from 'react';

const MindJourneySection = lazy(() => import('./MindJourneySection'));

function Fallback() {
  return (
    <section className="py-24 px-6 max-w-6xl mx-auto" aria-hidden>
      <div className="glass rounded-2xl h-48 animate-pulse" />
    </section>
  );
}

/** Code-split Mind Journey — does not block initial dashboard paint. */
export default function MindJourneyLazy() {
  return (
    <Suspense fallback={<Fallback />}>
      <MindJourneySection />
    </Suspense>
  );
}
