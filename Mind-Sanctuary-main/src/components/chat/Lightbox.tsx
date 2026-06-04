import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download } from 'lucide-react';

interface Props {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export default function Lightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [src, onClose]);

  return (
    <AnimatePresence>
      {src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-xl flex items-center justify-center p-6"
          role="dialog"
          aria-modal="true"
        >
          <motion.img
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            src={src}
            alt={alt ?? ''}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full rounded-2xl shadow-[0_20px_80px_-10px_hsl(var(--gold)/0.4)] object-contain"
          />
          <div className="absolute top-4 right-4 flex gap-2">
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="glass-strong p-2.5 rounded-xl text-foreground hover:text-primary border border-border/40 transition-colors"
              aria-label="Open in new tab"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="glass-strong p-2.5 rounded-xl text-foreground hover:text-primary border border-border/40 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
