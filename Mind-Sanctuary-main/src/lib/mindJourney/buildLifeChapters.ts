import type { JourneyChapter, LifeChapter, LifePhase } from './types';

const LIFE_PHASES: LifePhase[] = [
  'beginning',
  'struggle',
  'recovery',
  'growth',
  'momentum',
];

const LIFE_TITLES: Record<LifePhase, string> = {
  beginning: 'Beginning',
  struggle: 'Struggle',
  recovery: 'Recovery',
  growth: 'Growth',
  momentum: 'Momentum',
};

const TONE_TO_PHASE: Record<JourneyChapter['emotionalTone'], LifePhase> = {
  beginning: 'beginning',
  challenge: 'struggle',
  progress: 'recovery',
  momentum: 'growth',
  present: 'momentum',
};

function transitionCopy(from: LifePhase, to: LifePhase, moodDelta: number): string {
  const rise = moodDelta >= 5;
  const fall = moodDelta <= -5;
  if (from === 'beginning' && to === 'struggle') {
    return 'The opening chapter closes as real friction appears — not a setback, a plot turn.';
  }
  if (from === 'struggle' && to === 'recovery') {
    return rise
      ? 'Struggle gives way to recovery — your scores begin to answer your effort.'
      : 'Even without a spike, you stayed — and recovery often starts with showing up.';
  }
  if (from === 'recovery' && to === 'growth') {
    return 'Recovery becomes growth when patterns repeat and wellness climbs.';
  }
  if (from === 'growth' && to === 'momentum') {
    return 'Growth hardens into momentum — the story catches up to who you are now.';
  }
  if (fall) {
    return `Between ${LIFE_TITLES[from]} and ${LIFE_TITLES[to]}, scores dipped — the documentary keeps filming.`;
  }
  return `From ${LIFE_TITLES[from]} toward ${LIFE_TITLES[to]} — the next act builds on everything before it.`;
}

export function enrichLifeChapters(chapters: JourneyChapter[]): LifeChapter[] {
  return chapters.map((ch, i) => {
    const lifePhase =
      LIFE_PHASES[Math.min(i, LIFE_PHASES.length - 1)] ?? TONE_TO_PHASE[ch.emotionalTone];
    const next = chapters[i + 1];
    const nextPhase = next
      ? (LIFE_PHASES[Math.min(i + 1, LIFE_PHASES.length - 1)] ?? TONE_TO_PHASE[next.emotionalTone])
      : null;

    return {
      ...ch,
      lifePhase,
      title: LIFE_TITLES[lifePhase],
      documentaryIntro:
        i === 0
          ? 'Where your recorded story opens — the camera finds you at the threshold.'
          : `Act ${i + 1}: ${LIFE_TITLES[lifePhase]} — ${ch.dateRange.label}.`,
      transitionToNext:
        next && nextPhase
          ? transitionCopy(lifePhase, nextPhase, next.moodDelta - ch.moodDelta)
          : undefined,
    };
  });
}
