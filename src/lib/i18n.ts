import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from '@/locales/en.json';
import ar from '@/locales/ar.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import it from '@/locales/it.json';

export const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧', dir: 'ltr' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  { code: 'es', label: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹', dir: 'ltr' },
] as const;

const isDev = import.meta.env.DEV;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
      es: { translation: es },
      fr: { translation: fr },
      it: { translation: it },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar', 'es', 'fr', 'it'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    // Dev: surface untranslated keys instead of failing silently.
    saveMissing: isDev,
    missingKeyHandler: isDev
      ? (lngs, ns, key) => {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] Missing translation`, { lngs, ns, key });
        }
      : undefined,
    returnEmptyString: false,
  });

const applyDir = (lng: string) => {
  const cfg = LANGUAGES.find(l => l.code === lng);
  if (typeof document !== 'undefined') {
    document.documentElement.dir = cfg?.dir ?? 'ltr';
    document.documentElement.lang = lng;
    // Expose for CSS hooks (e.g. [data-dir="rtl"] selectors)
    document.documentElement.dataset.dir = cfg?.dir ?? 'ltr';
  }
};

applyDir(i18n.language || 'en');
i18n.on('languageChanged', applyDir);

export default i18n;
