import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@/lib/i18n';

/** Compact language picker for the login funnel (RTL-aware). */
export default function LoginLanguageBar() {
  const { i18n, t } = useTranslation();

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1.5 mb-4"
      role="group"
      aria-label={t('settings.language', { defaultValue: 'Language' })}
    >
      {LANGUAGES.map((l) => {
        const active = i18n.language?.startsWith(l.code);
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => i18n.changeLanguage(l.code)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-ui border transition-colors
              ${active
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'}`}
          >
            <span aria-hidden>{l.flag}</span>
            <span className="hidden sm:inline">{l.label}</span>
          </button>
        );
      })}
    </div>
  );
}
