import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Play, CheckCircle2, History as HistoryIcon, Repeat } from 'lucide-react';
import type { ActivityAsset, EducationalVideoContent } from '@/lib/activities/types';
import { isVideoPlaylistContent, type VideoPlaylistItem } from '@/lib/activities/builderTypes';
import { useAuth } from '@/context/AuthContext';
import { getProgressForAsset, upsertProgress, type VideoProgressRow } from '@/lib/activities/watchProgress';

interface Props {
  asset: ActivityAsset;
  onComplete: (response: Record<string, unknown>, score?: number) => void;
}

const RESUME_THRESHOLD_SEC = 5;
const COMPLETE_THRESHOLD = 0.92; // 92% counts as complete

export default function EducationalVideo({ asset, onComplete }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();

  /* Normalize playlists */
  const playlists = useMemo(() => {
    if (isVideoPlaylistContent(asset.content)) return asset.content.playlists;
    const legacy = asset.content as EducationalVideoContent;
    if (legacy?.video_url) {
      return [{
        id: 'legacy', name: asset.title,
        items: [{ id: 'legacy', title: asset.title, video_url: legacy.video_url } as VideoPlaylistItem],
      }];
    }
    return [];
  }, [asset]);

  const allItems = useMemo(() => playlists.flatMap((p) => p.items), [playlists]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [autoplay, setAutoplay] = useState(true);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, VideoProgressRow>>({});
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const persistTimer = useRef<number | null>(null);

  const legacyQuestions = (asset.content as EducationalVideoContent)?.questions ?? [];

  /* Hydrate persisted progress — guard against re-runs from user-ref churn */
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!user || hydratedRef.current) return;
    let cancel = false;
    (async () => {
      try {
        const rows = await getProgressForAsset(user.id, asset.id);
        if (cancel) return;
        const map: Record<string, VideoProgressRow> = {};
        const completed = new Set<string>();
        for (const r of rows) {
          map[r.video_item_id] = r;
          if (r.completed) completed.add(r.video_item_id);
        }
        setProgressMap(map);
        setWatched(completed);
        const firstIncomplete = allItems.findIndex((it) => !completed.has(it.id));
        if (firstIncomplete >= 0) setCurrentIdx(firstIncomplete);
        hydratedRef.current = true;
      } catch { /* ignore */ }
    })();
    return () => { cancel = true; };
  }, [user, asset.id, allItems]);

  /* Tags collected for filters */
  const tags = useMemo(() => {
    const s = new Set<string>();
    allItems.forEach((it) => (it.tags ?? []).forEach((tg) => s.add(tg)));
    return Array.from(s);
  }, [allItems]);

  const visibleItems = useMemo(
    () => (tagFilter ? allItems.filter((it) => (it.tags ?? []).includes(tagFilter)) : allItems),
    [allItems, tagFilter]
  );
  const current = allItems[currentIdx];

  /* Resume position when current changes */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !current) return;
    const row = progressMap[current.id];
    const at = row && !row.completed && row.position_sec > RESUME_THRESHOLD_SEC ? row.position_sec : 0;
    const apply = () => { try { v.currentTime = at; } catch {} };
    if (v.readyState >= 1) apply();
    else v.addEventListener('loadedmetadata', apply, { once: true });
  }, [currentIdx, current, progressMap]);

  /* Debounced persistence */
  const queuePersist = (pos: number, dur: number | null, completed = false) => {
    if (!user || !current) return;
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      upsertProgress({
        user_id: user.id, asset_id: asset.id, video_item_id: current.id,
        position_sec: Math.round(pos), duration_sec: dur ?? undefined, completed,
      }).catch(() => {});
      setProgressMap((m) => ({
        ...m,
        [current.id]: {
          ...(m[current.id] ?? { id: '', user_id: user.id, asset_id: asset.id, video_item_id: current.id }),
          position_sec: Math.round(pos), duration_sec: dur, completed,
          updated_at: new Date().toISOString(),
        } as VideoProgressRow,
      }));
    }, 1200);
  };

  const onTimeUpdate = () => {
    const v = videoRef.current; if (!v || !current) return;
    const dur = isFinite(v.duration) ? v.duration : null;
    queuePersist(v.currentTime, dur, false);
  };
  const onEnded = () => {
    const v = videoRef.current; if (!v || !current) return;
    const dur = isFinite(v.duration) ? v.duration : null;
    setWatched((s) => new Set(s).add(current.id));
    queuePersist(dur ?? v.currentTime, dur, true);
    if (autoplay && currentIdx < allItems.length - 1) {
      setTimeout(() => setCurrentIdx((i) => Math.min(i + 1, allItems.length - 1)), 600);
    }
  };
  const onProgressEnoughComplete = () => {
    const v = videoRef.current; if (!v || !current || !v.duration) return;
    if (v.currentTime / v.duration >= COMPLETE_THRESHOLD && !watched.has(current.id)) {
      setWatched((s) => new Set(s).add(current.id));
      queuePersist(v.currentTime, v.duration, true);
    }
  };

  const allWatched = allItems.length > 0 && allItems.every((it) => watched.has(it.id));

  const recommendations = useMemo(() => {
    if (!current) return [];
    const goal = current.emotional_goal;
    const sameTags = (current.tags ?? []).filter(Boolean);
    return allItems
      .filter((it) => it.id !== current.id && !watched.has(it.id))
      .map((it) => ({
        it,
        score:
          (it.emotional_goal && it.emotional_goal === goal ? 2 : 0) +
          (it.tags ?? []).filter((tg) => sameTags.includes(tg)).length,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.it);
  }, [current, allItems, watched]);

  /* Continue-watching list (within this asset) */
  const continueList = useMemo(() => {
    return allItems
      .filter((it) => !watched.has(it.id) && (progressMap[it.id]?.position_sec ?? 0) > RESUME_THRESHOLD_SEC)
      .slice(0, 4);
  }, [allItems, watched, progressMap]);

  if (allItems.length === 0) {
    return <Card className="p-6 text-sm text-muted-foreground">{t('activities.runner.noVideo', { defaultValue: 'No video available.' })}</Card>;
  }

  const currentRow = current ? progressMap[current.id] : null;
  const currentPct = currentRow?.duration_sec
    ? Math.min(1, currentRow.position_sec / currentRow.duration_sec)
    : 0;

  return (
    <div className="grid md:grid-cols-[1fr_300px] gap-4" role="region" aria-label={asset.title}>
      <Card className="p-4 space-y-3 bg-card/60 backdrop-blur border-border/60">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate">{current?.title ?? asset.title}</h2>
            {current?.emotional_goal && (
              <p className="text-[11px] uppercase tracking-wider text-accent/80 mt-0.5">{current.emotional_goal}</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <Repeat className="w-3.5 h-3.5" />
            <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} className="accent-primary" />
            {t('activities.runner.autoplay', { defaultValue: 'Autoplay next' })}
          </label>
        </div>

        {current && (
          <div className="relative">
            <video
              ref={videoRef}
              key={current.id}
              src={current.video_url}
              poster={current.thumbnail_url}
              controls
              preload="metadata"
              playsInline
              autoPlay={autoplay}
              onTimeUpdate={onTimeUpdate}
              onEnded={onEnded}
              onPause={onProgressEnoughComplete}
              className="w-full rounded-lg bg-black aspect-video"
              aria-label={current.title || asset.title}
            />
            {currentPct > 0 && currentPct < 1 && (
              <div className="absolute bottom-1 inset-x-1 h-0.5 bg-white/10 rounded overflow-hidden">
                <div className="h-full bg-primary/80" style={{ width: `${currentPct * 100}%` }} />
              </div>
            )}
          </div>
        )}
        {current?.description && <p className="text-sm text-muted-foreground">{current.description}</p>}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTagFilter(null)}
              className={`text-[11px] px-2 py-0.5 rounded-full border ${!tagFilter ? 'bg-primary/15 text-primary border-primary/30' : 'border-border/40 text-muted-foreground hover:bg-muted/60'}`}
            >{t('common.all', { defaultValue: 'All' })}</button>
            {tags.map((tg) => (
              <button
                key={tg}
                onClick={() => setTagFilter((f) => (f === tg ? null : tg))}
                className={`text-[11px] px-2 py-0.5 rounded-full border ${tagFilter === tg ? 'bg-primary/15 text-primary border-primary/30' : 'border-border/40 text-muted-foreground hover:bg-muted/60'}`}
              >#{tg}</button>
            ))}
          </div>
        )}

        {legacyQuestions.map((q) => (
          <div key={q.id} className="space-y-1.5">
            <label className="text-sm font-medium">{q.question}</label>
            <Textarea rows={2} value={answers[q.id] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value.slice(0, 2000) }))} />
          </div>
        ))}

        {recommendations.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {t('activities.runner.related', { defaultValue: 'Related' })}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {recommendations.map((it) => {
                const idx = allItems.findIndex((x) => x.id === it.id);
                return (
                  <button key={it.id} onClick={() => setCurrentIdx(idx)}
                    className="group text-start rounded-lg overflow-hidden border border-border/40 hover:border-primary/40 transition-all">
                    <div className="aspect-video bg-muted relative">
                      {it.thumbnail_url ? (
                        <img src={it.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Play className="w-5 h-5 opacity-50" /></div>
                      )}
                    </div>
                    <p className="text-[11px] px-2 py-1 truncate">{it.title}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
            {allWatched ? t('activities.runner.watched', { defaultValue: 'All watched.' }) : t('activities.runner.pleaseWatch', { defaultValue: 'Please watch to continue.' })}
          </p>
          <Button disabled={!allWatched} onClick={() => onComplete({ watched: Array.from(watched), answers, total: allItems.length })}>
            {t('activities.runner.finish', { defaultValue: 'Finish' })}
          </Button>
        </div>
      </Card>

      {/* Sidebar */}
      <Card className="p-3 space-y-3 bg-card/60 backdrop-blur border-border/60 max-h-[78vh] overflow-y-auto">
        {continueList.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 flex items-center gap-1">
              <HistoryIcon className="w-3 h-3" />{t('activities.runner.continueWatching', { defaultValue: 'Continue watching' })}
            </h3>
            {continueList.map((it) => {
              const idx = allItems.findIndex((x) => x.id === it.id);
              const r = progressMap[it.id];
              const pct = r?.duration_sec ? Math.min(1, r.position_sec / r.duration_sec) : 0;
              return (
                <button key={it.id} onClick={() => setCurrentIdx(idx)}
                  className="w-full text-start px-2 py-1.5 rounded-lg hover:bg-muted/60 group">
                  <p className="text-xs truncate">{it.title}</p>
                  <div className="h-1 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-accent" style={{ width: `${pct * 100}%` }} />
                  </div>
                </button>
              );
            })}
            <div className="border-t border-border/40 my-1" />
          </div>
        )}

        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground px-2">
          {t('activities.runner.playlist', { defaultValue: 'Playlist' })}
        </h3>
        <AnimatePresence initial={false}>
          {visibleItems.map((it) => {
            const i = allItems.findIndex((x) => x.id === it.id);
            const active = i === currentIdx;
            const done = watched.has(it.id);
            const r = progressMap[it.id];
            const pct = r?.duration_sec ? Math.min(1, r.position_sec / r.duration_sec) : 0;
            return (
              <motion.button
                key={it.id} layout
                initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
                onClick={() => setCurrentIdx(i)}
                className={`w-full text-start px-2.5 py-2 rounded-lg text-sm flex items-center gap-2 transition-all ${
                  active ? 'bg-primary/15 text-primary border border-primary/30' : 'hover:bg-muted/60 border border-transparent'
                }`}
              >
                {it.thumbnail_url ? (
                  <img src={it.thumbnail_url} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                ) : (
                  <Play className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate">{it.title}</p>
                  {pct > 0 && pct < 1 && (
                    <div className="h-0.5 mt-1 rounded bg-muted overflow-hidden">
                      <div className="h-full bg-primary/70" style={{ width: `${pct * 100}%` }} />
                    </div>
                  )}
                </div>
                {done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </Card>
    </div>
  );
}
