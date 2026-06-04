import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useResolvedStorageUrl } from '@/hooks/useResolvedStorageUrl';
import { emitVoiceEvent } from '@/lib/voice/telemetry';
import {
  claimAudio,
  noteReplay,
  notePlaybackResumed,
  recallPlaybackSpeed,
  rememberPlaybackSpeed,
  type AudioClaim,
  type InterruptReason,
} from '@/lib/voice/audioOrchestrator';
import Waveform from './Waveform';

interface Props {
  url?: string;
  path?: string;
  duration: number;
  waveform: number[];
  accent?: 'gold' | 'muted';
  pending?: boolean;
  autoplay?: boolean;
  messageId?: string;
  sessionId?: string;
  /** Visual + telemetry variant. Assistant variant emits speaking_* events. */
  variant?: 'user' | 'assistant';
}

const SPEEDS = [1, 1.5, 2] as const;
type Speed = typeof SPEEDS[number];

let __vpUid = 0;

export default function VoicePlayer({
  url, path, duration, waveform, accent = 'gold', pending, autoplay, messageId, sessionId,
  variant = 'assistant',
}: Props) {
  const { t } = useTranslation();
  const resolvedUrl = useResolvedStorageUrl(url, path);
  const playUrl = resolvedUrl ?? url;
  const reduceMotion = useReducedMotion();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const claimRef = useRef<AudioClaim | null>(null);
  const rafRef = useRef<number | null>(null);
  const speakingStartRef = useRef<number | null>(null);
  const resumedOnceRef = useRef(false);
  const token = useMemo(() => `vp:${++__vpUid}:${messageId ?? 'anon'}`, [messageId]);

  const [playing, setPlaying] = useState(false);
  const [t_, setT] = useState(0);
  const [ended, setEnded] = useState(false);
  const [speed, setSpeed] = useState<Speed>(() => {
    const remembered = recallPlaybackSpeed(sessionId) as Speed | null;
    return (remembered && (SPEEDS as readonly number[]).includes(remembered)) ? remembered : 1;
  });
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const pendingAutoplayRef = useRef(false);

  // ── Volume fade helpers (smooth playback transitions) ──────────────────
  const fadeRafRef = useRef<number | null>(null);
  const fadeVolume = (target: number, ms: number, after?: () => void) => {
    const a = audioRef.current;
    if (!a) { after?.(); return; }
    if (fadeRafRef.current != null) cancelAnimationFrame(fadeRafRef.current);
    const start = performance.now();
    const from = a.volume;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / Math.max(1, ms));
      const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      try { a.volume = Math.max(0, Math.min(1, from + (target - from) * eased)); } catch { /* noop */ }
      if (k < 1) {
        fadeRafRef.current = requestAnimationFrame(step);
      } else {
        fadeRafRef.current = null;
        after?.();
      }
    };
    fadeRafRef.current = requestAnimationFrame(step);
  };

  // ── Audio element lifecycle (only once per resolved url) ─────────────
  useEffect(() => {
    if (!playUrl) return;
    setCanPlay(false);
    setLoadError(false);
    const a = new Audio();
    // 'auto' so iOS/Safari actually fetch enough to fire canplay without
    // requiring a user gesture first — fixes "voice bubble stuck loading".
    a.preload = 'auto';
    a.crossOrigin = 'anonymous';
    a.src = playUrl;
    a.playbackRate = speed;
    a.volume = 0;
    audioRef.current = a;
    const onReady = () => {
      setCanPlay(true);
      if (pendingAutoplayRef.current) {
        pendingAutoplayRef.current = false;
        tryPlay('autoplay');
      }
    };
    const onEnd = () => {
      setPlaying(false);
      setEnded(true);
      releaseOwnership('ended');
      stopRaf();
    };
    const onPause = () => setPlaying(false);
    const onError = () => {
      setLoadError(true);
      setCanPlay(false);
      pendingAutoplayRef.current = false;
      emitVoiceEvent('playback_interrupted', { messageId, sessionId, meta: { reason: 'load_error' } });
    };
    a.addEventListener('loadedmetadata', onReady);
    a.addEventListener('canplay', onReady);
    a.addEventListener('canplaythrough', onReady);
    a.addEventListener('ended', onEnd);
    a.addEventListener('pause', onPause);
    a.addEventListener('error', onError);
    // Force-load (some browsers won't kick off a request from setting src alone)
    try { a.load(); } catch { /* */ }
    return () => {
      if (fadeRafRef.current != null) cancelAnimationFrame(fadeRafRef.current);
      fadeRafRef.current = null;
      pendingAutoplayRef.current = false;
      a.pause();
      a.removeEventListener('loadedmetadata', onReady);
      a.removeEventListener('canplay', onReady);
      a.removeEventListener('canplaythrough', onReady);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('error', onError);
      releaseOwnership('unmount');
      stopRaf();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  // ── rAF progress loop (smoother than `timeupdate`) ─────────────────────
  const startRaf = () => {
    if (rafRef.current != null) return;
    const tick = () => {
      const a = audioRef.current;
      if (a && !a.paused) {
        setT(a.currentTime);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };
  const stopRaf = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  // ── Centralised release (telemetry-correct, idempotent) ────────────────
  const releaseOwnership = (reason: InterruptReason) => {
    const claim = claimRef.current;
    if (!claim) return;
    claimRef.current = null;
    claim.release(reason);
    if (variant === 'assistant' && speakingStartRef.current != null) {
      const durMs = Date.now() - speakingStartRef.current;
      speakingStartRef.current = null;
      emitVoiceEvent('assistant_speaking_completed', {
        messageId, sessionId, durationMs: durMs,
      });
    }
    if (reason === 'ended') {
      emitVoiceEvent('playback_completed', { messageId, sessionId });
    } else if (reason === 'visibility') {
      emitVoiceEvent('playback_visibility_paused', { messageId, sessionId });
    } else if (reason === 'navigation' || reason === 'unmount') {
      emitVoiceEvent('playback_focus_released', { messageId, sessionId, meta: { reason } });
    } else if (reason !== 'user_action') {
      emitVoiceEvent('playback_interrupted', { messageId, sessionId, meta: { reason } });
    }
  };

  const tryPlay = (origin: 'autoplay' | 'user') => {
    const a = audioRef.current;
    if (!a) return;
    // Reentrancy guard against double-tap.
    if (playing) return;
    claimRef.current = claimAudio({
      token,
      role: variant,
      messageId,
      sessionId,
      onPause: (reason) => {
        // Soft-stop: fade out volume then pause for a tactile, non-jarring stop.
        fadeVolume(0, 140, () => { try { a.pause(); } catch { /* noop */ } });
        setPlaying(false);
        stopRaf();
        if (reason === 'visibility') {
          emitVoiceEvent('playback_visibility_paused', { messageId, sessionId });
        } else if (reason !== 'user_action' && reason !== 'ended') {
          emitVoiceEvent('playback_interrupted', { messageId, sessionId, meta: { reason } });
        }
        claimRef.current = null;
        if (variant === 'assistant' && speakingStartRef.current != null) {
          const durMs = Date.now() - speakingStartRef.current;
          speakingStartRef.current = null;
          emitVoiceEvent('assistant_speaking_completed', { messageId, sessionId, durationMs: durMs });
        }
      },
    });
    try { a.volume = 0; } catch { /* noop */ }
    a.play()
      .then(() => {
        fadeVolume(1, 220);
        setPlaying(true);
        setEnded(false);
        setAutoplayBlocked(false);
        startRaf();
        emitVoiceEvent('playback_started', {
          messageId, sessionId, meta: { origin, variant },
        });
        emitVoiceEvent('active_speaker_changed', {
          messageId, sessionId, meta: { role: variant },
        });
        if (variant === 'assistant') {
          speakingStartRef.current = Date.now();
          emitVoiceEvent('assistant_speaking_started', { messageId, sessionId });
        }
        if (origin === 'autoplay') {
          emitVoiceEvent('autoplay_started', { messageId, sessionId });
        } else {
          noteReplay();
          emitVoiceEvent('replay_voice', { messageId, sessionId });
          if (resumedOnceRef.current) {
            notePlaybackResumed();
            emitVoiceEvent('playback_resumed', { messageId, sessionId });
          }
          resumedOnceRef.current = true;
        }
      })
      .catch(() => {
        setPlaying(false);
        claimRef.current?.release('user_action');
        claimRef.current = null;
        if (origin === 'autoplay') {
          setAutoplayBlocked(true);
          emitVoiceEvent('autoplay_blocked', { messageId, sessionId });
        }
      });
  };

  // ── Autoplay ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoplay || !audioRef.current || pending || !playUrl) return;
    if (canPlay) tryPlay('autoplay');
    else pendingAutoplayRef.current = true; // queue until canplay fires
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, pending, playUrl, canPlay]);

  const toggle = () => {
    if (pending) return;
    const a = audioRef.current; if (!a) return;
    if (playing) {
      // Soft pause: fade out before pausing for a smoother stop.
      fadeVolume(0, 140, () => { try { a.pause(); } catch { /* noop */ } });
      setPlaying(false);
      releaseOwnership('user_action');
      stopRaf();
    } else {
      if (ended) { a.currentTime = 0; setT(0); }
      tryPlay('user');
    }
  };

  const seek = (ratio: number) => {
    if (pending) return;
    const a = audioRef.current; if (!a) return;
    const dur = a.duration && isFinite(a.duration) && a.duration > 0 ? a.duration : duration;
    a.currentTime = ratio * dur;
    setT(a.currentTime);
    emitVoiceEvent('waveform_scrub', { messageId, sessionId, meta: { ratio: Number(ratio.toFixed(2)) } });
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    rememberPlaybackSpeed(sessionId, next);
    emitVoiceEvent('playback_speed_changed', { messageId, sessionId, meta: { speed: next } });
  };

  const total = (() => {
    const d = audioRef.current?.duration;
    return d && isFinite(d) && d > 0 ? d : duration;
  })();
  const progress = total > 0 ? Math.min(1, t_ / total) : 0;
  const color = accent === 'gold' ? 'hsl(var(--gold))' : 'hsl(var(--foreground) / 0.65)';

  // ── Skeleton while assistant TTS is in-flight ──────────────────────────
  if (pending && (!waveform || waveform.length === 0)) {
    return (
      <div
        className="flex items-center gap-3 min-w-[200px] max-w-[320px]"
        aria-busy="true"
        aria-label={t('voice.generatingVoice', { defaultValue: 'Generating voice…' })}
      >
        <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 animate-pulse" />
        <div className="flex-1 h-[26px] rounded-md bg-muted/40 animate-pulse" />
        <span className="text-[10px] font-ui text-muted-foreground min-w-[34px] text-end">…</span>
      </div>
    );
  }

  const isAssistant = variant === 'assistant';
  const showReplay = ended && !playing;

  return (
    <div
      className="flex items-center gap-3 min-w-[200px] max-w-[320px] select-none"
      role="group"
      aria-label={isAssistant ? t('voice.assistantVoice', { defaultValue: 'Assistant voice message' }) : t('voice.userVoice', { defaultValue: 'Your voice message' })}
    >
      <motion.button
        type="button"
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        onClick={toggle}
        disabled={pending || !playUrl || loadError}
        animate={
          playing && !reduceMotion && isAssistant
            ? {
                boxShadow: [
                  '0 0 14px hsl(var(--gold) / 0.35)',
                  '0 0 26px hsl(var(--gold) / 0.7)',
                  '0 0 14px hsl(var(--gold) / 0.35)',
                ],
              }
            : autoplayBlocked && !reduceMotion
            ? { scale: [1, 1.06, 1] }
            : undefined
        }
        transition={
          playing && isAssistant
            ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
            : autoplayBlocked
            ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
            : undefined
        }
        className="relative w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_16px_-4px_hsl(var(--gold)/0.5)] disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        aria-label={
          pending
            ? t('voice.generatingVoice', { defaultValue: 'Generating voice…' })
            : showReplay
            ? t('voice.replay', { defaultValue: 'Replay' })
            : playing
            ? t('voice.pause')
            : t('voice.play')
        }
        aria-pressed={playing}
      >
        {pending ? (
          <span className="w-3 h-3 rounded-full bg-primary animate-pulse" />
        ) : showReplay ? (
          <RotateCcw className="w-4 h-4" />
        ) : playing ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ms-0.5" />
        )}
      </motion.button>

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <Waveform
          values={waveform.length ? waveform : new Array(40).fill(0.4)}
          progress={progress}
          active={playing && !reduceMotion}
          color={color}
          height={26}
          barWidth={2.5}
          gap={2}
          className="w-full"
          onSeek={seek}
        />
        {loadError ? (
          <button
            type="button"
            onClick={() => {
              // Force a fresh load attempt — bumping src reloads the element.
              const a = audioRef.current;
              if (!a || !playUrl) return;
              setLoadError(false);
              setCanPlay(false);
              try { a.src = playUrl + (playUrl.includes('?') ? '&' : '?') + 'r=' + Date.now(); a.load(); } catch { /* */ }
              emitVoiceEvent('autoplay_recovery', { messageId, sessionId, meta: { reason: 'manual_reload' } });
            }}
            className="text-[10px] font-ui text-destructive/90 underline px-0.5 self-start"
          >
            {t('voice.retryLoad', { defaultValue: 'Tap to retry' })}
          </button>
        ) : autoplayBlocked && !playing && (
          <span className="text-[10px] font-ui text-primary/80 px-0.5">
            {t('voice.tapToPlay', { defaultValue: 'Tap to play' })}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 min-w-[58px] justify-end">
        <span className="text-[10px] font-ui tabular-nums text-muted-foreground" aria-live="off">
          {pending ? '…' : format(playing || ended ? t_ : total)}
        </span>
        {!pending && playUrl && (
          <button
            type="button"
            onClick={cycleSpeed}
            className="text-[10px] font-ui tabular-nums px-1.5 py-0.5 rounded-md border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label={t('voice.playbackSpeed', { defaultValue: 'Playback speed' })}
            title={t('voice.playbackSpeed', { defaultValue: 'Playback speed' })}
          >
            {speed}x
          </button>
        )}
      </div>
    </div>
  );
}

function format(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
