import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface EmotionState {
  primary: string;
  intensity: number;
  distortions: string[];
  sentiment: number;
}

export interface UserProfile {
  avatar: string;
  identityMode: 'anonymous' | 'real';
  nickname?: string;
  email?: string;
  age?: string;
  gender?: string;
  nicknameReason?: string;
  interviewAnswers: Record<string, string>;
  aiTone?: 'friendly' | 'analytical' | 'clinical';
}

export type AppStage =
  | 'login'
  | 'entry'
  | 'interview'
  | 'session'
  | 'dashboard'
  | 'insights'
  | 'history'
  | 'profile'
  | 'settings'
  | 'notes'
  | 'emergency';

interface AppContextType {
  stage: AppStage;
  setStage: (s: AppStage) => void;
  profile: UserProfile | null;
  setProfile: (p: UserProfile | null) => void;
  updateProfile: (partial: Partial<UserProfile>) => void;
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  currentChatId: string | null;
  setCurrentChatId: (id: string | null) => void;
  currentEmotion: EmotionState | null;
  setCurrentEmotion: (e: EmotionState | null) => void;
  loadExistingSession: boolean;
  setLoadExistingSession: (b: boolean) => void;
  // Cinematic ClinicEntry replay gate. ClinicEntry consumes & clears it.
  cinematicPending: boolean;
  setCinematicPending: (b: boolean) => void;
  startNewSession: () => void;
  openExistingSession: (sessionId: string) => void;
  /** Open a specific chat inside a session — direct, no cinematic. */
  openExistingChat: (sessionId: string, chatId: string) => void;
  /** Create a fresh chat inside the current/given session — direct, no cinematic. */
  startNewChatInSession: (sessionId?: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const SESSION_KEY = 'mind-sentinel.currentSessionId';
const CHAT_KEY = 'mind-sentinel.currentChatId';
const STAGE_KEY = 'mind-sentinel.lastStage';

const PERSISTED_STAGES: AppStage[] = ['session', 'dashboard', 'insights', 'history', 'profile', 'settings', 'notes'];

export function AppProvider({ children }: { children: ReactNode }) {
  const [stage, setStageRaw] = useState<AppStage>(() => {
    try {
      const saved = localStorage.getItem(STAGE_KEY) as AppStage | null;
      if (saved && PERSISTED_STAGES.includes(saved)) return saved;
    } catch { /* ignore */ }
    return 'login';
  });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentSessionId, setCurrentSessionIdRaw] = useState<string | null>(() => {
    try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
  });
  const [currentChatId, setCurrentChatIdRaw] = useState<string | null>(() => {
    try { return localStorage.getItem(CHAT_KEY); } catch { return null; }
  });
  const [currentEmotion, setCurrentEmotion] = useState<EmotionState | null>(null);
  const [loadExistingSession, setLoadExistingSession] = useState(() => {
    try { return !!localStorage.getItem(SESSION_KEY); } catch { return false; }
  });
  const [cinematicPending, setCinematicPending] = useState(false);

  const setStage = (s: AppStage) => {
    setStageRaw(s);
    try {
      if (PERSISTED_STAGES.includes(s)) localStorage.setItem(STAGE_KEY, s);
      else localStorage.removeItem(STAGE_KEY);
    } catch { /* ignore */ }
  };

  const setCurrentSessionId = (id: string | null) => {
    setCurrentSessionIdRaw(id);
    try {
      if (id) localStorage.setItem(SESSION_KEY, id);
      else localStorage.removeItem(SESSION_KEY);
    } catch { /* ignore */ }
  };

  const setCurrentChatId = (id: string | null) => {
    setCurrentChatIdRaw(id);
    try {
      if (id) localStorage.setItem(CHAT_KEY, id);
      else localStorage.removeItem(CHAT_KEY);
    } catch { /* ignore */ }
  };

  const updateProfile = (partial: Partial<UserProfile>) => {
    setProfile(prev => prev ? { ...prev, ...partial } : null);
  };

  const startNewSession = () => {
    setCurrentSessionId(null);
    setCurrentChatId(null);
    setLoadExistingSession(false);
    setCinematicPending(true);
    setStage('entry');
  };

  const openExistingSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setCurrentChatId(null); // re-derived in chat init (latest chat for session)
    setLoadExistingSession(true);
    setCinematicPending(false);
    setStage('session');
  };

  const openExistingChat = (sessionId: string, chatId: string) => {
    setCurrentSessionId(sessionId);
    setCurrentChatId(chatId);
    setLoadExistingSession(true);
    setCinematicPending(false);
    setStage('session');
  };

  const startNewChatInSession = (sessionId?: string) => {
    const sid = sessionId ?? currentSessionId;
    if (!sid) {
      // No session to attach to → fall back to full new session (cinematic).
      startNewSession();
      return;
    }
    setCurrentSessionId(sid);
    setCurrentChatId(null); // SessionChat init detects this and creates a fresh chat
    setLoadExistingSession(false);
    setCinematicPending(false);
    setStage('session');
  };

  // Tab-sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY) setCurrentSessionIdRaw(e.newValue);
      if (e.key === CHAT_KEY) setCurrentChatIdRaw(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <AppContext.Provider value={{
      stage, setStage, profile, setProfile, updateProfile,
      currentSessionId, setCurrentSessionId,
      currentChatId, setCurrentChatId,
      currentEmotion, setCurrentEmotion,
      loadExistingSession, setLoadExistingSession,
      cinematicPending, setCinematicPending,
      startNewSession, openExistingSession,
      openExistingChat, startNewChatInSession,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
