import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, BarChart3, Wind, LayoutDashboard, ArrowDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp, EmotionState } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { analyzeEmotion, generateRecommendations, detectCrisis } from '@/lib/emotionEngine';
import { streamChat, ChatMsg } from '@/lib/streamChat';
import { createPacedDelta } from '@/lib/pacedStream';
import { setPresenceMode, setWarmth } from '@/lib/presence/aiPresence';
import EmotionalAtmosphere from '@/components/ui/EmotionalAtmosphere';
import { toast } from 'sonner';

import BreathingExercise from '@/components/BreathingExercise';
import MoodTracker from '@/components/MoodTracker';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatInput from '@/components/chat/ChatInput';
import MessageBubble from '@/components/chat/MessageBubble';
import TypingIndicator from '@/components/chat/TypingIndicator';
import FirstArrivalPresence from '@/components/chat/FirstArrivalPresence';
import SessionClosureOverlay from '@/components/chat/SessionClosureOverlay';
import { whisper } from '@/lib/feedback/whisper';
import VoiceStatusTimeline from '@/components/voice/VoiceStatusTimeline';
import type { ReplyTarget } from '@/components/chat/ReplyPreview';
import { parseVoiceContent } from '@/lib/voice/upload';
import { useSound } from '@/context/SoundContext';
import { loadDraft, saveDraft, loadScroll, useSessionScrollMemory } from '@/lib/sessionMemory';
import { useEmotionalEngine } from '@/hooks/useEmotionalEngine';
import { encodeVoiceContent, encodeReflection } from '@/lib/voice/upload';
import { sendUserVoice, generateAssistantVoice, persistVoiceMeta } from '@/lib/voice/pipeline';
import { ensureLatestChatForSession, createChat } from '@/lib/chats';
import { emitVoiceEvent } from '@/lib/voice/telemetry';
import { shouldReflect, fetchReflection } from '@/lib/reflection';
import type { VoiceRecording } from '@/lib/voice/recorder';
import { buildReplyContextAddendum, mergeReplyAddendum } from '@/lib/replyContext';
import SessionNotesInline from '@/components/notes/SessionNotesInline';
import { trackProductEvent } from '@/lib/observability/productTelemetry';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  emotion?: EmotionState;
  ts: number;
  replyToId?: string | null;
}

interface MemoryItem {
  topic: string;
  emotion_pattern?: string;
  context?: string;
}

function emotionToMood(emotion: EmotionState | null): { opacity: number } {
  if (!emotion) return { opacity: 0.3 };
  const p = emotion.primary.toLowerCase();
  if (p.includes('anxiety') || p.includes('stress')) return { opacity: 0.2 };
  if (p.includes('sadness') || p.includes('depress')) return { opacity: 0.35 };
  return { opacity: 0.3 };
}

function extractTopics(messages: DisplayMessage[]): string[] {
  const userMsgs = messages.filter((m) => m.role === 'user').map((m) => m.content.toLowerCase());
  const topicKeywords = [
    'work', 'family', 'relationship', 'sleep', 'anxiety', 'stress', 'school',
    'money', 'health', 'loneliness', 'grief', 'anger', 'fear', 'trauma',
    'self-esteem', 'motivation', 'career', 'friends',
  ];
  const found = new Set<string>();
  for (const msg of userMsgs) {
    for (const kw of topicKeywords) if (msg.includes(kw)) found.add(kw);
  }
  return Array.from(found).slice(0, 5);
}

const REFLECTION_PROMPT_KEYS = [
  'chat.reflectionPrompts.p1',
  'chat.reflectionPrompts.p2',
  'chat.reflectionPrompts.p3',
  'chat.reflectionPrompts.p4',
] as const;

