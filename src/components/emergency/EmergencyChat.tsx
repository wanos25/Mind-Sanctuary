import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Phone, Send, ShieldAlert, ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageShell from '@/components/layout/PageShell';
import { useApp } from '@/context/AppContext';
import { useDirection } from '@/hooks/useDirection';

interface Msg { role: 'user' | 'support'; content: string; }

export default function EmergencyChat() {
  const { t } = useTranslation();
  const { isRtl } = useDirection();
  const { setStage } = useApp();

  const HOTLINES = useMemo(() => [
    { name: t('emergencyHotlines.h1.name'), detail: t('emergencyHotlines.h1.detail') },
    { name: t('emergencyHotlines.h2.name'), detail: t('emergencyHotlines.h2.detail') },
    { name: t('emergencyHotlines.h3.name'), detail: t('emergencyHotlines.h3.detail') },
  ], [t]);

  const SUPPORTIVE_REPLIES = useMemo(() => [
    t('emergency.supportive.s1'),
    t('emergency.supportive.s2'),
    t('emergency.supportive.s3'),
  ], [t]);

  const [messages, setMessages] = useState<Msg[]>([
    { role: 'support', content: t('emergency.openingMessage') },
  ]);
  const [input, setInput] = useState('');

  const send = () => {
    if (!input.trim()) return;
    const reply = SUPPORTIVE_REPLIES[Math.floor(Math.random() * SUPPORTIVE_REPLIES.length)];
    setMessages(prev => [...prev, { role: 'user', content: input.trim() }, { role: 'support', content: reply }]);
    setInput('');
  };

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  return (
    <PageShell>
      <button onClick={() => setStage('dashboard')} className="text-xs font-ui text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-4">
        <BackIcon className="w-3.5 h-3.5" /> {t('emergency.backToDashboard')}
      </button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-2xl p-6 mb-6 border border-destructive/30">
        <div className="flex items-start gap-4">
          <ShieldAlert className="w-8 h-8 text-destructive flex-shrink-0" />
          <div>
            <h2 className="text-xl font-display text-foreground mb-1">{t('emergency.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('emergency.subtitle')}</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl flex flex-col h-[60vh]">
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-md rounded-2xl px-4 py-3 text-sm font-body leading-relaxed ${
                  m.role === 'user' ? 'bg-primary/20 border border-primary/30' : 'glass border-s-2 border-s-destructive/40'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-border/30 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder={t('emergency.placeholder')}
              aria-label={t('emergency.placeholder')}
              className="flex-1 bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm font-ui focus:outline-none focus:border-primary/50"
            />
            <button onClick={send} className="sentinel-btn px-4" aria-label={t('common.send')}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase">{t('emergency.immediateHelp')}</h3>
          {HOTLINES.map(h => (
            <div key={h.name} className="glass rounded-xl p-4 border border-destructive/20">
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-ui text-foreground">{h.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{h.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
