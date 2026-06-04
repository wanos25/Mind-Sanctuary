/**
 * Browser-native STT/TTS abstraction. Provider can be swapped later
 * (e.g. Deepgram via edge function) without touching the UI layer.
 */

export type STTHandlers = {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (msg: string) => void;
  onEnd?: () => void;
};

export interface STT {
  start: () => void;
  stop: () => void;
  available: boolean;
}

type SpeechRecognitionLike = {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SRConstructor = new () => SpeechRecognitionLike;

export function createSTT(handlers: STTHandlers, lang = 'en-US'): STT {
  const w = typeof window !== 'undefined' ? (window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor }) : undefined;
  const Ctor = w?.SpeechRecognition ?? w?.webkitSpeechRecognition;
  if (!Ctor) {
    return {
      available: false,
      start: () => handlers.onError?.('Voice recognition is not supported in this browser.'),
      stop: () => {},
    };
  }
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = lang;
  rec.onresult = (e) => {
    let interim = ''; let finalText = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const t = r[0].transcript;
      if (r.isFinal) finalText += t; else interim += t;
    }
    if (interim && handlers.onPartial) handlers.onPartial(interim);
    if (finalText) handlers.onFinal(finalText.trim());
  };
  rec.onerror = (e) => handlers.onError?.(e.error);
  rec.onend = () => handlers.onEnd?.();
  return {
    available: true,
    start: () => { try { rec.start(); } catch (e) { console.warn('STT start', e); } },
    stop: () => { try { rec.stop(); } catch { /* noop */ } },
  };
}

export interface TTS {
  speak: (text: string) => void;
  stop: () => void;
  speaking: () => boolean;
  available: boolean;
}

export function createTTS(opts: { rate?: number; pitch?: number; lang?: string } = {}): TTS {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { available: false, speak: () => {}, stop: () => {}, speaking: () => false };
  }
  return {
    available: true,
    speak: (text: string) => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = opts.rate ?? 0.95;
      u.pitch = opts.pitch ?? 0.95;
      if (opts.lang) u.lang = opts.lang;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    },
    stop: () => window.speechSynthesis.cancel(),
    speaking: () => window.speechSynthesis.speaking,
  };
}
