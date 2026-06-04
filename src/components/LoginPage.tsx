import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import AVATARS from '@/data/avatars';
import { useApp, UserProfile } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import GenderSelector from '@/components/login/GenderSelector';
import DoctorAccessCard from '@/components/login/DoctorAccessCard';
import LoginLanguageBar from '@/components/login/LoginLanguageBar';
import LoginOnboardingProgress from '@/components/login/LoginOnboardingProgress';
import {
  generateAndStoreRecoveryCode,
  restoreAnonymousAccount,
  loadLatestSessionPointers,
  recoveryErrorMessage,
  setRecoveryPending,
  clearRecoveryPending,
  stashPendingAnonProfile,
} from '@/lib/recovery';
import {
  fetchOrBootstrapProfile,
  OAUTH_AVATAR_KEY,
  PENDING_PROFILE_KEY,
  type PendingProfile,
} from '@/lib/auth/profileBootstrap';
import { isAnonymousUser } from '@/lib/auth/isAnonymousUser';

type LoginStep = 'avatar' | 'identity' | 'anonymous-form' | 'real-form' | 'resume' | 'confirm-pending' | 'recovery-show' | 'recovery-redeem';

const LoginPage = () => {
  const { t } = useTranslation();
  const { setStage, setProfile, setCurrentSessionId, setCurrentChatId } = useApp();
  const { user, signUpAnonymous, signUpWithEmail, signInWithEmail, signInWithGoogle, signInWithFacebook, resendConfirmation, signOut } = useAuth();
  const [step, setStep] = useState<LoginStep>('avatar');
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [identityMode, setIdentityMode] = useState<'anonymous' | 'real'>('anonymous');
  const [isLoading, setIsLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string>('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [pendingAnonProfile, setPendingAnonProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    nickname: '', email: '', password: '', age: '', gender: '', nicknameReason: '', resumeEmail: '', resumePassword: '',
  });

  const handleAnonymousComplete = async () => {
    setIsLoading(true);
    setRecoveryPending();
    try {
      const anonUser = await signUpAnonymous();
      if (!anonUser) {
        clearRecoveryPending();
        toast.error(t('login.errors.anonFailed'));
        return;
      }

      await supabase.from('profiles').update({
        avatar: selectedAvatar,
        identity_mode: 'anonymous',
        nickname: formData.nickname,
        age: formData.age,
        gender: formData.gender,
        nickname_reason: formData.nicknameReason,
      }).eq('user_id', anonUser.id);

      const newProfile: UserProfile = {
        avatar: selectedAvatar,
        identityMode: 'anonymous',
        nickname: formData.nickname,
        age: formData.age,
        gender: formData.gender,
        nicknameReason: formData.nicknameReason,
        interviewAnswers: {},
      };
      setPendingAnonProfile(newProfile);
      stashPendingAnonProfile(newProfile as unknown as Record<string, unknown>);

      const code = await generateAndStoreRecoveryCode(anonUser.id);
      setRecoveryCode(code);
      setStep('recovery-show');
    } catch (e) {
      clearRecoveryPending();
      toast.error(t('common.somethingWrong'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (user && !isAnonymousUser(user)) {
      toast.error('Sign out of your current account before restoring with a recovery code.');
      return;
    }

    setIsLoading(true);
    try {
      const anonUser = user && isAnonymousUser(user) ? user : await signUpAnonymous();
      if (!anonUser) {
        toast.error('Could not create recovery session');
        return;
      }

      const result = await restoreAnonymousAccount(recoveryInput);
      if (!result.ok) {
        const msg = result.message ?? recoveryErrorMessage(result.reason, t);
        toast.error(msg);
        const keepSession =
          result.reason === 'rpc_unavailable' || result.reason === 'database_error';
        if (!keepSession && isAnonymousUser(anonUser)) {
          await signOut();
        }
        return;
      }

      toast.success('Recovery successful — restoring your data');
      const profile = await fetchOrBootstrapProfile(anonUser);
      setProfile(profile);

      const { sessionId, chatId } = await loadLatestSessionPointers(anonUser.id);
      if (sessionId) {
        setCurrentSessionId(sessionId);
        setCurrentChatId(chatId);
      }

      setStage('dashboard');
      clearRecoveryPending();
    } catch {
      toast.error(t('common.somethingWrong'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRealComplete = async () => {
    setIsLoading(true);
    try {
      if (isLogin) {
        const res = await signInWithEmail(formData.email, formData.password);
      if (res.errorCode) {
        const key = res.errorCode === 'unknown' ? 'login.errors.loginFailed' : `login.errors.${res.errorCode}`;
        toast.error(res.errorMessage || t(key));
        return;
      }
      if (!res.user) { toast.error(t('login.errors.loginFailed')); return; }
      await loadProfileAndEnter(res.user.id);
      return;
    }

      // Signup
      const res = await signUpWithEmail(formData.email, formData.password);
      if (res.errorCode) {
        const key = res.errorCode === 'unknown' ? 'login.errors.authFailed' : `login.errors.${res.errorCode}`;
        toast.error(res.errorMessage || t(key));
        return;
      }

      // Email confirmation required → stash prefs, show confirm step.
      if (res.needsConfirmation) {
        const pending: PendingProfile = {
          avatar: selectedAvatar,
          email: formData.email,
          age: formData.age,
          gender: formData.gender,
        };
        try { localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(pending)); } catch { /* noop */ }
        setStep('confirm-pending');
        return;
      }

      // Auto-confirm mode → session is live; safe to write profile.
      if (res.user) {
        await applyPendingProfile(res.user.id, {
          avatar: selectedAvatar,
          email: formData.email,
          age: formData.age,
          gender: formData.gender,
        });
        await loadProfileAndEnter(res.user.id);
      } else {
        toast.error(t('login.errors.authFailed'));
      }
    } catch (e) {
      toast.error(t('common.somethingWrong'));
    } finally {
      setIsLoading(false);
    }
  };

  const applyPendingProfile = async (uid: string, p: PendingProfile) => {
    await supabase.from('profiles').update({
      avatar: p.avatar,
      identity_mode: 'real',
      email: p.email,
      age: p.age,
      gender: p.gender,
    }).eq('user_id', uid);
  };

  const loadProfileAndEnter = async (uid: string) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser || authUser.id !== uid) {
      setStage('dashboard');
      return;
    }
    const profile = await fetchOrBootstrapProfile(authUser);
    setProfile(profile);
    setStage('dashboard');
  };

  const handleResend = async () => {
    setIsLoading(true);
    const { error } = await resendConfirmation(formData.email);
    setIsLoading(false);
    if (error) toast.error(error);
    else toast.success(t('login.confirm.resent'));
  };

  const handleResume = async () => {
    setIsLoading(true);
    try {
      const res = await signInWithEmail(formData.resumeEmail, formData.resumePassword);
      if (res.errorCode) {
        const key = res.errorCode === 'unknown' ? 'login.errors.loginFailed' : `login.errors.${res.errorCode}`;
        toast.error(res.errorMessage || t(key));
        return;
      }
      if (!res.user) { toast.error(t('login.errors.loginFailed')); return; }
      await loadProfileAndEnter(res.user.id);
    } catch (e) {
      toast.error(t('common.somethingWrong'));
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center particle-bg warm-vignette relative overflow-hidden px-4 py-8 sm:py-12">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 start-1/4 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-gold/5 blur-3xl animate-glow-pulse" />
        <div className="absolute bottom-1/4 end-1/4 w-60 sm:w-80 h-60 sm:h-80 rounded-full bg-gold-dark/5 blur-3xl animate-glow-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      <motion.div className="relative z-10 w-full max-w-2xl" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
        <LoginLanguageBar />
        <motion.div className="text-center mb-6 sm:mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-display gold-text text-glow tracking-widest">{t('brand.title')}</h1>
          <p className="text-muted-foreground font-ui text-xs sm:text-sm tracking-[0.25em] sm:tracking-[0.3em] mt-2 uppercase">{t('brand.tagline')}</p>
        </motion.div>

        {step !== 'recovery-show' && (
          <LoginOnboardingProgress currentStep={step} />
        )}

        <AnimatePresence mode="wait">
          {step === 'avatar' && (
            <motion.div key="avatar" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="glass rounded-2xl p-5 sm:p-8">
              <h2 className="text-lg sm:text-xl font-display text-foreground mb-2 text-center">{t('login.chooseAvatar')}</h2>
              <p className="text-xs text-muted-foreground text-center mb-6 max-w-md mx-auto">{t('login.onboarding.avatarHint', { defaultValue: 'Choose a companion avatar — you can stay anonymous or sign in with email.' })}</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 mb-8">
                {AVATARS.map(av => (
                  <button key={av.id} onClick={() => setSelectedAvatar(av.id)}
                    className={`avatar-ring rounded-xl p-3 flex flex-col items-center gap-1 transition-all ${selectedAvatar === av.id ? 'selected glass-strong' : 'hover:bg-secondary/50'}`}>
                    <span className="text-3xl">{av.emoji}</span>
                    <span className="text-[10px] font-ui text-muted-foreground truncate w-full text-center">{av.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('resume')} className="sentinel-btn-outline flex-1">{t('login.resumeSession')}</button>
                <button onClick={() => selectedAvatar && setStep('identity')} disabled={!selectedAvatar} className="sentinel-btn flex-1 disabled:opacity-30 disabled:cursor-not-allowed">{t('common.continue')}</button>
              </div>
              <button
                onClick={() => setStep('recovery-redeem')}
                className="w-full text-center text-xs font-ui text-muted-foreground mt-4 hover:text-primary transition-colors"
              >
                Restore anonymous account with recovery code →
              </button>
              <DoctorAccessCard />
            </motion.div>
          )}

          {step === 'identity' && (
            <motion.div key="identity" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="glass rounded-2xl p-8">
              <h2 className="text-xl font-display text-foreground mb-6 text-center">{t('login.identityMode')}</h2>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <button onClick={() => { setIdentityMode('anonymous'); setStep('anonymous-form'); }} className="glass rounded-xl p-6 text-center hover:gold-glow transition-all group">
                  <span className="text-4xl block mb-3">🎭</span>
                  <span className="font-display text-foreground group-hover:text-primary transition-colors">{t('login.anonymous')}</span>
                  <p className="text-xs font-ui text-muted-foreground mt-2">{t('login.anonymousDesc')}</p>
                </button>
                <button onClick={() => { setIdentityMode('real'); setIsLogin(false); setStep('real-form'); }} className="glass rounded-xl p-6 text-center hover:gold-glow transition-all group">
                  <span className="text-4xl block mb-3">👤</span>
                  <span className="font-display text-foreground group-hover:text-primary transition-colors">{t('login.realIdentity')}</span>
                  <p className="text-xs font-ui text-muted-foreground mt-2">{t('login.realIdentityDesc')}</p>
                </button>
              </div>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[10px] font-ui uppercase tracking-widest text-muted-foreground">{t('login.orContinueWith', { defaultValue: 'or continue with' })}</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={async () => {
                    try {
                      if (selectedAvatar) localStorage.setItem(OAUTH_AVATAR_KEY, selectedAvatar);
                    } catch { /* noop */ }
                    const { error } = await signInWithGoogle();
                    if (error) toast.error(error);
                  }}
                  className="sentinel-btn-outline flex items-center justify-center gap-2 py-2.5 text-sm"
                  aria-label="Sign in with Google"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.3-3.5z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5c-7.4 0-13.8 4.1-17.7 10.2z"/>
                    <path fill="#4CAF50" d="M24 43.5c5 0 9.6-1.9 13.1-5l-6-5.1c-2 1.4-4.4 2.1-7.1 2.1-5.3 0-9.7-3.1-11.3-7.4l-6.5 5C9.6 39.2 16.2 43.5 24 43.5z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6 5.1c-.4.4 6.5-4.7 6.5-14.6 0-1.2-.1-2.4-.3-3.5z"/>
                  </svg>
                  Google
                </button>
                <button
                  onClick={async () => {
                    try {
                      if (selectedAvatar) localStorage.setItem(OAUTH_AVATAR_KEY, selectedAvatar);
                    } catch { /* noop */ }
                    const { error } = await signInWithFacebook();
                    if (error) toast.error(error);
                  }}
                  className="sentinel-btn-outline flex items-center justify-center gap-2 py-2.5 text-sm"
                  aria-label="Sign in with Facebook"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
                    <path d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.313 0 2.686.235 2.686.235v2.953h-1.514c-1.491 0-1.955.925-1.955 1.874V12h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12z"/>
                  </svg>
                  Facebook
                </button>
              </div>

              <button onClick={() => setStep('avatar')} className="sentinel-btn-outline w-full">{t('common.back')}</button>
            </motion.div>
          )}

          {step === 'anonymous-form' && (
            <motion.div key="anon-form" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="glass rounded-2xl p-8">
              <h2 className="text-xl font-display text-foreground mb-6 text-center">{t('login.anonymousProfile')}</h2>
              <div className="space-y-4">
                <InputField label={t('login.fields.nickname')} value={formData.nickname} onChange={v => updateField('nickname', v)} placeholder={t('login.fields.nicknamePh')} />
                <InputField label={t('login.fields.age')} value={formData.age} onChange={v => updateField('age', v)} placeholder={t('login.fields.agePh')} type="number" />
                <GenderSelector value={formData.gender} onChange={v => updateField('gender', v)} />
                <InputField label={t('login.fields.nicknameReason')} value={formData.nicknameReason} onChange={v => updateField('nicknameReason', v)} placeholder={t('login.fields.nicknameReasonPh')} />
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep('identity')} className="sentinel-btn-outline flex-1">{t('common.back')}</button>
                <button onClick={handleAnonymousComplete} disabled={!formData.nickname || !formData.age || isLoading} className="sentinel-btn flex-1 disabled:opacity-30">
                  {isLoading ? t('login.creating') : t('login.enter')}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'real-form' && (
            <motion.div key="real-form" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="glass rounded-2xl p-8">
              <h2 className="text-xl font-display text-foreground mb-6 text-center">
                {isLogin ? t('login.signIn') : t('login.createAccount')}
              </h2>
              <div className="space-y-4">
                <InputField label={t('login.fields.email')} value={formData.email} onChange={v => updateField('email', v)} placeholder={t('login.fields.emailPh')} type="email" />
                <InputField label={t('login.fields.password')} value={formData.password} onChange={v => updateField('password', v)} placeholder={t('login.fields.passwordPh')} type="password" />
                {!isLogin && (
                  <>
                    <InputField label={t('login.fields.age')} value={formData.age} onChange={v => updateField('age', v)} placeholder={t('login.fields.agePh')} type="number" />
                    <GenderSelector value={formData.gender} onChange={v => updateField('gender', v)} />
                  </>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep('identity')} className="sentinel-btn-outline flex-1">{t('common.back')}</button>
                <button onClick={handleRealComplete} disabled={!formData.email || !formData.password || isLoading} className="sentinel-btn flex-1 disabled:opacity-30">
                  {isLoading ? t('login.loading') : isLogin ? t('login.signIn') : t('login.createAccount')}
                </button>
              </div>
              <button onClick={() => setIsLogin(!isLogin)} className="w-full text-center text-xs font-ui text-muted-foreground mt-4 hover:text-primary transition-colors">
                {isLogin ? t('login.noAccount') : t('login.hasAccount')}
              </button>
            </motion.div>
          )}

          {step === 'resume' && (
            <motion.div key="resume" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="glass rounded-2xl p-8">
              <h2 className="text-xl font-display text-foreground mb-6 text-center">{t('login.continuePrev')}</h2>
              <div className="space-y-4">
                <InputField label={t('login.fields.email')} value={formData.resumeEmail} onChange={v => updateField('resumeEmail', v)} placeholder={t('login.fields.emailPh')} type="email" />
                <InputField label={t('login.fields.password')} value={formData.resumePassword} onChange={v => updateField('resumePassword', v)} placeholder={t('login.fields.passwordPh')} type="password" />
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep('avatar')} className="sentinel-btn-outline flex-1">{t('common.back')}</button>
                <button onClick={handleResume} disabled={!formData.resumeEmail || !formData.resumePassword || isLoading} className="sentinel-btn flex-1 disabled:opacity-30">
                  {isLoading ? t('login.loading') : t('login.resume')}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'confirm-pending' && (
            <motion.div key="confirm-pending" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="glass rounded-2xl p-8 text-center">
              <div className="text-5xl mb-4">📬</div>
              <h2 className="text-xl font-display text-foreground mb-3">{t('login.confirm.checkInbox')}</h2>
              <p className="text-sm font-ui text-muted-foreground mb-6 leading-relaxed">
                {t('login.confirm.confirmSent', { email: formData.email })}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setStep('real-form')} className="sentinel-btn-outline flex-1">
                  {t('login.confirm.backToLogin')}
                </button>
                <button onClick={handleResend} disabled={isLoading} className="sentinel-btn flex-1 disabled:opacity-30">
                  {isLoading ? t('login.loading') : t('login.confirm.resend')}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'recovery-show' && (
            <motion.div
              key="recovery-show"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass rounded-2xl p-8 text-center"
              aria-hidden
            >
              <p className="text-sm font-ui text-muted-foreground">
                {t('login.recovery.preparing', { defaultValue: 'Your recovery code is shown in the dialog above. Save it before continuing.' })}
              </p>
            </motion.div>
          )}

          {step === 'recovery-redeem' && (
            <motion.div key="recovery-redeem" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="glass rounded-2xl p-8">
              <h2 className="text-xl font-display text-foreground mb-2 text-center">Restore anonymous account</h2>
              <p className="text-xs text-muted-foreground mb-6 text-center">
                Paste the recovery code you saved when you first created your anonymous account.
              </p>
              <input
                value={recoveryInput}
                onChange={(e) => setRecoveryInput(e.target.value.toUpperCase())}
                placeholder="ABCD-1234-EFGH-5678"
                className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground font-mono tracking-[0.2em] text-center text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                autoFocus
              />
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep('avatar')} className="sentinel-btn-outline flex-1">{t('common.back')}</button>
                <button
                  onClick={handleRedeem}
                  disabled={recoveryInput.replace(/[-\s]/g, '').length < 12 || isLoading}
                  className="sentinel-btn flex-1 disabled:opacity-30"
                >
                  {isLoading ? t('login.loading') : 'Restore'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

function InputField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-ui text-muted-foreground mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-foreground font-ui text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all" />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="block text-sm font-ui text-muted-foreground mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-foreground font-ui text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all">
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export default LoginPage;
