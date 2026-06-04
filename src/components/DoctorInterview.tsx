import { useState, useRef, useEffect, forwardRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { streamChat, ChatMsg } from '@/lib/streamChat';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { useSound } from '@/context/SoundContext';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatInput from '@/components/chat/ChatInput';
import { LayoutDashboard, Volume2, VolumeX } from 'lucide-react';

interface ChatBubble {
  id: string;
  role: 'therapist' | 'user';
  content: string;
}

// Default fallback strings (used only if i18n unavailable). Real copy is read from t().
const INTRO_MESSAGE_FALLBACK = "Hello, I'm Dr. Sentinel.";
const FIRST_QUESTION_FALLBACK = "Let's start gently. How have you been feeling emotionally over the past few weeks?";

const INTERVIEW_SYSTEM_PROMPT = `You are Dr. Sentinel conducting an initial therapy intake assessment. You are warm, empathetic, and professional.

Your goal: Gather context about the user's emotional state, concerns, sleep, stress, coping mechanisms, and therapy goals through natural conversation.

Rules:
- Ask ONE follow-up question at a time based on what the user just shared
- Be empathetic and validate their feelings before asking the next question
- Keep responses to 1-2 short paragraphs max
- Cover these topics naturally over the conversation: emotional state, what brought them here, stress/overwhelm, sleep quality, anxiety, coping mechanisms, and their chosen nickname
- Do NOT list questions or use bullet points
- Sound like a real therapist, not a survey
- After you've gathered enough context (roughly 5-7 exchanges), close with a warm message that includes the exact phrase "Let's begin." at the end — this signals the assessment is complete
- Never mention you are an AI`;

const MAX_EXCHANGES = 8;

const DoctorInterview = forwardRef<HTMLDivElement>((_, ref) => {
  const { t } = useTranslation();
  const INTRO_MESSAGE = t('interview.intro', { defaultValue: INTRO_MESSAGE_FALLBACK });
  const FIRST_QUESTION = t('interview.firstQuestion', { defaultValue: FIRST_QUESTION_FALLBACK });
  const { setStage, updateProfile, profile } = useApp();
  const { user } = useAuth();
  const sound = useSound();
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [exchangeCount, setExchangeCount] = useState(0);
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef('');
  const couchPlayedRef = useRef(false);
  const { speak, stop: stopTTS, toggle: toggleTTS, isSpeakingTTS, ttsEnabled } = useSpeechSynthesis({ rate: 0.88, pitch: 0.92 });

  // Skip interview if already completed
  useEffect(() => {
    if (profile && Object.keys(profile.interviewAnswers ?? {}).length > 0) {
      setStage('session');
    }
  }, [profile, setStage]);


  // Play couch sit sound + breathing loop on mount, then show intro
  useEffect(() => {
    // Couch sit on entry
    if (!couchPlayedRef.current) {
      console.log("Interview started - triggering couch sound");
      couchPlayedRef.current = true;
      sound.playCouchSit();
      setTimeout(() => {
        console.log("Starting breathing loop");
        sound.startBreathingLoop();
      }, 1500);
    }

    setIsTyping(true);
    setIsSpeaking(true);
    const t1 = setTimeout(() => {
      setBubbles([{ id: 'intro', role: 'therapist', content: INTRO_MESSAGE }]);
      speak(INTRO_MESSAGE);
      setIsTyping(false);
      setIsSpeaking(false);

      setTimeout(() => {
        setIsTyping(true);
        setIsSpeaking(true);
        setTimeout(() => {
          setBubbles(prev => [...prev, { id: 'q1', role: 'therapist', content: FIRST_QUESTION }]);
          setChatHistory([
            { role: 'assistant', content: INTRO_MESSAGE },
            { role: 'assistant', content: FIRST_QUESTION },
          ]);
          speak(FIRST_QUESTION);
          setIsTyping(false);
          setIsSpeaking(false);
        }, 1500);
      }, 800);
    }, 2000);
    return () => clearTimeout(t1);
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles, isTyping]);

  const submitAnswer = useCallback(async (overrideText?: string) => {
    const text = overrideText ?? input;
    if (!text.trim() || isTyping || isComplete) return;

    const userContent = text.trim();
    const userBubbleId = `user-${Date.now()}`;

    // Add user bubble
    setBubbles(prev => [...prev, { id: userBubbleId, role: 'user', content: userContent }]);
    setInput('');

    const newExchangeCount = exchangeCount + 1;
    setExchangeCount(newExchangeCount);

    // Build chat history for AI
    const newHistory: ChatMsg[] = [...chatHistory, { role: 'user', content: userContent }];
    setChatHistory(newHistory);

    // Build messages for the edge function
    const systemMsg: ChatMsg = { role: 'user', content: '' }; // placeholder, system prompt is injected server-side
    const messagesForAI: ChatMsg[] = newHistory;

    // If we've had enough exchanges, hint the AI to wrap up
    let extraContext = '';
    if (newExchangeCount >= MAX_EXCHANGES - 1) {
      extraContext = '\n\n[System note: You have gathered enough context. Please wrap up the assessment warmly and end with "Let\'s begin."]';
    }

    // Show typing indicator
    setIsTyping(true);
    setIsSpeaking(true);
    streamingRef.current = '';

    const therapistBubbleId = `therapist-${Date.now()}`;

    await streamChat({
      messages: [
        // We inject the interview system prompt via interviewContext
        ...messagesForAI,
        ...(extraContext ? [{ role: 'user' as const, content: extraContext }] : []),
      ],
      interviewContext: { _mode: 'interview', _systemOverride: INTERVIEW_SYSTEM_PROMPT },
      onDelta: (delta) => {
        streamingRef.current += delta;
        const currentContent = streamingRef.current;
        setBubbles(prev => {
          const existing = prev.find(b => b.id === therapistBubbleId);
          if (existing) {
            return prev.map(b => b.id === therapistBubbleId ? { ...b, content: currentContent } : b);
          }
          return [...prev, { id: therapistBubbleId, role: 'therapist', content: currentContent }];
        });
      },
      onDone: () => {
        const finalContent = streamingRef.current;
        setIsTyping(false);
        setIsSpeaking(false);
        setChatHistory(prev => [...prev, { role: 'assistant', content: finalContent }]);
        sound.playMessageChime();
        speak(finalContent);

        // Check if assessment is complete
        if (finalContent.includes("Let's begin") || finalContent.includes("Let's begin.") || newExchangeCount >= MAX_EXCHANGES) {
          setIsComplete(true);

          // Save answers and transition
          const answers: Record<string, string> = {};
          newHistory.filter(m => m.role === 'user').forEach((m, i) => {
            answers[`response_${i + 1}`] = m.content;
          });

          if (user) {
            supabase.from('profiles').update({
              interview_answers: answers,
            }).eq('user_id', user.id).then(() => {});
          }
          updateProfile({ interviewAnswers: answers });

          setTimeout(() => setStage('session'), 3000);
        }
      },
      onError: (msg) => {
        setIsTyping(false);
        setIsSpeaking(false);
        setBubbles(prev => [...prev, {
          id: therapistBubbleId,
          role: 'therapist',
          content: t('interview.fallback'),
        }]);
      },
    });
  }, [input, isTyping, isComplete, exchangeCount, chatHistory, user, updateProfile, setStage, t]);

  const handleVoiceTranscript = useCallback((text: string) => {
    submitAnswer(text);
  }, [submitAnswer]);

  const progress = Math.min((exchangeCount / (MAX_EXCHANGES - 1)) * 100, 100);

  return (
    <div ref={ref} className="h-screen w-full flex overflow-hidden bg-background">
      {/* Left sidebar */}
      <ChatSidebar onNewChat={() => { /* no-op during intake */ }} />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Sticky header */}
        <header className="glass-strong border-b border-border/40 px-4 md:px-6 py-3 flex items-center justify-between z-20 sticky top-0">
          <div className="flex items-center gap-3 ms-12 md:ms-0 min-w-0">
            <h1 className="text-sm md:text-base font-display gold-text tracking-widest font-bold truncate">
              MIND SENTINEL
            </h1>
            <span className="text-[10px] font-ui text-muted-foreground tracking-[0.2em] uppercase hidden sm:inline">
              {t('doctor.initialAssessment')}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTTS}
              className={`p-2 rounded-lg transition-colors ${
                ttsEnabled ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary/50'
              }`}
              title={ttsEnabled ? t('interview.disableVoice') : t('interview.enableVoice')}
              aria-label={t('doctor.toggleVoice')}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs font-ui text-muted-foreground">
              <span>{t('doctor.progress', { percent: Math.round(progress) })}</span>
              <div className="w-20 h-1 bg-secondary rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ background: 'var(--gradient-gold)' }} animate={{ width: `${progress}%` }} />
              </div>
            </div>
            <button
              onClick={() => setStage('dashboard')}
              className="hidden sm:inline-flex items-center text-xs px-3 py-1.5 rounded-md border border-border/60 text-foreground hover:bg-secondary/60 transition-colors font-ui"
              title={t('doctor.backToDashboard')}
            >
              <LayoutDashboard className="w-3.5 h-3.5 me-1.5" />
              {t('doctor.backToDashboard')}
            </button>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto w-full px-4 md:px-6 py-8 space-y-6">
            <AnimatePresence>
              {bubbles.map(bubble => (
                <motion.div
                  key={bubble.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className={`flex ${bubble.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="max-w-[80%]">
                    {bubble.role === 'therapist' && (
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-sm gold-glow">🧠</div>
                        <span className="text-xs font-ui text-muted-foreground">{t('doctor.drSentinel')}</span>
                      </div>
                    )}
                    <div className={`rounded-2xl px-5 py-3.5 ${
                      bubble.role === 'user'
                        ? 'bg-primary/15 border border-primary/25 text-foreground'
                        : 'glass border-s-2 border-s-primary/40 text-foreground'
                    }`}>
                      <p className="text-sm font-body leading-relaxed whitespace-pre-wrap">{bubble.content}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isTyping && !bubbles.some(b => b.id.startsWith('therapist-') && b.content && bubbles.indexOf(b) === bubbles.length - 1) && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-sm">🧠</div>
                <div className="glass rounded-2xl px-4 py-3 flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-primary/60"
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Sticky bottom input */}
        {!isComplete && (
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={() => { sound.playSend(); submitAnswer(); }}
            onAttach={() => { /* placeholder for future upload */ }}
            onVoice={handleVoiceTranscript}
            onMicToggle={() => sound.playMicToggle()}
            disabled={isTyping}
            placeholder={t('interview.placeholder')}
          />
        )}

        {isComplete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 text-center border-t border-border/30">
            <p className="text-xs font-ui text-muted-foreground animate-pulse">{t('interview.starting')}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
});

DoctorInterview.displayName = 'DoctorInterview';

export default DoctorInterview;
