import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import PageShell from '@/components/layout/PageShell';
import { useAuth } from '@/context/AuthContext';
import { loadInsights, generateAIInsights, InsightsData } from '@/lib/insightsAggregator';
import InsightHero from './InsightHero';
import EmotionalTimeline from './EmotionalTimeline';
import AIInsightCards from './AIInsightCards';
import EmptyInsights from './EmptyInsights';

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
};

export default function InsightsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    loadInsights(user.id)
      .then(setData)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <PageShell title={t('insights.title')} subtitle={t('insights.subtitleShort')}>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
              className="glass rounded-2xl h-40"
            />
          ))}
        </div>
      </PageShell>
    );
  }

  if (!data || data.totals.sessions === 0) {
    return (
      <PageShell title={t('insights.title')} subtitle={t('insights.subtitle')}>
        <EmptyInsights />
      </PageShell>
    );
  }

  const aiInsights = generateAIInsights(data);

  return (
    <PageShell title={t('insights.title')} subtitle={t('insights.subtitle')}>
      <div className="space-y-6">
        <InsightHero data={data} />

        <EmotionalTimeline sessions={data.sessions} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-6 lg:col-span-2"
          >
            <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase mb-6">{t('insights.moodTrend')}</h3>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <AreaChart data={data.trend}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.15} vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="intensity" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#trendGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Distribution Pie */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="glass rounded-2xl p-6"
          >
            <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase mb-4">{t('insights.spectrum')}</h3>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data.distribution}
                    dataKey="count" nameKey="emotion"
                    innerRadius={50} outerRadius={85} paddingAngle={3}
                  >
                    {data.distribution.map((d, i) => <Cell key={i} fill={d.color} stroke="hsl(var(--background))" />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5">
              {data.distribution.slice(0, 4).map((d) => (
                <div key={d.emotion} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 capitalize text-foreground/80">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    {d.emotion}
                  </span>
                  <span className="text-muted-foreground">{d.count}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Weekly */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass rounded-2xl p-6 lg:col-span-2"
          >
            <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase mb-6">{t('insights.weekly')}</h3>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={data.weekly}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.15} vertical={false} />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Distortions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="glass rounded-2xl p-6"
          >
            <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase mb-4">{t('insights.cognitive')}</h3>
            {data.distortions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('insights.noPatterns')}</p>
            ) : (
              <div className="space-y-3">
                {data.distortions.slice(0, 5).map((d, i) => {
                  const max = data.distortions[0].count;
                  const pct = (d.count / max) * 100;
                  return (
                    <div key={d.name}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="capitalize text-foreground/85">{d.name}</span>
                        <span className="text-muted-foreground">{d.count}</span>
                      </div>
                      <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.2 + i * 0.06, duration: 0.8, ease: 'easeOut' }}
                          className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        <AIInsightCards insights={aiInsights} />
      </div>
    </PageShell>
  );
}
