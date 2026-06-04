import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';

/** Dev-only floating version badge. Hidden in production builds. */
export default function DevVersionBadge() {
  const { stage } = useApp();
  const [open, setOpen] = useState(true);

  // Cmd/Ctrl+Shift+V toggles
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!import.meta.env.DEV) return null;

  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';
  const ts = buildTime ? new Date(buildTime).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }) : '';

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Show dev badge"
        className="fixed bottom-3 right-3 z-[60] w-2.5 h-2.5 rounded-full bg-primary/60 shadow-[0_0_8px_hsl(var(--gold))]"
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-3 right-3 z-[60] glass rounded-lg px-3 py-2 border border-border/40 text-[10px] font-ui text-muted-foreground select-none pointer-events-auto"
      style={{ backdropFilter: 'blur(16px)' }}
    >
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
        <span className="text-primary font-semibold tracking-wider">v{version}</span>
        {ts && <span className="opacity-70">· {ts}</span>}
        <span className="opacity-70">· {stage}</span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Hide"
          className="ml-1 opacity-50 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </motion.div>
  );
}
