import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import PageShell from '@/components/layout/PageShell';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { listSessions } from '@/lib/sessions';
import ProfileHero from './ProfileHero';
import EditProfileForm from './EditProfileForm';
import AvatarPicker from './AvatarPicker';
import SettingsPreferences from './SettingsPreferences';
import AccountActions from './AccountActions';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { profile, updateProfile } = useApp();
  const { user } = useAuth();
  const [sessionCount, setSessionCount] = useState(0);
  const [dominantEmotion, setDominantEmotion] = useState<string | undefined>();
  const [memberSince, setMemberSince] = useState<string | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    listSessions(user.id).then((s) => {
      setSessionCount(s.length);
      const counts: Record<string, number> = {};
      s.forEach((row) => {
        const e = (row.summary_emotion ?? '').toLowerCase();
        if (e) counts[e] = (counts[e] ?? 0) + 1;
      });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (top) setDominantEmotion(top[0]);
    });
    if (user.created_at) {
      setMemberSince(new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }));
    }
  }, [user]);

  const setAvatar = async (id: string) => {
    if (!user) return;
    updateProfile({ avatar: id });
    const { error } = await supabase.from('profiles').update({ avatar: id }).eq('user_id', user.id);
    if (error) toast.error(t('profile.toasts.avatarFail'));
    else toast.success(t('profile.toasts.avatarUpdated'));
  };

  return (
    <PageShell title={t('profile.title')} subtitle={t('profile.subtitle')}>
      <div className="space-y-6">
        <ProfileHero
          avatarId={profile?.avatar}
          nickname={profile?.nickname}
          identityMode={profile?.identityMode}
          email={profile?.email}
          sessionCount={sessionCount}
          dominantEmotion={dominantEmotion}
          memberSince={memberSince}
          onChangeAvatar={() => setPickerOpen(true)}
        />

        <EditProfileForm />

        <SettingsPreferences />

        <AccountActions />
      </div>

      <AvatarPicker
        open={pickerOpen}
        current={profile?.avatar}
        onSelect={setAvatar}
        onClose={() => setPickerOpen(false)}
      />
    </PageShell>
  );
}
