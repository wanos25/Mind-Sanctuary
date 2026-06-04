import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Route } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMindJourney } from '@/hooks/useMindJourney';
import JourneyAnalyticsGrid from './JourneyAnalyticsGrid';
import JourneyInsightPanel from './JourneyInsightPanel';
import JourneyTimelineVirtual from './JourneyTimelineVirtual';
import JourneyGrowthScore from './JourneyGrowthScore';
import JourneyBeforeNow from './JourneyBeforeNow';
import JourneyStoryView from './JourneyStoryView';
import JourneyHighlights from './JourneyHighlights';
import JourneySeasons from './JourneySeasons';
import JourneyFuturePath from './JourneyFuturePath';
import JourneyCinematicBackdrop from './JourneyCinematicBackdrop';
import JourneyFutureSelfSection from './JourneyFutureSelfSection';
import JourneyEarlyRiskSection from './JourneyEarlyRiskSection';
import JourneyCrisisPreventionSection from './JourneyCrisisPreventionSection';
import JourneyTherapeuticMemorySection from './JourneyTherapeuticMemorySection';
import JourneyPersonalityTwinCard from './JourneyPersonalityTwinCard';
import JourneyTimeMachineSection from './JourneyTimeMachineSection';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function JourneySkeleton() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading journey">
      <div className="glass rounded-2xl h-32 animate-pulse" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-2xl h-28 animate-pulse" />
        ))}
      </div>
      <div className="glass rounded-2xl h-[420px] animate-pulse" />
    </div>
  );
}

export default function MindJourneySection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const rootRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

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
      { rootMargin: '120px', threshold: 0.05 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { data, loading, error } = useMindJourney(user?.id, visible);

  return (
    <section
      ref={rootRef}
      id="mind-journey"
      data-testid="mind-journey-section"
      className="relative py-24 md:py-32 px-6 overflow-hidden"
      aria-labelledby="mind-journey-heading"
    >
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-primary/5 to-background pointer-events-none" />
      <div className="absolute top-1/3 end-0 w-[50vw] max-w-xl h-[50vw] rounded-full bg-accent/10 blur-[120px] -z-10" />

      <div className="max-w-6xl mx-auto space-y-10">
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center md:text-start"
        >
          <p className="text-xs font-ui tracking-[0.4em] text-primary/70 uppercase mb-3 flex items-center justify-center md:justify-start gap-2">
            <Route className="w-4 h-4" />
            {t('mindJourney.badge')}
          </p>
          <h2
            id="mind-journey-heading"
            className="text-3xl md:text-5xl font-display font-bold tracking-tight"
          >
            {t('mindJourney.title')} <span className="gold-text">{t('mindJourney.titleAccent')}</span>
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mt-4 max-w-2xl mx-auto md:mx-0">
            {t('mindJourney.subtitle')}
          </p>
        </motion.header>

        {!visible && <JourneySkeleton />}

        {visible && loading && <JourneySkeleton />}

        {visible && error && (
          <div className="glass rounded-2xl p-6 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}

        {visible && data && !loading && data.sessions.length > 0 && (
          <div className="space-y-10 relative">
            <JourneyCinematicBackdrop tone="default" />

            <JourneyGrowthScore growth={data.story.growthScore} />

            <JourneyEarlyRiskSection earlyRisk={data.advanced.earlyRisk} />
            <JourneyCrisisPreventionSection crisis={data.advanced.crisisPrevention} />
            <JourneyTherapeuticMemorySection memory={data.advanced.therapeuticMemory} />
            <JourneyPersonalityTwinCard twin={data.advanced.personalityTwin} />
            <JourneyTimeMachineSection timeMachine={data.advanced.timeMachine} />

            <JourneyBeforeNow comparison={data.story.comparison} />
            <JourneyFutureSelfSection futureSelf={data.futureSelf} />

            {data.story.chapters.length > 0 && (
              <JourneyStoryView chapters={data.story.chapters} dailyScores={data.dailyScores} />
            )}

            <JourneyHighlights highlights={data.story.highlights} />
            <JourneySeasons seasons={data.story.seasons} />

            {data.dailyScores.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="glass rounded-3xl p-6 border border-border/40"
              >
                <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase mb-4">
                  {t('mindJourney.dailyScores')}
                </h3>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.dailyScores} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="journeyScoreFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--primary))"
                        fill="url(#journeyScoreFill)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            <JourneyAnalyticsGrid analytics={data.analytics} streaks={data.streaks} />
            <JourneyInsightPanel insights={data.insights} />
            <JourneyFuturePath futurePath={data.story.futurePath} />
            <JourneyTimelineVirtual events={data.events} />
          </div>
        )}

        {visible && data && !loading && data.sessions.length === 0 && (
          <p className="text-center text-sm text-muted-foreground glass rounded-2xl p-8" role="status">
            {t('mindJourney.empty')}
          </p>
        )}
      </div>
    </section>
  );
}
