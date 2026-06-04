import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import TopNav from './TopNav';
import AnimatedBackdrop from '@/components/ui/AnimatedBackdrop';
import CustomCursor from '@/components/ui/CustomCursor';
import PageTransition from '@/components/ui/PageTransition';
import FloatingBackButton from '@/components/ui/FloatingBackButton';

interface PageShellProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

export default function PageShell({ title, subtitle, children }: PageShellProps) {
  return (
    <div className="min-h-screen particle-bg warm-vignette relative">
      <AnimatedBackdrop />
      <CustomCursor />
      <TopNav />
      <FloatingBackButton />
      <main id="main-content" tabIndex={-1} className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-8 outline-none">
        <PageTransition k={title}>
          {title && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <h1 className="text-3xl md:text-4xl font-display gold-text text-glow tracking-wider font-bold">{title}</h1>
              {subtitle && <p className="text-sm font-ui text-muted-foreground mt-2">{subtitle}</p>}
            </motion.div>
          )}
          {children}
        </PageTransition>
      </main>
    </div>
  );
}
