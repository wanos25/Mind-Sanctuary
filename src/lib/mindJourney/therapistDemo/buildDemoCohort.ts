import type { TherapistIntelligenceDemo } from '../types';

/** Static demo cohort — no production permissions or live patient API. */
export function buildTherapistIntelligenceDemo(): TherapistIntelligenceDemo {
  return {
    demoMode: true,
    patients: [
      {
        id: 'demo-1',
        name: 'Alex M.',
        riskLevel: 'high',
        burnout: 72,
        anxiety: 68,
        moodSparkline: [52, 48, 45, 44, 42, 40, 38],
        recoveryTrend: -12,
        lastSession: '2 days ago',
        dominantEmotion: 'anxiety',
        interventions: [
          'Schedule grounding check-in within 24h',
          'Assign short CBT flow',
          'Monitor streak break pattern',
        ],
        timeline: [
          { at: '2026-05-28', title: 'High-intensity reflection' },
          { at: '2026-05-25', title: 'Streak broken' },
          { at: '2026-05-20', title: 'CBT activity completed' },
        ],
        aiSummary:
          'Alex shows rising anxiety and falling wellness over 7 days. Engagement continues but recovery quality is thinning — recommend proactive outreach.',
      },
      {
        id: 'demo-2',
        name: 'Jordan K.',
        riskLevel: 'moderate',
        burnout: 48,
        anxiety: 52,
        moodSparkline: [55, 58, 56, 60, 59, 61, 62],
        recoveryTrend: 6,
        lastSession: 'Yesterday',
        dominantEmotion: 'stress',
        interventions: ['Maintain current cadence', 'Add educational video this week'],
        timeline: [
          { at: '2026-06-01', title: 'Daily score improved' },
          { at: '2026-05-29', title: 'Session completed' },
        ],
        aiSummary:
          'Jordan is stabilizing with modest upward mood trend. Stress remains the dominant theme — consistency is the leverage point.',
      },
      {
        id: 'demo-3',
        name: 'Sam R.',
        riskLevel: 'low',
        burnout: 22,
        anxiety: 18,
        moodSparkline: [68, 70, 71, 72, 74, 73, 75],
        recoveryTrend: 14,
        lastSession: 'Today',
        dominantEmotion: 'calm',
        interventions: ['Celebrate 7-day streak', 'Optional advanced CBT module'],
        timeline: [
          { at: '2026-06-02', title: '7-day streak milestone' },
          { at: '2026-05-30', title: 'Wellness peak day' },
        ],
        aiSummary:
          'Sam demonstrates strong recovery momentum and low risk scores. Ideal candidate for peer modeling or lighter-touch monitoring.',
      },
      {
        id: 'demo-4',
        name: 'Riley T.',
        riskLevel: 'moderate',
        burnout: 55,
        anxiety: 44,
        moodSparkline: [50, 52, 49, 51, 48, 50, 49],
        recoveryTrend: 0,
        lastSession: '5 days ago',
        dominantEmotion: 'sadness',
        interventions: ['Re-engagement nudge', 'Low-barrier 5-min session'],
        timeline: [
          { at: '2026-05-27', title: 'Isolation drift flag' },
          { at: '2026-05-22', title: 'Last full reflection' },
        ],
        aiSummary:
          'Riley’s scores are flat with gap in reflection frequency. Social withdrawal risk elevated — gentle re-engagement recommended.',
      },
    ],
    cohortSummary: {
      low: 1,
      moderate: 2,
      high: 1,
    },
  };
}
