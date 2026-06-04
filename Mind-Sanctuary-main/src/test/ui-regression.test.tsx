import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock heavy / browser-only deps before importing anything
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'r3f-canvas' }, children),
  useFrame: () => {},
}));
vi.mock('@react-three/drei', () => ({
  Float: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children),
  Sphere: () => null,
  MeshDistortMaterial: () => null,
  Stars: () => null,
  Environment: () => null,
}));
vi.mock('three', () => ({}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [] }) }) }),
        order: () => Promise.resolve({ data: [] }),
      }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ data: null }) }),
    }),
  },
}));

vi.mock('@/lib/sessions', () => ({
  listSessions: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/components/3d/TherapyRoomBackground', () => ({
  default: () => React.createElement('div', { 'data-testid': 'therapy-bg' }),
}));

vi.mock('@/components/VoiceInput', () => ({
  default: () => React.createElement('button', { 'aria-label': 'voice' }),
}));

vi.mock('@/hooks/useSpeechSynthesis', () => ({
  useSpeechSynthesis: () => ({
    speak: vi.fn(),
    stop: vi.fn(),
    toggle: vi.fn(),
    isSpeakingTTS: false,
    ttsEnabled: false,
  }),
}));

vi.mock('@/lib/streamChat', () => ({ streamChat: vi.fn() }));
vi.mock('@/lib/emotionEngine', () => ({
  analyzeEmotion: () => ({ primary: 'calm', intensity: 0.2, distortions: [], sentiment: 0 }),
  generateRecommendations: () => [],
  detectCrisis: () => false,
}));

import '@/lib/i18n';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider, useApp, AppStage } from '@/context/AppContext';
import { ThemeProvider } from '@/context/ThemeContext';
import Dashboard from '@/components/Dashboard';
import SessionChat from '@/components/SessionChat';
import FloatingBackButton from '@/components/ui/FloatingBackButton';

vi.mock('@/context/AuthContext', async () => {
  const React = await import('react');
  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useAuth: () => ({ user: null, loading: false, authReady: true, signOut: vi.fn() }),
  };
});

vi.mock('@/context/SoundContext', async () => {
  const React = await import('react');
  const noop = () => {};
  return {
    SoundProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useSound: () => ({
      playClick: noop, playSend: noop, playMessageChime: noop,
      playBreathingStart: noop, playMicToggle: noop,
    }),
  };
});

function StageHarness({ stage, children }: { stage: AppStage; children: React.ReactNode }) {
  const { stage: current, setStage } = useApp();
  React.useLayoutEffect(() => { setStage(stage); }, [stage, setStage]);
  // Defer rendering children until the requested stage is active so
  // stage-dependent components (e.g. FloatingBackButton's AnimatePresence)
  // never mount under the wrong stage and then linger via exit animations.
  if (current !== stage) return null;
  return React.createElement(React.Fragment, null, children);
}

const wrap = (stage: AppStage, ui: React.ReactNode) =>
  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(
          AppProvider,
          null,
          React.createElement(StageHarness, { stage, children: ui }),
        ),
      ),
    ),
  );

beforeEach(() => {
  vi.clearAllMocks();
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('Dashboard regression', () => {
  it('renders Hero, Timeline and Analytics sections', () => {
    wrap('dashboard', React.createElement(Dashboard));
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-section')).toBeInTheDocument();
    expect(screen.getByTestId('analytics-section')).toBeInTheDocument();
  });
});

describe('SessionChat regression', () => {
  it('mounts ChatSidebar and ChatInput', () => {
    wrap('session', React.createElement(SessionChat));
    expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });
});

describe('FloatingBackButton visibility', () => {
  const stages: { stage: AppStage; visible: boolean }[] = [
    { stage: 'dashboard', visible: false },
    { stage: 'login', visible: false },
    { stage: 'entry', visible: false },
    { stage: 'session', visible: true },
    { stage: 'insights', visible: true },
    { stage: 'history', visible: true },
    { stage: 'settings', visible: true },
    { stage: 'profile', visible: true },
    { stage: 'emergency', visible: true },
  ];

  for (const { stage, visible } of stages) {
    it(`${visible ? 'shows' : 'hides'} on stage=${stage}`, () => {
      wrap(stage, React.createElement(FloatingBackButton));
      const btn = screen.queryByTestId('floating-back-button');
      if (visible) expect(btn).toBeInTheDocument();
      else expect(btn).not.toBeInTheDocument();
    });
  }
});
