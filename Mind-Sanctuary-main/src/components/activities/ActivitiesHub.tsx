import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Image as ImageIcon, Video, Eye, Sparkles, Clock, Gauge, Heart, ArrowRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { listPublishedAssets } from '@/lib/activities/assets';
import { startActivitySession, completeActivitySession } from '@/lib/activities/sessions';
import { trackProductEvent } from '@/lib/observability/productTelemetry';
import type { ActivityAsset, ActivityKind } from '@/lib/activities/types';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { EmptyState } from '@/components/ui/EmptyState';

import { useToast } from '@/hooks/use-toast';
import CompletionBurst from '@/components/ui/CompletionBurst';

// Code-split heavy activity runners — each loads only when launched.
const CBTFlow = lazy(() => import('./runners/CBTFlow'));
const ImageInterpretation = lazy(() => import('./runners/ImageInterpretation'));
const EducationalVideo = lazy(() => import('./runners/EducationalVideo'));
const SpotDifference = lazy(() => import('./runners/SpotDifference'));

const KIND_ICON: Record<ActivityKind, React.ReactNode> = {
  cbt_flow: <Brain className="w-4 h-4" />,
  image_interpretation: <ImageIcon className="w-4 h-4" />,
  educational_video: <Video className="w-4 h-4" />,
  spot_difference: <Eye className="w-4 h-4" />,
};

/**
 * Per-kind cinematic identity. All colors use semantic-friendly hsl ramps
 * that work in both light + dark themes.
 */
const KIND_THEME: Record<ActivityKind, {
  gradient: string;
  glow: string;
  border: string;
  text: string;
  badge: string;
  duration: string;
  energy: 'Calm' | 'Reflective' | 'Playful' | 'Immersive';
  goal: string;
}> = {
  cbt_flow: {
    gradient: 'from-indigo-500/20 via-violet-500/10 to-transparent',
    glow: 'shadow-[0_0_60px_-12px_hsl(250_80%_60%/0.45)]',
    border: 'border-indigo-400/30 hover:border-indigo-400/60',
    text: 'text-indigo-300',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-400/30',
    duration: '8–12 min',
    energy: 'Reflective',
    goal: 'Reframe thoughts',
  },
  image_interpretation: {
    gradient: 'from-fuchsia-500/20 via-rose-500/10 to-transparent',
    glow: 'shadow-[0_0_60px_-12px_hsl(320_80%_60%/0.45)]',
    border: 'border-fuchsia-400/30 hover:border-fuchsia-400/60',
    text: 'text-fuchsia-300',
    badge: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/30',
    duration: '4–6 min',
    energy: 'Immersive',
    goal: 'Open expression',
  },
  educational_video: {
    gradient: 'from-amber-400/20 via-orange-400/10 to-transparent',
    glow: 'shadow-[0_0_60px_-12px_hsl(38_90%_60%/0.45)]',
    border: 'border-amber-400/30 hover:border-amber-400/60',
    text: 'text-amber-300',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    duration: '5–10 min',
    energy: 'Calm',
    goal: 'Build insight',
  },
  spot_difference: {
    gradient: 'from-emerald-400/20 via-teal-400/10 to-transparent',
    glow: 'shadow-[0_0_60px_-12px_hsl(160_70%_55%/0.45)]',
    border: 'border-emerald-400/30 hover:border-emerald-400/60',
    text: 'text-emerald-300',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    duration: '3–5 min',
    energy: 'Playful',
    goal: 'Refocus attention',
  },
};


