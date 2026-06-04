import { useCallback, useRef } from 'react';
import { extractMemories } from '@/lib/memory/extractor';
import { upsertMemories } from '@/lib/memory/store';
import { recallForChat, RecallItem } from '@/lib/memory/recall';
import { detectMoment, persistMoment } from '@/lib/keymoments/detector';
import { assessCrisis, softeningSystemNote, CrisisLevel } from '@/lib/crisis/awareness';
import {
  ensurePersonality, evolvePersonality, personalityForSystemPrompt,
} from '@/lib/personality/state';
import { recomputeTodayPulse, loadRecentPulses } from '@/lib/presence/pulse';
import { evaluate } from '@/lib/achievements/engine';
import { listSessions } from '@/lib/sessions';
import { listMemories } from '@/lib/memory/store';
import { EmotionState } from '@/context/AppContext';

interface PreparedTurn {
  recall: RecallItem[];
  systemAddenda: string[];
  crisis: CrisisLevel;
}

/**
 * Orchestrates the per-turn engine layer:
 *  - recall memories
 *  - assess crisis
 *  - personality system note
 *  - extract & store new memories
 *  - detect & persist key moments
 * And the per-session post-processing:
 *  - recompute pulse
 *  - evolve personality
 *  - evaluate achievements
 */
export function useEmotionalEngine() {
  const prevEmotionRef = useRef<EmotionState | null>(null);

  const prepareTurn = useCallback(async (
    userId: string,
    userMessage: string,
    emotion: EmotionState,
  ): Promise<PreparedTurn> => {
    const [{ recall }, personality] = await Promise.all([
      recallForChat(userId, userMessage, emotion.primary, 6),
      ensurePersonality(userId),
    ]);
    const crisis = assessCrisis(userMessage, emotion);
    const systemAddenda: string[] = [];
    const personalityNote = personalityForSystemPrompt(personality);
    if (personalityNote) systemAddenda.push(personalityNote);
    const crisisNote = softeningSystemNote(crisis);
    if (crisisNote) systemAddenda.push(crisisNote);
    return { recall, systemAddenda, crisis };
  }, []);

  const recordTurn = useCallback(async (params: {
    userId: string;
    sessionId: string;
    messageId: string | null;
    position: number;
    text: string;
    emotion: EmotionState;
  }) => {
    const { userId, sessionId, messageId, position, text, emotion } = params;
    // Extract + persist memories (fire-and-forget per perf)
    const drafts = extractMemories(text, { emotion: emotion.primary, intensity: emotion.intensity });
    if (drafts.length) {
      upsertMemories(userId, drafts, sessionId).catch((e) => console.warn('upsertMemories', e));
    }
    // Detect key moment
    const moment = detectMoment({
      userId, sessionId, messageId, position, emotion, text,
      prevEmotion: prevEmotionRef.current,
    });
    if (moment) {
      persistMoment({ userId, sessionId, messageId, position, emotion, text, prevEmotion: prevEmotionRef.current }, moment)
        .catch((e) => console.warn('persistMoment', e));
    }
    prevEmotionRef.current = emotion;
    return { moment };
  }, []);

  const finalizeSession = useCallback(async (params: {
    userId: string;
    breakthroughDuringSession: boolean;
    longSession: boolean;
  }) => {
    const { userId, breakthroughDuringSession, longSession } = params;
    try {
      await recomputeTodayPulse(userId);
      const [pulses, allSessions, memories] = await Promise.all([
        loadRecentPulses(userId, 30),
        listSessions(userId),
        listMemories(userId, 500),
      ]);

      // consecutive-day streak
      const dates = new Set(pulses.map((p) => p.pulse_date));
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        if (dates.has(iso)) streak++; else break;
      }
      const recentAvg = pulses.slice(0, 5).reduce((a, p) => a + (p.avg_intensity ?? 0), 0)
        / Math.max(1, Math.min(5, pulses.length));
      const calmStreak = pulses.filter((p) => (p.avg_intensity ?? 1) < 0.45).length;
      const recoveryArc = pulses.length >= 3
        && (pulses[pulses.length - 1]?.avg_intensity ?? 0) - (pulses[0]?.avg_intensity ?? 0) >= 0.25;

      await Promise.all([
        evolvePersonality(userId, {
          totalSessions: allSessions.length,
          consecutiveDays: streak,
          pulses,
          recentDistress: recentAvg,
        }),
        evaluate(userId, {
          totalSessions: allSessions.length,
          totalMessages: 0,
          consecutiveDays: streak,
          hadBreakthrough: breakthroughDuringSession,
          isNightSession: new Date().getHours() >= 22 || new Date().getHours() < 5,
          recoveryArcDetected: recoveryArc,
          calmStreakDays: calmStreak,
          longSession,
          memoryCount: memories.length,
        }),
      ]);
    } catch (e) {
      console.warn('finalizeSession', e);
    }
  }, []);

  return { prepareTurn, recordTurn, finalizeSession };
}
