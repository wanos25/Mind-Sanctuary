/**
 * Telemetry dashboard — live event stream + aggregation cards.
 *
 * Subscribes to onVoiceEvent for streaming updates. Memory-safe:
 * single subscription per mount, cleaned up on unmount; renders are
 * throttled via a tick state to avoid runaway updates under burst load.
 */
import { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Trash2, Copy, Download } from 'lucide-react';
import {
  snapshotVoiceTelemetry, onVoiceEvent, type VoiceEvent, type VoiceEventName,
} from '@/lib/voice/telemetry';
import { summarize } from '@/lib/voice/metricsAggregator';

type FilterKey = 'all' | 'upload' | 'stt' | 'tts' | 'autoplay' | 'actions' | 'retries' | 'errors' | 'replay';

const FILTERS: { key: FilterKey; match: (e: VoiceEvent) => boolean }[] = [
  { key: 'all', match: () => true },
  { key: 'upload', match: (e) => e.name.startsWith('upload_') },
  { key: 'stt', match: (e) => e.name.startsWith('stt_') },
  { key: 'tts', match: (e) => e.name.startsWith('tts_') },
  { key: 'autoplay', match: (e) => e.name.startsWith('autoplay_') },
  { key: 'actions', match: (e) => e.name.startsWith('action_') },
  { key: 'retries', match: (e) => e.name === 'pipeline_retry' || e.name === 'pipeline_recovered' },
  { key: 'errors', match: (e) => e.name.endsWith('_failed') || e.name.endsWith('_blocked') },
  { key: 'replay', match: (e) => e.name === 'replay_voice' || e.name === 'reply_navigate' || e.name === 'waveform_scrub' },
];

const severityFor = (n: VoiceEventName): 'info' | 'warn' | 'error' | 'ok' => {
  if (n.endsWith('_failed')) return 'error';
  if (n.endsWith('_blocked') || n === 'pipeline_retry') return 'warn';
  if (n.endsWith('_completed') || n === 'pipeline_recovered') return 'ok';
  return 'info';
};

const sevTone: Record<string, string> = {
  ok: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300',
  warn: 'border-yellow-500/40 bg-yellow-500/5 text-yellow-300',
  error: 'border-red-500/40 bg-red-500/5 text-red-300',
  info: 'border-border/40 bg-secondary/30 text-foreground/80',
};

