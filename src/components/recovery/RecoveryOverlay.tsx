import { useSyncExternalStore } from 'react';
import RecoveryCodeCard from '@/components/recovery/RecoveryCodeCard';
import { useApp, type UserProfile } from '@/context/AppContext';
import {
  clearRecoveryPending,
  getStoredRecoveryCode,
  isRecoveryPending,
  readPendingAnonProfile,
} from '@/lib/recovery';

const RECOVERY_PENDING_EVENT = 'mind-sentinel:recovery-pending-change';

function subscribeRecoveryPending(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (
      e.key === 'mind-sentinel.recoveryPending'
      || e.key === 'mind-sentinel.recoveryCode'
      || e.key === null
    ) {
      cb();
    }
  };
  window.addEventListener(RECOVERY_PENDING_EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(RECOVERY_PENDING_EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * App-level recovery modal — survives LoginPage mount/unmount and blocks
 * useAuthSessionGate from advancing to dashboard until dismissed.
 */
export default function RecoveryOverlay() {
  const pending = useSyncExternalStore(
    subscribeRecoveryPending,
    isRecoveryPending,
    () => false,
  );
  const { setStage, setProfile } = useApp();
  const code = pending ? getStoredRecoveryCode() : null;

  if (!pending || !code) return null;

  const handleContinue = () => {
    const profile = readPendingAnonProfile<UserProfile>();
    if (profile) setProfile(profile);
    clearRecoveryPending();
    setStage('dashboard');
  };

  return <RecoveryCodeCard code={code} onContinue={handleContinue} />;
}
