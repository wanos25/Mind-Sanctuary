import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@/lib/i18n';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">{t('settings.languageDesc')}</p>
      <div className="grid grid-cols-2 gap-2">
        {LANGUAGES.map(l => {
          const active = i18n.language?.startsWith(l.code);
          return (
            <button
              key={l.code}
              onClick={() => i18n.changeLanguage(l.code)}
              className={`flex items-center gap-2 p-3 rounded-lg border transition-all text-left ${
                active ? 'border-primary/60 bg-primary/10' : 'border-border/30 hover:border-border'
              }`}
            >
              <span className="text-xl">{l.flag}</span>
              <span className="text-sm font-ui text-foreground">{l.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
