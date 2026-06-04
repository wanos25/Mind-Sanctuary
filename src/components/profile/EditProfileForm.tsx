import { motion } from 'framer-motion';
import { useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';

const schema = z.object({
  nickname: z.string().trim().min(1, 'Required').max(40, 'Max 40 chars'),
  age: z.string().trim().max(3).optional().or(z.literal('')),
  gender: z.string().trim().max(40).optional().or(z.literal('')),
});

export default function EditProfileForm() {
  const { t } = useTranslation();
  const { profile, updateProfile } = useApp();
  const { user } = useAuth();
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [age, setAge] = useState(profile?.age ?? '');
  const [gender, setGender] = useState(profile?.gender ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dirty =
    nickname !== (profile?.nickname ?? '') ||
    age !== (profile?.age ?? '') ||
    gender !== (profile?.gender ?? '');

  const save = async () => {
    if (!user) return;
    const result = schema.safeParse({ nickname, age, gender });
    if (!result.success) {
      const e: Record<string, string> = {};
      result.error.issues.forEach((i) => { e[String(i.path[0])] = i.message; });
      setErrors(e);
      return;
    }
    setErrors({});
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ nickname, age, gender }).eq('user_id', user.id);
    if (error) toast.error(t('profile.toasts.profileFail'));
    else {
      updateProfile({ nickname, age, gender });
      toast.success(t('profile.toasts.profileUpdated'));
    }
    setSaving(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
      <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase mb-5">{t('profile.editable')}</h3>
      <div className="space-y-4">
        <Field label={t('profile.displayName')} value={nickname} onChange={setNickname} error={errors.nickname} />
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('profile.ageLabel')} value={age} onChange={setAge} type="number" error={errors.age} />
          <Field label={t('profile.genderLabel')} value={gender} onChange={setGender} error={errors.gender} />
        </div>
        {profile?.email && <Field label={t('profile.emailLabel')} value={profile.email} disabled />}
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="sentinel-btn px-6 py-2.5 text-sm disabled:opacity-50"
        >
          {saving ? t('common.saving') : t('common.saveChanges')}
        </button>
        {dirty && !saving && <span className="text-xs text-muted-foreground">{t('common.unsavedChanges')}</span>}
      </div>
    </motion.div>
  );
}

function Field({
  label, value, onChange, type = 'text', disabled, error,
}: {
  label: string; value: string; onChange?: (v: string) => void; type?: string; disabled?: boolean; error?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-ui text-muted-foreground mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className={`w-full bg-secondary/50 border rounded-lg px-4 py-2.5 text-foreground font-ui text-sm focus:outline-none transition-colors disabled:opacity-60 ${
          error ? 'border-destructive/60' : 'border-border focus:border-primary/60'
        }`}
      />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
