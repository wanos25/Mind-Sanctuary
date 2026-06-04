import { useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BookOpen, ChevronRight } from 'lucide-react';
import type { JourneyChapter, DailyEmotionalScore } from '@/lib/mindJourney/types';
import JourneyCinematicBackdrop from './JourneyCinematicBackdrop';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Props {
  chapters: JourneyChapter[];
  dailyScores: DailyEmotionalScore[];
}

const TONE_GRADIENT: Record<JourneyChapter['emotionalTone'], string> = {
  beginning: 'from-violet-600/30 to-primary/5',
  challenge: 'from-amber-600/25 to-rose-900/10',
  progress: 'from-emerald-600/25 to-primary/5',
  momentum: 'from-cyan-600/25 to-accent/10',
  present: 'from-primary/35 to-amber-500/10',
};

export default function JourneyStoryView({ chapters, dailyScores }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);

  if (!chapters.length) return null;

  const chartData = dailyScores.map((d) => ({ date: d.date, score: d.score }));

  return (
    <div ref={trackRef} className="relative space-y-6" data-testid="journey-story-view">
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase">
          {t('mindJourney.story.viewTitle')}
        </h3>
      </div>

      <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
        {t('mindJourney.story.viewSubtitle')}
      </p>

      {chartData.length > 1 && (
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="glass rounded-2xl p-4 border border-border/30 h-36"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="storyTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} hide />
              <YAxis domain={[0, 100]} hide />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--accent))"
                fill="url(#storyTrendFill)"
                strokeWidth={2}
                isAnimationActive={!reduce}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      <div className="relative space-y-8 ps-0 md:ps-2">
        <div className="absolute start-4 md:start-6 top-0 bottom-0 w-px bg-gradient-to-b from-primary/40 via-accent/30 to-transparent hidden sm:block" />

        <AnimatePresence mode="popLayout">
          {chapters.map((chapter, idx) => (
            <motion.article
              key={chapter.id}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, delay: reduce ? 0 : idx * 0.06 }}
              className="relative"
            >
              <JourneyCinematicBackdrop tone={chapter.emotionalTone} />
              <div
                className={`relative glass rounded-3xl p-6 md:p-8 border border-border/40 overflow-hidden bg-gradient-to-br ${TONE_GRADIENT[chapter.emotionalTone]}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <p className="text-[10px] font-ui tracking-[0.35em] text-primary/80 uppercase">
                    {t('mindJourney.story.chapter', { n: chapter.index })}
                  </p>
                  <span className="text-[10px] text-muted-foreground">{chapter.dateRange.label}</span>
                </div>
                <h4 className="text-2xl md:text-3xl font-display font-bold mb-3">{chapter.title}</h4>
                <p className="text-sm text-foreground/85 leading-relaxed mb-4">{chapter.narrative}</p>
                {chapter.streakNote && (
                  <p className="text-xs text-primary/90 mb-4 font-ui tracking-wide">{chapter.streakNote}</p>
                )}
                {chapter.keyEvents.length > 0 && (
                  <ul className="space-y-2">
                    {chapter.keyEvents.slice(0, 4).map((ev) => (
                      <li
                        key={ev.id}
                        className="flex items-center gap-2 text-xs text-muted-foreground glass rounded-lg px-3 py-2"
                      >
                        <ChevronRight className="w-3 h-3 text-primary shrink-0 rtl:rotate-180" />
                        <span className="capitalize">{ev.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[10px] text-muted-foreground/80 mt-4">
                  {t('mindJourney.story.avgWellness', { score: chapter.avgScore })}
                </p>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
