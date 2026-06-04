import { motion } from 'framer-motion';
import { Brain, Mic, ShieldAlert, LineChart, Heart, Sparkles } from 'lucide-react';
import TiltCard from '@/components/ui/TiltCard';
import { useTranslation } from 'react-i18next';

const FEATURES = [
  { icon: Brain, key: 'emotion' },
  { icon: Mic, key: 'voice' },
  { icon: ShieldAlert, key: 'crisis' },
  { icon: LineChart, key: 'analytics' },
  { icon: Heart, key: 'recovery' },
  { icon: Sparkles, key: 'companion' },
] as const;

export default function FeaturesSection() {
  const { t } = useTranslation();
  return (
    <section className="relative py-32 px-6 overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background/95 to-background" />
      <div className="absolute top-1/2 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full bg-primary/5 blur-[140px] -z-10" />

      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <p className="text-xs font-ui tracking-[0.4em] text-primary/70 uppercase mb-4">
            {t('dashboard.whatIs')}
          </p>
          <h2 className="text-4xl md:text-6xl font-display font-bold mb-5 tracking-tight">
            {t('dashboard.therapy')} <span className="gold-text">{t('dashboard.reimagined')}</span>
          </h2>
          <p className="text-base md:text-lg font-body text-muted-foreground max-w-2xl mx-auto">
            {t('dashboard.pillarsDesc')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.key}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6, delay: (i % 3) * 0.1 }}
              >
                <TiltCard
                  intensity={10}
                  className="glass rounded-3xl p-8 h-full transition-all hover:gold-glow hover:border-primary/40 group cursor-default"
                >
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-display font-semibold mb-3 text-foreground">
                    {t(`features.${f.key}.title`)}
                  </h3>
                  <p className="text-sm font-body text-muted-foreground leading-relaxed">
                    {t(`features.${f.key}.desc`)}
                  </p>
                </TiltCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
