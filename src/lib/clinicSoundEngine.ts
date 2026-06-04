/**
 * Clinic Sound Engine — Procedural synthesis for all clinic sounds.
 * Organized into layers: Ambient, Environmental, UI, Session.
 * All sounds are generated via Web Audio API — no external files.
 */

export type SoundLayer = 'ambient' | 'environmental' | 'ui' | 'session';

interface LayerConfig {
  gainNode: GainNode;
  volume: number;
}

export class ClinicSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private layers: Record<SoundLayer, LayerConfig | null> = {
    ambient: null,
    environmental: null,
    ui: null,
    session: null,
  };
  private activeLoops: Map<string, { stop: () => void }> = new Map();
  private unlocked = false;

  get isUnlocked() { return this.unlocked; }
  get audioContext() { return this.ctx; }

  /** Must be called from a user gesture */
  unlock(): AudioContext {
    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    this.masterGain = master;

    // Create layer gain nodes
    const layerNames: SoundLayer[] = ['ambient', 'environmental', 'ui', 'session'];
    const defaultVolumes: Record<SoundLayer, number> = {
      ambient: 0.3,
      environmental: 0.85,
      ui: 0.25,
      session: 0.2,
    };

    for (const name of layerNames) {
      const gain = ctx.createGain();
      gain.gain.value = defaultVolumes[name];
      gain.connect(master);
      this.layers[name] = { gainNode: gain, volume: defaultVolumes[name] };
    }

    this.unlocked = true;
    return ctx;
  }

  getLayerGain(layer: SoundLayer): GainNode | null {
    return this.layers[layer]?.gainNode ?? null;
  }

  setLayerVolume(layer: SoundLayer, vol: number) {
    const l = this.layers[layer];
    if (l) {
      l.volume = vol;
      l.gainNode.gain.value = vol;
    }
  }

  getLayerVolume(layer: SoundLayer): number {
    return this.layers[layer]?.volume ?? 0;
  }

  /** Stop a named loop */
  stopLoop(name: string) {
    this.activeLoops.get(name)?.stop();
    this.activeLoops.delete(name);
  }

  /** Register a named loop */
  registerLoop(name: string, instance: { stop: () => void }) {
    this.stopLoop(name);
    this.activeLoops.set(name, instance);
  }

  /** Stop all sounds */
  stopAll() {
    this.activeLoops.forEach(l => l.stop());
    this.activeLoops.clear();
  }

  /** Cleanup on unmount */
  destroy() {
    this.stopAll();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.unlocked = false;
  }

  // ─── NOISE BUFFERS ─────────────────────────────────────

  private noiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private brownNoiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    return buf;
  }

  // ─── ENVIRONMENTAL SOUNDS ─────────────────────────────

  /** Wooden door opening with hinge creak */
  playDoorOpen() {
    console.log("Door sound triggered");
    const ctx = this.ctx;
    const gain = this.getLayerGain('environmental');
    if (!ctx || !gain) return;

    const now = ctx.currentTime;

    // Hinge creak — frequency sweep
    const creak = ctx.createOscillator();
    creak.type = 'sawtooth';
    creak.frequency.setValueAtTime(200, now);
    creak.frequency.linearRampToValueAtTime(350, now + 0.3);
    creak.frequency.linearRampToValueAtTime(180, now + 0.8);
    creak.frequency.linearRampToValueAtTime(400, now + 1.2);
    creak.frequency.linearRampToValueAtTime(150, now + 1.8);

    const creakFilter = ctx.createBiquadFilter();
    creakFilter.type = 'bandpass';
    creakFilter.frequency.value = 300;
    creakFilter.Q.value = 8;

    const creakGain = ctx.createGain();
    creakGain.gain.setValueAtTime(0, now);
    creakGain.gain.linearRampToValueAtTime(0.15, now + 0.1);
    creakGain.gain.setValueAtTime(0.15, now + 1.5);
    creakGain.gain.linearRampToValueAtTime(0, now + 2.0);

    creak.connect(creakFilter).connect(creakGain).connect(gain);
    creak.start(now);
    creak.stop(now + 2.0);

    // Low wooden thud at end
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.value = 80;
    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0, now + 1.6);
    thudGain.gain.linearRampToValueAtTime(0.25, now + 1.65);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
    thud.connect(thudGain).connect(gain);
    thud.start(now + 1.6);
    thud.stop(now + 2.3);

    // Room ambience fade-in (brown noise very low)
    const roomNoise = ctx.createBufferSource();
    roomNoise.buffer = this.brownNoiseBuffer(4);
    roomNoise.loop = true;
    const roomLp = ctx.createBiquadFilter();
    roomLp.type = 'lowpass';
    roomLp.frequency.value = 300;
    const roomGain = ctx.createGain();
    roomGain.gain.setValueAtTime(0, now + 1.5);
    roomGain.gain.linearRampToValueAtTime(0.08, now + 3.5);

    roomNoise.connect(roomLp).connect(roomGain).connect(gain);
    roomNoise.start(now + 1.5);

    this.registerLoop('room-ambience', {
      stop: () => { try { roomNoise.stop(); } catch {} }
    });
  }

  /** Footsteps: 3-5 soft steps with echo */
  playFootsteps(count = 4) {
    console.log("Footsteps sound triggered");
    const ctx = this.ctx;
    const gain = this.getLayerGain('environmental');
    if (!ctx || !gain) return;

    const now = ctx.currentTime;
    const stepInterval = 0.55;

    for (let i = 0; i < count; i++) {
      const t = now + i * stepInterval;
      const vol = 0.35 - (i * 0.04); // decreasing volume

      // Impact thump
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 60 + Math.random() * 30;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(Math.max(0.02, vol), t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(g).connect(gain);
      osc.start(t);
      osc.stop(t + 0.15);

      // High click (shoe)
      const click = ctx.createBufferSource();
      click.buffer = this.noiseBuffer(0.05);
      const clickHp = ctx.createBiquadFilter();
      clickHp.type = 'highpass';
      clickHp.frequency.value = 3000;
      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(0, t);
      clickGain.gain.linearRampToValueAtTime(Math.max(0.01, vol * 0.5), t + 0.005);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      click.connect(clickHp).connect(clickGain).connect(gain);
      click.start(t);
      click.stop(t + 0.08);
    }
  }

  /** Couch sitting: fabric rustle + cushion compression */
  playCouchSit() {
    console.log("Couch sound triggered");
    const ctx = this.ctx;
    const gain = this.getLayerGain('environmental');
    if (!ctx || !gain) return;

    const now = ctx.currentTime;

    // Fabric rustle — filtered noise burst
    const fabric = ctx.createBufferSource();
    fabric.buffer = this.noiseBuffer(0.5);
    const fabricBp = ctx.createBiquadFilter();
    fabricBp.type = 'bandpass';
    fabricBp.frequency.value = 2000;
    fabricBp.Q.value = 1;
    const fabricGain = ctx.createGain();
    fabricGain.gain.setValueAtTime(0, now);
    fabricGain.gain.linearRampToValueAtTime(0.18, now + 0.05);
    fabricGain.gain.linearRampToValueAtTime(0.09, now + 0.2);
    fabricGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    fabric.connect(fabricBp).connect(fabricGain).connect(gain);
    fabric.start(now);
    fabric.stop(now + 0.55);

    // Cushion compression — low frequency drop
    const cushion = ctx.createOscillator();
    cushion.type = 'sine';
    cushion.frequency.setValueAtTime(120, now + 0.1);
    cushion.frequency.exponentialRampToValueAtTime(40, now + 0.6);
    const cushionGain = ctx.createGain();
    cushionGain.gain.setValueAtTime(0, now + 0.1);
    cushionGain.gain.linearRampToValueAtTime(0.22, now + 0.15);
    cushionGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    cushion.connect(cushionGain).connect(gain);
    cushion.start(now + 0.1);
    cushion.stop(now + 0.85);

    // Second fabric rustle (settling)
    const settle = ctx.createBufferSource();
    settle.buffer = this.noiseBuffer(0.3);
    const settleBp = ctx.createBiquadFilter();
    settleBp.type = 'bandpass';
    settleBp.frequency.value = 3000;
    settleBp.Q.value = 0.5;
    const settleGain = ctx.createGain();
    settleGain.gain.setValueAtTime(0, now + 0.6);
    settleGain.gain.linearRampToValueAtTime(0.1, now + 0.65);
    settleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    settle.connect(settleBp).connect(settleGain).connect(gain);
    settle.start(now + 0.6);
    settle.stop(now + 0.95);
  }

  // ─── SESSION SOUNDS ────────────────────────────────────

  /** Start a subtle breathing loop */
  startBreathingLoop() {
    console.log("Breathing loop triggered");
    const ctx = this.ctx;
    const gain = this.getLayerGain('session');
    if (!ctx || !gain) return;

    this.stopLoop('breathing');

    const noise = ctx.createBufferSource();
    noise.buffer = this.brownNoiseBuffer(8);
    noise.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.3;

    const breathGain = ctx.createGain();
    breathGain.gain.value = 0;

    // LFO for breathing rhythm (~4s inhale, ~6s exhale = ~0.1Hz)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.04; // very subtle
    lfo.connect(lfoGain);
    lfoGain.connect(breathGain.gain);

    noise.connect(bp).connect(breathGain).connect(gain);
    noise.start();
    lfo.start();

    this.registerLoop('breathing', {
      stop: () => {
        try { noise.stop(); } catch {}
        try { lfo.stop(); } catch {}
      }
    });
  }

  /** Start typing ambience — very faint keyboard-like clicks */
  startTypingAmbience() {
    const ctx = this.ctx;
    const gain = this.getLayerGain('session');
    if (!ctx || !gain) return;

    this.stopLoop('typing');

    let interval: number;
    interval = window.setInterval(() => {
      if (Math.random() > 0.6) return;
      const now = ctx.currentTime;
      const click = ctx.createBufferSource();
      click.buffer = this.noiseBuffer(0.02);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 5000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.02 + Math.random() * 0.02, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      click.connect(hp).connect(g).connect(gain);
      click.start(now);
      click.stop(now + 0.04);
    }, 80 + Math.random() * 60);

    this.registerLoop('typing', { stop: () => clearInterval(interval) });
  }

  stopTypingAmbience() {
    this.stopLoop('typing');
  }

  // ─── UI SOUNDS ─────────────────────────────────────────

  /** Soft button click */
  playClick() {
    console.log("UI click triggered");
    const ctx = this.ctx;
    const gain = this.getLayerGain('ui');
    if (!ctx || !gain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.08, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(g).connect(gain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /** Microphone toggle — slightly different pitch */
  playMicToggle() {
    const ctx = this.ctx;
    const gain = this.getLayerGain('ui');
    if (!ctx || !gain) return;

    const now = ctx.currentTime;
    // Two-tone blip
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 600;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 900;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc1.connect(g).connect(gain);
    osc2.connect(g);
    osc1.start(now);
    osc1.stop(now + 0.05);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.1);
  }

  /** Send message sound — gentle ascending tone */
  playSend() {
    const ctx = this.ctx;
    const gain = this.getLayerGain('ui');
    if (!ctx || !gain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.linearRampToValueAtTime(700, now + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g).connect(gain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /** Menu toggle — soft pop */
  playToggle() {
    const ctx = this.ctx;
    const gain = this.getLayerGain('ui');
    if (!ctx || !gain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.07, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g).connect(gain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** Breathing exercise start — warm tone */
  playBreathingStart() {
    const ctx = this.ctx;
    const gain = this.getLayerGain('ui');
    if (!ctx || !gain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(500, now + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.08, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(g).connect(gain);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  /** Gentle notification chime — two harmonious tones */
  playMessageChime() {
    const ctx = this.ctx;
    const gain = this.getLayerGain('ui');
    if (!ctx || !gain) return;

    const now = ctx.currentTime;

    // First tone — warm bell
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 523; // C5
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(0.06, now + 0.02);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(g1).connect(gain);
    osc1.start(now);
    osc1.stop(now + 0.65);

    // Second tone — gentle fifth above
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 784; // G5
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, now + 0.12);
    g2.gain.linearRampToValueAtTime(0.04, now + 0.14);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(g2).connect(gain);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.85);
  }
}

/** Singleton instance */
export const clinicSound = new ClinicSoundEngine();
