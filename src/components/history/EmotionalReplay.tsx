import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessageRow, getSessionMessages } from '@/lib/sessions';
import { listMomentsForSession, MomentType } from '@/lib/keymoments/detector';

interface ReplayPoint {
  position: number;
  time: number;     // ms from start
  intensity: number;
  emotion: string | null;
  content: string;
  role: 'user' | 'assistant';
}

interface MomentMarker {
  position: number;
  type: MomentType;
  intensity: number;
  summary: string | null;
  emotion: string | null;
}

interface Props { sessionId: string | null; }

const MOMENT_COLOR: Record<MomentType, string> = {
  breakthrough: '50 90% 60%',
  spike: '0 80% 60%',
  recovery: '140 70% 60%',
  distortion: '280 60% 65%',
  crisis: '0 95% 55%',
};

export default function EmotionalReplay({ sessionId }: Props) {
  const { t } = useTranslation();
  const [points, setPoints] = useState<ReplayPoint[]>([]);
  const [moments, setMoments] = useState<MomentMarker[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionId) { setPoints([]); setMoments([]); return; }
    setLoading(true);
    (async () => {
      const [msgs, { data: emo }, { data: { user } }] = await Promise.all([
        getSessionMessages(sessionId),
        supabase.from('emotion_analyses').select('message_id, intensity, primary_emotion, created_at')
          .eq('session_id', sessionId).order('created_at', { ascending: true }),
        supabase.auth.getUser(),
      ]);
      const emoMap = new Map<string, { intensity: number; primary: string | null }>();
      (emo ?? []).forEach((e) => {
        if (e.message_id) emoMap.set(e.message_id, { intensity: Number(e.intensity ?? 0), primary: e.primary_emotion });
      });
      const start = msgs[0] ? new Date(msgs[0].created_at).getTime() : Date.now();
      const pts = msgs.map((m: ChatMessageRow, i): ReplayPoint => {
        const emoRow = emoMap.get(m.id);
        return {
          position: i,
          time: new Date(m.created_at).getTime() - start,
          intensity: emoRow?.intensity ?? (m.role === 'user' ? 0.4 : 0.25),
          emotion: emoRow?.primary ?? null,
          content: m.content, role: (m.role as 'user' | 'assistant'),
        };
      });
      setPoints(pts);
      if (user) {
        const km = await listMomentsForSession(user.id, sessionId);
        setMoments(km.map((k) => ({
          position: k.position, type: k.moment_type,
          intensity: Number(k.intensity), summary: k.summary, emotion: k.emotion,
        })));
      }
      setLoading(false);
      setIdx(0);
    })();
  }, [sessionId]);

  // Playback
  useEffect(() => {
    if (!playing || points.length === 0) return;
    timerRef.current = setInterval(() => {
      setIdx((i) => {
        if (i >= points.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, 1100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, points.length]);

  const W = 600, H = 110;
  const path = useMemo(() => {
    if (!points.length) return '';
    const dx = W / Math.max(1, points.length - 1);
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * dx} ${H - p.intensity * (H - 14) - 7}`).join(' ');
  }, [points]);

  const current = points[idx] ?? null;

  if (!sessionId) {
    return <div className="text-xs text-muted-foreground italic text-center py-8">{t('history.replayUI.selectToReplay')}</div>;
  }
  if (loading) {
    return <div className="text-xs text-muted-foreground text-center py-8">{t('history.replayUI.loadingReplay')}</div>;
  }
  if (!points.length) {
    return <div className="text-xs text-muted-foreground italic text-center py-8">{t('history.replayUI.noMessages')}</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Waveform */}
      <div className="relative rounded-xl border border-border/20 bg-background/30 p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
          <defs>
            <linearGradient id="wave-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="hsl(38 70% 60% / 0.6)" />
              <stop offset="100%" stopColor="hsl(38 70% 40% / 0.05)" />
            </linearGradient>
          </defs>
          <path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill="url(#wave-grad)" />
          <path d={path} stroke="hsl(38 80% 65%)" strokeWidth={1.5} fill="none" />
          {/* moment markers */}
          {moments.map((mk) => {
            const x = (mk.position / Math.max(1, points.length - 1)) * W;
            return (
              <g key={`${mk.position}-${mk.type}`}>
                <line x1={x} x2={x} y1={0} y2={H} stroke={`hsl(${MOMENT_COLOR[mk.type]} / 0.5)`} strokeDasharray="2 3" />
                <circle cx={x} cy={10} r={4} fill={`hsl(${MOMENT_COLOR[mk.type]})`} />
              </g>
            );
          })}
          {/* playhead */}
          <motion.line
            x1={(idx / Math.max(1, points.length - 1)) * W}
            x2={(idx / Math.max(1, points.length - 1)) * W}
            y1={0} y2={H}
            stroke="hsl(var(--gold))" strokeWidth={2}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
        </svg>
        <input
          type="range" min={0} max={Math.max(0, points.length - 1)} value={idx}
          onChange={(e) => setIdx(Number(e.target.value))}
          className="w-full mt-2 accent-primary"
        />
        <div className="flex items-center justify-between mt-2">
          <button onClick={() => setPlaying((p) => !p)}
            className="flex items-center gap-1.5 text-xs font-ui px-3 py-1.5 rounded-full border border-border/30 hover:border-primary/40">
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {playing ? t('history.replayUI.pause') : t('history.replayUI.play')}
          </button>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {idx + 1} / {points.length}
          </span>
        </div>
      </div>

      {/* Current moment */}
      {current && (
        <motion.div
          key={current.position}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border/20 p-3 bg-background/40"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">{current.role}</span>
            {current.emotion && <span className="text-[10px] capitalize text-primary">· {current.emotion}</span>}
            <div className="flex-1" />
            {current.intensity >= 0.7
              ? <TrendingUp className="w-3 h-3 text-destructive/70" />
              : <TrendingDown className="w-3 h-3 text-emerald-500/70" />}
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {Math.round(current.intensity * 100)}%
            </span>
          </div>
          <p className="text-xs text-foreground/85 leading-relaxed line-clamp-4">{current.content}</p>
        </motion.div>
      )}

      {/* Moments list */}
      {moments.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> {t('history.replayUI.keyMoments')}
          </p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto pe-1">
            {moments.map((m) => (
              <button key={`${m.position}-${m.type}`} onClick={() => setIdx(m.position)}
                className="w-full text-start text-[11px] px-2.5 py-1.5 rounded-lg border border-border/20 hover:border-primary/30 transition-colors flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${MOMENT_COLOR[m.type]})` }} />
                <span className="capitalize text-foreground/80">{m.type}</span>
                <span className="text-muted-foreground/70 truncate flex-1">{m.summary ?? ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
