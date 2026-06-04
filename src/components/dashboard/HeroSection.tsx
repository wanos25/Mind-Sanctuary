import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, lazy, Suspense } from 'react';
import { Sparkles, BarChart3, ChevronDown, Gamepad2, Route } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import FloatingParticles from '@/components/3d/FloatingParticles';
import RadialClock from '@/components/ui/RadialClock';

const DashboardScene = lazy(() => import('@/components/3d/DashboardScene'));

export default function HeroSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, startNewSession, setStage } = useApp();

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const px = useSpring(mx, { stiffness: 40, damping: 18 });
  const py = useSpring(my, { stiffness: 40, damping: 18 });
  const tx = useTransform(px, [-1, 1], [-30, 30]);
  const ty = useTransform(py, [-1, 1], [-20, 20]);
  const tx2 = useTransform(px, [-1, 1], [20, -20]);
  const ty2 = useTransform(py, [-1, 1], [15, -15]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mx.set((e.clientX / window.innerWidth) * 2 - 1);
      my.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [mx, my]);

  const greetingHour = new Date().getHours();
  const greetingKey = greetingHour < 12 ? 'morning' : greetingHour < 18 ? 'afternoon' : 'evening';

  return (
    <section data-testid="hero-section" className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      {/* 3D scene backdrop */}
      <div className="absolute inset-0 -z-10">
        <Suspense fallback={<div className="absolute inset-0 bg-background" />}>
          <DashboardScene />
        </Suspense>
      </div>

      {/* Layered glows */}
      <motion.div
        style={{ x: tx, y: ty }}
        className="absolute top-1/4 start-1/4 w-[40vw] h-[40vw] rounded-full blur-[140px] bg-primary/20 pointer-events-none"
      />
      <motion.div
        style={{ x: tx2, y: ty2 }}
        className="absolute bottom-1/4 end-1/4 w-[30vw] h-[30vw] rounded-full blur-[120px] bg-accent/20 pointer-events-none"
      />

      <FloatingParticles count={40} />

      {/* Radial clock widget */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, delay: 0.6, ease: 'easeOut' }}
        className="hidden lg:block absolute top-24 end-8 z-10"
      >
        <RadialClock mode="dashboard" size="sm" />
      </motion.div>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background/40 via-transparent to-background" />

      <div className="relative z-10 text-center px-6 max-w-5xl">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-xs md:text-sm font-ui tracking-[0.4em] text-muted-foreground uppercase mb-6"
        >
          {t(`dashboard.${greetingKey}`)}
          {profile?.nickname ? `, ${profile.nickname}` : ''}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.15 }}
          className="text-5xl md:text-7xl lg:text-8xl font-display font-bold leading-[1.05] tracking-tight mb-6"
        >
          {t('dashboard.heroLine1')}
          <br />
          <span className="gold-text text-glow">{t('dashboard.heroLine2')}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="text-base md:text-xl font-body text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          {t('dashboard.heroDesc')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.96 }}
            onClick={startNewSession}
            className="sentinel-btn gold-glow text-sm px-8 py-4 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {t('dashboard.startSessionBtn')}
          </motion.button>
          <motion.button
            whileHover={{ y: -2 }}
            onClick={() => setStage('insights')}
            className="sentinel-btn-outline text-sm px-7 py-4 flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" /> {t('dashboard.viewInsights')}
          </motion.button>
          <motion.button
            whileHover={{ y: -2 }}
            onClick={() => navigate('/activities')}
            className="sentinel-btn-outline text-sm px-7 py-4 flex items-center gap-2"
          >
            <Gamepad2 className="w-4 h-4" /> {t('nav.activities', { defaultValue: 'Activities' })}
          </motion.button>
          <motion.button
            whileHover={{ y: -2 }}
            onClick={() => document.getElementById('mind-journey')?.scrollIntoView({ behavior: 'smooth' })}
            className="sentinel-btn-outline text-sm px-7 py-4 flex items-center gap-2"
          >
            <Route className="w-4 h-4" /> {t('dashboard.viewJourney')}
          </motion.button>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
        className="absolute bottom-8 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-10"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-2 text-muted-foreground"
        >
          <span className="text-[10px] font-ui tracking-[0.3em] uppercase">{t('dashboard.scroll')}</span>
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </motion.div>
    </section>
  );
}
