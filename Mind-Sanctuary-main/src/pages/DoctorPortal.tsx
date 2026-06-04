import { useEffect, useState, lazy, Suspense, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, Users, Lock, ArrowLeft, AlertTriangle, Sparkles, LayoutDashboard, Telescope, Search, UserCog } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';
import CrisisQueue from '@/components/doctor/CrisisQueue';
import DoctorAmbientScene from '@/components/doctor/DoctorAmbientScene';
import { Skeleton } from '@/components/ui/skeleton';
const ContentManager = lazy(() => import('@/components/doctor/ContentManager'));
const DoctorDashboard = lazy(() => import('@/components/doctor/DoctorDashboard'));
const ClinicianInsights = lazy(() => import('@/components/doctor/ClinicianInsights'));
const PatientWorkspace = lazy(() => import('@/components/doctor/PatientWorkspace'));
const UserManagement = lazy(() => import('@/components/doctor/UserManagement'));

function PanelSkeleton() {
  return (
    <div className="space-y-3 py-2">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-3/4 rounded-xl" />
    </div>
  );
}

type Severity = 'critical' | 'high' | 'medium' | 'stable';

interface PatientSummary {
  user_id: string;
  nickname: string | null;
  sessions_count: number;
  last_session_at: string | null;
  dominant_emotion: string | null;
}

