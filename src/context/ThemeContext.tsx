/**
 * Theme system — purple (default) ↔ gold.
 *
 * Architecture:
 * - Reads/writes `data-theme` on <html> so CSS variables defined under
 *   `:root[data-theme="purple"]` / `:root[data-theme="gold"]` cascade to
 *   every component without remounting.
 * - Persists to localStorage and syncs across tabs via the `storage` event.
 * - Initial paint is set by an inline boot script in `index.html` to avoid
 *   a flash of the wrong theme.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeName = 'purple' | 'gold' | 'light';
const STORAGE_KEY = 'mind-sentinel-theme';
const DEFAULT_THEME: ThemeName = 'purple';
const THEME_ORDER: ThemeName[] = ['purple', 'gold', 'light'];

interface ThemeCtx {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  toggleTheme: () => void;
}

const Ctx = createContext<ThemeCtx | undefined>(undefined);

function isTheme(v: unknown): v is ThemeName {
  return v === 'purple' || v === 'gold' || v === 'light';
}

function readInitialTheme(): ThemeName {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const attr = document.documentElement.getAttribute('data-theme');
  if (isTheme(attr)) return attr;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch { /* ignore */ }
  return DEFAULT_THEME;
}

function applyTheme(theme: ThemeName) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => readInitialTheme());

  // Apply on mount (covers the case where SSR/boot script missed) and on change.
  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  // Cross-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (isTheme(e.newValue)) setThemeState(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((t: ThemeName) => setThemeState(t), []);
  const toggleTheme = useCallback(
    () => setThemeState((t) => THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length]),
    [],
  );

  return <Ctx.Provider value={{ theme, setTheme, toggleTheme }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used within ThemeProvider');
  return v;
}
