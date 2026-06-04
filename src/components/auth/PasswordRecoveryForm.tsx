import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PasswordRecoveryForm() {
  const { t } = useTranslation();
  const { updatePassword, clearPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (password.length < 6) {
      toast.error(t('login.errors.weakPassword', { defaultValue: 'Password must be at least 6 characters.' }));
      return;
    }
    if (password !== confirm) {
      toast.error(t('profile.toasts.passwordMismatch', { defaultValue: 'Passwords do not match.' }));
      return;
    }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(t('profile.toasts.passwordUpdated', { defaultValue: 'Password updated successfully.' }));
    clearPasswordRecovery();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4 shadow-xl">
        <h2 className="text-xl font-semibold">
          {t('profile.resetPasswordTitle', { defaultValue: 'Set a new password' })}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('profile.resetPasswordHint', { defaultValue: 'Choose a new password for your account.' })}
        </p>
        <Input
          type="password"
          autoComplete="new-password"
          placeholder={t('login.password', { defaultValue: 'Password' })}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          type="password"
          autoComplete="new-password"
          placeholder={t('profile.confirmPassword', { defaultValue: 'Confirm password' })}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <Button className="w-full" disabled={loading} onClick={submit}>
          {t('profile.savePassword', { defaultValue: 'Save password' })}
        </Button>
      </div>
    </div>
  );
}
