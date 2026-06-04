/**
 * Adaptive GPU quality detection.
 * Returns a tier the 3D scenes and compositing-heavy UI can use to scale
 * DPR, particle counts, backdrop-filter blur, opacity layers, and frameloop
 * strategy without redesigning visuals.
 */

export type GpuTier = 'low' | 'medium' | 'high';

export interface GpuProfile {
  tier: GpuTier;
  maxDpr: number;
  antialias: boolean;
  /** Multiplier for particle / instance counts (0.3–1.0). */
  densityScale: number;
  /** If true, callers should pause frameloop when tab hidden. */
  pauseWhenHidden: boolean;
  reducedMotion: boolean;
  isMobile: boolean;
  /** Backdrop-filter blur multiplier (0..1). 0 = disable blur, use solid bg. */
  blurScale: number;
  /** Allow expensive compositing layers (mix-blend, large animated shadows). */
  enableHeavyEffects: boolean;
  /** Allow ambient particle layer. */
  enableParticles: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|Mobile/i.test(navigator.userAgent);
}

function detectTier(): GpuTier {
  if (typeof navigator === 'undefined') return 'medium';
  const cores = (navigator as any).hardwareConcurrency ?? 4;
  const memory = (navigator as any).deviceMemory ?? 4;
  const mobile = isMobileDevice();
  if (mobile && (memory <= 3 || cores <= 4)) return 'low';
  if (memory <= 2 || cores <= 2) return 'low';
  if (memory >= 8 && cores >= 8 && !mobile) return 'high';
  return 'medium';
}

let cached: GpuProfile | null = null;

export function getGpuProfile(): GpuProfile {
  if (cached) return cached;
  const tier = detectTier();
  const reduced = prefersReducedMotion();
  const mobile = isMobileDevice();
  const maxDpr = tier === 'low' ? 1 : tier === 'medium' ? 1.5 : 1.75;
  const densityScale = tier === 'low' ? 0.4 : tier === 'medium' ? 0.75 : 1;
  const blurScale = tier === 'low' ? (mobile ? 0 : 0.35) : tier === 'medium' ? 0.7 : 1;
  const enableHeavyEffects = tier !== 'low' && !reduced;
  const enableParticles = tier !== 'low' && !reduced;
  cached = {
    tier,
    maxDpr,
    antialias: tier !== 'low',
    densityScale,
    pauseWhenHidden: true,
    reducedMotion: reduced,
    isMobile: mobile,
    blurScale,
    enableHeavyEffects,
    enableParticles,
  };
  return cached;
}

/**
 * Apply GPU tier attributes to <html> so CSS can adaptively degrade
 * backdrop-filter, opacity layers, and animated shadows. Safe to call once
 * at app bootstrap; idempotent.
 */
export function applyGpuTierToDocument(): void {
  if (typeof document === 'undefined') return;
  const p = getGpuProfile();
  const root = document.documentElement;
  root.setAttribute('data-gpu-tier', p.tier);
  if (p.isMobile) root.setAttribute('data-gpu-mobile', '1');
  if (!p.enableHeavyEffects) root.setAttribute('data-reduced-fx', '1');
  root.style.setProperty('--gpu-blur-scale', String(p.blurScale));
}
