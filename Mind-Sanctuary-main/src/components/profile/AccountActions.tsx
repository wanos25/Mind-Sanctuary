import { motion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { LogOut, Download, Trash2, KeyRound } from 'lucide-react';
import { getAuthRedirectUrl } from '@/lib/auth/redirectUrl';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

export default function AccountActions() {
  const { t } = useTranslation();
  const { profile, setStage } = useApp();
  const { user, signOut } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const [{ data: sessions }, { data: messages }, { data: emotions }] = await Promise.all([
        supabase.from('sessions').select('*').eq('user_id', user.id),
        supabase.from('chat_messages').select('*').eq('user_id', user.id),
        supabase.from('emotion_analyses').select('*').eq('user_id', user.id),
      ]);
      const payload = { exportedAt: new Date().toISOString(), profile, sessions, messages, emotions };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${t('profile.exportFileName')}-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success(t('profile.toasts.exported'));
    } catch {
      toast.error(t('profile.toasts.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const resetPassword = async () => {
    if (!user?.email) {
      toast.error(t('profile.toasts.noEmail'));
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: getAuthRedirectUrl(),
    });
    if (error) toast.error(t('profile.toasts.resetFail'));
    else toast.success(t('profile.toasts.resetSent'));
  };

  const deleteAllData = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await Promise.all([
        supabase.from('chat_messages').delete().eq('user_id', user.id),
        supabase.from('emotion_analyses').delete().eq('user_id', user.id),
        supabase.from('session_memories').delete().eq('user_id', user.id),
      ]);
      await supabase.from('sessions').delete().eq('user_id', user.id);
      toast.success(t('profile.toasts.deleted'));
    } catch {
      toast.error(t('profile.toasts.deleteFail'));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
      <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase mb-5">{t('profile.accountPrivacy')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ActionButton icon={KeyRound} label={t('profile.resetPassword')} onClick={resetPassword} />
        <ActionButton icon={Download} label={exporting ? t('profile.exporting') : t('profile.exportMyData')} onClick={exportData} disabled={exporting} />
        <ActionButton
          icon={LogOut}
          label={t('profile.signOutAction')}
          onClick={async () => { await signOut(); setStage('login'); }}
        />
        <ActionButton
          icon={Trash2}
          label={t('profile.deleteAllMyData')}
          danger
          onClick={() => setConfirmDelete(true)}
        />
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="glass-strong border-destructive/30">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('profile.confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('profile.confirmDeleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); deleteAllData(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t('profile.deleting') : t('profile.confirmDeleteAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

function ActionButton({
  icon: Icon, label, onClick, danger, disabled,
}: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-sm font-ui disabled:opacity-50 ${
        danger
          ? 'border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive/60'
          : 'border-border/30 text-foreground hover:border-primary/40 hover:bg-primary/5'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </motion.button>
  );
}
