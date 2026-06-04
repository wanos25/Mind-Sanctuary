import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Lightbulb, RotateCcw, Sparkles, Timer } from 'lucide-react';
import type { ActivityAsset, SpotDifferenceContent } from '@/lib/activities/types';
import { isSpotBuilderContent, type SpotMarker } from '@/lib/activities/builderTypes';
import { clinicSound } from '@/lib/clinicSoundEngine';

interface Props {
  asset: ActivityAsset;
  onComplete: (response: Record<string, unknown>, score?: number) => void;
}

interface FoundTap { markerId: string; x: number; y: number; ts: number }

const DIFFICULTY_DEFAULTS: Record<'easy' | 'medium' | 'hard', { time: number; hintPenalty: number }> = {
  easy:   { time: 180, hintPenalty: 0.05 },
  medium: { time: 120, hintPenalty: 0.10 },
  hard:   { time: 75,  hintPenalty: 0.18 },
};

export default function SpotDifference({ asset, onComplete }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const builder = isSpotBuilderContent(asset.content) ? asset.content : null;
  const legacy = !builder ? (asset.content as SpotDifferenceContent) : null;

  const markers: SpotMarker[] = useMemo(() => builder?.markers ?? [], [builder]);
  const tolerance = builder?.tap_tolerance ?? 0.06;
  const totalNeeded = builder ? markers.length : (legacy?.total_differences ?? 0);

  const difficulty = builder?.difficulty ?? 'medium';
  const dDefaults = DIFFICULTY_DEFAULTS[difficulty];
  const timeLimit = builder?.time_limit_sec ?? dDefaults.time;
  const hintPenalty = builder?.hint_penalty ?? dDefaults.hintPenalty;
  const hintsEnabled = builder?.hints_enabled !== false;

  const imageA = builder?.image_a_url ?? legacy?.image_a_url ?? '';
  const imageB = builder?.image_b_url ?? legacy?.image_b_url ?? '';

  const [found, setFound] = useState<FoundTap[]>([]);
  const [misses, setMisses] = useState<{ x: number; y: number; ts: number }[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [revealedHint, setRevealedHint] = useState<SpotMarker | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(timeLimit);
  const [phase, setPhase] = useState<'playing' | 'won' | 'lost'>('playing');
  const startRef = useRef<number>(Date.now());
  const invalidConfigHandled = useRef(false);

  /* Misconfigured spot assets with zero targets cannot be completed */
  useEffect(() => {
    if (totalNeeded > 0 || invalidConfigHandled.current) return;
    invalidConfigHandled.current = true;
    setPhase('lost');
    onComplete(
      { found: [], total: 0, hintsUsed: 0, elapsed: 0, outcome: 'timeout' },
      0,
    );
  }, [totalNeeded, onComplete]);

  /* Countdown */
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { setPhase('lost'); try { clinicSound.playToggle(); } catch {} return 0; }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const done = totalNeeded > 0 && found.length >= totalNeeded;
  useEffect(() => {
    if (done && phase === 'playing') {
      setPhase('won');
      try { clinicSound.playMessageChime(); } catch {}
    }
  }, [done, phase]);

  const handleHit = useCallback((x: number, y: number) => {
    if (phase !== 'playing') return;
    if (builder) {
      const hit = markers.find((m) => {
        if (found.some((f) => f.markerId === m.id)) return false;
        const dx = m.x - x, dy = m.y - y;
        return Math.sqrt(dx * dx + dy * dy) <= Math.max(m.r, tolerance);
      });
      if (hit) {
        try { clinicSound.playClick(); } catch {}
        setFound((arr) => [...arr, { markerId: hit.id, x: hit.x, y: hit.y, ts: Date.now() }]);
      } else {
        try { clinicSound.playToggle(); } catch {}
        const ts = Date.now();
        setMisses((arr) => [...arr, { x, y, ts }]);
        setTimeout(() => setMisses((arr) => arr.filter((m) => m.ts !== ts)), 700);
      }
    } else {
      setFound((arr) => [...arr, { markerId: `legacy-${arr.length}`, x, y, ts: Date.now() }]);
    }
  }, [builder, markers, found, tolerance, phase]);

  const onTap = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const point = 'touches' in e ? (e.changedTouches[0] ?? e.touches[0]) : e;
    if (!point) return;
    const x = (point.clientX - rect.left) / rect.width;
    const y = (point.clientY - rect.top) / rect.height;
    handleHit(x, y);
  };

  const requestHint = useCallback(() => {
    if (!hintsEnabled || phase !== 'playing' || !builder) return;
    const remaining = markers.filter((m) => !found.some((f) => f.markerId === m.id));
    if (!remaining.length) return;
    const target = remaining[Math.floor(Math.random() * remaining.length)];
    setRevealedHint(target);
    setHintsUsed((n) => n + 1);
    try { clinicSound.playToggle(); } catch {}
    setTimeout(() => setRevealedHint((h) => (h?.id === target.id ? null : h)), 1400);
  }, [hintsEnabled, phase, builder, markers, found]);

  /* Keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') { e.preventDefault(); requestHint(); }
      if (e.key.toLowerCase() === 'r') { e.preventDefault(); reset(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestHint]);

  const reset = () => {
    setFound([]); setMisses([]); setHintsUsed(0); setRevealedHint(null);
    setSecondsLeft(timeLimit); setPhase('playing');
    startRef.current = Date.now();
  };

  const baseScore = totalNeeded ? Math.min(1, found.length / totalNeeded) : 0;
  const score = Math.max(0, baseScore - hintsUsed * hintPenalty);
  const elapsed = Math.round((Date.now() - startRef.current) / 1000);

  const ringPct = Math.max(0, Math.min(1, secondsLeft / timeLimit));
  const ringStroke = ringPct > 0.5 ? 'hsl(var(--primary))' : ringPct > 0.2 ? 'hsl(38 90% 55%)' : 'hsl(var(--destructive))';

  return (
    <Card className="p-4 sm:p-6 space-y-4 bg-card/60 backdrop-blur border-border/60 relative overflow-hidden" role="region" aria-label={asset.title}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">{asset.title}</h2>
        <div className="flex items-center gap-3">
          {/* Countdown ring */}
          <div className="relative w-12 h-12" aria-hidden>
            <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none" stroke={ringStroke} strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${ringPct * 94.2} 94.2`}
                style={{ transition: reduce ? 'none' : 'stroke-dasharray 1s linear, stroke 0.4s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-mono tabular-nums">
              <Timer className="w-3 h-3 me-0.5 opacity-60" />{secondsLeft}
            </div>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite" aria-atomic="true">
            {t('activities.runner.spotProgress', { found: found.length, total: totalNeeded, defaultValue: '{{found}} / {{total}}' })}
          </span>
        </div>
      </div>

      {/* Boards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {([{ src: imageA, side: 'a' }, { src: imageB, side: 'b' }] as const).map(({ src, side }) => (
          <div
            key={side}
            role="button"
            tabIndex={0}
            aria-label={t('activities.runner.spotBoardAria', { side: side.toUpperCase(), defaultValue: 'Spot the difference — image {{side}}' })}
            onKeyDown={(e) => {
              if (phase !== 'playing') return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleHit(0.5, 0.5);
              }
            }}
            onClick={onTap}
            onTouchEnd={(e) => { e.preventDefault(); onTap(e); }}
            className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-muted cursor-crosshair select-none touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            {src ? (
              <img src={src} alt={`board-${side}`} className="w-full h-full object-contain pointer-events-none" draggable={false} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">—</div>
            )}

            {/* Found marks */}
            <AnimatePresence>
              {found.map((f) => {
                const m = builder?.markers.find((x) => x.id === f.markerId);
                const r = m?.r ?? 0.05;
                return (
                  <motion.div
                    key={f.markerId + side}
                    initial={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                    animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${r * 200}%`, aspectRatio: '1/1' }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-400 bg-emerald-400/15 shadow-[0_0_24px_hsl(150_80%_55%/0.55)] pointer-events-none"
                  />
                );
              })}
              {/* Hint reveal */}
              {revealedHint && (
                <motion.div
                  key={`hint-${revealedHint.id}-${side}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: [0.6, 1.25, 1], opacity: [0, 1, 0.8] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2 }}
                  style={{
                    left: `${revealedHint.x * 100}%`,
                    top: `${revealedHint.y * 100}%`,
                    width: `${revealedHint.r * 260}%`,
                    aspectRatio: '1/1',
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300/80 bg-amber-300/15 shadow-[0_0_30px_hsl(45_95%_65%/0.6)] pointer-events-none"
                />
              )}
              {misses.map((m) => (
                <motion.div
                  key={m.ts + side}
                  initial={{ scale: 0.5, opacity: 0.8 }}
                  animate={{ scale: 1.4, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7 }}
                  style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-destructive pointer-events-none"
                />
              ))}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="w-4 h-4 me-1.5" />{t('activities.runner.reset', { defaultValue: 'Reset' })}
          </Button>
          {hintsEnabled && (
            <Button variant="outline" size="sm" onClick={requestHint} disabled={phase !== 'playing'}>
              <Lightbulb className="w-4 h-4 me-1.5" />
              {t('activities.runner.hint', { defaultValue: 'Hint' })}
              <span className="ms-1.5 text-[10px] opacity-70 tabular-nums">−{Math.round(hintPenalty * 100)}%</span>
            </Button>
          )}
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t(`activities.difficulty.${difficulty}`, { defaultValue: difficulty })}
          </span>
        </div>
        <Button
          disabled={!done && phase !== 'lost'}
          onClick={() => onComplete({
            found, total: totalNeeded, hintsUsed, elapsed,
            outcome: phase === 'lost' ? 'timeout' : 'completed',
          }, score)}
        >
          {t('activities.runner.finish', { defaultValue: 'Finish' })}
        </Button>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {phase === 'won' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-md z-10"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="text-center space-y-3 px-6"
            >
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-300/30 to-amber-500/30 shadow-[0_0_40px_hsl(45_95%_65%/0.5)]">
                <Sparkles className="w-7 h-7 text-amber-400" />
              </div>
              <p className="text-xl font-display">{t('activities.runner.spotWonTitle', { defaultValue: 'Beautifully done' })}</p>
              <p className="text-sm text-muted-foreground">
                {t('activities.runner.spotWonBody', {
                  hints: hintsUsed, elapsed,
                  defaultValue: 'Completed in {{elapsed}}s · {{hints}} hint(s)',
                })}
              </p>
              <Button onClick={() => onComplete({ found, total: totalNeeded, hintsUsed, elapsed, outcome: 'completed' }, score)}>
                {t('activities.runner.finish', { defaultValue: 'Finish' })}
              </Button>
            </motion.div>
          </motion.div>
        )}
        {phase === 'lost' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-md z-10"
          >
            <div className="text-center space-y-3 px-6">
              <p className="text-xl font-display">{t('activities.runner.spotTimeUp', { defaultValue: 'Time’s up' })}</p>
              <p className="text-sm text-muted-foreground">
                {t('activities.runner.spotTimeUpBody', {
                  found: found.length, total: totalNeeded,
                  defaultValue: 'You found {{found}} of {{total}}. Try again when you’re ready.',
                })}
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={reset}>{t('activities.runner.tryAgain', { defaultValue: 'Try again' })}</Button>
                <Button onClick={() => onComplete({ found, total: totalNeeded, hintsUsed, elapsed, outcome: 'timeout' }, score)}>
                  {t('activities.runner.finish', { defaultValue: 'Finish' })}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
