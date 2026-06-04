import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import PageShell from '@/components/layout/PageShell';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import ThemeSwitcher from '@/components/ui/ThemeSwitcher';

const TONE_IDS = ['friendly', 'analytical', 'clinical'] as const;

export default function SettingsPage() {
  const { profile, updateProfile, setStage } = useApp();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const sound = useSound();
  const [volume, setVolume] = useState(50);
  const [tone, setTone] = useState<'friendly' | 'analytical' | 'clinical'>(profile?.aiTone ?? 'friendly');

  const setTonePref = async (value: 'friendly' | 'analytical' | 'clinical') => {
    setTone(value);
    updateProfile({ aiTone: value });
    if (user) await supabase.from('profiles').update({ /* no column yet */ }).eq('user_id', user.id);
    toast.success(t('settings.toasts.toneSet', { tone: t(`settings.tones.${value}`) }));
  };

  const exportData = async () => {
    if (!user) return;
    const { data: sessions } = await supabase.from('sessions').select('*').eq('user_id', user.id);
    const { data: messages } = await supabase.from('chat_messages').select('*').eq('user_id', user.id);
    const blob = new Blob([JSON.stringify({ sessions, messages, profile }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `mind-sentinel-export-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t('settings.toasts.exported'));
  };

  const deleteData = async () => {
    if (!user) return;
    if (!confirm(t('settings.confirmDelete'))) return;
    await supabase.from('chat_messages').delete().eq('user_id', user.id);
    await supabase.from('emotion_analyses').delete().eq('user_id', user.id);
    await supabase.from('session_memories').delete().eq('user_id', user.id);
    await supabase.from('sessions').delete().eq('user_id', user.id);
    toast.success(t('settings.toasts.deleted'));
  };

  return (
    <PageShell title={t('settings.title')} subtitle={t('settings.subtitle')}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
          <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase mb-4 font-semibold">{t('settings.sound')}</h3>
          <label className="block text-sm font-ui text-foreground mb-2">{t('settings.masterVolume')}</label>
          <input
            type="range" min={0} max={100} value={volume}
            onChange={e => {
              const v = Number(e.target.value);
              setVolume(v);
              sound.setLayerVolume('ambient', v / 100);
              sound.setLayerVolume('environmental', v / 100);
              sound.setLayerVolume('ui', v / 100);
              sound.setLayerVolume('session', v / 100);
            }}
            className="w-full accent-primary"
          />
          <p className="text-xs text-muted-foreground mt-2">{volume}%</p>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-2xl p-6">
          <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase mb-4 font-semibold">{t('settings.language')}</h3>
          <LanguageSwitcher />
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} className="glass rounded-2xl p-6">
          <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase mb-4 font-semibold">
            {t('settings.appearance', { defaultValue: 'Appearance' })}
          </h3>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-ui text-foreground">{t('theme.theme', { defaultValue: 'Theme' })}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('theme.subtitle', { defaultValue: 'Purple neural · Gold cinematic' })}
              </p>
            </div>
            <ThemeSwitcher variant="pill" />
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6">
          <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase mb-4 font-semibold">{t('settings.aiBehavior')}</h3>
          <div className="space-y-2">
            {TONE_IDS.map((id) => (
              <button
                key={id}
                onClick={() => setTonePref(id)}
                className={`w-full text-start p-3 rounded-lg border transition-all ${
                  tone === id ? 'border-primary/60 bg-primary/10' : 'border-border/30 hover:border-border'
                }`}
              >
                <p className="text-sm font-ui text-foreground">{t(`settings.tones.${id}`)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t(`settings.tones.${id}Desc`)}</p>
              </button>
            ))}
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-2xl p-6">
          <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase mb-4 font-semibold">{t('settings.privacy')}</h3>
          <div className="space-y-3">
            <button onClick={exportData} className="sentinel-btn-outline w-full text-sm py-2.5">{t('settings.exportData')}</button>
            <button onClick={deleteData} className="sentinel-btn-outline w-full text-sm py-2.5 text-destructive border-destructive/40 hover:border-destructive">
              {t('settings.deleteAll')}
            </button>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl p-6">
          <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase mb-4 font-semibold">{t('settings.account')}</h3>
          <button
            onClick={async () => { await signOut(); setStage('login'); }}
            className="sentinel-btn-outline w-full text-sm py-2.5"
          >
            {t('common.signOut')}
          </button>
        </motion.section>
      </div>
    </PageShell>
  );
}
