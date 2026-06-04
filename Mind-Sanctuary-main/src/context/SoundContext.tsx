import { createContext, useContext, useCallback, ReactNode } from 'react';
import { clinicSound, SoundLayer } from '@/lib/clinicSoundEngine';

interface SoundContextType {
  unlock: () => void;
  isUnlocked: boolean;
  // Layers
  setLayerVolume: (layer: SoundLayer, vol: number) => void;
  getLayerVolume: (layer: SoundLayer) => number;
  // Environmental
  playDoorOpen: () => void;
  playFootsteps: (count?: number) => void;
  playCouchSit: () => void;
  // Session
  startBreathingLoop: () => void;
  stopBreathingLoop: () => void;
  startTypingAmbience: () => void;
  stopTypingAmbience: () => void;
  // UI
  playClick: () => void;
  playMicToggle: () => void;
  playSend: () => void;
  playToggle: () => void;
  playBreathingStart: () => void;
  playMessageChime: () => void;
}

const SoundContext = createContext<SoundContextType | null>(null);

export function SoundProvider({ children }: { children: ReactNode }) {
  const unlock = useCallback(() => {
    clinicSound.unlock();
  }, []);

  const value: SoundContextType = {
    unlock,
    get isUnlocked() { return clinicSound.isUnlocked; },
    setLayerVolume: (l, v) => clinicSound.setLayerVolume(l, v),
    getLayerVolume: (l) => clinicSound.getLayerVolume(l),
    playDoorOpen: () => clinicSound.playDoorOpen(),
    playFootsteps: (c) => clinicSound.playFootsteps(c),
    playCouchSit: () => clinicSound.playCouchSit(),
    startBreathingLoop: () => clinicSound.startBreathingLoop(),
    stopBreathingLoop: () => clinicSound.stopLoop('breathing'),
    startTypingAmbience: () => clinicSound.startTypingAmbience(),
    stopTypingAmbience: () => clinicSound.stopTypingAmbience(),
    playClick: () => clinicSound.playClick(),
    playMicToggle: () => clinicSound.playMicToggle(),
    playSend: () => clinicSound.playSend(),
    playToggle: () => clinicSound.playToggle(),
    playBreathingStart: () => clinicSound.playBreathingStart(),
    playMessageChime: () => clinicSound.playMessageChime(),
  };

  return (
    <SoundContext.Provider value={value}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useSound must be used within SoundProvider');
  return ctx;
}
