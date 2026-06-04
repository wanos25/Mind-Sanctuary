import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp, AppStage } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import ThemeSwitcher from '@/components/ui/ThemeSwitcher';
import {
  LayoutDashboard, MessageCircle, BarChart3, Clock, Settings, User, ShieldAlert, LogOut,
  Gamepad2, Stethoscope, FileText,
} from 'lucide-react';

const NAV: { stage: AppStage; labelKey: string; icon: React.ComponentType<{ className?: string }>; emergency?: boolean }[] = [
  { stage: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { stage: 'insights', labelKey: 'nav.insights', icon: BarChart3 },
  { stage: 'history', labelKey: 'nav.history', icon: Clock },
  { stage: 'notes', labelKey: 'nav.notes', icon: FileText },
  { stage: 'profile', labelKey: 'nav.profile', icon: User },
  { stage: 'settings', labelKey: 'nav.settings', icon: Settings },
  { stage: 'emergency', labelKey: 'nav.emergency', icon: ShieldAlert, emergency: true },
];

export default function TopNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { stage, setStage, startNewSession } = useApp();
  const { signOut } = useAuth();
  const { isDoctor } = useUserRole();

  const handleLogout = async () => {
    await signOut();
    setStage('login');
  };

  return (
    <header className="glass-strong border-b border-border/50 px-6 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4 z-30 sticky top-0">
      <div className="flex items-center justify-start">
        <button
          onClick={() => setStage('dashboard')}
          className="text-base font-display gold-text tracking-widest font-bold"
        >
          MIND SENTINEL
        </button>
      </div>
      <nav className="hidden md:flex items-center justify-center gap-1">
          {NAV.map(item => {
            const Icon = item.icon;
            const active = stage === item.stage;
            return (
              <button
                key={item.stage}
                onClick={() => setStage(item.stage)}
                className={`relative flex items-center gap-2 text-xs font-ui px-3 py-2 rounded-lg transition-all
                  ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}
                  ${item.emergency ? 'text-destructive/80 hover:text-destructive' : ''}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t(item.labelKey, { defaultValue: item.stage === 'notes' ? 'Notes' : item.labelKey })}</span>
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-2 bottom-0.5 h-0.5 rounded-full"
                    style={{ background: 'var(--gradient-gold)' }}
                  />
                )}
              </button>
            );
          })}

          {/* Activities (separate route — visible to all signed-in users) */}
          <button
            onClick={() => navigate('/activities')}
            className="relative flex items-center gap-2 text-xs font-ui px-3 py-2 rounded-lg transition-all text-muted-foreground hover:text-foreground"
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>{t('nav.activities', { defaultValue: 'Activities' })}</span>
          </button>

          {/* Doctor portal — gated by role */}
          {isDoctor && (
            <button
              onClick={() => navigate('/doctor')}
              className="relative flex items-center gap-2 text-xs font-ui px-3 py-2 rounded-lg transition-all text-accent hover:text-foreground"
              title="Doctor Portal"
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>{t('nav.doctor', { defaultValue: 'Clinician' })}</span>
            </button>
          )}
      </nav>
      <div className="flex items-center justify-end gap-2">
        <ThemeSwitcher variant="icon" />
        <button
          onClick={startNewSession}
          className="sentinel-btn py-2 px-4 text-xs flex items-center gap-2"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {t('nav.startSession')}
        </button>
        <button
          onClick={handleLogout}
          className="sentinel-btn-outline py-2 px-3 text-xs flex items-center gap-1.5"
          title={t('common.signOut')}
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
