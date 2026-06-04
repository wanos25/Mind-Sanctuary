import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, ShieldCheck, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Premium Doctor Access entry.
 * Centered below the avatar grid, same max-width container.
 * Cinematic medical-tech feel with subtle cyan/indigo glow.
 * RTL-safe (uses logical icons + flex-row-reverse via dir).
 * Respects prefers-reduced-motion.
 */
export default function DoctorAccessCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
      className="mt-6"
    >
      <button
        onClick={() => navigate('/doctor-login')}
        className="group relative w-full overflow-hidden rounded-2xl text-start
                   border border-accent/30 bg-gradient-to-br from-background/40 via-accent/[0.06] to-primary/[0.06]
                   backdrop-blur-xl px-6 py-5 transition-all duration-500
                   hover:border-accent/60 hover:shadow-[0_0_40px_hsl(var(--accent)/0.25)]
                   focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        {/* animated glow sweep */}
        {!reduce && (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-x-10 -top-10 h-32 rotate-12 bg-gradient-to-r
                       from-transparent via-accent/15 to-transparent opacity-0
                       transition-opacity duration-700 group-hover:opacity-100"
          />
        )}

        <div className="relative flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-accent/20 blur-md opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative w-12 h-12 rounded-xl border border-accent/40
                            bg-gradient-to-br from-accent/20 to-primary/10
                            flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-accent" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-foreground tracking-wide">
                {t('login.doctorAccess.title', { defaultValue: 'Clinician Access' })}
              </h3>
              <ShieldCheck className="w-3.5 h-3.5 text-accent/80" />
            </div>
            <p className="text-xs font-ui text-muted-foreground mt-1 leading-relaxed">
              {t('login.doctorAccess.subtitle', {
                defaultValue: 'Secure portal for licensed clinicians · patient oversight, crisis review, longitudinal insights',
              })}
            </p>
          </div>

          <ArrowRight className="w-4 h-4 text-accent/70 shrink-0 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
        </div>
      </button>
    </motion.div>
  );
}
