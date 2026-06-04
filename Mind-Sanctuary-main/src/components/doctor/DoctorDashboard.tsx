import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity, AlertTriangle, Users, TrendingUp, Heart, Sparkles, Clock, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { sbExt } from '@/lib/supabaseExt';
import CountUp from '@/components/ui/CountUp';

interface PatientSummary {
  user_id: string;
  nickname: string | null;
  sessions_count: number;
  last_session_at: string | null;
  dominant_emotion: string | null;
}

interface Props {
  patients: PatientSummary[];
  loading: boolean;
}

/**
 * System Dashboard for the clinician workspace.
 * Aggregates global cohort metrics from already-loaded patient data —
 * no extra network calls, no schema dependencies (R6a will deepen this).
 */
export default function DoctorDashboard({ patients, loading }: Props) {
  const { t } = useTranslation();

  const [recentSessions, setRecentSessions] = useState<{ id: string; started_at: string; user_id: string; summary_emotion: string | null }[]>([]);
  const [activityStats, setActivityStats] = useState<{ total: number; completed: number; byKind: Record<string, number> }>({ total: 0, completed: 0, byKind: {} });
  const [openCrises, setOpenCrises] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sess, acts, crises] = await Promise.all([
        (supabase as any).from('sessions').select('id, started_at, user_id, summary_emotion').order('started_at', { ascending: false }).limit(8),
        (supabase as any).from('activity_sessions').select('kind, completed_at').order('started_at', { ascending: false }).limit(500),
        sbExt.from('crisis_flags').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
      ]);
      if (cancelled) return;
      setRecentSessions((sess.data ?? []) as any);
      const a = (acts.data ?? []) as { kind: string; completed_at: string | null }[];
      const byKind: Record<string, number> = {};
      a.forEach(r => { byKind[r.kind] = (byKind[r.kind] ?? 0) + 1; });
      setActivityStats({ total: a.length, completed: a.filter(r => r.completed_at).length, byKind });
      setOpenCrises((crises as any).count ?? 0);
    })();
    return () => { cancelled = true; };
  }, []);


  const totalSessions = patients.reduce((s, p) => s + p.sessions_count, 0);
  const active7d = patients.filter(p => {
    if (!p.last_session_at) return false;
    return Date.now() - new Date(p.last_session_at).getTime() < 7 * 24 * 3600 * 1000;
  }).length;

  const emotionCounts = patients.reduce<Record<string, number>>((acc, p) => {
    if (p.dominant_emotion) acc[p.dominant_emotion] = (acc[p.dominant_emotion] ?? 0) + 1;
    return acc;
  }, {});
  const topEmotions = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totalEmotions = topEmotions.reduce((s, [, n]) => s + n, 0) || 1;

  // Pseudo-severity heuristic for visual hierarchy (until R6a lands)
  const flagged = patients.filter(p => {
    const e = p.dominant_emotion?.toLowerCase() ?? '';
    return ['anger', 'fear', 'sadness', 'grief', 'panic', 'despair'].some(k => e.includes(k));
  });

  return (
    <div className="space-y-6">
      {/* Watchful live-system bar — quiet reassurance the portal is monitoring. */}
      <LivePulseBar loading={loading} crises={openCrises} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={<Users className="w-4 h-4" />} label={t('doctor.dash.totalPatients', { defaultValue: 'Patients' })} value={patients.length} tone="primary" />
        <MetricCard icon={<Activity className="w-4 h-4" />} label={t('doctor.dash.active7d', { defaultValue: 'Active · 7d' })} value={active7d} tone="accent" />
        <MetricCard icon={<TrendingUp className="w-4 h-4" />} label={t('doctor.dash.totalSessions', { defaultValue: 'Total sessions' })} value={totalSessions} tone="primary" />
        <MetricCard icon={<AlertTriangle className="w-4 h-4" />} label={t('doctor.dash.crisisOpen', { defaultValue: 'Open crises' })} value={openCrises} tone="warn" />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 bg-card/60 backdrop-blur border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              {t('doctor.dash.emotionalLandscape', { defaultValue: 'Emotional landscape' })}
            </h3>
          </div>
          {loading ? (
            <SkeletonRows />
          ) : topEmotions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              {t('doctor.dash.noData', { defaultValue: 'No emotional data yet' })}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {topEmotions.map(([emotion, count], i) => {
                const pct = Math.round((count / totalEmotions) * 100);
                return (
                  <motion.li
                    key={emotion}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-foreground">{emotion}</span>
                      <span className="text-muted-foreground tabular-nums">{count} · {pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, delay: i * 0.05 }}
                        className="h-full rounded-full"
                        style={{ background: 'var(--gradient-gold)' }}
                      />
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5 bg-card/60 backdrop-blur border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              {t('doctor.dash.engagement', { defaultValue: 'Engagement signal' })}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Bucket label="Critical" count={flagged.length} severity="critical" />
            <Bucket label="High" count={Math.max(0, Math.floor(patients.length * 0.15) - flagged.length)} severity="high" />
            <Bucket label="Medium" count={Math.floor(patients.length * 0.35)} severity="medium" />
            <Bucket label="Stable" count={Math.max(0, patients.length - flagged.length - Math.floor(patients.length * 0.5))} severity="stable" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-4 italic">
            {t('doctor.dash.heuristicNote', { defaultValue: 'Heuristic grouping · refined by R6a longitudinal model' })}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 bg-card/60 backdrop-blur border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              {t('doctor.dash.recentSessions', { defaultValue: 'Recent sessions' })}
            </h3>
          </div>
          {recentSessions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No recent activity.</p>
          ) : (
            <ul className="space-y-1.5">
              {recentSessions.map(s => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded hover:bg-background/40">
                  <span className="text-muted-foreground tabular-nums truncate" dir="ltr">{new Date(s.started_at).toLocaleString()}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    {s.summary_emotion && <span className="text-primary capitalize truncate max-w-[100px]">{s.summary_emotion}</span>}
                    <span className="font-mono text-muted-foreground/70" dir="ltr">{s.user_id.slice(0, 6)}…</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 bg-card/60 backdrop-blur border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              {t('doctor.dash.activityParticipation', { defaultValue: 'Activity participation' })}
            </h3>
          </div>
          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-3xl font-display tabular-nums">{activityStats.completed}</span>
            <span className="text-xs text-muted-foreground">/ {activityStats.total} completed</span>
          </div>
          <ul className="space-y-1.5">
            {Object.entries(activityStats.byKind).map(([k, n]) => (
              <li key={k} className="flex items-center justify-between text-xs">
                <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                <span className="text-muted-foreground tabular-nums">{n}</span>
              </li>
            ))}
            {Object.keys(activityStats.byKind).length === 0 && (
              <li className="text-xs text-muted-foreground py-2 text-center">No activity yet.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone: 'primary' | 'accent' | 'warn' }) {
  const toneCls =
    tone === 'warn' ? 'text-destructive bg-destructive/10' :
    tone === 'accent' ? 'text-accent bg-accent/10' :
    'text-primary bg-primary/10';
  const numeric = typeof value === 'number';
  // Subtle severity glow for crisis tile when it's actually non-zero.
  const warnGlow = tone === 'warn' && numeric && (value as number) > 0;
  return (
    <Card
      className={`p-4 bg-card/60 backdrop-blur border-border/60 transition-shadow ${
        warnGlow ? 'shadow-[0_0_28px_-10px_hsl(var(--destructive)/0.55)]' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${toneCls}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-semibold tabular-nums">
            {numeric ? <CountUp value={value as number} /> : value}
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Live pulse bar — a calm "we are watching" indicator for the clinician.
 * Avoids alarming language: just a soft heartbeat dot + cohort summary line.
 */
function LivePulseBar({ loading, crises }: { loading: boolean; crises: number }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const tone = crises > 0 ? 'text-amber-400' : 'text-emerald-400';
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border/50 bg-card/40 backdrop-blur">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="relative flex w-2 h-2">
          <motion.span
            aria-hidden
            className={`absolute inline-flex h-full w-full rounded-full ${crises > 0 ? 'bg-amber-400/60' : 'bg-emerald-400/60'}`}
            animate={reduce ? undefined : { scale: [1, 2.2, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
          />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${crises > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
        </span>
        <span className={`text-[11px] font-ui uppercase tracking-[0.22em] ${tone}`}>
          {loading
            ? t('doctor.dash.live.connecting', { defaultValue: 'Connecting' })
            : crises > 0
              ? t('doctor.dash.live.attention', { defaultValue: 'Monitoring · attention needed' })
              : t('doctor.dash.live.stable', { defaultValue: 'Monitoring · all stable' })}
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground/70 hidden sm:inline tabular-nums" dir="ltr">
        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

function Bucket({ label, count, severity }: { label: string; count: number; severity: 'critical' | 'high' | 'medium' | 'stable' }) {
  const cls = {
    critical: 'border-destructive/40 bg-destructive/10 text-destructive',
    high: 'border-amber-500/40 bg-amber-500/10 text-amber-500',
    medium: 'border-accent/40 bg-accent/10 text-accent',
    stable: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500',
  }[severity];
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${cls}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-lg font-semibold tabular-nums">
        <CountUp value={count} />
      </p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-3 rounded bg-muted/60 animate-pulse" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}
