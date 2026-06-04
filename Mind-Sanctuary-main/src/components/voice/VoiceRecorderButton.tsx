import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Mic, Trash2, Send, Pause, Play, Lock, ChevronUp, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { startRecording, type RecorderHandle, type VoiceRecording } from '@/lib/voice/recorder';
import Waveform from './Waveform';
import { toast } from 'sonner';
import { emitVoiceEvent } from '@/lib/voice/telemetry';

interface Props {
  disabled?: boolean;
  onRecorded: (rec: VoiceRecording, transcript: string) => void;
}

type SR = {
  start(): void; stop(): void; abort(): void;
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

const STT_LANG: Record<string, string> = {
  en: 'en-US', ar: 'ar-SA', es: 'es-ES', fr: 'fr-FR', it: 'it-IT',
};

function makeSTT(lang: string): SR | null {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.continuous = true; r.interimResults = true; r.lang = lang;
  return r;
}

// Slide-to-cancel / lock thresholds (px) — generous for finger-friendly mobile.
const CANCEL_THRESHOLD = 90;
const LOCK_THRESHOLD = 70;
const HOLD_INTENT_MS = 180; // pointer must stay > this to be a "hold"

type Phase = 'idle' | 'recording' | 'locked' | 'preview';

export default function VoiceRecorderButton({ disabled, onRecorded }: Props) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir(i18n.language) === 'rtl';
  const reduceMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [live, setLive] = useState<number[]>(Array(36).fill(0.05));
  const [level, setLevel] = useState(0);
  const [paused, setPaused] = useState(false);
  const [drag, setDrag] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [preview, setPreview] = useState<{ rec: VoiceRecording; transcript: string; url: string } | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const handleRef = useRef<RecorderHandle | null>(null);
  const sttRef = useRef<SR | null>(null);
  const transcriptRef = useRef('');
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const sttActiveRef = useRef(false);
  const sttLangRef = useRef('en-US');
  const cancelledRef = useRef(false);
  const lockedRef = useRef(false);
  const rafRef = useRef(0);
  const startPtRef = useRef<{ x: number; y: number } | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const pointerDownAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const waveformStartRef = useRef(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const sttRestartTimerRef = useRef<number | null>(null);

  const cleanupTimers = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (sttRestartTimerRef.current) { clearTimeout(sttRestartTimerRef.current); sttRestartTimerRef.current = null; }
  }, []);

  const teardown = useCallback((silent: boolean) => {
    cleanupTimers();
    if (sttRef.current) { try { sttRef.current.stop(); } catch { /* */ } sttRef.current = null; }
    if (silent && handleRef.current) handleRef.current.cancel();
    handleRef.current = null;
  }, [cleanupTimers]);

  useEffect(() => () => {
    teardown(true);
    if (previewAudioRef.current) { try { previewAudioRef.current.pause(); } catch { /* */ } previewAudioRef.current = null; }
    if (preview?.url) URL.revokeObjectURL(preview.url);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginRecording = useCallback(async () => {
    if (disabled || phase !== 'idle') return;
    cancelledRef.current = false;
    lockedRef.current = false;
    transcriptRef.current = '';
    setDrag({ dx: 0, dy: 0 });
    setPaused(false);
    try {
      const h = await startRecording();
      handleRef.current = h;
      startedAtRef.current = performance.now();
      waveformStartRef.current = performance.now();
      setPhase('recording');
      setElapsed(0);
      emitVoiceEvent('recording_started', { meta: { surface: 'composer' } });
      emitVoiceEvent('waveform_capture_started');

      const base = (i18n.language || 'en').split('-')[0];
      const sttLang = STT_LANG[base] ?? i18n.language ?? 'en-US';
      sttLangRef.current = sttLang;
      finalTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      transcriptRef.current = '';
      startSTT();

      const tick = () => {
        const hh = handleRef.current;
        if (!hh) return;
        setElapsed(hh.duration());
        setLive(hh.getLiveWave());
        setLevel(hh.getLevel());
        if (hh.duration() > 300) { void finish(); return; }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.warn('mic', e);
      emitVoiceEvent('recording_failed', { errorCode: (e as Error)?.message?.slice(0, 120) });
      toast.error(t('voice.micUnavailable'));
      setPhase('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, phase, i18n.language, t]);

  // Web Speech STT lifecycle — accumulates final segments AND keeps the most
  // recent interim so we never lose the last words before stop().
  // Auto-restarts when the browser ends recognition mid-recording
  // (Chrome ~10s silence, Safari ends per-utterance) so long Arabic
  // recordings keep producing transcript across pauses.
  const startSTT = useCallback(() => {
    const stt = makeSTT(sttLangRef.current);
    if (!stt) return;
    stt.onresult = (e) => {
      let newFinal = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) newFinal += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (newFinal) {
        finalTranscriptRef.current = (finalTranscriptRef.current + ' ' + newFinal).trim();
      }
      interimTranscriptRef.current = interim.trim();
      transcriptRef.current = (finalTranscriptRef.current + ' ' + interimTranscriptRef.current).trim();
    };
    stt.onerror = () => {
      // Promote any pending interim into final so it isn't lost on error.
      if (interimTranscriptRef.current) {
        finalTranscriptRef.current = (finalTranscriptRef.current + ' ' + interimTranscriptRef.current).trim();
        interimTranscriptRef.current = '';
      }
    };
    stt.onend = () => {
      sttActiveRef.current = false;
      // Promote interim → final so a mid-stream end doesn't truncate the tail.
      if (interimTranscriptRef.current) {
        finalTranscriptRef.current = (finalTranscriptRef.current + ' ' + interimTranscriptRef.current).trim();
        interimTranscriptRef.current = '';
        transcriptRef.current = finalTranscriptRef.current;
      }
      // Restart if we're still actively recording (silence/utterance cutoff).
      const stillRecording = handleRef.current && !handleRef.current.isPaused();
      if (stillRecording) {
        sttRestartTimerRef.current = window.setTimeout(() => {
          sttRestartTimerRef.current = null;
          if (handleRef.current && !sttActiveRef.current) startSTT();
        }, 80);
      }
    };
    try {
      stt.start();
      sttRef.current = stt;
      sttActiveRef.current = true;
    } catch { /* already started or unsupported */ }
  }, []);

  const cancelRecording = useCallback((reason: 'gesture' | 'manual') => {
    const dur = handleRef.current ? handleRef.current.duration() : 0;
    cancelledRef.current = true;
    teardown(true);
    emitVoiceEvent('recording_cancelled', {
      durationMs: Math.round(dur * 1000),
      meta: { reason },
    });
    setPhase('idle');
    setPaused(false);
    setDrag({ dx: 0, dy: 0 });
  }, [teardown]);

  const togglePause = useCallback(() => {
    const h = handleRef.current;
    if (!h) return;
    if (h.isPaused()) {
      h.resume();
      setPaused(false);
      emitVoiceEvent('recording_resumed');
    } else {
      h.pause();
      setPaused(true);
      emitVoiceEvent('recording_paused', { meta: { pauseCount: h.pauseCount() + 1 } });
    }
  }, []);

  const finish = useCallback(async () => {
    const h = handleRef.current;
    if (!h) { setPhase('idle'); return; }
    cleanupTimers();
    const pauseCountN = h.pauseCount();
    const dur = h.duration();
    const rec = await h.stop();
    // Stop STT AFTER recorder fully finalizes so the trailing interim/final
    // events have a chance to land. Then collapse interim → final.
    if (sttRef.current) {
      try { sttRef.current.stop(); } catch { /* */ }
      sttRef.current = null;
    }
    if (interimTranscriptRef.current) {
      finalTranscriptRef.current = (finalTranscriptRef.current + ' ' + interimTranscriptRef.current).trim();
      interimTranscriptRef.current = '';
    }
    transcriptRef.current = finalTranscriptRef.current || transcriptRef.current;
    handleRef.current = null;
    if (cancelledRef.current || !rec) { setPhase('idle'); return; }
    if (rec.duration < 0.4) {
      toast(t('voice.holdLonger'));
      emitVoiceEvent('recording_discarded', { meta: { reason: 'too_short', durationMs: Math.round(rec.duration * 1000) } });
      setPhase('idle');
      return;
    }
    emitVoiceEvent('waveform_capture_completed', {
      durationMs: Math.round(performance.now() - waveformStartRef.current),
      meta: { samples: rec.waveform.length },
    });
    emitVoiceEvent('recording_completed', {
      durationMs: Math.round(dur * 1000),
      bytes: rec.blob.size,
      meta: { pauseCount: pauseCountN, locked: lockedRef.current },
    });

    if (lockedRef.current) {
      // Lock mode → show preview before send
      const url = URL.createObjectURL(rec.blob);
      setPreview({ rec, transcript: transcriptRef.current, url });
      setPhase('preview');
      setPaused(false);
    } else {
      onRecorded(rec, transcriptRef.current);
      setPhase('idle');
      setPaused(false);
    }
  }, [cleanupTimers, onRecorded, t]);

  // -------- Gesture handlers (hold + slide-to-cancel + lock) --------
  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || phase !== 'idle') return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointerDownAtRef.current = performance.now();
    startPtRef.current = { x: e.clientX, y: e.clientY };
    holdTimerRef.current = window.setTimeout(() => {
      void beginRecording();
    }, HOLD_INTENT_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!startPtRef.current || phase !== 'recording') return;
    const rawDx = e.clientX - startPtRef.current.x;
    const dx = isRtl ? rawDx : -rawDx;     // positive dx = "toward cancel" (start side)
    const dy = startPtRef.current.y - e.clientY; // positive dy = upward (toward lock)
    setDrag({ dx: Math.max(0, dx), dy: Math.max(0, dy) });
    if (dx >= CANCEL_THRESHOLD) {
      cancelRecording('gesture');
      startPtRef.current = null;
    } else if (dy >= LOCK_THRESHOLD) {
      lockedRef.current = true;
      setPhase('locked');
      setDrag({ dx: 0, dy: 0 });
      emitVoiceEvent('recording_locked');
      startPtRef.current = null;
    }
  };

  const onPointerUp = () => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    const heldFor = performance.now() - pointerDownAtRef.current;
    startPtRef.current = null;
    if (phase === 'recording') {
      // Quick tap (released before HOLD_INTENT_MS handled below) → treat as tap-toggle: lock instead of finish
      if (heldFor < HOLD_INTENT_MS + 80 && handleRef.current && handleRef.current.duration() < 0.4) {
        lockedRef.current = true;
        setPhase('locked');
        emitVoiceEvent('recording_locked', { meta: { via: 'tap' } });
        setDrag({ dx: 0, dy: 0 });
        return;
      }
      void finish();
    }
  };

  const onPointerCancel = () => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    startPtRef.current = null;
    if (phase === 'recording') void finish();
  };

  // -------- Preview controls --------
  const playPreview = () => {
    if (!preview) return;
    const a = previewAudioRef.current ?? new Audio(preview.url);
    previewAudioRef.current = a;
    a.onended = () => setPreviewPlaying(false);
    a.play().then(() => setPreviewPlaying(true)).catch(() => setPreviewPlaying(false));
  };
  const pausePreview = () => {
    const a = previewAudioRef.current;
    if (!a) return;
    a.pause();
    setPreviewPlaying(false);
  };
  const discardPreview = () => {
    if (!preview) return;
    if (previewAudioRef.current) { try { previewAudioRef.current.pause(); } catch { /* */ } previewAudioRef.current = null; }
    URL.revokeObjectURL(preview.url);
    emitVoiceEvent('recording_discarded', { meta: { reason: 'preview_cancel' } });
    setPreview(null);
    setPhase('idle');
    setPreviewPlaying(false);
  };
  const sendPreview = () => {
    if (!preview) return;
    if (previewAudioRef.current) { try { previewAudioRef.current.pause(); } catch { /* */ } previewAudioRef.current = null; }
    URL.revokeObjectURL(preview.url);
    onRecorded(preview.rec, preview.transcript);
    setPreview(null);
    setPhase('idle');
    setPreviewPlaying(false);
  };

  const glowScale = 1 + Math.min(0.25, level * 0.6);
  const isActive = phase === 'recording' || phase === 'locked';
  const cancelProgress = Math.min(1, drag.dx / CANCEL_THRESHOLD);
  const lockProgress = Math.min(1, drag.dy / LOCK_THRESHOLD);

  return (
    <div className="relative flex items-center">
      {/* Lock hint (visible only during press-hold recording) */}
      <AnimatePresence>
        {phase === 'recording' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: -Math.min(40, drag.dy) }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-12 start-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-1"
          >
            <div
              className="rounded-full glass-strong border border-primary/30 p-2 shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.4)]"
              style={{ opacity: 0.4 + lockProgress * 0.6 }}
            >
              <Lock className="w-3.5 h-3.5 text-primary" />
            </div>
            {!reduceMotion && (
              <motion.div
                animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              >
                <ChevronUp className="w-3 h-3 text-primary/60" />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active recording strip (hold or locked) */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, x: isRtl ? -8 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? -8 : 8 }}
            className={`absolute ${isRtl ? 'left-12' : 'right-12'} top-1/2 -translate-y-1/2 flex items-center gap-2 glass-strong border ${
              cancelProgress > 0.4 ? 'border-destructive/60' : 'border-primary/30'
            } rounded-full ps-2 pe-1 py-1 shadow-[0_0_28px_-8px_hsl(var(--primary)/0.5)]`}
            style={{
              transform: phase === 'recording'
                ? `translate(${isRtl ? drag.dx * 0.4 : -drag.dx * 0.4}px, ${-drag.dy * 0.2}px)`
                : undefined,
              opacity: 1 - cancelProgress * 0.4,
            }}
          >
            <button
              type="button"
              onClick={() => cancelRecording('manual')}
              className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label={t('common.cancel')}
              title={t('common.cancel')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {phase === 'locked' && (
              <button
                type="button"
                onClick={togglePause}
                className="p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                aria-label={paused ? t('common.resume', { defaultValue: 'Resume' }) : t('common.pause', { defaultValue: 'Pause' })}
              >
                {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
            )}

            <Waveform
              values={live}
              active={!paused}
              color={cancelProgress > 0.4 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
              height={20}
              barWidth={2}
              gap={2}
              className="w-28 sm:w-32"
            />
            <span className="text-[11px] font-ui tabular-nums text-muted-foreground min-w-[34px] text-end">
              {formatTime(elapsed)}
            </span>

            {/* Slide-to-cancel hint during hold */}
            {phase === 'recording' && (
              <span
                className="hidden sm:inline-flex items-center gap-1 text-[10px] font-ui text-muted-foreground/80 ps-1"
                style={{ opacity: 1 - cancelProgress }}
              >
                {isRtl ? '◂' : '◂'} {t('voice.slideToCancel', { defaultValue: 'Slide to cancel' })}
              </span>
            )}

            {phase === 'locked' && (
              <motion.button
                type="button"
                onClick={() => void finish()}
                whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                className="p-1.5 rounded-full bg-primary text-background"
                aria-label={t('voice.sendVoice')}
                title={t('common.send')}
              >
                <Send className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview-before-send strip */}
      <AnimatePresence>
        {phase === 'preview' && preview && (
          <motion.div
            initial={{ opacity: 0, x: isRtl ? -8 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? -8 : 8 }}
            className={`absolute ${isRtl ? 'left-12' : 'right-12'} top-1/2 -translate-y-1/2 flex items-center gap-2 glass-strong border border-primary/40 rounded-full ps-2 pe-1 py-1 shadow-[0_0_28px_-8px_hsl(var(--primary)/0.55)]`}
          >
            <button
              type="button"
              onClick={discardPreview}
              className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label={t('common.discard', { defaultValue: 'Discard' })}
              title={t('common.discard', { defaultValue: 'Discard' })}
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={previewPlaying ? pausePreview : playPreview}
              className="p-1.5 rounded-full text-primary hover:bg-primary/10 transition-colors"
              aria-label={previewPlaying ? 'Pause preview' : 'Play preview'}
            >
              {previewPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <Waveform values={preview.rec.waveform.slice(0, 36)} color="hsl(var(--primary))" height={20} barWidth={2} gap={2} className="w-28 sm:w-32" />
            <span className="text-[11px] font-ui tabular-nums text-muted-foreground min-w-[34px] text-end">
              {formatTime(preview.rec.duration)}
            </span>
            <motion.button
              type="button"
              onClick={sendPreview}
              whileTap={reduceMotion ? undefined : { scale: 0.92 }}
              className="p-1.5 rounded-full bg-primary text-background"
              aria-label={t('voice.sendVoice')}
              title={t('common.send')}
            >
              <Send className="w-3.5 h-3.5" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        disabled={disabled || phase === 'preview'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 touch-none select-none ${
          isActive
            ? cancelProgress > 0.4
              ? 'bg-destructive/25 border border-destructive/60 text-destructive'
              : 'bg-primary/20 border border-primary/60 text-primary'
            : 'glass border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/50'
        } disabled:opacity-30 disabled:cursor-not-allowed`}
        aria-label={
          phase === 'idle' ? t('voice.holdToRecord')
          : phase === 'recording' ? t('voice.releaseToSend')
          : phase === 'locked' ? t('voice.sendVoice')
          : 'Voice preview'
        }
        title={phase === 'idle' ? t('voice.holdToRecord') : t('voice.releaseToSend')}
      >
        {isActive ? (
          <>
            {!reduceMotion && (
              <motion.span
                className="absolute -inset-1 rounded-full border border-primary/40"
                animate={{ scale: [1, 1.5, 1], opacity: [0.55, 0, 0.55] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              />
            )}
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, hsl(var(--primary)/0.45), transparent 70%)',
                transform: `scale(${reduceMotion ? 1 : glowScale})`,
                transition: 'transform 90ms ease-out',
              }}
            />
            {phase === 'locked' ? <Lock className="w-3.5 h-3.5 relative" /> : <Mic className="w-4 h-4 relative" />}
          </>
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </motion.button>
    </div>
  );
}

function formatTime(sec: number) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