export default function TelemetryDashboard() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<VoiceEvent[]>(() => snapshotVoiceTelemetry());
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);

  // Single subscription, RAF-coalesced re-render to avoid burst storms.
  useEffect(() => {
    const flush = () => {
      rafRef.current = null;
      if (dirtyRef.current) {
        dirtyRef.current = false;
        setEvents(snapshotVoiceTelemetry());
      }
    };
    const off = onVoiceEvent(() => {
      dirtyRef.current = true;
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(flush);
    });
    return () => {
      off();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const summary = useMemo(() => summarize(events), [events]);
  const filtered = useMemo(() => {
    const fn = FILTERS.find((f) => f.key === filter)!.match;
    return events.filter(fn).slice().reverse();
  }, [events, filter]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `telemetry-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(events, null, 2));
    toast.success(t('diagnostics.toast.copied'));
  };
  const clearBuffer = () => {
    // We don't expose a clear in telemetry.ts on purpose; just clear our view.
    setEvents([]);
    toast.success(t('diagnostics.toast.cleared'));
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Aggregation cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <AggCard label={t('diagnostics.agg.upload')} avg={summary.upload.avgMs} count={summary.upload.count} fails={summary.upload.failures} />
        <AggCard label={t('diagnostics.agg.stt')} avg={summary.stt.avgMs} count={summary.stt.count} fails={summary.stt.failures} />
        <AggCard label={t('diagnostics.agg.tts')} avg={summary.tts.avgMs} count={summary.tts.count} fails={summary.tts.failures} />
        <AggCard label={t('diagnostics.agg.total')} avg={summary.total.avgMs} count={summary.total.count} fails={0} highlight />
        <AggCard label={t('diagnostics.agg.retries')} avg={summary.retries} count={summary.retries} fails={0} unit="" />
        <AggCard label={t('diagnostics.agg.autoplay')} avg={Math.round(summary.autoplaySuccessRate * 100)} count={summary.totalEvents} fails={0} unit="%" />
      </div>

      {/* Ring buffer viz */}
      <div className="glass rounded-2xl border border-border/40 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-ui uppercase tracking-[0.2em] text-muted-foreground">{t('diagnostics.dash.ringBuffer')}</h3>
          <span className="text-[10px] font-mono text-muted-foreground">{events.length} / 200</span>
        </div>
        <div className="flex gap-px h-6 rounded overflow-hidden bg-secondary/30">
          {Array.from({ length: 200 }).map((_, i) => {
            const e = events[i];
            const sev = e ? severityFor(e.name) : null;
            const bg = !e ? 'bg-transparent' :
              sev === 'error' ? 'bg-red-500/70' :
              sev === 'warn' ? 'bg-yellow-500/70' :
              sev === 'ok' ? 'bg-emerald-500/60' : 'bg-primary/40';
            return <div key={i} className={`flex-1 min-w-0 ${bg}`} title={e?.name} />;
          })}
        </div>
      </div>

      {/* Filters + actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[11px] font-ui uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors ${
                filter === f.key
                  ? 'border-primary/60 bg-primary/15 text-primary'
                  : 'border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground/80'
              }`}
            >
              {t(`diagnostics.filter.${f.key}`)}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <IconBtn onClick={copyJson} icon={<Copy className="w-3.5 h-3.5" />} label={t('diagnostics.flowTest.copyJson')} />
          <IconBtn onClick={exportJson} icon={<Download className="w-3.5 h-3.5" />} label={t('diagnostics.flowTest.exportJson')} />
          <IconBtn onClick={clearBuffer} icon={<Trash2 className="w-3.5 h-3.5" />} label={t('diagnostics.dash.clear')} />
        </div>
      </div>

      {/* Event stream */}
      <div className="glass rounded-2xl border border-border/40 max-h-[60vh] overflow-y-auto divide-y divide-border/20">
        <AnimatePresence initial={false}>
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">{t('diagnostics.dash.empty')}</div>
          ) : filtered.map((e, idx) => {
            const sev = severityFor(e.name);
            return (
              <motion.button
                key={`${e.at}-${idx}`}
                type="button"
                onClick={() => setExpanded(expanded === idx ? null : idx)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`w-full text-start px-3 py-2 grid grid-cols-[auto_1fr_auto] items-center gap-3 hover:bg-secondary/30 transition-colors border-s-2 ${sevTone[sev]}`}
              >
                <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                  {new Date(e.at).toLocaleTimeString([], { hour12: false })}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-ui font-medium truncate">{e.name}</p>
                  {expanded === idx && (
                    <pre className="mt-1 text-[10px] text-foreground/70 overflow-x-auto whitespace-pre-wrap break-all max-h-40">
{JSON.stringify(e, null, 2)}
                    </pre>
                  )}
                </div>
                <span className="text-[10px] font-mono tabular-nums text-muted-foreground flex-shrink-0">
                  {typeof e.durationMs === 'number' ? `${e.durationMs}ms` : ''}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AggCard({ label, avg, count, fails, highlight, unit = 'ms' }: { label: string; avg: number; count: number; fails: number; highlight?: boolean; unit?: string }) {
  return (
    <div className={`rounded-xl border p-2.5 ${highlight ? 'border-primary/50 bg-primary/10' : 'border-border/40 bg-secondary/30'}`}>
      <p className="text-[9px] font-ui uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className={`mt-0.5 font-mono tabular-nums text-base ${highlight ? 'text-primary' : 'text-foreground/90'}`}>
        {avg}{unit}
      </p>
      <p className="text-[10px] text-muted-foreground">
        n={count}{fails > 0 ? ` · ⚠ ${fails}` : ''}
      </p>
    </div>
  );
}

function IconBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass border border-border/50 text-foreground/80 font-ui text-[11px] hover:border-primary/40"
    >
      {icon}{label}
    </button>
  );
}
