import { useTranslation } from 'react-i18next';

/**
 * Returns layout direction helpers for the active i18n language.
 * Use throughout the app to avoid hardcoded LTR assumptions.
 *
 * Usage:
 *   const { isRtl, dir, start, end } = useDirection();
 *   <div className={isRtl ? 'pr-3' : 'pl-3'} />
 */
export function useDirection() {
  const { i18n } = useTranslation();
  const dir = i18n.dir(i18n.language);
  const isRtl = dir === 'rtl';
  return {
    dir,
    isRtl,
    start: isRtl ? 'right' : 'left',
    end: isRtl ? 'left' : 'right',
    flipX: isRtl ? -1 : 1,
  } as const;
}
