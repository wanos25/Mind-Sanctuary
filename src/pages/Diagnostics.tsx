/**
 * /diagnostics — gated by DEV or ?debug=1.
 * Tabs: Arabic Flow Test · Telemetry Dashboard.
 * Theme-aware, RTL-safe, mobile-safe, reduced-motion compatible.
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Activity, FlaskConical, ArrowLeft, Shield } from 'lucide-react';
import { useDirection } from '@/hooks/useDirection';
import ArabicVoiceFlowTest from '@/components/diagnostics/ArabicVoiceFlowTest';
import TelemetryDashboard from '@/components/diagnostics/TelemetryDashboard';

type Tab = 'flow' | 'telemetry';

export default function DiagnosticsPage() {
  const { t } = useTranslation();
  useDirection();
  const allowed = useMemo(() => {
    if (import.meta.env.DEV) return true;
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('debug') === '1';
    } catch { return false; }
  }, []);
  const [tab, setTab] = useState<Tab>('flow');

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="glass border border-border/40 rounded-2xl p-8 max-w-md text-center">
          <Shield className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-xl font-display mb-2">{t('diagnostics.gate.title')}</h1>
          <p className="text-sm text-muted-foreground mb-4">{t('diagnostics.gate.body')}</p>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" /> {t('common.back')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Cinematic backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-60"
           style={{ background: 'radial-gradient(ellipse at 50% 0%, hsl(var(--primary) / 0.18), transparent 60%)' }} />

      <header className="border-b border-border/40 backdrop-blur-md sticky top-0 z-10 bg-background/70">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center gap-4 flex-wrap">
          <Link to="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3.5 h-3.5" /> {t('common.back')}
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-ui uppercase tracking-[0.22em] text-primary/80">{t('diagnostics.header.eyebrow')}</p>
            <h1 className="text-base md:text-lg font-display truncate">{t('diagnostics.header.title')}</h1>
          </div>
          <nav className="inline-flex rounded-xl bg-secondary/40 border border-border/40 p-1">
            <TabBtn active={tab === 'flow'} onClick={() => setTab('flow')} icon={<FlaskConical className="w-3.5 h-3.5" />}>
              {t('diagnostics.tabs.flow')}
            </TabBtn>
            <TabBtn active={tab === 'telemetry'} onClick={() => setTab('telemetry')} icon={<Activity className="w-3.5 h-3.5" />}>
              {t('diagnostics.tabs.telemetry')}
            </TabBtn>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        {tab === 'flow' ? <ArabicVoiceFlowTest /> : <TelemetryDashboard />}
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-ui transition-colors ${
        active ? 'bg-primary/15 text-primary border border-primary/40' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}{children}
    </button>
  );
}
