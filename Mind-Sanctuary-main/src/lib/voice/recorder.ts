// Lightweight MediaRecorder wrapper that also captures a downsampled waveform
// (peak amplitudes per frame) for both the recording UI and the saved bubble.
import { emitVoiceEvent } from './telemetry';

export interface VoiceRecording {
  blob: Blob;
  mime: string;
  duration: number;     // seconds
  waveform: number[];   // 0..1 peaks, ~40-80 samples
}

export interface RecorderHandle {
  stop: () => Promise<VoiceRecording | null>;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
  pauseCount: () => number;
  getLevel: () => number;             // 0..1, current loudness
  getLiveWave: () => number[];        // rolling 36 samples for UI
  duration: () => number;             // seconds (excluding paused time)
}

const PEAK_BUCKETS = 60;

export async function startRecording(): Promise<RecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });

  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  // 1000ms timeslice — bounded memory growth + safe finalize for long recordings.
  rec.start(1000);

  // analyser for live + final waveform
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  src.connect(analyser);
  const buf = new Uint8Array(analyser.fftSize);
  const peaks: number[] = [];     // for final waveform (continuous)
  const live: number[] = new Array(36).fill(0.05);
  let level = 0;
  let raf = 0;
  const startedAt = performance.now();
  let pausedAt = 0;            // when current pause started
  let pausedAccum = 0;         // total paused ms
  let pauseCountN = 0;
  let paused = false;

  const elapsedSec = () => {
    const now = performance.now();
    const live = paused ? (now - (now - pausedAt)) : 0; // noop placeholder
    void live;
    const pausedNow = paused ? (performance.now() - pausedAt) : 0;
    return (now - startedAt - pausedAccum - pausedNow) / 1000;
  };

  const tick = () => {
    if (!paused) {
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i] - 128) / 128;
        if (v > peak) peak = v;
      }
      level = peak;
      peaks.push(peak);
      live.push(peak);
      if (live.length > 36) live.shift();
    } else {
      level = 0;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const cleanup = () => {
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
    detachLifecycle();
  };

  // ── Real-device hardening: visibility / pagehide / device change ──
  let detached = false;
  let interruptedByLifecycle = false;
  const onVisibility = () => {
    if (document.visibilityState === 'hidden' && rec.state === 'recording') {
      interruptedByLifecycle = true;
      emitVoiceEvent('recording_interrupted', { meta: { reason: 'visibility' } });
      try { rec.pause(); } catch { /* */ }
      paused = true;
      pausedAt = performance.now();
    }
  };
  const onPageHide = () => {
    if (rec.state !== 'inactive') {
      emitVoiceEvent('recording_interrupted', { meta: { reason: 'pagehide' } });
      try { rec.stop(); } catch { /* */ }
    }
  };
  const onDeviceChange = () => {
    emitVoiceEvent('mic_device_changed');
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  try { navigator.mediaDevices.addEventListener?.('devicechange', onDeviceChange); } catch { /* */ }
  function detachLifecycle() {
    if (detached) return;
    detached = true;
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    try { navigator.mediaDevices.removeEventListener?.('devicechange', onDeviceChange); } catch { /* */ }
  }
  void interruptedByLifecycle; // reserved for future surfacing

  return {
    duration: elapsedSec,
    getLevel: () => level,
    getLiveWave: () => live.slice(),
    pause: () => {
      if (paused) return;
      try { rec.pause(); } catch { /* */ }
      paused = true;
      pausedAt = performance.now();
      pauseCountN += 1;
    },
    resume: () => {
      if (!paused) return;
      try { rec.resume(); } catch { /* */ }
      pausedAccum += performance.now() - pausedAt;
      paused = false;
    },
    isPaused: () => paused,
    pauseCount: () => pauseCountN,
    cancel: () => {
      try { rec.stop(); } catch { /* noop */ }
      cleanup();
    },
    stop: () =>
      new Promise<VoiceRecording | null>((resolve) => {
        if (paused) {
          try { rec.resume(); } catch { /* */ }
          pausedAccum += performance.now() - pausedAt;
          paused = false;
        }
        const dur = elapsedSec();
        let settled = false;
        const finalize = () => {
          if (settled) return;
          settled = true;
          cleanup();
          if (chunks.length === 0) { resolve(null); return; }
          const blob = new Blob(chunks, { type: mime || chunks[0].type || 'audio/webm' });
          resolve({
            blob,
            mime: blob.type,
            duration: Math.max(0.3, dur),
            waveform: downsample(peaks, PEAK_BUCKETS),
          });
        };
        // Safety: some browsers (Safari/iOS) occasionally fail to fire onstop
        // after a clean stop(). Force-finalize after a short grace window so
        // the pipeline never hangs waiting for the blob.
        const safety = window.setTimeout(finalize, 1500);
        rec.onstop = () => { clearTimeout(safety); finalize(); };

        // Flush any buffered data BEFORE stop() so the final dataavailable
        // is guaranteed to land in `chunks` (fixes truncation regression on
        // some Chromium/iOS builds that drop the trailing chunk).
        try {
          if (rec.state === 'recording') {
            try { rec.requestData(); } catch { /* */ }
          }
        } catch { /* */ }

        try {
          if (rec.state !== 'inactive') rec.stop();
          else finalize();
        } catch {
          clearTimeout(safety);
          settled = true;
          resolve(null);
        }
      }),
  };
}

function pickMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return '';
}

function downsample(values: number[], buckets: number): number[] {
  if (values.length === 0) return new Array(buckets).fill(0.05);
  const out: number[] = [];
  const size = values.length / buckets;
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * size);
    const end = Math.max(start + 1, Math.floor((i + 1) * size));
    let peak = 0;
    for (let j = start; j < end && j < values.length; j++) {
      if (values[j] > peak) peak = values[j];
    }
    out.push(Math.min(1, Math.max(0.04, peak)));
  }
  // gentle normalization
  const max = Math.max(...out);
  if (max < 0.6 && max > 0) {
    const k = 0.85 / max;
    return out.map((v) => Math.min(1, v * k));
  }
  return out;
}
