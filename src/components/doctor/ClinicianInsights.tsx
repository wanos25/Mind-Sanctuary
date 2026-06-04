import { Card } from '@/components/ui/card';
import { TrendingUp, Activity, Brain, Telescope } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Clinician Insights — longitudinal trend surface.
 * Stage A: scaffolded shell with elegant empty/preview states.
 * Stage B (R6a): wires to longitudinal aggregates (trends, triggers, volatility).
 */
export default function ClinicianInsights() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-card/60 backdrop-blur border-border/60">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
            <Telescope className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-medium">
              {t('doctor.insights.title', { defaultValue: 'Longitudinal Emotional Intelligence' })}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('doctor.insights.subtitle', { defaultValue: 'Cohort-level trends, recurring triggers, volatility · R6a foundation' })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <InsightTile icon={<TrendingUp className="w-4 h-4" />} title="Mood trajectories" desc="30-day rolling baseline per patient" />
          <InsightTile icon={<Activity className="w-4 h-4" />} title="Volatility index" desc="Emotional swing magnitude over time" />
          <InsightTile icon={<Brain className="w-4 h-4" />} title="Recurring triggers" desc="Detected themes across sessions" />
        </div>

        <div className="mt-5 rounded-lg border border-dashed border-border/60 p-6 text-center">
          <p className="text-xs text-muted-foreground">
            {t('doctor.insights.pending', {
              defaultValue: 'Longitudinal aggregates activate after R6a data foundation ships. UI is wired and ready.',
            })}
          </p>
        </div>
      </Card>
    </div>
  );
}

function InsightTile({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex items-center gap-2 text-accent mb-1.5">{icon}<span className="text-xs font-medium uppercase tracking-wider">{title}</span></div>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
