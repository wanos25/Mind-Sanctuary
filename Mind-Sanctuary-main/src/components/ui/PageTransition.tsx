import { ReactNode } from 'react';
import { motion } from 'framer-motion';

export default function PageTransition({ children, k }: { children: ReactNode; k?: string }) {
  return (
    <motion.div
      key={k}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}
