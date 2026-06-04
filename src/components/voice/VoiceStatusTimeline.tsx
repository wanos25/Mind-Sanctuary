import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Mic, UploadCloud, Languages, Brain, AudioWaveform, Check, AlertCircle, RotateCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { onVoiceEvent, type VoiceEvent } from '@/lib/voice/telemetry';

type Stage = 'recording' | 'uploading' | 'transcribing' | 'thinking' | 'generating' | 'ready';

interface Props {
  /** When true, the timeline binds to the next voice activity and shows itself. */
  active: boolean;
  /** Optional thinking signal from the chat layer (AI streaming in progress). */
  thinking?: boolean;
  /** Called when user dismisses an error. */
  onDismiss?: () => void;
  /** Called when user taps retry on a recoverable error. */
  onRetry?: () => void;
}

const ORDER: Stage[] = ['recording', 'uploading', 'transcribing', 'thinking', 'generating', 'ready'];

const ICONS: Record<Stage, React.ComponentType<{ className?: string }>> = {
  recording: Mic,
  uploading: UploadCloud,
  transcribing: Languages,
  thinking: Brain,
  generating: AudioWaveform,
  ready: Check,
};

export default function VoiceStatusTimeline({ active, thinking, onDismiss, onRetry }: Props) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stop = onVoiceEvent((e: VoiceEvent) => {
      const mapStart: Partial<Record<string, Stage>> = {
        recording_started: 'recording',
        upload_started: 'uploading',
        stt_started: 'transcribing',
        tts_started: 'generating',
      };
      const next = mapStart[e.name];
      if (next) {
        setError(null);
        setVisible(true);
        setStage(next);
        return;
      }
      if (e.name === 'recording_completed') { setStage('uploading'); setVisible(true); return; }
      if (e.name === 'stt_completed') { setStage('thinking'); return; }
      if (e.name === 'tts_completed') {
        setStage('ready');
        setTimeout(() => setVisible(false), 1200);
        return;
      }
      if (e.name === 'upload_failed' || e.name === 'stt_failed' || e.name === 'tts_failed') {
        setError(e.errorCode || t('voiceStatus.error', { defaultValue: 'Something interrupted the voice pipeline.' }));
        setVisible(true);
      }
    });
    return stop;
  }, [t]);

  // Reflect thinking signal from chat layer if no telemetry-driven stage is owning it.
  useEffect(() => {
    if (!active) return;
    if (thinking && (stage === 'transcribing' || stage === null)) setStage('thinking');
  }, [thinking, active, stage]);

  if (!visible || !active) return null;

  const idx = stage ? ORDER.indexOf(stage) : -1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: reduceMotion ? 0 : 0.22 }}
        role="status"
        aria-live="polite"
        className="mx-auto max-w-3xl px-4"
      >
        <div className="glass border border-primary/25 rounded-xl px-3 py-2 flex items-center gap-2 shadow-[0_0_24px_-8px_hsl(var(--gold)/0.4)]">
          <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
            {ORDER.map((s, i) => {
              const Icon = ICONS[s];
              const isPast = idx > i;
              const isCurrent = idx === i && !error;
              const isError = error && idx === i;
              return (
                <div key={s} className="flex items-center gap-1 flex-shrink-0">
                  <motion.div
                    animate={isCurrent && !reduceMotion ? { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] } : { scale: 1, opacity: isPast ? 1 : 0.45 }}
                    transition={isCurrent ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
                    className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                      isError
                        ? 'bg-destructive/15 border-destructive/40 text-destructive'
                        : isPast || isCurrent
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'bg-secondary/40 border-border/40 text-muted-foreground'
                    }`}
                    title={t(`voiceStatus.${s}`, { defaultValue: s })}
                  >
                    {isError ? <AlertCircle className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  </motion.div>
                  {i < ORDER.length - 1 && (
                    <span className={`w-3 h-px ${isPast ? 'bg-primary/50' : 'bg-border/60'}`} aria-hidden />
                  )}
                </div>
              );
            })}
          </div>
          <span className="text-[10px] font-ui text-muted-foreground tracking-wide uppercase hidden sm:inline ms-1">
            {error
              ? t('voiceStatus.error', { defaultValue: 'Error' })
              : stage
              ? t(`voiceStatus.${stage}`, { defaultValue: stage })
              : ''}
          </span>
          {error && onRetry && (
            <button
              onClick={onRetry}
              className="text-[10px] font-ui px-2 py-1 rounded-md border border-primary/40 text-primary hover:bg-primary/10 transition-colors flex items-center gap-1"
              aria-label={t('common.retry')}
            >
              <RotateCw className="w-3 h-3" /> {t('common.retry')}
            </button>
          )}
          {(error || stage === 'ready') && (
            <button
              onClick={() => { setVisible(false); onDismiss?.(); }}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              aria-label={t('common.close')}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
