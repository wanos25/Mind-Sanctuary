import type { FutureSimulationPath } from './types';
import type { BaselineSignals } from './predictionModel';
import { HORIZONS, projectHorizon } from './predictionModel';

const PATH_META = {
  continue: {
    title: 'Continue Current Path',
    description: 'If you keep today’s rhythm — same sessions, same pace.',
  },
  growth: {
    title: 'Growth Path',
    description: 'If you add more activities and protect your reflection streak.',
  },
  neglect: {
    title: 'Neglect Path',
    description: 'If check-ins fade and structured practice stops.',
  },
} as const;

export function simulateFuturePaths(baseline: BaselineSignals): FutureSimulationPath[] {
  return (['continue', 'growth', 'neglect'] as const).map((kind) => ({
    kind,
    title: PATH_META[kind].title,
    description: PATH_META[kind].description,
    projections: HORIZONS.map((horizonDays) => ({
      horizonDays,
      ...projectHorizon(baseline, kind, horizonDays),
    })),
  }));
}
