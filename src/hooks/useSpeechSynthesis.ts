import { useRef, useCallback, useEffect, useState } from 'react';

interface SpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  enabled?: boolean;
}

/**
 * Hook for Dr. Sentinel's text-to-speech with a calm, professional voice.
 * Uses Web Speech API SpeechSynthesis.
 */
export function useSpeechSynthesis({ rate = 0.9, pitch = 0.95, volume = 0.8, enabled = true }: SpeechOptions = {}) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isSpeakingTTS, setIsSpeakingTTS] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(enabled);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Pick the best calm/professional voice
  const pickVoice = useCallback(() => {
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    // Preference order: calm English voices
    const preferred = [
      'Google UK English Female',
      'Google UK English Male',
      'Microsoft Zira',
      'Samantha',
      'Karen',
      'Daniel',
      'Google US English',
      'Microsoft David',
    ];

    for (const name of preferred) {
      const match = voices.find(v => v.name.includes(name));
      if (match) return match;
    }

    // Fallback: any English voice
    const english = voices.find(v => v.lang.startsWith('en'));
    return english || voices[0];
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      voiceRef.current = pickVoice();
    };
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, [pickVoice]);

  const speak = useCallback((text: string) => {
    if (!ttsEnabled || !text.trim()) return;

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    // Clean text: remove markdown formatting
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/---/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    if (voiceRef.current) {
      utterance.voice = voiceRef.current;
    }

    utterance.onstart = () => setIsSpeakingTTS(true);
    utterance.onend = () => setIsSpeakingTTS(false);
    utterance.onerror = () => setIsSpeakingTTS(false);

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, [ttsEnabled, rate, pitch, volume]);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setIsSpeakingTTS(false);
  }, []);

  const toggle = useCallback(() => {
    if (isSpeakingTTS) {
      stop();
    }
    setTtsEnabled(prev => !prev);
  }, [isSpeakingTTS, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { speechSynthesis.cancel(); };
  }, []);

  return { speak, stop, toggle, isSpeakingTTS, ttsEnabled };
}
