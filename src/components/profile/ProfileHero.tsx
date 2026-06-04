import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import AVATARS from '@/data/avatars';
import { colorForEmotion } from '@/lib/insightsAggregator';

interface Props {
  avatarId?: string;
  nickname?: string;
  identityMode?: string;
  email?: string;
  sessionCount: number;
  dominantEmotion?: string;
  memberSince?: string;
  onChangeAvatar: () => void;
}

export default function ProfileHero({
  avatarId, nickname, identityMode, email, sessionCount, dominantEmotion, memberSince, onChangeAvatar,
}: Props) {
  const { t } = useTranslation();
  const avatar = AVATARS.find((a) => a.id === avatarId) ?? AVATARS[0];
  const aura = colorForEmotion(dominantEmotion);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative glass rounded-3xl p-8 md:p-10 overflow-hidden"
    >
      <motion.div
        aria-hidden
        className="absolute -top-32 -left-32 w-[26rem] h-[26rem] rounded-full blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${aura}55, transparent 70%)` }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-32 -right-32 w-[24rem] h-[24rem] rounded-full blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, hsl(var(--primary) / 0.25), transparent 70%)` }}
        animate={{ scale: [1.05, 1, 1.05], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
        {/* Avatar */}
        <motion.button
          onClick={onChangeAvatar}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="relative group"
        >
          <motion.div
            className="absolute inset-0 rounded-full blur-2xl"
            style={{ background: `radial-gradient(circle, ${aura}aa, transparent 70%)` }}
            animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-full glass-strong flex items-center justify-center text-7xl border border-primary/30 group-hover:border-primary/60 transition-colors">
            {avatar.emoji}
          </div>
          <div className="absolute -bottom-1 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 px-3 py-1 rounded-full bg-background/80 border border-border/50 text-[10px] uppercase tracking-wider text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            {t('profile.change')}
          </div>
        </motion.button>

        {/* Identity */}
        <div className="flex-1 text-center md:text-start">
          <p className="text-[10px] font-ui tracking-[0.4em] text-primary/80 uppercase mb-2">{t('profile.sanctuaryIdentity')}</p>
          <h2 className="text-3xl md:text-4xl font-display gold-text">{nickname || t('common.anonymous')}</h2>
          <p className="text-xs text-muted-foreground mt-1 capitalize">
            {avatar.label} · {identityMode ?? t('profile.guest')}
            {email && <> · {email}</>}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3 max-w-md mx-auto md:mx-0">
            <Stat label={t('profile.stats.sessions')} value={sessionCount} />
            <Stat label={t('profile.stats.mood')} value={dominantEmotion ?? '—'} capitalize />
            <Stat label={t('profile.stats.since')} value={memberSince ?? '—'} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ label, value, capitalize }: { label: string; value: string | number; capitalize?: boolean }) {
  return (
    <div className="text-center px-2 py-3 rounded-xl bg-secondary/30 border border-border/30">
      <p className={`text-lg font-display gold-text truncate ${capitalize ? 'capitalize' : ''}`}>{value}</p>
      <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
