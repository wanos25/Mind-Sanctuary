import { useTranslation } from 'react-i18next';

/** Keyboard-accessible skip link — first focusable element in the shell. */
export default function SkipToMain() {
  const { t } = useTranslation();
  return (
    <a
      href="#main-content"
      className="skip-link"
    >
      {t('a11y.skipToMain', { defaultValue: 'Skip to main content' })}
    </a>
  );
}
