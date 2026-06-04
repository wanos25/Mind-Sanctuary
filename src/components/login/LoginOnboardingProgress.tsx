import { useTranslation } from 'react-i18next';

const FLOW_STEPS = ['avatar', 'identity', 'profile'] as const;

export type OnboardingFlowStep = typeof FLOW_STEPS[number];

/** Maps login substeps to the three high-level onboarding milestones. */
export function resolveOnboardingMilestone(step: string): OnboardingFlowStep {
  if (step === 'avatar' || step === 'resume' || step === 'recovery-redeem') return 'avatar';
  if (step === 'identity') return 'identity';
  return 'profile';
}

interface Props {
  currentStep: string;
}

/** Visual step indicator for the login funnel — glass/gold design language. */
export default function LoginOnboardingProgress({ currentStep }: Props) {
  const { t } = useTranslation();
  const milestone = resolveOnboardingMilestone(currentStep);
  const idx = FLOW_STEPS.indexOf(milestone);

  return (
    <nav
      className="mb-6"
      aria-label={t('login.onboarding.progress', { defaultValue: 'Sign-up progress' })}
    >
      <ol className="flex items-center justify-center gap-2 sm:gap-3">
        {FLOW_STEPS.map((key, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <li key={key} className="flex items-center gap-2 sm:gap-3">
              <div className="flex flex-col items-center gap-1 min-w-[4.5rem] sm:min-w-[5.5rem]">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-ui border transition-colors
                    ${active ? 'border-primary bg-primary/20 text-primary' : ''}
                    ${done ? 'border-primary/50 bg-primary/10 text-primary' : ''}
                    ${!active && !done ? 'border-border/50 text-muted-foreground' : ''}`}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span className={`text-[10px] font-ui uppercase tracking-wider text-center leading-tight
                  ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                  {t(`login.onboarding.${key}`, { defaultValue: key })}
                </span>
              </div>
              {i < FLOW_STEPS.length - 1 && (
                <div
                  className={`hidden sm:block w-8 h-px ${i < idx ? 'bg-primary/50' : 'bg-border/40'}`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
