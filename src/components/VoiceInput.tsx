import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  onToggle?: () => void;
}

const VoiceInput = ({ onTranscript, disabled, onToggle }: VoiceInputProps) => {
  const { t, i18n } = useTranslation();
  const { flipX } = useDirection();
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    const langMap: Record<string, string> = { en: 'en-US', ar: 'ar-SA', es: 'es-ES', fr: 'fr-FR', it: 'it-IT' };
    recognition.lang = langMap[i18n.language?.split('-')[0] ?? 'en'] ?? 'en-US';

    recognition.onresult = (e: any) => {
      let final = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          final += transcript;
        } else {
          interimText += transcript;
        }
      }
      setInterim(interimText);
      if (final) {
        onTranscript(final);
        setInterim('');
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [onTranscript, i18n.language]);

  const toggle = useCallback(() => {
    if (!recognitionRef.current) return;
    onToggle?.();
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening, onToggle]);

  if (!supported) return null;

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence>
        {interim && (
          <motion.span
            initial={{ opacity: 0, x: -10 * flipX }}
            animate={{ opacity: 0.6, x: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs font-ui text-muted-foreground italic max-w-48 truncate"
          >
            {interim}
          </motion.span>
        )}
      </AnimatePresence>

      <button
        onClick={toggle}
        disabled={disabled}
        className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
          isListening
            ? 'bg-destructive/20 border border-destructive/50'
            : 'glass border border-border/50 hover:border-primary/50'
        } disabled:opacity-30`}
        title={isListening ? t('voice.stopVoiceInput') : t('voice.startVoiceInput')}
        aria-label={isListening ? t('voice.stopVoiceInput') : t('voice.startVoiceInput')}
      >
        {isListening ? (
          <>
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-destructive/40"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <div className="flex gap-0.5 items-center h-4">
              {[0, 1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  className="w-0.5 bg-destructive rounded-full"
                  animate={{ height: ['4px', '14px', '6px', '12px', '4px'] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          </>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default VoiceInput;
