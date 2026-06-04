import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import TiltCard from '@/components/ui/TiltCard';
import { Skeleton } from '@/components/ui/skeleton';
import { listSessions, SessionRow } from '@/lib/sessions';
import {
  MessageCircle, Heart, TrendingUp, Clock, Wind, ShieldAlert,
} from 'lucide-react';

export default function AnalyticsSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { startNewSession, setStage, currentEmotion } = useApp();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    listSessions(user.id)
      .then((s) => {
        setSessions(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  const totalSessions = sessions.length;
  const lastSession = sessions[0];
  const avgIntensity = sessions.length
    ? sessions.reduce((acc, s) => acc + (s.summary_intensity ?? 0), 0) / sessions.length
    : 0;

  return (
    <section data-testid="analytics-section" className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-ui tracking-[0.4em] text-primary/70 uppercase mb-4">
            Your Sanctuary
          </p>
          <h2 className="text-4xl md:text-6xl font-display font-bold tracking-tight">
            A snapshot of <span className="gold-text">your inner world.</span>
          </h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10"
        >
          <StatCard
            icon={MessageCircle}
            label={t('dashboard.totalSessions')}
            value={loading ? null : String(totalSessions)}
          />
          <StatCard
            icon={Heart}
            label={t('dashboard.currentMood')}
            value={
              loading ? null : currentEmotion?.primary ?? lastSession?.summary_emotion ?? 'Calm'
            }
            capitalize
          />
          <StatCard
            icon={TrendingUp}
            label={t('dashboard.avgIntensity')}
            value={loading ? null : `${Math.round(avgIntensity * 100)}%`}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10"
        >
          <QuickAction
            icon={MessageCircle}
            label={t('common.newSession')}
            desc={t('dashboard.newSessionDesc')}
            onClick={startNewSession}
          />
          <QuickAction
            icon={Clock}
            label={t('dashboard.history')}
            desc={t('dashboard.historyDesc')}
            onClick={() => setStage('history')}
          />
          <QuickAction
            icon={Wind}
            label={t('dashboard.breathing')}
            desc={t('dashboard.breathingDesc')}
            onClick={startNewSession}
          />
          <QuickAction
            icon={ShieldAlert}
            label={t('nav.emergency')}
            desc={t('dashboard.emergencyDesc')}
            onClick={() => setStage('emergency')}
            accent
          />
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="glass rounded-3xl p-8"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase font-semibold">
              {t('dashboard.recentSessions')}
            </h3>
            <button
              onClick={() => setStage('history')}
              className="text-xs font-ui text-primary hover:underline"
            >
              {t('dashboard.viewAll')}
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm font-ui text-muted-foreground mb-4">
                {t('dashboard.noSessions')}
              </p>
              <button
                onClick={startNewSession}
                className="sentinel-btn text-xs py-2 px-5"
              >
                {t('dashboard.beginNow')}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.slice(0, 6).map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary/60 shadow-[0_0_8px_hsl(var(--gold))]" />
                    <span className="text-sm font-ui text-foreground">
                      {new Date(s.started_at).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  <span className="text-xs font-ui text-muted-foreground capitalize">
                    {s.summary_emotion ?? '—'}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </section>
  );
}

function StatCard({
  icon: Icon, label, value, capitalize,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  capitalize?: boolean;
}) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }}
    >
      <TiltCard
        className="glass rounded-2xl p-6 transition-all hover:gold-glow hover:border-primary/40 cursor-default h-full"
        intensity={6}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-ui tracking-[0.25em] text-muted-foreground uppercase">
            {label}
          </p>
          <Icon className="w-4 h-4 text-primary/60" />
        </div>
        {value === null ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p
            className={`text-3xl font-display text-foreground font-bold ${
              capitalize ? 'capitalize' : ''
            }`}
          >
            {value}
          </p>
        )}
      </TiltCard>
    </motion.div>
  );
}

function QuickAction({
  icon: Icon, label, desc, onClick, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`glass rounded-xl p-5 text-left transition-all hover:gold-glow group ${
        accent
          ? 'border border-destructive/30 hover:border-destructive/60'
          : 'hover:border-primary/40'
      }`}
    >
      <Icon
        className={`w-5 h-5 mb-3 ${accent ? 'text-destructive' : 'text-primary/70'}`}
      />
      <p className="text-sm font-ui text-foreground group-hover:text-primary transition-colors font-semibold">
        {label}
      </p>
      <p className="text-xs font-ui text-muted-foreground mt-1">{desc}</p>
    </motion.button>
  );
}