export default function DoctorPortal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isDoctor, loading: roleLoading, error: roleError } = useUserRole();

  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [tab, setTab] = useState<'dashboard' | 'patients' | 'crisis' | 'content' | 'insights' | 'users'>('dashboard');
  const [query, setQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');

  useEffect(() => {
    if (!isDoctor) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: profiles, error: pErr } = await (supabase as any)
          .from('profiles')
          .select('user_id, nickname')
          .order('created_at', { ascending: false })
          .limit(100);
        if (pErr) throw pErr;

        const { data: sessions } = await (supabase as any)
          .from('sessions')
          .select('user_id, started_at, summary_emotion')
          .order('started_at', { ascending: false })
          .limit(500);

        const map = new Map<string, PatientSummary>();
        (profiles ?? []).forEach((p: any) => {
          map.set(p.user_id, {
            user_id: p.user_id,
            nickname: p.nickname ?? null,
            sessions_count: 0,
            last_session_at: null,
            dominant_emotion: null,
          });
        });
        (sessions ?? []).forEach((s: any) => {
          const row = map.get(s.user_id);
          if (!row) return;
          row.sessions_count += 1;
          if (!row.last_session_at || s.started_at > row.last_session_at) {
            row.last_session_at = s.started_at;
            row.dominant_emotion = s.summary_emotion;
          }
        });
        if (cancelled) return;
        setPatients(
          Array.from(map.values()).sort((a, b) =>
            (b.last_session_at ?? '').localeCompare(a.last_session_at ?? '')
          )
        );
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isDoctor]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground animate-pulse">{t('common.loading')}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 max-w-md text-center space-y-4">
          <Lock className="w-12 h-12 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-semibold">{t('doctor.signInRequired')}</h1>
          <Button onClick={() => navigate('/doctor-login', { replace: true })}>{t('common.back')}</Button>
        </Card>
      </div>
    );
  }

  if (!isDoctor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 max-w-md text-center space-y-4">
          <Lock className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-semibold">{t('doctor.accessDenied')}</h1>
          <p className="text-sm text-muted-foreground">{t('doctor.accessDeniedHint')}</p>
          {roleError && <p className="text-xs text-destructive">{roleError}</p>}
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 me-2" />
            {t('common.back')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground relative">
      <DoctorAmbientScene />
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="border-b border-border/40 bg-card/40 backdrop-blur-xl sticky top-0 z-10 shadow-[0_4px_30px_-12px_hsl(var(--primary)/0.35)]"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <motion.div
              animate={{ boxShadow: ['0 0 0 0 hsl(var(--primary)/0.0)', '0 0 24px 4px hsl(var(--primary)/0.35)', '0 0 0 0 hsl(var(--primary)/0.0)'] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/25 to-accent/20 border border-primary/30 flex items-center justify-center shrink-0"
            >
              <Stethoscope className="w-5 h-5 text-primary" />
            </motion.div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold truncate bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">
                {t('doctor.title')}
              </h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{t('doctor.subtitle')}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="shrink-0">
            <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" />
            <span className="hidden sm:inline">{t('common.back')}</span>
          </Button>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-card/50 backdrop-blur-xl border border-border/50 p-1 rounded-xl shadow-[0_8px_32px_-12px_hsl(var(--primary)/0.25)]">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)] transition-all">
              <LayoutDashboard className="w-4 h-4 me-2" />
              {t('doctor.tab.dashboard', { defaultValue: 'Dashboard' })}
            </TabsTrigger>
            <TabsTrigger value="patients" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)] transition-all">
              <Users className="w-4 h-4 me-2" />
              {t('doctor.patients')}
            </TabsTrigger>
            <TabsTrigger value="crisis" className="data-[state=active]:bg-destructive/15 data-[state=active]:text-destructive data-[state=active]:shadow-[inset_0_0_0_1px_hsl(var(--destructive)/0.35)] transition-all">
              <AlertTriangle className="w-4 h-4 me-2" />
              {t('doctor.crisis.tab')}
            </TabsTrigger>
            <TabsTrigger value="insights" className="data-[state=active]:bg-accent/15 data-[state=active]:text-accent data-[state=active]:shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.35)] transition-all">
              <Telescope className="w-4 h-4 me-2" />
              {t('doctor.tab.insights', { defaultValue: 'Insights' })}
            </TabsTrigger>
            <TabsTrigger value="content" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)] transition-all">
              <Sparkles className="w-4 h-4 me-2" />
              {t('doctor.content.tab')}
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)] transition-all">
              <UserCog className="w-4 h-4 me-2" />
              {t('doctor.tab.users', { defaultValue: 'Users' })}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <Suspense fallback={<PanelSkeleton />}>
              <DoctorDashboard patients={patients} loading={loading} />
            </Suspense>
          </TabsContent>

          <TabsContent value="patients" className="mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('doctor.searchPlaceholder', { defaultValue: 'Search patients by name, id, or emotion…' })}
                className="w-full ps-10 pe-3 py-2.5 rounded-lg bg-card/60 backdrop-blur border border-border/60 text-sm font-ui placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30"
              />
            </div>

            <SeverityChips
              counts={severityCounts(patients)}
              active={severityFilter}
              onChange={setSeverityFilter}
            />

            {loading ? (
              <div className="text-muted-foreground text-sm py-12 text-center">{t('common.loading')}</div>
            ) : error ? (
              <Card className="p-6 text-sm text-destructive">{error}</Card>
            ) : patients.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">{t('doctor.empty')}</Card>
            ) : (
              <PatientList
                patients={patients}
                query={query}
                severityFilter={severityFilter}
                onOpen={(id) => setSelectedPatient(id)}
              />
            )}
          </TabsContent>

          <TabsContent value="crisis" className="mt-4">
            <CrisisQueue
              onSelectPatient={(pid) => {
                setSelectedPatient(pid);
                setTab('patients');
              }}
            />
          </TabsContent>

          <TabsContent value="insights" className="mt-4">
            <Suspense fallback={<PanelSkeleton />}>
              <ClinicianInsights />
            </Suspense>
          </TabsContent>

          <TabsContent value="content" className="mt-4">
            <Suspense fallback={<PanelSkeleton />}>
              <ContentManager />
            </Suspense>
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <Suspense fallback={<PanelSkeleton />}>
              <UserManagement />
            </Suspense>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground text-center pt-4 border-t border-border/50">
          {t('doctor.disclaimer')}
        </p>
      </main>

      <AnimatePresence>
        {selectedPatient && (
          <Suspense fallback={null}>
            <PatientWorkspace
              userId={selectedPatient}
              nickname={patients.find(p => p.user_id === selectedPatient)?.nickname ?? null}
              onClose={() => setSelectedPatient(null)}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}

type PatientLike = {
  user_id: string;
  nickname: string | null;
  sessions_count: number;
  last_session_at: string | null;
  dominant_emotion: string | null;
};

function severityFor(p: PatientLike): 'critical' | 'high' | 'medium' | 'stable' {
  const e = (p.dominant_emotion ?? '').toLowerCase();
  if (['panic', 'despair', 'suicidal', 'grief'].some(k => e.includes(k))) return 'critical';
  if (['anger', 'fear', 'sadness'].some(k => e.includes(k))) return 'high';
  if (p.sessions_count >= 3) return 'medium';
  return 'stable';
}

const SEV_STYLES: Record<ReturnType<typeof severityFor>, { dot: string; pill: string; label: string }> = {
  critical: { dot: 'bg-destructive shadow-[0_0_10px_hsl(var(--destructive)/0.6)]', pill: 'bg-destructive/15 text-destructive border-destructive/30', label: 'Critical' },
  high:     { dot: 'bg-amber-500 shadow-[0_0_8px_hsl(38_90%_55%/0.5)]', pill: 'bg-amber-500/15 text-amber-500 border-amber-500/30', label: 'High' },
  medium:   { dot: 'bg-accent shadow-[0_0_8px_hsl(var(--accent)/0.4)]', pill: 'bg-accent/15 text-accent border-accent/30', label: 'Medium' },
  stable:   { dot: 'bg-emerald-500/80', pill: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30', label: 'Stable' },
};

export function severityCounts(patients: PatientLike[]): Record<Severity, number> {
  const out: Record<Severity, number> = { critical: 0, high: 0, medium: 0, stable: 0 };
  patients.forEach(p => { out[severityFor(p)] += 1; });
  return out;
}

function SeverityChips({ counts, active, onChange }: {
  counts: Record<Severity, number>;
  active: Severity | 'all';
  onChange: (s: Severity | 'all') => void;
}) {
  const total = counts.critical + counts.high + counts.medium + counts.stable;
  const chips: { key: Severity | 'all'; label: string; count: number; cls: string }[] = [
    { key: 'all', label: 'All', count: total, cls: 'border-border/60 bg-card/60 text-foreground' },
    { key: 'critical', label: 'Critical', count: counts.critical, cls: SEV_STYLES.critical.pill },
    { key: 'high', label: 'High risk', count: counts.high, cls: SEV_STYLES.high.pill },
    { key: 'medium', label: 'Moderate', count: counts.medium, cls: SEV_STYLES.medium.pill },
    { key: 'stable', label: 'Stable', count: counts.stable, cls: SEV_STYLES.stable.pill },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(c => (
        <button
          key={c.key}
          onClick={() => onChange(c.key)}
          className={`text-xs font-ui px-3 py-1.5 rounded-full border transition-all
            ${c.cls}
            ${active === c.key ? 'ring-2 ring-offset-1 ring-offset-background ring-accent/50 scale-[1.02]' : 'opacity-80 hover:opacity-100'}`}
        >
          <span className="uppercase tracking-wider">{c.label}</span>
          <span className="ms-2 tabular-nums opacity-80">{c.count}</span>
        </button>
      ))}
    </div>
  );
}

function PatientList({ patients, query, severityFilter, onOpen }: {
  patients: PatientLike[];
  query: string;
  severityFilter: Severity | 'all';
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter(p => {
      if (severityFilter !== 'all' && severityFor(p) !== severityFilter) return false;
      if (!q) return true;
      return (
        (p.nickname ?? '').toLowerCase().includes(q) ||
        p.user_id.toLowerCase().includes(q) ||
        (p.dominant_emotion ?? '').toLowerCase().includes(q)
      );
    });
  }, [patients, query, severityFilter]);

  if (filtered.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">{t('doctor.noMatches', { defaultValue: 'No patients match this search.' })}</Card>;
  }

  return (
    <div className="grid gap-2">
      {filtered.map((p, idx) => {
        const sev = severityFor(p);
        const s = SEV_STYLES[sev];
        return (
          <motion.div
            key={p.user_id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx, 20) * 0.015 }}
          >
            <button onClick={() => onOpen(p.user_id)} className="w-full text-start">
              <Card className="p-4 transition-all hover:bg-accent/10 hover:border-accent/40 border-border/60">
                <div className="flex items-center gap-4">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.nickname || t('common.anonymous')}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate" dir="ltr">{p.user_id.slice(0, 8)}…</p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${s.pill}`}>{s.label}</span>
                  <div className="text-end shrink-0 hidden sm:block">
                    <p className="text-sm tabular-nums">{p.sessions_count} {t('doctor.sessions')}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.last_session_at ? new Date(p.last_session_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  {p.dominant_emotion && (
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary shrink-0 hidden md:inline truncate max-w-[120px]">{p.dominant_emotion}</span>
                  )}
                </div>
              </Card>
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
