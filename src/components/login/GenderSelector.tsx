import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const OPTIONS: { value: string; labelEn: string; labelAr: string; icon: JSX.Element }[] = [
  {
    value: 'Male',
    labelEn: 'Male',
    labelAr: 'ذكر',
    icon: (
      <svg viewBox="0 0 64 64" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="32" cy="20" r="9" />
        <path d="M16 56c2-10 8-16 16-16s14 6 16 16" />
      </svg>
    ),
  },
  {
    value: 'Female',
    labelEn: 'Female',
    labelAr: 'أنثى',
    icon: (
      <svg viewBox="0 0 64 64" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="32" cy="20" r="9" />
        <path d="M18 56c1-9 6-15 14-15s13 6 14 15" />
        <path d="M22 28c4 4 16 4 20 0" />
      </svg>
    ),
  },
];

export default function GenderSelector({ value, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const isAr = (i18n.language || 'en').startsWith('ar');

  return (
    <div className="space-y-3">
      <label className="block text-sm font-ui text-muted-foreground">
        {t('gender.label')}
      </label>
      <div className="grid grid-cols-2 gap-4">
        {OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className={`group relative overflow-hidden rounded-2xl border backdrop-blur-xl p-5 flex flex-col items-center gap-3 transition-all duration-300 ${
                selected
                  ? 'border-primary/70 bg-primary/[0.06] shadow-[0_0_36px_-6px_hsl(var(--gold)/0.55)]'
                  : 'border-border/50 bg-secondary/30 hover:border-primary/40 hover:bg-primary/[0.03]'
              }`}
              aria-pressed={selected}
            >
              {/* Animated gold sweep on hover */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    'radial-gradient(circle at 50% 0%, hsl(var(--gold)/0.18), transparent 65%)',
                }}
              />
              {selected && (
                <motion.span
                  layoutId="gender-glow"
                  aria-hidden
                  className="absolute -inset-px rounded-2xl"
                  style={{
                    background:
                      'linear-gradient(135deg, hsl(var(--gold)/0.35), transparent 50%, hsl(var(--gold)/0.25))',
                    WebkitMask:
                      'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                    padding: 1,
                  }}
                />
              )}
              <div
                className={`relative flex items-center justify-center w-16 h-16 rounded-full border transition-all ${
                  selected
                    ? 'border-primary/60 text-primary bg-primary/10 shadow-[inset_0_0_20px_hsl(var(--gold)/0.25)]'
                    : 'border-border/60 text-foreground/70 group-hover:text-primary group-hover:border-primary/40'
                }`}
              >
                {opt.icon}
              </div>
              <div className="relative text-center">
                <div className={`font-display text-lg ${selected ? 'gold-text' : 'text-foreground'}`}>
                  {t(`gender.${opt.value.toLowerCase()}`)}
                </div>
                <div className="text-[10px] font-ui tracking-[0.2em] uppercase text-muted-foreground mt-0.5">
                  {isAr ? opt.labelEn : opt.labelAr}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
