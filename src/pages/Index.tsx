import { AppProvider, useApp, AppStage } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { SoundProvider } from '@/context/SoundContext';
import { Suspense, lazy, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import LoginPage from '@/components/LoginPage';
import DevVersionBadge from '@/components/ui/DevVersionBadge';
import { useAuthSessionGate } from '@/hooks/useAuthSessionGate';
import RecoveryOverlay from '@/components/recovery/RecoveryOverlay';
import PasswordRecoveryForm from '@/components/auth/PasswordRecoveryForm';

const ClinicEntry = lazy(() => import('@/components/ClinicEntry'));
const DoctorInterview = lazy(() => import('@/components/DoctorInterview'));
const SessionChat = lazy(() => import('@/components/SessionChat'));
const Dashboard = lazy(() => import('@/components/Dashboard'));
const InsightsPage = lazy(() => import('@/components/insights/InsightsPage'));
const HistoryPage = lazy(() => import('@/components/history/HistoryPage'));
const ProfilePage = lazy(() => import('@/components/profile/ProfilePage'));
const SettingsPage = lazy(() => import('@/components/settings/SettingsPage'));
const EmergencyChat = lazy(() => import('@/components/emergency/EmergencyChat'));
const NotesPage = lazy(() => import('@/components/notes/NotesPage'));

const StageFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center" role="status" aria-live="polite">
    <div className="w-8 h-8 rounded-full border-2 border-muted border-t-foreground/60 animate-spin" />
  </div>
);

const renderStage = (stage: AppStage) => {
  const wrap = (node: ReactNode) => (
    <Suspense fallback={<StageFallback />}>{node}</Suspense>
  );

  switch (stage) {
    case 'login': return <LoginPage />;
    case 'entry': return wrap(<ClinicEntry />);
    case 'interview': return wrap(<DoctorInterview />);
    case 'session': return wrap(<SessionChat />);
    case 'dashboard': return wrap(<Dashboard />);
    case 'insights': return wrap(<InsightsPage />);
    case 'history': return wrap(<HistoryPage />);
    case 'profile': return wrap(<ProfilePage />);
    case 'settings': return wrap(<SettingsPage />);
    case 'notes': return wrap(<NotesPage />);
    case 'emergency': return wrap(<EmergencyChat />);
    default: return <LoginPage />;
  }
};

const AppContent = () => {
  const { stage } = useApp();
  const { loading, authReady, user, passwordRecoveryMode } = useAuth();
  useAuthSessionGate();

  const displayStage =
    !authReady || loading
      ? 'login'
      : !user && stage !== 'login'
        ? 'login'
        : stage;

  if (loading || !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center particle-bg">
        <div className="text-center">
          <h1 className="text-3xl font-display gold-text text-glow tracking-widest mb-4">MIND SENTINEL</h1>
          <p className="text-sm font-ui text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {passwordRecoveryMode && <PasswordRecoveryForm />}
      <RecoveryOverlay />
      <AnimatePresence mode="wait">
        <motion.div
          key={displayStage}
          id="main-content"
          tabIndex={-1}
          initial={{ opacity: 0, filter: 'blur(8px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(8px)' }}
          transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
          className={`min-h-screen outline-none ${displayStage === 'dashboard' || displayStage === 'session' ? 'has-mobile-nav md:pb-0' : ''}`}
        >
          {renderStage(displayStage)}
        </motion.div>
      </AnimatePresence>
    </>
  );
};

const Index = () => {
  return (
    <AppProvider>
      <SoundProvider>
        <AppContent />
        <DevVersionBadge />
      </SoundProvider>
    </AppProvider>
  );
};

export default Index;
