import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import ActivitiesHub from '@/components/activities/ActivitiesHub';

function ActivitiesInner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading, authReady } = useAuth();

  if (loading || !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground animate-pulse">{t('common.loading')}</div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">{t('doctor.signInRequired')}</p>
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 me-2" />{t('common.back')}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-background text-foreground outline-none">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{t('activities.title')}</h1>
              <p className="text-xs text-muted-foreground">{t('activities.subtitle')}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 me-2" />{t('common.back')}
          </Button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <ActivitiesHub />
      </main>
    </div>
  );
}

export default function Activities() {
  return <ActivitiesInner />;
}
