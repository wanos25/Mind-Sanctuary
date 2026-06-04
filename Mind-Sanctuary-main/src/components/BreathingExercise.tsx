import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSound } from '@/context/SoundContext';

interface BreathingExerciseProps {
  onClose: () => void;
}

const PHASES = [
  { key: 'inhale', duration: 4000, scale: 1.5 },
  { key: 'hold', duration: 2000, scale: 1.5 },
  { key: 'exhale', duration: 6000, scale: 1 },
] as const;

const BreathingExercise = ({ onClose }: BreathingExerciseProps) => {
  const { t } = useTranslation();
  const sound = useSound();
  const [active, setActive] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [cycles, setCycles] = useState(0);

  const start = useCallback(() => {
    setActive(true);
    setPhaseIndex(0);
    setCycles(0);
  }, []);

  useEffect(() => {
    if (!active) return;
    const phase = PHASES[phaseIndex];
    const timer = setTimeout(() => {
      const next = (phaseIndex + 1) % PHASES.length;
      setPhaseIndex(next);
      if (next === 0) setCycles(c => c + 1);
    }, phase.duration);
    return () => clearTimeout(timer);
  }, [active, phaseIndex]);

  const phase = PHASES[phaseIndex];
  const phaseLabel = t(`breathing.phases.${phase.key}`);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md"
    >
      <div className="text-center space-y-8 max-w-sm mx-4">
        <div>
          <p className="text-xs font-ui text-muted-foreground tracking-[0.3em] uppercase mb-2">{t('breathing.guidedBreathing')}</p>
          <h2 className="text-2xl font-display gold-text">{t('breathing.findCalm')}</h2>
        </div>

        {!active ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <p className="text-sm font-body text-foreground/70 leading-relaxed">
              {t('breathing.intro')}
            </p>
            <div className="flex gap-4 justify-center text-xs font-ui text-muted-foreground">
              <span>{t('breathing.inhale4')}</span>
              <span>•</span>
              <span>{t('breathing.hold2')}</span>
              <span>•</span>
              <span>{t('breathing.exhale6')}</span>
            </div>
            <button onClick={() => { sound.playBreathingStart(); start(); }} className="sentinel-btn py-3 px-8">
              {t('breathing.begin')}
            </button>
          </motion.div>
        ) : (
          <div className="space-y-8">
            <div className="relative flex items-center justify-center h-56">
              <motion.div
                className="absolute rounded-full border-2 border-primary/20"
                style={{ width: 200, height: 200 }}
                animate={{ scale: phase.scale, opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: phase.duration / 1000, ease: 'easeInOut' }}
              />
              <motion.div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: 120,
                  height: 120,
                  background: 'radial-gradient(circle, hsl(var(--primary) / 0.3), hsl(var(--primary) / 0.05))',
                  boxShadow: '0 0 40px hsl(var(--primary) / 0.2)',
                }}
                animate={{ scale: phase.scale }}
                transition={{ duration: phase.duration / 1000, ease: 'easeInOut' }}
              >
                <motion.span
                  key={phaseIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-lg font-display text-primary"
                >
                  {phaseLabel}
                </motion.span>
              </motion.div>
            </div>

            <p className="text-xs font-ui text-muted-foreground">
              {t('breathing.cycleAndPhase', { num: cycles + 1, phase: phaseLabel })}
            </p>
          </div>
        )}

        <button
          onClick={onClose}
          className="sentinel-btn-outline py-2 px-6 text-xs"
        >
          {active ? t('breathing.endExercise') : t('breathing.close')}
        </button>
      </div>
    </motion.div>
  );
};

export default BreathingExercise;
