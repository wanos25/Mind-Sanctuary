import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';

const TONE_IDS = ['friendly', 'analytical', 'clinical'] as const;
const MOTION_IDS = ['full', 'reduced', 'minimal'] as const;
type MotionLevel = typeof MOTION_IDS[number];
type ToneId = typeof TONE_IDS[number];

const STORAGE_KEYS = {
  volume: 'mind-sentinel.audio.volume',
  voice: 'mind-sentinel.voice.enabled',
  voiceSpeed: 'mind-sentinel.voice.speed',
  streaming: 'mind-sentinel.ai.streaming',
};

export default function SettingsPreferences() {
  const { t } = useTranslation();
  const { profile, updateProfile } = useApp();
  const { user } = useAuth();
  const sound = useSound();

  const [volume, setVolume] = useState<number>(() => Number(localStorage.getItem(STORAGE_KEYS.volume) ?? 50));
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => localStorage.getItem(STORAGE_KEYS.voice) !== 'false');
  const [voiceSpeed, setVoiceSpeed] = useState<number>(() => Number(localStorage.getItem(STORAGE_KEYS.voiceSpeed) ?? 1));
  const [streaming, setStreaming] = useState<boolean>(() => localStorage.getItem(STORAGE_KEYS.streaming) !== 'false');
  const [motionLevel, setMotionLevel] = useState<MotionLevel>('full');
  const [tone, setTone] = useState<ToneId>((profile?.aiTone as ToneId) ?? 'friendly');

  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem('mind-sentinel.motion.level') as MotionLevel | null;
    if (stored) {
      setMotionLevel(stored);
      document.documentElement.dataset.motion = stored;
    }
  }, [user]);

  useEffect(() => {
    const v = volume / 100;
    sound.setLayerVolume('ambient', v);
    sound.setLayerVolume('environmental', v);
    sound.setLayerVolume('ui', v);
    sound.setLayerVolume('session', v);
    localStorage.setItem(STORAGE_KEYS.volume, String(volume));
  }, [volume, sound]);

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.voice, String(voiceEnabled)); }, [voiceEnabled]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.voiceSpeed, String(voiceSpeed)); }, [voiceSpeed]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.streaming, String(streaming)); }, [streaming]);

  const setMotion = (lvl: MotionLevel) => {
    setMotionLevel(lvl);
    document.documentElement.dataset.motion = lvl;
    localStorage.setItem('mind-sentinel.motion.level', lvl);
    toast.success(t('settings.toasts.motionSet', { level: t(`settings.motionLevels.${lvl}`) }));
  };

  const setTonePref = (id: ToneId) => {
    setTone(id);
    updateProfile({ aiTone: id });
    toast.success(t('settings.toasts.toneSet', { tone: t(`settings.tones.${id}`) }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card title={t('settings.aiBehavior')} delay={0}>
        <div className="space-y-2">
          {TONE_IDS.map((id) => (
            <OptionRow
              key={id}
              active={tone === id}
              onClick={() => setTonePref(id)}
              label={t(`settings.tones.${id}`)}
              desc={t(`settings.tones.${id}Desc`)}
            />
          ))}
        </div>
        <Toggle
          className="mt-4"
          label={t('settings.streamingResponses')}
          desc={t('settings.streamingDesc')}
          checked={streaming}
          onChange={setStreaming}
        />
      </Card>

      <Card title={t('settings.motion')} delay={0.05}>
        <div className="space-y-2">
          {MOTION_IDS.map((id) => (
            <OptionRow
              key={id}
              active={motionLevel === id}
              onClick={() => setMotion(id)}
              label={t(`settings.motionLevels.${id}`)}
              desc={t(`settings.motionLevels.${id}Desc`)}
            />
          ))}
        </div>
      </Card>

      <Card title={t('settings.audio')} delay={0.1}>
        <label className="block text-sm font-ui text-foreground mb-2">{t('settings.masterVolumeLabel')}</label>
        <input
          type="range" min={0} max={100} value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <p className="text-xs text-muted-foreground mt-1">{volume}%</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => sound.playClick()} className="sentinel-btn-outline px-3 py-1.5 text-xs">{t('settings.testClick')}</button>
          <button onClick={() => sound.playMessageChime()} className="sentinel-btn-outline px-3 py-1.5 text-xs">{t('settings.testChime')}</button>
        </div>
      </Card>

      <Card title={t('settings.voice')} delay={0.15}>
        <Toggle
          label={t('settings.voiceReplies')}
          desc={t('settings.voiceRepliesDesc')}
          checked={voiceEnabled}
          onChange={setVoiceEnabled}
        />
        <div className="mt-4">
          <label className="block text-sm font-ui text-foreground mb-2">{t('settings.speakingSpeedLabel', { rate: voiceSpeed.toFixed(2) })}</label>
          <input
            type="range" min={0.5} max={1.5} step={0.05} value={voiceSpeed}
            onChange={(e) => setVoiceSpeed(Number(e.target.value))}
            disabled={!voiceEnabled}
            className="w-full accent-primary disabled:opacity-50"
          />
        </div>
      </Card>
    </div>
  );
}

function Card({ title, delay = 0, children }: { title: string; delay?: number; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="glass rounded-2xl p-6"
    >
      <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase mb-4 font-semibold">{title}</h3>
      {children}
    </motion.section>
  );
}

function OptionRow({ active, onClick, label, desc }: { active: boolean; onClick: () => void; label: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-start p-3 rounded-lg border transition-all ${
        active ? 'border-primary/60 bg-primary/10' : 'border-border/30 hover:border-border'
      }`}
    >
      <p className="text-sm font-ui text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </button>
  );
}

function Toggle({
  label, desc, checked, onChange, className,
}: { label: string; desc?: string; checked: boolean; onChange: (b: boolean) => void; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className ?? ''}`}>
      <div>
        <p className="text-sm font-ui text-foreground">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-secondary'}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-background transition-all ${checked ? 'start-[1.4rem]' : 'start-0.5'}`}
        />
      </button>
    </div>
  );
}
