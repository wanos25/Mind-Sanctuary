import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, MessageSquare, Sparkles, TrendingUp,
  Search, X, Calendar, Brain, Heart,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { sbExt } from '@/lib/supabaseExt';
import ReviewActions from './ReviewActions';
import ReviewTimeline from './ReviewTimeline';
import AIAssistPanel from './AIAssistPanel';

interface Props {
  userId: string;
  nickname: string | null;
  onClose: () => void;
}

interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  summary_emotion: string | null;
  summary_intensity: number | null;
}
interface MsgRow {
  id: string;
  role: string;
  content: string;
  created_at: string;
  mood: string | null;
  session_id: string;
  chat_id: string | null;
}
interface ActivityRow {
  id: string;
  kind: string;
  started_at: string;
  completed_at: string | null;
  score: number | null;
}
interface CrisisRow {
  id: string;
  severity: string;
  status: string;
  reason: string | null;
  created_at: string;
}
interface InsightRow {
  id: string;
  title: string;
  description: string;
  kind: string;
  created_at: string;
}

/**
 * Full clinician workspace for a single patient.
 * Tabs: Overview · Transcript · Sessions · Activities · Crisis · Insights
 * All queries are RLS-scoped (doctor/admin role required).
 */
export default function PatientWorkspace({ userId, nickname, onClose }: Props) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [crises, setCrises] = useState<CrisisRow[]>([]);
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'transcript' | 'sessions' | 'activities' | 'crisis' | 'insights' | 'review'>('overview');
  const [refreshKey, setRefreshKey] = useState(0);
  const [transcriptQuery, setTranscriptQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [s, m, a, c, i] = await Promise.all([
        (supabase as any).from('sessions').select('id, started_at, ended_at, summary_emotion, summary_intensity').eq('user_id', userId).order('started_at', { ascending: false }).limit(200),
        (supabase as any).from('chat_messages').select('id, role, content, created_at, session_id').eq('user_id', userId).order('created_at', { ascending: true }).limit(2000),
        (supabase as any).from('activity_sessions').select('id, kind, started_at, completed_at, score').eq('user_id', userId).order('started_at', { ascending: false }).limit(100),
        sbExt.from('crisis_flags').select('id, severity, status, reason, created_at').eq('patient_id', userId).order('created_at', { ascending: false }),
        (supabase as any).from('ai_insight_summaries').select('id, content, created_at, period_start, period_end').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      ]);
      if (cancelled) return;
      setSessions((s.data ?? []) as SessionRow[]);
      setMessages((m.data ?? []) as MsgRow[]);
      setActivities((a.data ?? []) as ActivityRow[]);
      setCrises(((c.data ?? []) as any[]).map(r => ({
        id: r.id, severity: r.severity, status: r.status, reason: r.reason, created_at: r.created_at,
      })));
      // Map ai_insight_summaries -> InsightRow shape
      const aiRows = (i.data ?? []) as any[];
      setInsights(aiRows.map(r => ({
        id: r.id,
        title: (r.content?.title as string) ?? `Summary · ${new Date(r.period_start).toLocaleDateString()}`,
        description: (r.content?.summary as string) ?? (r.content?.body as string) ?? '—',
        kind: 'ai_summary',
        created_at: r.created_at,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  const trend = useMemo(() => sessions.slice().reverse().map(s => ({
    t: s.started_at,
    emotion: s.summary_emotion,
    intensity: s.summary_intensity ?? 0,
  })), [sessions]);

  const filteredMessages = useMemo(() => {
    const q = transcriptQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(m => m.content.toLowerCase().includes(q));
  }, [messages, transcriptQuery]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-background/90 backdrop-blur-xl overflow-y-auto"
    >
      <div className="max-w-6xl mx-auto p-3 sm:p-6 lg:p-8">
        <div className="flex items-start justify-between mb-4 sm:mb-6 gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Patient workspace</p>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-display tracking-tight break-words">{nickname || 'Anonymous'}</h2>
            <p className="text-[11px] sm:text-xs font-mono text-muted-foreground mt-1 break-all" dir="ltr">{userId}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close" className="shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-card/60 backdrop-blur p-1 mb-4">
            <TabsTrigger value="overview"><Heart className="w-3.5 h-3.5 me-1.5" />Overview</TabsTrigger>
            <TabsTrigger value="transcript"><MessageSquare className="w-3.5 h-3.5 me-1.5" />Transcript</TabsTrigger>
            <TabsTrigger value="sessions"><Calendar className="w-3.5 h-3.5 me-1.5" />Sessions</TabsTrigger>
            <TabsTrigger value="activities"><Activity className="w-3.5 h-3.5 me-1.5" />Activities</TabsTrigger>
            <TabsTrigger value="crisis"><AlertTriangle className="w-3.5 h-3.5 me-1.5" />Crisis</TabsTrigger>
            <TabsTrigger value="insights"><Brain className="w-3.5 h-3.5 me-1.5" />AI Insights</TabsTrigger>
            <TabsTrigger value="review"><Sparkles className="w-3.5 h-3.5 me-1.5" />Review</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat icon={<Calendar className="w-4 h-4" />} label="Sessions" value={sessions.length} />
              <Stat icon={<MessageSquare className="w-4 h-4" />} label="Messages" value={messages.length} />
              <Stat icon={<Activity className="w-4 h-4" />} label="Activities" value={activities.length} />
              <Stat icon={<AlertTriangle className="w-4 h-4" />} label="Crisis events" value={crises.length} tone={crises.length ? 'warn' : undefined} />
            </div>
            <Card className="p-5 bg-card/60 backdrop-blur border-border/60">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" /> Emotional trend
              </h4>
              {loading ? <SkeletonRows /> : trend.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No session data yet.</p>
              ) : (
                <TrendChart trend={trend} />
              )}
            </Card>
            <AIAssistPanel kind="cbt_flow" trendContext={{ patientId: userId, nickname }} />
          </TabsContent>

          <TabsContent value="transcript">
            <Card className="p-3 bg-card/60 backdrop-blur border-border/60">
              <div className="relative mb-3">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={transcriptQuery}
                  onChange={(e) => setTranscriptQuery(e.target.value)}
                  placeholder="Search transcript…"
                  className="w-full ps-10 pe-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:border-accent/60"
                />
              </div>
              <div className="max-h-[60vh] overflow-y-auto space-y-2 pe-1">
                {loading ? <SkeletonRows /> : filteredMessages.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">No messages.</p>
                ) : filteredMessages.map(m => (
                  <div key={m.id} className={`rounded-lg p-3 text-sm border ${m.role === 'user' ? 'bg-primary/5 border-primary/15' : 'bg-accent/5 border-accent/15'}`}>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {m.role} {m.mood ? `· ${m.mood}` : ''}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="sessions">
            <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
              {loading ? <SkeletonRows /> : sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No sessions yet.</p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {sessions.map(s => (
                    <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <p className="text-foreground">{new Date(s.started_at).toLocaleString()}</p>
                        {s.ended_at && <p className="text-xs text-muted-foreground">Ended {new Date(s.ended_at).toLocaleTimeString()}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {s.summary_emotion && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{s.summary_emotion}</span>}
                        {s.summary_intensity != null && <span className="text-xs text-muted-foreground tabular-nums">{Math.round(s.summary_intensity * 100)}%</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="activities">
            <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
              {loading ? <SkeletonRows /> : activities.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No activities completed.</p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {activities.map(a => (
                    <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <p className="text-foreground capitalize">{a.kind.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">{new Date(a.started_at).toLocaleString()}</p>
                      </div>
                      <div className="text-end">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${a.completed_at ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500' : 'border-amber-500/40 bg-amber-500/10 text-amber-500'}`}>
                          {a.completed_at ? 'Completed' : 'In progress'}
                        </span>
                        {a.score != null && <p className="text-xs text-muted-foreground tabular-nums mt-1">Score {a.score}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="crisis">
            <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
              {loading ? <SkeletonRows /> : crises.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No crisis events. </p>
              ) : (
                <ul className="space-y-2">
                  {crises.map(c => {
                    const cls = c.severity === 'critical' ? 'border-destructive/40 bg-destructive/10 text-destructive' :
                      c.severity === 'high' ? 'border-amber-500/40 bg-amber-500/10 text-amber-500' :
                      c.severity === 'medium' ? 'border-accent/40 bg-accent/10 text-accent' :
                      'border-emerald-500/30 bg-emerald-500/5 text-emerald-500';
                    return (
                      <li key={c.id} className={`rounded-lg border p-3 text-sm ${cls}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs uppercase tracking-wider font-medium">{c.severity} · {c.status}</span>
                          <span className="text-[10px] tabular-nums opacity-80">{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                        {c.reason && <p className="mt-1 text-foreground/90">{c.reason}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="insights">
            <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
              {loading ? <SkeletonRows /> : insights.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No AI summaries yet.</p>
              ) : (
                <ul className="space-y-3">
                  {insights.map(i => (
                    <li key={i.id} className="rounded-lg border border-border/40 bg-background/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{i.title}</p>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{new Date(i.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{i.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="review" className="space-y-4">
            <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Clinician actions</p>
              <ReviewActions patientId={userId} onChanged={() => setRefreshKey(k => k + 1)} />
            </Card>
            <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Review timeline</p>
              <ReviewTimeline patientId={userId} refreshKey={refreshKey} />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: 'warn' }) {
  return (
    <Card className="p-3 bg-card/60 backdrop-blur border-border/60">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone === 'warn' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
          {icon}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function TrendChart({ trend }: { trend: { t: string; emotion: string | null; intensity: number }[] }) {
  const max = Math.max(0.001, ...trend.map(p => p.intensity));
  // Force LTR rendering so chronological bars always read left→right, even in RTL UI.
  return (
    <div dir="ltr" className="flex items-end gap-1 h-32 overflow-hidden">
      {trend.map((p, i) => (
        <div key={i} className="flex-1 min-w-[3px] rounded-t" style={{
          height: `${(p.intensity / max) * 100}%`,
          background: 'var(--gradient-gold)',
          opacity: 0.4 + 0.6 * (p.intensity / max),
        }} title={`${p.emotion ?? '—'} · ${Math.round(p.intensity * 100)}%`} />
      ))}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="h-3 rounded bg-muted/60 animate-pulse" style={{ width: `${90 - i * 10}%` }} />
      ))}
    </div>
  );
}
