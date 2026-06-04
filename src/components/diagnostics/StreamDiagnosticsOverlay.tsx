import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, X, ChevronDown, ChevronUp } from 'lucide-react';
import {
  subscribeStreams,
  isDiagnosticsEnabled,
  type StreamSnapshot,
} from '@/lib/voice/streamDiagnostics';

function fmtMs(n: number | null | undefined): string {
  if (n == null) return '—';
  return n < 1000 ? `${Math.round(n)}ms` : `${(n / 1000).toFixed(2)}s`;
}

function stateColor(s: StreamSnapshot['state']): string {
  switch (s) {
    case 'connecting': return 'text-sky-400 bg-sky-400/10 border-sky-400/30';
    case 'first_chunk':
    case 'streaming': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
    case 'completed': return 'text-foreground/80 bg-muted/40 border-border';
    case 'aborted': return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
    case 'errored':
    case 'timeout': return 'text-destructive bg-destructive/10 border-destructive/40';
    default: return 'text-muted-foreground bg-muted/30 border-border';
  }
}

export default function StreamDiagnosticsOverlay() {
  const [snaps, setSnaps] = useState<StreamSnapshot[]>([]);
  const [open, setOpen] = useState(true);
  const [visible, setVisible] = useState(isDiagnosticsEnabled());

  useEffect(() => {
    if (!visible) return;
    return subscribeStreams(setSnaps);
  }, [visible]);

  // Keyboard toggle: Ctrl+Shift+D
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setVisible((v) => {
          const next = !v;
          try { localStorage.setItem('diag.stream', next ? '1' : '0'); } catch { /* noop */ }
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      dir="ltr"
      className="fixed bottom-3 right-3 z-[120] w-[320px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-border/60 bg-background/85 backdrop-blur-xl shadow-2xl font-mono text-[11px] select-none"
      role="complementary"
      aria-label="Stream diagnostics"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border-b border-border/40"
      >
        <span className="flex items-center gap-2 text-foreground/90">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-sans font-semibold text-xs tracking-wide">Stream Diagnostics</span>
        </span>
        <span className="flex items-center gap-1">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          <X
            className="w-3.5 h-3.5 opacity-60 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              setVisible(false);
              try { localStorage.setItem('diag.stream', '0'); } catch { /* noop */ }
            }}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="max-h-[50vh] overflow-y-auto p-2 space-y-2">
              {snaps.length === 0 && (
                <div className="text-muted-foreground text-center py-4">No streams yet…</div>
              )}
              {snaps.map((s) => {
                const totalMs = (s.endedAt ?? performance.now()) - s.startedAt;
                const firstMs = s.firstChunkAt ? s.firstChunkAt - s.startedAt : null;
                return (
                  <div key={s.id} className="rounded-lg border border-border/40 bg-card/50 p-2 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wider ${stateColor(s.state)}`}>
                        {s.state}
                      </span>
                      <span className="text-muted-foreground text-[10px] truncate">{s.id}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-foreground/80">
                      <span>TTFB</span><span className="text-right tabular-nums">{fmtMs(firstMs)}</span>
                      <span>Total</span><span className="text-right tabular-nums">{fmtMs(totalMs)}</span>
                      <span>Chunks</span><span className="text-right tabular-nums">{s.chunkCount}</span>
                      <span>Avg Δ</span><span className="text-right tabular-nums">{fmtMs(s.avgChunkIntervalMs)}</span>
                      <span>Chars</span><span className="text-right tabular-nums">{s.totalChars}</span>
                      <span>HTTP</span><span className="text-right tabular-nums">{s.httpStatus ?? '—'}</span>
                      {s.retryCount > 0 && (<><span>Retries</span><span className="text-right tabular-nums">{s.retryCount}</span></>)}
                    </div>
                    {s.reason && <div className="text-[10px] text-muted-foreground truncate">↳ {s.reason}</div>}
                    <div className="text-[9px] text-muted-foreground/70 truncate">{s.provider} · {s.model}</div>
                  </div>
                );
              })}
            </div>
            <div className="px-3 py-1.5 border-t border-border/40 text-[10px] text-muted-foreground/70 text-center">
              Ctrl+Shift+D to toggle
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