export default function ActivitiesHub() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [assets, setAssets] = useState<ActivityAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<{ asset: ActivityAsset; sessionId: string } | null>(null);
  const [filter, setFilter] = useState<ActivityKind | 'all'>('all');
  const [celebration, setCelebration] = useState<{ title: string; subtitle?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listPublishedAssets();
        if (!cancelled) setAssets(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(
    () => (filter === 'all' ? assets : assets.filter((a) => a.kind === filter)),
    [assets, filter]
  );

  const totalByKind = useMemo(() => {
    const counts: Record<string, number> = { all: assets.length };
    assets.forEach((a) => { counts[a.kind] = (counts[a.kind] ?? 0) + 1; });
    return counts;
  }, [assets]);

  const start = async (asset: ActivityAsset) => {
    if (!user) return;
    try {
      const s = await startActivitySession({ user_id: user.id, asset_id: asset.id, kind: asset.kind });
      trackProductEvent('activity.start', { kind: asset.kind });
      setActive({ asset, sessionId: s.id });
    } catch (e) {
      toast({ title: t('common.somethingWrong'), description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const finish = async (response: Record<string, unknown>, score?: number) => {
    if (!active) return;
    const kindLabel = t(`activities.kind.${active.asset.kind}`);
    try {
      await completeActivitySession({ id: active.sessionId, response, score: score ?? null });
      trackProductEvent('activity.complete', { kind: active.asset.kind });
      setCelebration({
        title: t('activities.completedToast'),
        subtitle: typeof score === 'number' ? `${kindLabel} · ${Math.round(score * 100) / 100}` : kindLabel,
      });
      setActive(null);
    } catch (e) {
      toast({ title: t('common.somethingWrong'), description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  if (active) {
    const a = active.asset;
    const Runner =
      a.kind === 'cbt_flow' ? CBTFlow :
      a.kind === 'image_interpretation' ? ImageInterpretation :
      a.kind === 'educational_video' ? EducationalVideo :
      SpotDifference;
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
          {t('common.back')}
        </Button>
        <ErrorBoundary label={`activity:${a.kind}`}>
          <Suspense fallback={<Card className="p-12 text-center text-muted-foreground text-sm">{t('common.loading')}</Card>}>
            <Runner asset={a} onComplete={finish} />
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <CompletionBurst
        open={!!celebration}
        title={celebration?.title ?? ''}
        subtitle={celebration?.subtitle}
        onDone={() => setCelebration(null)}
      />
      {/* Cinematic hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-primary/10 via-accent/[0.06] to-transparent p-6 sm:p-8"
      >
        <div aria-hidden className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-accent/20 blur-3xl opacity-60" />
        <div aria-hidden className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-primary/15 blur-3xl opacity-50" />
        <div className="relative flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl border border-accent/40 bg-gradient-to-br from-accent/20 to-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-display tracking-wide">{t('activities.title')}</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
              {t('activities.subtitle')}
            </p>
          </div>
        </div>
      </motion.section>

      {/* Filter rail */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'cbt_flow', 'image_interpretation', 'educational_video', 'spot_difference'] as const).map((k) => {
          const active = filter === k;
          const theme = k === 'all' ? null : KIND_THEME[k];
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`group inline-flex items-center gap-2 text-xs font-ui uppercase tracking-wider px-3.5 py-2 rounded-full border transition-all
                ${active
                  ? theme
                    ? `${theme.badge} ring-2 ring-offset-1 ring-offset-background ring-current/30 scale-[1.03]`
                    : 'bg-accent/15 text-accent border-accent/40 ring-2 ring-offset-1 ring-offset-background ring-accent/30 scale-[1.03]'
                  : 'bg-card/40 border-border/50 text-muted-foreground hover:text-foreground hover:border-border'}`}
            >
              {k !== 'all' && <span className={theme?.text}>{KIND_ICON[k]}</span>}
              <span>{t(`activities.kind.${k}`)}</span>
              <span className="tabular-nums opacity-70">{totalByKind[k] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-9 w-full mt-2" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{error}</Card>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          tone="calm"
          title={t('activities.empty')}
          description={t('activities.emptyHint', { defaultValue: 'New experiences arrive as your clinician curates them. Check back soon — every activity is shaped around how you feel.' })}
          hint={t('activities.emptyTag', { defaultValue: 'Curated · Personal · Gentle' })}
        />

      ) : (
        <AnimatePresence mode="popLayout">
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
          >
            {visible.map((a, idx) => {
              const theme = KIND_THEME[a.kind];
              return (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ delay: Math.min(idx, 12) * 0.05, duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
                  whileHover={{ y: -4 }}
                  className="group relative"
                >
                  <Card
                    className={`relative overflow-hidden h-full p-5 flex flex-col gap-4 backdrop-blur-xl
                      bg-card/40 border ${theme.border}
                      transition-all duration-500
                      group-hover:${theme.glow}`}
                  >
                    {/* gradient wash */}
                    <div
                      aria-hidden
                      className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-60 group-hover:opacity-100 transition-opacity duration-500`}
                    />
                    {/* glow sweep */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -inset-x-10 -top-10 h-24 rotate-6 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    />

                    <div className="relative flex items-center justify-between">
                      <div className={`inline-flex items-center gap-2 text-[11px] font-ui uppercase tracking-[0.18em] ${theme.text}`}>
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-current/30 bg-current/10">
                          {KIND_ICON[a.kind]}
                        </span>
                        {t(`activities.kind.${a.kind}`)}
                      </div>
                      <span className={`text-[10px] font-ui uppercase tracking-wider px-2 py-0.5 rounded-full border ${theme.badge}`}>
                        {theme.energy}
                      </span>
                    </div>

                    <div className="relative space-y-1.5">
                      <h3 className="font-display text-base leading-snug tracking-wide">{a.title}</h3>
                      {a.description && (
                        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{a.description}</p>
                      )}
                    </div>

                    <div className="relative flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground font-ui">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> {theme.duration}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Gauge className="w-3 h-3" /> {theme.energy}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Heart className="w-3 h-3" /> {theme.goal}
                      </span>
                    </div>

                    <div className="relative flex-1" />

                    <Button
                      onClick={() => start(a)}
                      size="sm"
                      className="relative group/btn justify-between bg-foreground/90 text-background hover:bg-foreground"
                    >
                      <span>{t('activities.start')}</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5 rtl:rotate-180 rtl:group-hover/btn:-translate-x-0.5" />
                    </Button>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

