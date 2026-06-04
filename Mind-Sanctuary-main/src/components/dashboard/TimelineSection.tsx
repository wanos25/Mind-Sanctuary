import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { ClipboardCheck, MessageCircle, Brain, BarChart3, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STEPS = [
  { icon: ClipboardCheck, key: 'intake' },
  { icon: MessageCircle, key: 'session' },
  { icon: Brain, key: 'analysis' },
  { icon: BarChart3, key: 'insights' },
  { icon: TrendingUp, key: 'tracking' },
] as const;

export default function TimelineSection() {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const lineHeight = useTransform(scrollYProgress, [0.1, 0.85], ['0%', '100%']);

  return (
    <section data-testid="timeline-section" className="relative py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
          className="text-center mb-24"
        >
          <p className="text-xs font-ui tracking-[0.4em] text-primary/70 uppercase mb-4">
            {t('dashboard.journey')}
          </p>
          <h2 className="text-4xl md:text-6xl font-display font-bold tracking-tight">
            {t('dashboard.fromFirst')} <span className="gold-text">{t('dashboard.lastingChange')}</span>
          </h2>
        </motion.div>

        <div ref={ref} className="relative">
          {/* Track */}
          <div className="absolute start-8 md:start-1/2 top-0 bottom-0 w-px bg-border/40 -translate-x-1/2 rtl:translate-x-1/2" />
          {/* Animated progress line */}
          <motion.div
            style={{ height: lineHeight }}
            className="absolute start-8 md:start-1/2 top-0 w-px -translate-x-1/2 rtl:translate-x-1/2 origin-top"
          >
            <div className="w-full h-full bg-gradient-to-b from-primary via-primary/70 to-accent shadow-[0_0_20px_hsl(var(--gold)/0.6)]" />
          </motion.div>

          <div className="space-y-20">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const left = i % 2 === 0;
              return (
                <motion.div
                  key={s.key}
                  initial={{ opacity: 0, y: 60 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.7 }}
                  className={`relative flex items-center gap-6 ${
                    left ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                >
                  {/* Node */}
                  <div className="absolute start-8 md:start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-10">
                    <motion.div
                      whileInView={{ scale: [0.5, 1.15, 1] }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6 }}
                      className="w-14 h-14 rounded-full glass-strong border border-primary/40 flex items-center justify-center gold-glow"
                    >
                      <Icon className="w-5 h-5 text-primary" />
                    </motion.div>
                  </div>

                  {/* Spacer */}
                  <div className="hidden md:block flex-1" />

                  {/* Card */}
                  <div className="ms-24 md:ms-0 flex-1 md:max-w-md">
                    <div className="glass rounded-2xl p-6 hover:border-primary/40 transition-all">
                      <p className="text-[10px] font-ui tracking-[0.3em] text-primary/70 uppercase mb-2">
                        {t('dashboard.step')} {String(i + 1).padStart(2, '0')}
                      </p>
                      <h3 className="text-2xl font-display font-semibold mb-2">{t(`timeline.${s.key}.title`)}</h3>
                      <p className="text-sm font-body text-muted-foreground leading-relaxed">
                        {t(`timeline.${s.key}.desc`)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
