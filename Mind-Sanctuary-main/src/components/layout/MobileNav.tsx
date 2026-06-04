import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { useUserRole } from '@/hooks/useUserRole';
import {
  LayoutDashboard, BarChart3, Clock, Gamepad2, User, Stethoscope, ShieldAlert,
} from 'lucide-react';

/**
 * Slim mobile bottom navigation. Visible only on small screens.
 * Includes Activities and (for clinicians) Doctor portal entry.
 */
export default function MobileNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { stage, setStage } = useApp();
  const { isDoctor } = useUserRole();

  const items: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void; active?: boolean; tone?: string }[] = [
    { key: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, onClick: () => setStage('dashboard'), active: stage === 'dashboard' },
    { key: 'insights', label: t('nav.insights'), icon: BarChart3, onClick: () => setStage('insights'), active: stage === 'insights' },
    { key: 'activities', label: t('nav.activities', { defaultValue: 'Activities' }), icon: Gamepad2, onClick: () => navigate('/activities') },
    { key: 'history', label: t('nav.history'), icon: Clock, onClick: () => setStage('history'), active: stage === 'history' },
    { key: 'profile', label: t('nav.profile'), icon: User, onClick: () => setStage('profile'), active: stage === 'profile' },
  ];

  if (isDoctor) {
    items.push({ key: 'doctor', label: t('nav.doctor', { defaultValue: 'Clinician' }), icon: Stethoscope, onClick: () => navigate('/doctor'), tone: 'text-accent' });
  } else {
    items.push({ key: 'emergency', label: t('nav.emergency'), icon: ShieldAlert, onClick: () => setStage('emergency'), tone: 'text-destructive/80' });
  }

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass-strong border-t border-border/50 px-1.5 py-1.5
                    pb-[max(0.375rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-0.5">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={item.onClick}
              className={`flex flex-col items-center gap-0.5 flex-1 min-w-0 py-1.5 px-1 rounded-md transition-colors
                ${item.active ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}
                ${item.tone ?? ''}`}
              aria-label={item.label}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] font-ui truncate w-full text-center">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
