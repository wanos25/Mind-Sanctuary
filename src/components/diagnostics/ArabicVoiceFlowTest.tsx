/**
 * Arabic Voice Flow Test — premium diagnostics surface.
 *
 * One-click test:
 *   1. Records 4.5s from mic (user reads the target Arabic phrase).
 *   2. Runs sendUserVoice → STT.
 *   3. Computes similarity score vs target.
 *   4. Runs generateAssistantVoice → TTS.
 *   5. Attempts autoplay.
 *   6. Captures roundtrip latency + retry counts.
 *
 * All output: stage timeline, latency cards, pass/fail badges,
 * copy/export JSON snapshot.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Play, RefreshCw, Copy, Download, AlertCircle, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { startRecording, type VoiceRecording, type RecorderHandle } from '@/lib/voice/recorder';
import { sendUserVoice, generateAssistantVoice } from '@/lib/voice/pipeline';
import { snapshotVoiceTelemetry, type VoiceEvent } from '@/lib/voice/telemetry';
import { similarityScore } from '@/lib/voice/metricsAggregator';
import { supabase } from '@/integrations/supabase/client';
import StageTimeline, { type Stage, type StageStatus } from './StageTimeline';

const TARGET_PHRASE = 'انا تعبان ومتوتر';
const LANG = 'ar';
const RECORD_MS = 4500;

type StageKey =
  | 'recording' | 'uploading' | 'stt' | 'thinking'
  | 'generation' | 'tts' | 'waveform' | 'autoplay' | 'complete';

const STAGE_DEFS: { key: StageKey; labelKey: string }[] = [
  { key: 'recording', labelKey: 'diagnostics.stages.recording' },
  { key: 'uploading', labelKey: 'diagnostics.stages.uploading' },
  { key: 'stt', labelKey: 'diagnostics.stages.stt' },
  { key: 'thinking', labelKey: 'diagnostics.stages.thinking' },
  { key: 'generation', labelKey: 'diagnostics.stages.generation' },
  { key: 'tts', labelKey: 'diagnostics.stages.tts' },
  { key: 'waveform', labelKey: 'diagnostics.stages.waveform' },
  { key: 'autoplay', labelKey: 'diagnostics.stages.autoplay' },
  { key: 'complete', labelKey: 'diagnostics.stages.complete' },
];

interface DiagSnapshot {
  startedAt: number;
  finishedAt?: number;
  totalRoundtripMs?: number;
  recording?: { ms: number; bytes: number; mime: string; durationSec: number };
  upload?: { ms: number; url?: string };
  stt?: { ms: number; transcript: string; similarity: number; language: string };
  tts?: { ms: number; url?: string; duration: number };
  waveformPeaks?: number;
  autoplay?: 'success' | 'blocked' | 'failed' | 'skipped';
  retries: number;
  verdict: 'pending' | 'pass' | 'fail' | 'warn';
  failureReason?: string;
  events: VoiceEvent[];
}

const emptySnapshot = (): DiagSnapshot => ({
  startedAt: 0,
  retries: 0,
  verdict: 'pending',
  events: [],
});

export default function ArabicVoiceFlowTest() {
  const { t } = useTranslation();
  const [stages, setStages] = useState<Record<StageKey, { status: StageStatus; ms?: number; detail?: string }>>(() => {
    const s: Record<string, { status: StageStatus }> = {};
    for (const d of STAGE_DEFS) s[d.key] = { status: 'pending' };
    return s as Record<StageKey, { status: StageStatus }>;
  });
  const [snapshot, setSnapshot] = useState<DiagSnapshot>(emptySnapshot);
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const recHandleRef = useRef<RecorderHandle | null>(null);
  const autoStopRef = useRef<number | null>(null);

  const setStage = (k: StageKey, patch: Partial<{ status: StageStatus; ms: number; detail: string }>) =>
    setStages((prev) => ({ ...prev, [k]: { ...prev[k], ...patch } }));

  const resetAll = () => {
    setStages(() => {
      const s: Record<string, { status: StageStatus }> = {};
      for (const d of STAGE_DEFS) s[d.key] = { status: 'pending' };
      return s as Record<StageKey, { status: StageStatus }>;
    });
    setSnapshot(emptySnapshot());
  };

  useEffect(() => () => {
    if (autoStopRef.current) window.clearTimeout(autoStopRef.current);
    recHandleRef.current?.cancel();
  }, []);

  const runFlow = async () => {
    if (running) return;
    resetAll();
    setRunning(true);
    const t0 = performance.now();
    const snap: DiagSnapshot = { ...emptySnapshot(), startedAt: Date.now() };

    let userMsgId: string | null = null;
    try {
      // 0. auth
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) throw new Error('not-authenticated');

      // 1. RECORDING
      setStage('recording', { status: 'active', detail: t('diagnostics.detail.recordingHint') });
      setRecording(true);
      const handle = await startRecording();
      recHandleRef.current = handle;
      const recStart = performance.now();
      const rec: VoiceRecording | null = await new Promise((resolve) => {
        autoStopRef.current = window.setTimeout(async () => {
          try {
            const out = await handle.stop();
            resolve(out);
          } catch { resolve(null); }
        }, RECORD_MS);
      });
      setRecording(false);
      const recMs = Math.round(performance.now() - recStart);
      if (!rec) throw new Error('recording-failed');
      snap.recording = { ms: recMs, bytes: rec.blob.size, mime: rec.mime, durationSec: rec.duration };
      setStage('recording', { status: 'success', ms: recMs, detail: `${(rec.blob.size / 1024).toFixed(1)} KB · ${rec.duration.toFixed(1)}s` });

      // 2. UPLOAD + 3. STT (sendUserVoice wraps both via telemetry)
      setStage('uploading', { status: 'active' });
      setStage('stt', { status: 'active' });
      const sessionId = `diag-${Date.now()}`;
      const upStart = performance.now();
      const sent = await sendUserVoice({
        blob: rec.blob,
        duration: rec.duration,
        waveform: rec.waveform,
        userId: u.user.id,
        sessionId,
        lang: LANG,
      });
      const uploadMs = Math.round(performance.now() - upStart);
      userMsgId = sent.upload.path ?? null;
      snap.upload = { ms: uploadMs, url: sent.upload.url };
      setStage('uploading', { status: 'success', ms: uploadMs, detail: sent.upload.url ? '✓ stored' : '—' });

      const similarity = similarityScore(TARGET_PHRASE, sent.transcript);
      snap.stt = { ms: uploadMs, transcript: sent.transcript, similarity, language: LANG };
      const sttStatus: StageStatus = !sent.transcript ? 'failure' : similarity >= 0.4 ? 'success' : 'warning';
      setStage('stt', {
        status: sttStatus,
        detail: sent.transcript ? `"${sent.transcript}" · ${(similarity * 100).toFixed(0)}%` : t('diagnostics.detail.noTranscript'),
      });

      // 4. THINKING (simulated — no LLM call in diag; we go straight to TTS of canned response)
      setStage('thinking', { status: 'active' });
      const thinkStart = performance.now();
      const cannedReply = 'أتفهم شعورك. خذ نفساً عميقاً، أنا هنا معك.';
      await new Promise((r) => setTimeout(r, 250));
      setStage('thinking', { status: 'success', ms: Math.round(performance.now() - thinkStart) });

      // 5. GENERATION + 6. TTS + 7. WAVEFORM (generateAssistantVoice wraps all three)
      setStage('generation', { status: 'active' });
      setStage('tts', { status: 'active' });
      setStage('waveform', { status: 'active' });
      const ttsStart = performance.now();
      const asst = await generateAssistantVoice({
        text: cannedReply,
        lang: LANG,
        userId: u.user.id,
        sessionId,
      });
      const ttsMs = Math.round(performance.now() - ttsStart);
      snap.tts = { ms: ttsMs, url: asst.url, duration: asst.durationSec };
      snap.waveformPeaks = asst.waveform.length;
      setStage('generation', { status: 'success', detail: cannedReply.slice(0, 40) + '…' });
      setStage('tts', { status: 'success', ms: ttsMs, detail: `${asst.durationSec.toFixed(1)}s` });
      setStage('waveform', { status: 'success', detail: `${asst.waveform.length} peaks` });

      // 8. AUTOPLAY
      setStage('autoplay', { status: 'active' });
      try {
        const audio = new Audio(asst.url);
        await audio.play();
        snap.autoplay = 'success';
        setStage('autoplay', { status: 'success', detail: '✓ unblocked' });
        // Stop quickly — we just want to verify the browser allowed playback.
        window.setTimeout(() => { audio.pause(); audio.src = ''; }, 600);
      } catch {
        snap.autoplay = 'blocked';
        setStage('autoplay', { status: 'warning', detail: t('diagnostics.detail.autoplayBlocked') });
      }

      // 9. COMPLETE
      snap.finishedAt = Date.now();
      snap.totalRoundtripMs = Math.round(performance.now() - t0);
      snap.events = snapshotVoiceTelemetry().filter((e) => e.sessionId === sessionId || e.messageId === userMsgId);
      snap.retries = snap.events.filter((e) => e.name === 'pipeline_retry').length;
      const hasFail = Object.values(stages).some((s) => s.status === 'failure');
      const hasWarn = snap.stt && snap.stt.similarity < 0.4;
      snap.verdict = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass';
      setStage('complete', { status: snap.verdict === 'pass' ? 'success' : snap.verdict === 'warn' ? 'warning' : 'failure', ms: snap.totalRoundtripMs });
      setSnapshot(snap);
    } catch (e) {
      const reason = (e as Error).message || 'unknown';
      snap.verdict = 'fail';
      snap.failureReason = reason;
      snap.finishedAt = Date.now();
      snap.totalRoundtripMs = Math.round(performance.now() - t0);
      snap.events = snapshotVoiceTelemetry().slice(-50);
      setSnapshot(snap);
      // mark first non-success as failure
      setStages((prev) => {
        const next = { ...prev };
        for (const d of STAGE_DEFS) {
          if (next[d.key].status === 'active') { next[d.key] = { status: 'failure', detail: reason }; break; }
        }
        return next;
      });
      toast.error(t('diagnostics.toast.failed', { reason }));
    } finally {
      setRunning(false);
      setRecording(false);
      recHandleRef.current = null;
    }
  };

  const stopEarly = async () => {
    if (autoStopRef.current) { window.clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    await recHandleRef.current?.stop();
  };

  const stagesArr: Stage[] = useMemo(
    () => STAGE_DEFS.map((d) => ({ key: d.key, labelKey: d.labelKey, ...stages[d.key] })),
    [stages],
  );

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice-flow-${snapshot.startedAt || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    toast.success(t('diagnostics.toast.copied'));
  };

  const verdictTone =
    snapshot.verdict === 'pass' ? 'border-emerald-500/60 text-emerald-300 bg-emerald-500/10' :
    snapshot.verdict === 'warn' ? 'border-yellow-500/60 text-yellow-300 bg-yellow-500/10' :
    snapshot.verdict === 'fail' ? 'border-red-500/60 text-red-300 bg-red-500/10' :
    'border-border/40 text-muted-foreground bg-secondary/30';

  return (
    <div className="flex flex-col gap-5">
      {/* Header card */}
      <div className="glass rounded-2xl border border-primary/25 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[10px] font-ui uppercase tracking-[0.22em] text-primary/80">{t('diagnostics.flowTest.eyebrow')}</p>
            <h2 className="text-xl font-display mt-1">{t('diagnostics.flowTest.title')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('diagnostics.flowTest.subtitle')}</p>
            <div dir="rtl" className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30">
              <span className="text-[10px] font-ui uppercase tracking-wider text-primary/70">{t('diagnostics.flowTest.phraseLabel')}</span>
              <span className="font-display text-lg text-primary">{TARGET_PHRASE}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-[11px] font-ui uppercase tracking-wider border ${verdictTone}`}>
              {t(`diagnostics.verdict.${snapshot.verdict}`)}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!running ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={runFlow}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-primary/70 text-primary-foreground font-ui text-sm shadow-[0_8px_28px_-8px_hsl(var(--primary)/0.6)]"
            >
              <Play className="w-4 h-4" />
              {t('diagnostics.flowTest.run')}
            </motion.button>
          ) : recording ? (
            <button
              onClick={stopEarly}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 font-ui text-sm"
            >
              <Square className="w-4 h-4" />
              {t('diagnostics.flowTest.stop')}
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary font-ui text-sm">
              <Mic className="w-4 h-4 animate-pulse" />
              {t('diagnostics.flowTest.processing')}
            </span>
          )}
          <button
            onClick={resetAll}
            disabled={running}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl glass border border-border/50 text-foreground/80 font-ui text-xs hover:border-primary/40 disabled:opacity-40"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('diagnostics.flowTest.reset')}
          </button>
          <button
            onClick={copyJson}
            disabled={!snapshot.finishedAt}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl glass border border-border/50 text-foreground/80 font-ui text-xs hover:border-primary/40 disabled:opacity-40"
          >
            <Copy className="w-3.5 h-3.5" />
            {t('diagnostics.flowTest.copyJson')}
          </button>
          <button
            onClick={exportJson}
            disabled={!snapshot.finishedAt}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl glass border border-border/50 text-foreground/80 font-ui text-xs hover:border-primary/40 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            {t('diagnostics.flowTest.exportJson')}
          </button>
        </div>
      </div>

      {/* Two columns: timeline + latency panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
        <div className="glass rounded-2xl border border-border/40 p-4">
          <h3 className="text-xs font-ui uppercase tracking-[0.2em] text-muted-foreground mb-3">{t('diagnostics.flowTest.timeline')}</h3>
          <StageTimeline stages={stagesArr} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="glass rounded-2xl border border-border/40 p-4">
            <h3 className="text-xs font-ui uppercase tracking-[0.2em] text-muted-foreground mb-3">{t('diagnostics.flowTest.latency')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <LatencyCard label={t('diagnostics.latency.recording')} ms={snapshot.recording?.ms} />
              <LatencyCard label={t('diagnostics.latency.upload')} ms={snapshot.upload?.ms} />
              <LatencyCard label={t('diagnostics.latency.stt')} ms={snapshot.stt?.ms} />
              <LatencyCard label={t('diagnostics.latency.tts')} ms={snapshot.tts?.ms} />
              <LatencyCard label={t('diagnostics.latency.total')} ms={snapshot.totalRoundtripMs} highlight />
              <LatencyCard label={t('diagnostics.latency.retries')} value={snapshot.retries} />
            </div>
          </div>

          {snapshot.stt && (
            <div className="glass rounded-2xl border border-border/40 p-4">
              <h3 className="text-xs font-ui uppercase tracking-[0.2em] text-muted-foreground mb-2">{t('diagnostics.flowTest.transcript')}</h3>
              <p dir="rtl" className="font-display text-lg text-foreground/90">{snapshot.stt.transcript || '—'}</p>
              <p className="text-[11px] mt-2 text-muted-foreground">
                {t('diagnostics.flowTest.similarity', { pct: (snapshot.stt.similarity * 100).toFixed(0) })}
              </p>
            </div>
          )}

          {snapshot.failureReason && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 text-red-300 p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-xs font-ui break-all">{snapshot.failureReason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LatencyCard({ label, ms, value, highlight }: { label: string; ms?: number; value?: number; highlight?: boolean }) {
  const display = typeof ms === 'number'
    ? ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
    : typeof value === 'number' ? String(value) : '—';
  return (
    <div className={`rounded-xl border p-2.5 ${highlight ? 'border-primary/50 bg-primary/10' : 'border-border/40 bg-secondary/30'}`}>
      <p className="text-[10px] font-ui uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className={`mt-0.5 font-mono tabular-nums text-base ${highlight ? 'text-primary' : 'text-foreground/90'}`}>{display}</p>
    </div>
  );
}
