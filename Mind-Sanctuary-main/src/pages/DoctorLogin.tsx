import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Stethoscope, ShieldCheck, ArrowLeft, Mail, Lock, Sparkles, Loader2, AlertTriangle, Crown } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Clinician auth gateway.
 * - unauthenticated → email/password (or magic-link) form
 * - authenticated + doctor → redirect /doctor
 * - authenticated + not doctor → unauthorized screen (with bootstrap CTA when applicable)
 */
function DoctorLoginInner() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading, signInWithEmail } = useAuth();
  const { isDoctor, loading: roleLoading } = useUserRole();

  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);
  const [showClaim, setShowClaim] = useState(false);
  const [claiming, setClaiming] = useState(false);

  // Probe bootstrap availability for authenticated non-doctors.
  useEffect(() => {
    if (!user || isDoctor || roleLoading) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any).rpc('doctor_bootstrap_available');
      if (!cancelled && !error) setBootstrapAvailable(Boolean(data));
    })();
    return () => { cancelled = true; };
  }, [user, isDoctor, roleLoading]);

  // Redirect doctors straight to the portal.
  useEffect(() => {
    if (!authLoading && !roleLoading && user && isDoctor) {
      navigate('/doctor', { replace: true });
    }
  }, [authLoading, roleLoading, user, isDoctor, navigate]);

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!email || !password) { setErr('Email and password are required'); return; }
    setBusy(true);
    const res = await signInWithEmail(email, password);
    setBusy(false);
    if (res.errorMessage) setErr(res.errorMessage);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!email) { setErr('Email is required'); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/doctor-login` },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else toast({ title: 'Check your inbox', description: 'A secure sign-in link is on its way.' });
  };

  const handleClaim = async () => {
    setClaiming(true);
    const { error } = await (supabase as any).rpc('claim_doctor_bootstrap');
    setClaiming(false);
    setShowClaim(false);
    if (error) {
      toast({
        title: 'Bootstrap closed',
        description: error.message === 'bootstrap_closed'
          ? 'A clinician already exists. Ask an admin for access.'
          : error.message,
        variant: 'destructive',
      });
      setBootstrapAvailable(false);
      return;
    }
    toast({ title: 'Welcome, clinician.', description: 'Doctor role granted.' });
    // Force role re-fetch by navigating to portal — hook re-runs on /doctor.
    setTimeout(() => navigate('/doctor', { replace: true }), 400);
  };

  const loading = authLoading || (user && roleLoading);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden flex items-center justify-center p-4">
      {/* ambient cinematic backdrop */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[520px] h-[520px] rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <Button
          variant="ghost" size="sm"
          onClick={() => navigate('/')}
          className="mb-4 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" /> Back
        </Button>

        <Card className="relative overflow-hidden border-accent/25 bg-gradient-to-br from-background/60 via-card/40 to-accent/[0.06] backdrop-blur-2xl shadow-[0_20px_80px_-20px_hsl(var(--accent)/0.35)]">
          {/* top accent line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

          <div className="p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-xl bg-accent/30 blur-md opacity-70" />
                <div className="relative w-12 h-12 rounded-xl border border-accent/40 bg-gradient-to-br from-accent/20 to-primary/10 flex items-center justify-center">
                  <Stethoscope className="w-5 h-5 text-accent" />
                </div>
              </div>
              <div>
                <h1 className="text-lg font-display tracking-wide">Clinician Access</h1>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-accent/80" />
                  Secure portal · encrypted session
                </p>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Verifying credentials…
              </div>
            ) : !user ? (
              <>
                {/* mode toggle */}
                <div className="flex gap-1 p-1 rounded-lg bg-card/50 border border-border/40">
                  <button
                    onClick={() => setMode('password')}
                    className={`flex-1 text-xs font-ui py-1.5 rounded-md transition-all ${mode === 'password' ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:text-foreground'}`}
                  >Password</button>
                  <button
                    onClick={() => setMode('magic')}
                    className={`flex-1 text-xs font-ui py-1.5 rounded-md transition-all ${mode === 'magic' ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:text-foreground'}`}
                  >Magic link</button>
                </div>

                <form onSubmit={mode === 'password' ? handlePasswordSignIn : handleMagicLink} className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email" autoComplete="email" required
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="clinician@hospital.org"
                      className="ps-10 bg-background/40 border-border/60 focus-visible:border-accent/60"
                    />
                  </div>

                  {mode === 'password' && (
                    <div className="relative">
                      <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="password" autoComplete="current-password" required
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="ps-10 bg-background/40 border-border/60 focus-visible:border-accent/60"
                      />
                    </div>
                  )}

                  {err && (
                    <div className="text-xs text-destructive flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {err}
                    </div>
                  )}

                  <Button type="submit" disabled={busy} className="w-full group">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        <Sparkles className="w-4 h-4 me-2 opacity-70 group-hover:opacity-100" />
                        {mode === 'password' ? 'Sign in' : 'Send magic link'}
                      </>
                    )}
                  </Button>
                </form>

                <p className="text-[11px] text-muted-foreground/80 text-center leading-relaxed">
                  Session is persisted securely. Only authorised clinicians may proceed beyond this gateway.
                </p>
              </>
            ) : (
              // authenticated but not doctor
              <UnauthorizedPanel
                email={user.email ?? null}
                bootstrapAvailable={bootstrapAvailable}
                onClaim={() => setShowClaim(true)}
                onHome={() => navigate('/')}
              />
            )}
          </div>
        </Card>
      </motion.div>

      <AlertDialog open={showClaim} onOpenChange={setShowClaim}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-accent" /> Claim clinician role
            </AlertDialogTitle>
            <AlertDialogDescription>
              No clinician exists yet. You are about to permanently grant the doctor role to this account.
              This bootstrap path closes automatically once granted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={claiming}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClaim} disabled={claiming}>
              {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & claim'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UnauthorizedPanel({ email, bootstrapAvailable, onClaim, onHome }: {
  email: string | null;
  bootstrapAvailable: boolean;
  onClaim: () => void;
  onHome: () => void;
}) {
  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto w-14 h-14 rounded-full border border-destructive/30 bg-destructive/10 flex items-center justify-center">
        <Lock className="w-6 h-6 text-destructive" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-base font-display">Unauthorized clinician access</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Signed in as <span className="font-mono text-foreground/80">{email ?? 'unknown'}</span>,
          but this account does not hold the clinician role.
        </p>
      </div>

      {bootstrapAvailable && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 text-start space-y-2">
          <div className="flex items-center gap-2 text-xs font-ui uppercase tracking-wider text-accent">
            <Crown className="w-3.5 h-3.5" /> Initial setup available
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            No clinician has been registered yet. As the first authenticated user, you may claim the doctor role for this workspace.
          </p>
          <Button onClick={onClaim} size="sm" className="w-full mt-1">
            <Crown className="w-3.5 h-3.5 me-2" /> Claim clinician role
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <Button variant="outline" onClick={onHome} className="w-full">
          <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" /> Return to dashboard
        </Button>
        <button
          type="button"
          disabled
          className="w-full text-xs text-muted-foreground/70 py-2 hover:text-muted-foreground cursor-not-allowed"
          title="Coming soon"
        >
          Request clinician access →
        </button>
      </div>
    </div>
  );
}

export default function DoctorLogin() {
  return (
    <AuthProvider>
      <DoctorLoginInner />
    </AuthProvider>
  );
}
