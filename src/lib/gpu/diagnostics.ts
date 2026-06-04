/**
 * Dev-only GPU / WebGL diagnostics registry.
 * Tracks active renderers, scenes, RAF loops, and disposal counts so we can
 * spot leaks across navigation without shipping anything in production.
 */

type Stats = {
  activeRenderers: number;
  mountedScenes: number;
  rafLoops: number;
  disposed: number;
  contextLosses: number;
  contextRestores: number;
  reducedMotion: boolean;
};

const isDev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;

const stats: Stats = {
  activeRenderers: 0,
  mountedScenes: 0,
  rafLoops: 0,
  disposed: 0,
  contextLosses: 0,
  contextRestores: 0,
  reducedMotion: false,
};

function publish() {
  if (!isDev || typeof window === 'undefined') return;
  const root = document.documentElement;
  const blurLayers = document.querySelectorAll(
    '[class*="backdrop-blur"], .glass, .glass-strong'
  ).length;
  (window as any).__GPU_DIAG__ = {
    ...stats,
    tier: root.getAttribute('data-gpu-tier'),
    mobile: root.hasAttribute('data-gpu-mobile'),
    reducedFx: root.hasAttribute('data-reduced-fx'),
    blurLayers,
    compositingRisk: blurLayers > 24 ? 'high' : blurLayers > 12 ? 'medium' : 'low',
  };
}

export const gpuDiag = {
  registerRenderer() { stats.activeRenderers++; publish(); },
  unregisterRenderer() { stats.activeRenderers = Math.max(0, stats.activeRenderers - 1); publish(); },
  registerScene(name?: string) {
    stats.mountedScenes++;
    if (isDev) console.debug('[gpu] scene mount', name ?? '');
    publish();
  },
  unregisterScene(name?: string) {
    stats.mountedScenes = Math.max(0, stats.mountedScenes - 1);
    if (isDev) console.debug('[gpu] scene unmount', name ?? '');
    publish();
  },
  registerRaf() { stats.rafLoops++; publish(); },
  unregisterRaf() { stats.rafLoops = Math.max(0, stats.rafLoops - 1); publish(); },
  noteDispose() { stats.disposed++; publish(); },
  noteContextLost() { stats.contextLosses++; publish(); },
  noteContextRestored() { stats.contextRestores++; publish(); },
  setReducedMotion(v: boolean) { stats.reducedMotion = v; publish(); },
  snapshot(): Stats { return { ...stats }; },
};

publish();
