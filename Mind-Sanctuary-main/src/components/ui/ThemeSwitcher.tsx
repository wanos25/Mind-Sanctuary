import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Sun, SunMedium } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme, type ThemeName } from '@/context/ThemeContext';

interface Props {
  /** `pill` = compact toggle with all themes; `icon` = single button that cycles. */
  variant?: 'pill' | 'icon';
  className?: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const THEMES: ThemeName[] = ['purple', 'gold', 'light'];

const ICONS: Record<ThemeName, typeof Sparkles> = {
  purple: Sparkles,
  gold: Sun,
  light: SunMedium,
};

export default function ThemeSwitcher({ variant = 'pill', className }: Props) {
  const { theme, setTheme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const reduced = prefersReducedMotion();

  const labelFor = (name: ThemeName) =>
    name === 'purple'
      ? t('theme.purple', { defaultValue: 'Purple theme' })
      : name === 'gold'
        ? t('theme.gold', { defaultValue: 'Gold theme' })
        : t('theme.light', { defaultValue: 'Light theme' });

  if (variant === 'icon') {
    const ActiveIcon = ICONS[theme];
    const nextLabel = t('theme.cycle', { defaultValue: 'Cycle theme' });
    return (
      <motion.button
        type="button"
        onClick={toggleTheme}
        aria-label={nextLabel}
        title={`${labelFor(theme)} — ${nextLabel}`}
        whileTap={reduced ? undefined : { scale: 0.9 }}
        className={`relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${className ?? ''}`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            initial={reduced ? false : { rotate: -90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={reduced ? undefined : { rotate: 90, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <ActiveIcon className="w-4 h-4" />
          </motion.span>
        </AnimatePresence>
      </motion.button>
    );
  }

  // Pill variant — three segments, animated thumb slides between them.
  const activeIndex = THEMES.indexOf(theme);
  const thumbLeft = `calc(${activeIndex} * 2rem + ${activeIndex * 0.25}rem + 0.25rem)`;

  return (
    <div
      role="group"
      aria-label={t('theme.theme', { defaultValue: 'Theme' })}
      className={`relative inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary/40 backdrop-blur-md p-1 ${className ?? ''}`}
    >
      <motion.span
        aria-hidden
        animate={{ left: thumbLeft }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
        className="absolute top-1 bottom-1 w-8 rounded-full bg-primary/20 border border-primary/40 shadow-[0_0_18px_hsl(var(--primary)/0.45)]"
      />
      {THEMES.map((name) => {
        const Icon = ICONS[name];
        const active = name === theme;
        return (
          <button
            key={name}
            type="button"
            onClick={() => !active && setTheme(name)}
            aria-pressed={active}
            aria-label={labelFor(name)}
            title={labelFor(name)}
            className={`relative z-10 w-8 h-7 rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${active ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}