const SessionChat = () => {
  const { t, i18n } = useTranslation();
  const sound = useSound();
  const {
    setStage, profile, currentSessionId, setCurrentSessionId,
    currentChatId, setCurrentChatId,
    currentEmotion, setCurrentEmotion, loadExistingSession, setLoadExistingSession,
  } = useApp();
  const { user } = useAuth();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [showCrisis, setShowCrisis] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [showBreathing, setShowBreathing] = useState(false);
  const [breathingCount, setBreathingCount] = useState(0);
  const [sessionStart] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [emotionLog, setEmotionLog] = useState<EmotionState[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [panelTab, setPanelTab] = useState<'insights' | 'mood'>('insights');
  const engine = useEmotionalEngine();
  const breakthroughRef = useRef(false);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [replayId, setReplayId] = useState<string | null>(null);
  const [voicePipelineActive, setVoicePipelineActive] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const reflectionSentRef = useRef(false);
  const restoredScrollRef = useRef<string | null>(null);

  // ---- Long-session windowing (lightweight virtualization) ----
  // Render only the last `windowSize` messages once the history exceeds
  // VIRT_THRESHOLD. Older messages are revealed in batches via "Load older"
  // with scroll-anchor preservation. Streaming only mutates the last bubble,
  // so the visible window is unaffected by stream updates.
  const VIRT_THRESHOLD = 120;
  const WINDOW_INITIAL = 80;
  const WINDOW_STEP = 80;
  const [windowSize, setWindowSize] = useState(WINDOW_INITIAL);
  // Reset window when switching sessions OR chats.
  useEffect(() => { setWindowSize(WINDOW_INITIAL); }, [currentSessionId, currentChatId]);
  const scrollCommitsRef = useRef(0);
  const lastFrameTsRef = useRef(0);
  const fpsEstRef = useRef(0);

  // Per-chat persistence key (falls back to session id for legacy drafts).
  const persistKey = currentChatId ?? currentSessionId;

  // Per-chat draft persistence (falls back to session-scoped draft once).
  useEffect(() => {
    const own = loadDraft(persistKey);
    if (own) { setInput(own); return; }
    if (persistKey !== currentSessionId) setInput(loadDraft(currentSessionId));
    else setInput('');
  }, [persistKey, currentSessionId]);
  useEffect(() => {
    const t = setTimeout(() => saveDraft(persistKey, input), 250);
    return () => clearTimeout(t);
  }, [input, persistKey]);

  // Per-chat scroll memory
  useSessionScrollMemory(persistKey, scrollRef);

  // Session timer
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Date.now() - sessionStart), 1000);
    return () => clearInterval(iv);
  }, [sessionStart]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  // Load memories
  useEffect(() => {
    const loadMemories = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('session_memories')
        .select('topic, emotion_pattern, context')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data && data.length > 0) setMemories(data);
    };
    loadMemories();
  }, [user]);

  // Init session/chat — chat-aware (Layer 2). Re-runs when session or chat id
  // changes (e.g. sidebar selects a different chat). Guard prevents StrictMode
  // double-creation by remembering the last-handled key.
  const lastInitKeyRef = useRef<string | null>(null);
  const reflectionTimerRef = useRef<number | null>(null);
  const activeStreamAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    activeStreamAbortRef.current?.abort();
    if (reflectionTimerRef.current) {
      window.clearTimeout(reflectionTimerRef.current);
      reflectionTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    activeStreamAbortRef.current?.abort();
    activeStreamAbortRef.current = null;
  }, [currentSessionId, currentChatId]);
  useEffect(() => {
    let cancelled = false;
    const initSession = async () => {
      if (!user || cancelled) return;
      const key = `${currentSessionId ?? ''}::${currentChatId ?? ''}::${loadExistingSession ? '1' : '0'}`;
      if (lastInitKeyRef.current === key) return;
      lastInitKeyRef.current = key;

      const loadMessagesFor = async (chatId: string, sessionIdForFallback: string) => {
        // Primary: query by chat_id (post-migration source of truth).
        const byChat = await (supabase
          .from('chat_messages') as unknown as { select: (c: string) => { eq: (k: string, v: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: Array<{ id: string; role: string; content: string; created_at: string; reply_to_message_id: string | null }> | null }> } } })
          .select('id, role, content, created_at, reply_to_message_id')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });
        let msgs = byChat.data ?? [];
        // Legacy fallback: if no chat-scoped rows and only one chat exists in
        // this session, surface any session-scoped legacy rows (null chat_id).
        if (msgs.length === 0) {
          const legacy = await (supabase
            .from('chat_messages') as unknown as { select: (c: string) => { eq: (k: string, v: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: Array<{ id: string; role: string; content: string; created_at: string; reply_to_message_id: string | null }> | null }> } } })
            .select('id, role, content, created_at, reply_to_message_id')
            .eq('session_id', sessionIdForFallback)
            .order('created_at', { ascending: true });
          msgs = legacy.data ?? [];
        }
        if (msgs.length === 0) {
          if (cancelled) return;
          // Empty chat → show greeting so the surface doesn't feel dead.
          showGreeting();
          return;
        }
        if (cancelled) return;
        const display: DisplayMessage[] = msgs.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          ts: new Date(m.created_at).getTime(),
          replyToId: m.reply_to_message_id ?? null,
        }));
        if (cancelled) return;
        setMessages(display);
        setChatHistory(
          msgs
            .filter((m) => !m.content.startsWith('\u0001REFLECT\u0001') && !(m.role === 'assistant' && m.content.includes('\u0001VOICE\u0001')))
            .map((m) => {
              const c = m.content.split('\u0001VOICE\u0001')[0] || '[Voice message]';
              return { role: m.role as 'user' | 'assistant', content: c };
            }),
        );
        const scrollKey = chatId;
        if (restoredScrollRef.current !== scrollKey) {
          restoredScrollRef.current = scrollKey;
          const top = loadScroll(scrollKey);
          requestAnimationFrame(() => {
            if (scrollRef.current && top > 0) {
              scrollRef.current.scrollTop = top;
              userScrolledRef.current = true;
            }
          });
        }
      };

      const showGreeting = () => {
        const hasMemories = memories.length > 0;
        const nameSuffix = profile?.nickname ? `, ${profile.nickname}` : '';
        const greeting: DisplayMessage = {
          id: 'greeting',
          role: 'assistant',
          ts: Date.now(),
          content: hasMemories
            ? t('chat.greeting.welcomeBack', { name: nameSuffix })
            : t('chat.greeting.first', { name: nameSuffix }),
        };
        setMessages([greeting]);
        setChatHistory([]);
      };

      // Case A: opening an existing session/chat.
      if (loadExistingSession && currentSessionId) {
        let chatId = currentChatId;
        if (!chatId) {
          chatId = await ensureLatestChatForSession(currentSessionId, user.id);
          if (chatId) setCurrentChatId(chatId);
        }
        if (chatId) await loadMessagesFor(chatId, currentSessionId);
        setLoadExistingSession(false);
        return;
      }

      // Case B: new chat inside an existing session (no cinematic path).
      if (currentSessionId && !currentChatId && !loadExistingSession) {
        const newChatId = await createChat(currentSessionId, user.id, null);
        if (newChatId) setCurrentChatId(newChatId);
        showGreeting();
        return;
      }

      // Case C: brand-new session (post-cinematic). Create session + first chat.
      if (!currentSessionId) {
        const { data } = await supabase
          .from('sessions')
          .insert({ user_id: user.id })
          .select('id')
          .single();
        if (data) {
          setCurrentSessionId(data.id);
          const chatId = await ensureLatestChatForSession(data.id, user.id);
          if (chatId) setCurrentChatId(chatId);
        }
        showGreeting();
        return;
      }
    };
    initSession();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, memories.length, currentSessionId, currentChatId, loadExistingSession]);

  // Smart auto-scroll: never yank users away if they scrolled up
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [unread, setUnread] = useState(0);
  const lastScrolledUpRef = useRef(false);
  const unreadShownRef = useRef(false);
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    scrollCommitsRef.current += 1;
    const now = performance.now();
    if (lastFrameTsRef.current) {
      const dt = now - lastFrameTsRef.current;
      if (dt > 0) fpsEstRef.current = Math.round(1000 / dt);
    }
    lastFrameTsRef.current = now;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const scrolledUp = dist > 120;
    if (scrolledUp && !lastScrolledUpRef.current && streamingId) {
      emitVoiceEvent('auto_scroll_interrupted', { sessionId: currentSessionId ?? undefined, messageId: streamingId });
    }

    lastScrolledUpRef.current = scrolledUp;
    userScrolledRef.current = scrolledUp;
    setShowScrollDown(dist > 240);
    if (!scrolledUp) setUnread(0);
  }, [streamingId, currentSessionId]);

  const lastAssistantContent = messages[messages.length - 1]?.role === 'assistant'
    ? messages[messages.length - 1]?.content : '';

  useEffect(() => {
    if (!userScrolledRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (lastAssistantContent) {
      setUnread((u) => {
        const next = u + 1;
        if (!unreadShownRef.current) {
          unreadShownRef.current = true;
          emitVoiceEvent('unread_marker_shown', { sessionId: currentSessionId ?? undefined });
        }
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, lastAssistantContent]);

  const jumpToBottom = useCallback(() => {
    userScrolledRef.current = false;
    setUnread(0);
    unreadShownRef.current = false;
    emitVoiceEvent('jump_to_latest_used', { sessionId: currentSessionId ?? undefined });
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSessionId]);

  // Scroll-anchor preservation for "Load older": when windowSize grows,
  // restore scrollTop so the previously-visible content stays in place.
  const pendingAnchorRef = useRef<number | null>(null);
  const loadOlder = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    pendingAnchorRef.current = el.scrollHeight - el.scrollTop;
    setWindowSize((w) => w + WINDOW_STEP);
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    const anchor = pendingAnchorRef.current;
    if (!el || anchor == null) return;
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight - anchor;
      pendingAnchorRef.current = null;
    });
  }, [windowSize]);


  useEffect(() => {
    const mins = elapsed / 60000;
    if (mins > 8 && messages.length > 6 && !reflectionSentRef.current && !isThinking) {
      reflectionSentRef.current = true;
      const promptKey = REFLECTION_PROMPT_KEYS[Math.floor(Math.random() * REFLECTION_PROMPT_KEYS.length)];
      toast(t(promptKey), {
        duration: 8000,
        action: { label: `🫁 ${t('chat.breatheAction')}`, onClick: () => setShowBreathing(true) },
      });
    }
  }, [elapsed, messages.length, isThinking]);

  const saveMessage = async (
    role: 'user' | 'assistant',
    content: string,
    sessionId: string,
    replyToId?: string | null,
  ) => {
    if (!user) return null;
    const payload: Record<string, unknown> = {
      session_id: sessionId, user_id: user.id, role, content,
    };
    if (replyToId) payload.reply_to_message_id = replyToId;
    if (currentChatId) payload.chat_id = currentChatId;
    const { data } = await (supabase
      .from('chat_messages') as unknown as { insert: (v: unknown) => { select: (c: string) => { single: () => Promise<{ data: { id: string } | null }> } } })
      .insert(payload)
      .select('id')
      .single();
    console.log('[voice] message insertion', { role, id: data?.id ?? null, hasVoice: content.includes('\u0001VOICE\u0001'), replyTo: replyToId ?? null, chatId: currentChatId });
    return data?.id ?? null;
  };

  const saveEmotionAnalysis = async (
    messageId: string, sessionId: string, emotion: EmotionState,
  ) => {
    if (!user) return;
    await supabase.from('emotion_analyses').insert([{
      message_id: messageId, session_id: sessionId, user_id: user.id,
      primary_emotion: emotion.primary, intensity: emotion.intensity,
      sentiment: emotion.sentiment, distortions: emotion.distortions,
    }]);
  };

  // Save session memories on unmount
  useEffect(() => {
    return () => {
      if (!user || !currentSessionId || messages.length < 3) return;
      const topics = extractTopics(messages);
      const dominantEmotion = emotionLog.length > 0
        ? emotionLog.reduce((a, b) => (a.intensity > b.intensity ? a : b)).primary
        : undefined;
      for (const topic of topics) {
        supabase.from('session_memories').insert({
          user_id: user.id,
          session_id: currentSessionId,
          topic,
          emotion_pattern: dominantEmotion,
          context: `Discussed during session on ${new Date().toLocaleDateString()}`,
        });
      }
      // Engine post-processing — pulse, personality, achievements.
      engine.finalizeSession({
        userId: user.id,
        breakthroughDuringSession: breakthroughRef.current,
        longSession: messages.length >= 14,
      });
    };
  }, [user, currentSessionId, messages, emotionLog, engine]);

  const sendMessage = useCallback(
    async (
      overrideInput?: string,
      voice?: { url: string; path?: string; duration: number; waveform: number[]; persist?: import('@/lib/voice/pipeline').VoiceMetaPayload },
    ) => {
      const text = overrideInput ?? input;
      // Voice with empty transcript still allowed; otherwise need text
      if (!voice && !text.trim()) return;
      if (isThinking || !currentSessionId) return;

      userScrolledRef.current = false;
      const transcript = (text || '').trim();
      // Content for AI / memory uses the transcript only; storage adds voice metadata
      const userContentForAI = transcript || '[Voice message]';
      const userContentForStore = voice
        ? encodeVoiceContent({ url: voice.url, path: voice.path, duration: voice.duration, waveform: voice.waveform, transcript })
        : transcript;
      const userMsg: DisplayMessage = {
        id: `u-${Date.now()}`, role: 'user', content: userContentForStore, ts: Date.now(),
        replyToId: replyTo?.id ?? null,
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsThinking(true);

      const msgId = await saveMessage('user', userContentForStore, currentSessionId, replyTo?.id ?? null);
      // Persist normalized voice meta onto the just-inserted user row.
      // Schema-adapter no-ops cleanly if columns are not yet migrated.
      if (msgId && voice?.persist) {
        persistVoiceMeta(msgId, voice.persist).catch(() => { /* telemetry handles it */ });
      }
      // Clear reply target now that it's persisted on the row.
      if (replyTo) setReplyTo(null);

      if (detectCrisis(userContentForAI)) {
        setShowCrisis(true);
        setIsThinking(false);
        return;
      }

      const emotion = analyzeEmotion(userContentForAI);
      setCurrentEmotion(emotion);
      setEmotionLog((prev) => [...prev, emotion]);

      if (msgId) await saveEmotionAnalysis(msgId, currentSessionId, emotion);


      await supabase
        .from('sessions')
        .update({ summary_emotion: emotion.primary, summary_intensity: emotion.intensity })
        .eq('id', currentSessionId);

      // ── Engine layer: prepare turn (recall + personality + crisis addenda) and
      //    record memories + key moments. Runs in parallel with AI streaming.
      let preparedAddenda: string[] = [];
      let preparedRecall: typeof memories = memories;
      if (user) {
        try {
          const prepared = await engine.prepareTurn(user.id, userContentForAI, emotion);
          preparedAddenda = prepared.systemAddenda;
          preparedRecall = prepared.recall as typeof memories;
        } catch (e) { console.warn('prepareTurn', e); }
        // record after prepare so the just-said message is included for next turn
        engine.recordTurn({
          userId: user.id,
          sessionId: currentSessionId,
          messageId: msgId,
          position: messages.length,
          text: userContentForAI,
          emotion,
        }).then(({ moment }) => {
          if (moment?.moment_type === 'breakthrough') breakthroughRef.current = true;
        }).catch(() => {});
      }

      // ── Reply-aware context injection (deterministic, sanitized, depth=1) ──
      // When the user replied to a prior message, surface a single bounded
      // [REPLIED MESSAGE] block to the model via systemAddenda. We never push
      // the quoted text into the chat history itself (preserves cadence,
      // memory extraction, reflection triggers).
      const repliedToId = userMsg.replyToId;
      if (repliedToId) {
        const parent = messages.find((m) => m.id === repliedToId);
        if (parent && (parent.role === 'user' || parent.role === 'assistant')) {
          const addendum = buildReplyContextAddendum({ role: parent.role, content: parent.content });
          preparedAddenda = mergeReplyAddendum(preparedAddenda, addendum);
        }
      }

      const newHistory: ChatMsg[] = [...chatHistory, { role: 'user', content: userContentForAI }];
      setChatHistory(newHistory);

      const assistantId = `a-${Date.now()}`;
      let fullResponse = '';
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', emotion, ts: Date.now() },
      ]);
      setStreamingId(assistantId);
      setIsSpeaking(true);
      // Presence: assistant is composing a reply (thinking) → speaking once tokens arrive.
      setPresenceMode('thinking');
      // Warmth modulates orb glow softly from current emotional intensity.
      if (emotion?.intensity != null) setWarmth(Math.min(1, 0.55 + emotion.intensity * 0.35));
      const streamStartedAt = performance.now();
      let firstTokenAt = 0;
      emitVoiceEvent('stream_started', { sessionId: currentSessionId ?? undefined, messageId: assistantId });

      // Tiny humanizing pause before the assistant starts replying. Calmer pause
      // for higher emotional intensity, snappier for neutral exchanges.
      const leadMs = 240 + Math.round((emotion?.intensity ?? 0.2) * 280);
      await new Promise((r) => setTimeout(r, leadMs));

      // Paced presentation layer — variable cadence + punctuation pauses
      // for a more human-feeling stream. Backend logic untouched.
      // H2: rAF-batched setMessages — coalesce per-character paced releases
      // into one React commit per frame to eliminate render thrash on long
      // assistant replies. Final content is reconciled in onDone.
      let rafScheduled = false;
      let streamCancelled = false;
      const flushFrame = () => {
        rafScheduled = false;
        if (streamCancelled) return;
        const snapshot = fullResponse;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: snapshot } : m)),
        );
      };
      const paced = createPacedDelta((piece) => {
        if (!firstTokenAt) {
          firstTokenAt = performance.now();
          // First token rendered → presence shifts from thinking to speaking.
          setPresenceMode('speaking');
          emitVoiceEvent('first_token_rendered', {
            sessionId: currentSessionId ?? undefined,
            messageId: assistantId,
            durationMs: Math.round(firstTokenAt - streamStartedAt),
          });
        }
        fullResponse += piece;
        if (!rafScheduled && typeof requestAnimationFrame !== 'undefined') {
          rafScheduled = true;
          requestAnimationFrame(flushFrame);
        } else if (typeof requestAnimationFrame === 'undefined') {
          flushFrame();
        }
      }, {
        // Emotional pacing: slow down for higher intensity, lift sentence pauses.
        baseCharMs: 14 + Math.round((emotion?.intensity ?? 0.3) * 6),
        sentencePauseMs: 160 + Math.round((emotion?.intensity ?? 0.3) * 120),
      });

      try {
        activeStreamAbortRef.current?.abort();
        const streamAbort = new AbortController();
        activeStreamAbortRef.current = streamAbort;

        await streamChat({
          messages: newHistory,
          interviewContext: profile?.interviewAnswers,
          emotionState: emotion,
          memories: preparedRecall,
          systemAddenda: preparedAddenda,
          userProfile: profile ? {
            gender: profile.gender,
            nickname: profile.nickname,
            preferredLanguage: (i18n.language || 'en').split('-')[0],
          } : undefined,
          signal: streamAbort.signal,
          onDelta: (chunk) => paced.push(chunk),
          onDone: async () => {
            if (streamAbort.signal.aborted) return;
            await paced.flush();
            // H2: ensure the final, complete content is committed in case the
            // last rAF tick coalesced behind the flush.
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: fullResponse } : m)),
            );
            emitVoiceEvent('stream_completed', {
              sessionId: currentSessionId ?? undefined,
              messageId: assistantId,
              durationMs: Math.round(performance.now() - streamStartedAt),
              meta: { chars: fullResponse.length },
            });
            trackProductEvent('chat.stream_completed', { chars: fullResponse.length });
            setIsThinking(false);
            setIsSpeaking(false);
            setStreamingId(null);
            // Presence settles back to idle after a tiny grace period so the orb
            // doesn't snap-cut immediately on completion.
            setTimeout(() => setPresenceMode('idle'), 600);
            setChatHistory((prev) => [
              ...prev, { role: 'assistant', content: fullResponse },
            ]);
            sound.playMessageChime();
            const assistantRowId = await saveMessage('assistant', fullResponse, currentSessionId);

            // ── AI Voice Reply: pipeline-orchestrated TTS ──
            if (user) {
              const runTts = async (placeholderId: string) => {
                try {
                  const result = await generateAssistantVoice({
                    text: fullResponse,
                    lang: (i18n.language || 'en').split('-')[0],
                    emotion: emotion?.primary,
                    gender: profile?.gender,
                    userId: user.id,
                    sessionId: currentSessionId,
                    messageId: assistantRowId ?? undefined,
                  });
                  const stored = encodeVoiceContent({
                    url: result.url,
                    path: result.storagePath,
                    duration: result.durationSec,
                    waveform: result.waveform,
                    transcript: result.reply.paraphrase,
                  });
                  setMessages((prev) => prev.map((m) => (m.id === placeholderId ? { ...m, content: stored } : m)));
                  if (assistantRowId) await persistVoiceMeta(assistantRowId, result.persist);
                } catch (e) {
                  emitVoiceEvent('tts_failed', { sessionId: currentSessionId, errorCode: (e as Error).message?.slice(0, 120) });
                  // Don't leave a stuck/dead pending bubble — remove placeholder
                  // and surface a retry toast that re-runs the TTS pipeline.
                  setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
                  toast.error(t('chat.toasts.ttsFailedToast', { defaultValue: 'Voice reply unavailable' }), {
                    action: {
                      label: t('common.retry', { defaultValue: 'Retry' }),
                      onClick: () => {
                        const retryId = `av-${Date.now()}-r`;
                        setMessages((prev) => [
                          ...prev,
                          {
                            id: retryId,
                            role: 'assistant',
                            content: encodeVoiceContent({
                              transcript: t('chat.voiceGenerating'),
                              duration: 0,
                              waveform: new Array(48).fill(0.35),
                              pending: true,
                            }),
                            ts: Date.now(),
                          },
                        ]);
                        void runTts(retryId);
                      },
                    },
                  });
                }
              };
              (async () => {
                const placeholderId = `av-${Date.now()}`;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: placeholderId,
                    role: 'assistant',
                    content: encodeVoiceContent({
                      transcript: t('chat.voiceGenerating'),
                      duration: 0,
                      waveform: new Array(48).fill(0.35),
                      pending: true,
                    }),
                    ts: Date.now(),
                  },
                ]);
                await runTts(placeholderId);
              })();
            }


            // ── Reflection layer: emotionally-meaningful follow-up bubble ──
            const decision = shouldReflect(userContentForAI, emotion);
            if (decision.trigger && fullResponse.length > 40) {
              const delay = 800 + Math.random() * 700;
              if (reflectionTimerRef.current) window.clearTimeout(reflectionTimerRef.current);
              reflectionTimerRef.current = window.setTimeout(async () => {
                reflectionTimerRef.current = null;
                const reflection = await fetchReflection({
                  userMessage: userContentForAI,
                  assistantMessage: fullResponse,
                  emotion,
                });
                if (!reflection) return;
                const id = `r-${Date.now()}`;
                setMessages((prev) => [
                  ...prev,
                  { id, role: 'assistant', content: encodeReflection(reflection), ts: Date.now() },
                ]);
                await saveMessage('assistant', encodeReflection(reflection), currentSessionId);
              }, delay);
            }
          },
          onError: (errMsg) => {
            if (streamAbort.signal.aborted) {
              trackProductEvent('chat.stream_aborted');
              return;
            }
            streamCancelled = true;
            paced.cancel();
            setIsThinking(false);
            setIsSpeaking(false);
            setStreamingId(null);
            setPresenceMode('idle');
            toast.error(errMsg);
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          },
        });
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') {
          trackProductEvent('chat.stream_aborted');
          return;
        }
        streamCancelled = true;
        paced.cancel();
        setIsThinking(false);
        setIsSpeaking(false);
        setStreamingId(null);
        setPresenceMode('idle');
        toast.error(t('chat.toasts.aiConnectFail'));
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, isThinking, currentSessionId, chatHistory, profile, memories],
  );

  const handleVoiceTranscript = useCallback(
    (text: string) => sendMessage(text),
    [sendMessage],
  );

  const handleVoiceMessage = useCallback(
    async (rec: VoiceRecording, transcript: string) => {
      if (!user || !currentSessionId) return;
      const lang = i18n.language || 'en';
      emitVoiceEvent('recording_started', { sessionId: currentSessionId, lang, bytes: rec.blob.size });
      // ── Optimistic bubble: render immediately with local blob URL so the user
      // sees their voice message before upload/STT finish. Replaced atomically
      // when sendUserVoice resolves. On failure, we surface a retry toast and
      // remove only the optimistic bubble (never leave a stuck/dead row).
      const localUrl = URL.createObjectURL(rec.blob);
      const optimisticId = `uv-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: optimisticId,
          role: 'user',
          content: encodeVoiceContent({
            url: localUrl,
            duration: rec.duration,
            waveform: rec.waveform,
            transcript: transcript || t('chat.voiceUploading', { defaultValue: 'Sending voice…' }),
            pending: true,
          }),
          ts: Date.now(),
        },
      ]);

      const attempt = async (): Promise<void> => {
        try {
          const result = await sendUserVoice({
            blob: rec.blob,
            duration: rec.duration,
            waveform: rec.waveform,
            userId: user.id,
            sessionId: currentSessionId,
            lang,
            clientTranscript: transcript,
          });
          // Remove the optimistic bubble — sendMessage re-inserts the real row.
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          try { URL.revokeObjectURL(localUrl); } catch { /* */ }
          await sendMessage(result.transcript, {
            url: result.upload.url,
            path: result.upload.path,
            duration: result.durationSec,
            waveform: result.waveform,
            persist: result.persist,
          });
        } catch (e) {
          emitVoiceEvent('upload_failed', { sessionId: currentSessionId, errorCode: (e as Error).message?.slice(0, 120) });
          // Keep the optimistic bubble visible (with local blob) so the audio
          // is never lost. Mark non-pending so playback works. Offer retry.
          setMessages((prev) => prev.map((m) => m.id === optimisticId ? {
            ...m,
            content: encodeVoiceContent({
              url: localUrl,
              duration: rec.duration,
              waveform: rec.waveform,
              transcript: transcript || '',
              pending: false,
            }),
          } : m));
          toast.error(t('chat.toasts.uploadFailedToast'), {
            action: {
              label: t('common.retry', { defaultValue: 'Retry' }),
              onClick: () => {
                // Re-mark pending and retry.
                setMessages((prev) => prev.map((m) => m.id === optimisticId ? {
                  ...m,
                  content: encodeVoiceContent({
                    url: localUrl,
                    duration: rec.duration,
                    waveform: rec.waveform,
                    transcript: transcript || t('chat.voiceUploading', { defaultValue: 'Sending voice…' }),
                    pending: true,
                  }),
                } : m));
                void attempt();
              },
            },
          });
        }
      };
      void attempt();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, currentSessionId, i18n.language, sendMessage],
  );

  const onNewChat = () => {
    setMessages([]);
    setChatHistory([]);
    setCurrentEmotion(null);
    sound.playClick();
  };

  // Delete user message (and its AI reply if present); soft-delete from UI + chatHistory.
  const handleDeleteMessage = useCallback((id: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      // also drop the immediately following assistant reply if any
      if (next[idx + 1]?.role === 'assistant') next.splice(idx, 2);
      else next.splice(idx, 1);
      return next;
    });
    setChatHistory((prev) => {
      // best-effort: drop the last user/assistant pair matching content
      const target = messages.find((m) => m.id === id);
      if (!target) return prev;
      const i = prev.findIndex((m) => m.role === 'user' && m.content === target.content);
      if (i < 0) return prev;
      const next = [...prev];
      if (next[i + 1]?.role === 'assistant') next.splice(i, 2);
      else next.splice(i, 1);
      return next;
    });
  }, [messages]);

  // Regenerate: drop last assistant, re-send the previous user content.
  const handleRegenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser || isThinking) return;
    setMessages((prev) => {
      const idx = prev.map((m) => m.role).lastIndexOf('assistant');
      if (idx < 0) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
    setChatHistory((prev) => {
      const idx = prev.map((m) => m.role).lastIndexOf('assistant');
      if (idx < 0) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
    setTimeout(() => sendMessage(lastUser.content), 0);
  }, [messages, isThinking, sendMessage]);

  const messageActions = useMemo(() => ({
    onRegenerate: handleRegenerate,
    onDelete: handleDeleteMessage,
  }), [handleRegenerate, handleDeleteMessage]);

  const mood = emotionToMood(currentEmotion);
  const lastMsg = messages[messages.length - 1];
  const showTyping =
    isThinking && (!lastMsg || lastMsg.role === 'user' || lastMsg.content === '');
  // The very-first AI reply of the session gets a richer "arrival" presence.
  const hasRepliedBefore = useMemo(
    () => messages.some((m) => m.role === 'assistant' && m.id !== 'greeting' && m.content.trim().length > 0),
    [messages],
  );
  const showFirstArrival = showTyping && !hasRepliedBefore;

  // ── Session cooldown ritual ──
  // Trigger the closure overlay after meaningful inactivity in a non-trivial
  // session. Strictly additive: only fires if the user has exchanged at least
  // a few turns and has been quiet for several minutes. Fires at most once.
  const [showClosure, setShowClosure] = useState(false);
  const closureFiredRef = useRef(false);
  useEffect(() => {
    if (closureFiredRef.current) return;
    if (isThinking || streamingId) return;
    if (messages.length < 6) return;
    const lastTs = messages[messages.length - 1]?.ts ?? 0;
    const INACTIVITY_MS = 6 * 60 * 1000;
    const tick = () => {
      if (closureFiredRef.current) return;
      if (Date.now() - lastTs >= INACTIVITY_MS) {
        closureFiredRef.current = true;
        setShowClosure(true);
        whisper(t('session.closure.toast', { defaultValue: 'A gentle pause — well done for showing up.' }), {
          key: 'session-cooldown',
          cooldownMs: 30 * 60 * 1000,
        });
      }
    };
    const iv = setInterval(tick, 30_000);
    return () => clearInterval(iv);
  }, [messages, isThinking, streamingId, t]);

  const closureSummary = useMemo(() => {
    if (emotionLog.length < 2) return undefined;
    const first = emotionLog[0].primary;
    const last = emotionLog[emotionLog.length - 1].primary;
    if (first === last) return undefined;
    return t('session.closure.summaryMoved', {
      defaultValue: `You moved from ${first} toward ${last}.`,
      from: first,
      to: last,
    });
  }, [emotionLog, t]);

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background">
      <EmotionalAtmosphere emotion={currentEmotion} streaming={!!streamingId} />
      <AnimatePresence>
        {showBreathing && (
          <BreathingExercise
            onClose={() => {
              setShowBreathing(false);
              setBreathingCount((c) => c + 1);
            }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <ChatSidebar onNewChat={onNewChat} />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Sticky header */}
        <header className="glass-strong border-b border-border/40 px-4 md:px-6 py-3 flex items-center justify-between z-20 sticky top-0">
          <div className="flex items-center gap-3 ms-12 md:ms-0 min-w-0">
            <h1 className="text-sm md:text-base font-display gold-text tracking-widest font-bold truncate">
              {t('brand.title')}
            </h1>
            <span className="text-[10px] font-ui text-muted-foreground hidden sm:inline">
              {formatTime(elapsed)}
            </span>
            {currentEmotion && (
              <span className="hidden md:inline px-2.5 py-0.5 rounded-full text-[10px] font-ui capitalize bg-primary/15 text-primary border border-primary/30">
                {currentEmotion.primary}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { sound.playBreathingStart(); setShowBreathing(true); }}
              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
              title={t('chat.breathingExercise')}
              aria-label={t('chat.breathingExercise')}
            >
              <Wind className="w-4 h-4" />
            </button>
            <button
              onClick={() => { sound.playClick(); setPanelTab('insights'); setShowPanel(!showPanel); }}
              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
              title={t('chat.insightsPanel')}
              aria-label={t('chat.insightsPanel')}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => { sound.playClick(); setStage('dashboard'); }}
              className="hidden sm:inline-flex items-center text-xs px-3 py-1.5 rounded-md border border-border/60 text-foreground hover:bg-secondary/60 transition-colors font-ui"
              title={t('chat.backToDashboard')}
              aria-label={t('chat.backToDashboard')}
            >
              <LayoutDashboard className="w-3.5 h-3.5 me-1.5" />
              {t('chat.backToDashboard')}
            </button>
          </div>
        </header>

        {/* Crisis banner */}
        <AnimatePresence>
          {currentEmotion &&
            currentEmotion.intensity >= 0.85 &&
            /despair|suicidal|panic|severe|crisis|hopeless/i.test(currentEmotion.primary) && (
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="bg-destructive/15 border-b border-destructive/30 px-6 py-3 flex items-center justify-between gap-3"
              >
                <motion.div
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <p className="text-xs font-ui text-destructive">{t('chat.highDistress')}</p>
                </motion.div>
                <button
                  onClick={() => setStage('emergency')}
                  className="text-xs font-ui px-3 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
                >
                  {t('chat.talkToSpecialist')} →
                </button>
              </motion.div>
            )}
        </AnimatePresence>

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overscroll-contain relative scroll-smooth [scroll-padding-bottom:6rem]"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {/* Soft ambient vignette + emotion-tinted glow that pulses while streaming */}
          <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_100%)]">
            <motion.div
              className="absolute inset-0"
              animate={{ opacity: streamingId ? [0.18, 0.35, 0.18] : mood.opacity }}
              transition={streamingId
                ? { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 1.2 }}
              style={{ background: 'radial-gradient(ellipse at 50% 30%, hsl(var(--gold) / 0.18), transparent 60%)' }}
            />
          </div>

          <div
            className="max-w-3xl mx-auto w-full px-4 md:px-6 py-8 relative"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-busy={!!streamingId}
          >
            <SessionNotesInline
              chatId={currentChatId}
              sessionId={currentSessionId}
              userId={user?.id ?? null}
            />
            {/* Windowed slice: only render the last `windowSize` messages once
                the conversation grows past VIRT_THRESHOLD. Streaming only
                touches the last bubble, so the window is stable during streams. */}
            {(() => {
              const total = messages.length;
              const virtActive = total > VIRT_THRESHOLD;
              const visibleCount = virtActive ? Math.min(windowSize, total) : total;
              const startIdx = total - visibleCount;
              const visible = visibleCount === total ? messages : messages.slice(startIdx);
              const hiddenOlder = total - visibleCount;
              return (
                <>
                  {hiddenOlder > 0 && (
                    <div className="flex justify-center mb-4">
                      <button
                        type="button"
                        onClick={loadOlder}
                        className="text-[11px] font-ui uppercase tracking-[0.2em] px-3 py-1.5 rounded-full glass border border-primary/30 text-primary/85 hover:border-primary/60 hover:text-primary transition-colors"
                        aria-label={t('chat.loadOlder', { defaultValue: 'Load older messages' })}
                      >
                        {t('chat.loadOlder', { defaultValue: 'Load older' })} · {hiddenOlder}
                      </button>
                    </div>
                  )}
                  <AnimatePresence initial={false}>
                    {visible.map((msg, vIdx) => {
                      const idx = startIdx + vIdx;
                      const prev = messages[idx - 1];
                      const next = messages[idx + 1];
                      const GROUP_WINDOW_MS = 90_000;
                      const groupedWithPrev = !!prev && prev.role === msg.role && !msg.replyToId && (msg.ts - prev.ts) < GROUP_WINDOW_MS;
                      const groupedWithNext = !!next && next.role === msg.role && !next.replyToId && (next.ts - msg.ts) < GROUP_WINDOW_MS;
                      const isVoiceMsg = msg.content.includes('\u0001VOICE\u0001');
                      const handleReply = () => {
                        const parsed = parseVoiceContent(msg.content);
                        const preview = (parsed.text || msg.content).replace(/\s+/g, ' ').trim().slice(0, 140);
                        setReplyTo({ id: msg.id, role: msg.role, preview, isVoice: !!parsed.voice });
                      };
                      const handleReplay = () => {
                        setReplayId(msg.id);
                        setTimeout(() => setReplayId(null), 50);
                      };
                      const parentMsg = msg.replyToId ? messages.find((m) => m.id === msg.replyToId) : null;
                      const parent = parentMsg
                        ? (() => {
                            const parsed = parseVoiceContent(parentMsg.content);
                            const preview = (parsed.text || parentMsg.content).replace(/\s+/g, ' ').trim().slice(0, 140);
                            return { id: parentMsg.id, role: parentMsg.role, preview, isVoice: !!parsed.voice };
                          })()
                        : null;
                      const jumpToParent = (pid: string) => {
                        const el = document.querySelector(`[data-message-id="${pid}"]`);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          emitVoiceEvent('reply_navigate', { messageId: pid, sessionId: currentSessionId ?? undefined });
                        } else if (hiddenOlder > 0) {
                          // Parent is outside the current window — expand and retry.
                          loadOlder();
                        }
                      };
                      return (
                        <div key={msg.id} className={groupedWithPrev ? 'mt-1' : 'mt-6 first:mt-0'}>
                          <MessageBubble
                            id={msg.id}
                            sessionId={currentSessionId ?? undefined}
                            role={msg.role}
                            content={msg.content}
                            emotion={msg.emotion}
                            timestamp={msg.ts}
                            streaming={msg.id === streamingId}
                            groupedWithPrev={groupedWithPrev}
                            groupedWithNext={groupedWithNext}
                            onRegenerate={msg.role === 'assistant' ? messageActions.onRegenerate : undefined}
                            onDelete={msg.role === 'user' ? () => messageActions.onDelete(msg.id) : undefined}
                            onReply={handleReply}
                            onReplay={isVoiceMsg ? handleReplay : undefined}
                            autoplayVoice={msg.id === replayId}
                            parent={parent}
                            onJumpToParent={jumpToParent}
                          />
                        </div>
                      );
                    })}
                  </AnimatePresence>
                  {import.meta.env.DEV && virtActive && (
                    <div className="pointer-events-none fixed bottom-2 right-2 z-50 text-[10px] font-mono px-2 py-1 rounded bg-background/80 border border-border/60 text-muted-foreground">
                      virt: {startIdx}–{total} / {total} · scrolls {scrollCommitsRef.current} · ~{fpsEstRef.current}fps
                    </div>
                  )}
                </>
              );
            })()}
            {showFirstArrival ? <FirstArrivalPresence /> : showTyping && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Floating scroll-to-bottom + unread pill */}
          <AnimatePresence>
            {(showScrollDown || unread > 0) && (
              <motion.button
                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                onClick={jumpToBottom}
                className={`absolute bottom-28 left-1/2 -translate-x-1/2 z-10 glass-strong border rounded-full shadow-[0_4px_24px_-4px_hsl(var(--gold)/0.5)] transition-colors flex items-center gap-2 ${
                  unread > 0
                    ? 'border-primary/50 text-primary px-3.5 py-2 pr-4'
                    : 'border-primary/30 text-primary p-2.5 hover:bg-primary/15'
                }`}
                aria-label={t('chat.scrollToBottom')}
              >
                <ArrowDown className="w-4 h-4" />
                {unread > 0 && (
                  <span className="text-[11px] font-ui">{unread} {unread === 1 ? t('chat.newMessage') : t('chat.newMessages')}</span>
                )}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Voice pipeline timeline (telemetry-driven) */}
        <VoiceStatusTimeline
          active={voicePipelineActive || isThinking}
          thinking={isThinking}
          onDismiss={() => setVoicePipelineActive(false)}
        />

        {/* Input */}
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => { sound.playSend(); sendMessage(); }}
          onAttach={() => toast(t('chat.uploadComing'))}
          onVoice={handleVoiceTranscript}
          onVoiceMessage={(rec, transcript) => { setVoicePipelineActive(true); handleVoiceMessage(rec, transcript); }}
          onMicToggle={() => { sound.playMicToggle(); setPresenceMode('listening'); }}
          disabled={isThinking}
          placeholder={t('chat.placeholder')}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          onJumpToReply={(id) => {
            const el = document.querySelector(`[data-message-id="${id}"]`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              emitVoiceEvent('reply_navigate', { messageId: id, sessionId: currentSessionId ?? undefined });
            }
          }}
        />
      </div>

      {/* Side panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.aside
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="hidden lg:flex flex-col w-80 glass-strong border-s border-border/30 p-6 overflow-y-auto"
          >
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setPanelTab('insights')}
                className={`flex-1 text-xs font-ui py-2 rounded-lg transition-colors ${
                  panelTab === 'insights'
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-secondary/40'
                }`}
              >
                {t('chat.insightsPanel')}
              </button>
              <button
                onClick={() => setPanelTab('mood')}
                className={`flex-1 text-xs font-ui py-2 rounded-lg transition-colors ${
                  panelTab === 'mood'
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-secondary/40'
                }`}
              >
                {t('chat.moodPanel')}
              </button>
            </div>
            {panelTab === 'mood' ? (
              <MoodTracker
                emotionLog={emotionLog}
                elapsed={elapsed}
                breathingUsed={breathingCount}
              />
            ) : currentEmotion ? (
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-ui tracking-[0.2em] text-muted-foreground uppercase mb-1">
                    {t('chat.currentState')}
                  </p>
                  <p className="font-display text-primary capitalize text-lg">
                    {currentEmotion.primary}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-ui tracking-[0.2em] text-muted-foreground uppercase mb-1.5">
                    {t('chat.intensity')}
                  </p>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'var(--gradient-gold)' }}
                      animate={{ width: `${currentEmotion.intensity * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-ui text-muted-foreground mt-1 text-end">
                    {Math.round(currentEmotion.intensity * 100)}%
                  </p>
                </div>
                {currentEmotion.distortions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-ui tracking-[0.2em] text-muted-foreground uppercase mb-2">
                      {t('chat.patterns')}
                    </p>
                    <div className="space-y-1.5">
                      {currentEmotion.distortions.map((d) => (
                        <div
                          key={d}
                          className="flex items-center gap-2 text-xs font-ui text-foreground/80 capitalize"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          {d}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-ui tracking-[0.2em] text-muted-foreground uppercase mb-2">
                    {t('chat.recommendations')}
                  </p>
                  <div className="space-y-2">
                    {generateRecommendations(currentEmotion).slice(0, 3).map((rec, i) => (
                      <div key={i} className="glass rounded-lg p-3 text-xs font-ui text-foreground/80">
                        {rec}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs font-ui text-muted-foreground">
                {t('chat.startAnalysis')}
              </p>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Crisis modal */}
      <AnimatePresence>
        {showCrisis && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="glass-strong rounded-2xl p-8 max-w-md mx-4 border border-destructive/30"
            >
              <div className="text-center">
                <span className="text-4xl block mb-4">🆘</span>
                <h3 className="font-display text-destructive text-xl mb-3">Crisis Support</h3>
                <p className="font-body text-foreground text-sm mb-4">
                  I care about your safety. If you're in immediate danger, please reach out to these resources:
                </p>
                <div className="space-y-2 mb-6">
                  <div className="glass rounded-lg p-3 text-sm font-ui">
                    <span className="text-primary font-semibold">988 Suicide & Crisis Lifeline</span>
                    <p className="text-muted-foreground">Call or text 988</p>
                  </div>
                  <div className="glass rounded-lg p-3 text-sm font-ui">
                    <span className="text-primary font-semibold">Crisis Text Line</span>
                    <p className="text-muted-foreground">Text HOME to 741741</p>
                  </div>
                </div>
                <button onClick={() => setShowCrisis(false)} className="sentinel-btn w-full">
                  I understand, continue session
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session cooldown ritual — gentle, opt-in dismissal */}
      <SessionClosureOverlay
        open={showClosure}
        summary={closureSummary}
        onClose={() => setShowClosure(false)}
      />
    </div>
  );
};

export default SessionChat;
