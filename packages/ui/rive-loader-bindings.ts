import { hlynk, led, palette, signage } from '@acme/theme';

/**
 * The contract between rive/loader/scene.rml and the RiveLoader forks.
 * Artboard, state machine and view model names, and every property path the
 * component writes, must match the RML exactly; rive-loader-bindings.test.ts
 * reads the scene and fails when they drift.
 */
export const RIVE_LOADER_ARTBOARD = 'RiveLoader';
export const RIVE_LOADER_MACHINE = 'Loader';
export const RIVE_LOADER_VIEW_MODEL = 'RiveLoader';

export const RIVE_LOADER_BINDINGS = {
  ringPrimary: 'ringPrimary',
  ringAccent: 'ringAccent',
  core: 'core',
  track: 'track',
  phase: 'phase',
  progress: 'progress',
} as const;

/**
 * What the host asks for. The machine always plays its draw-in first, then
 * follows this value: `loading` spins, `complete` collapses the rings into
 * the core and fades, `error` stops and dims, `reduced` swaps the rotation
 * for a slow opacity pulse.
 */
export type RiveLoaderPhase = 'loading' | 'complete' | 'error' | 'reduced';

export type RiveLoaderScheme = 'light' | 'dark';

export interface RiveLoaderColors {
  ringPrimary: string;
  ringAccent: string;
  core: string;
  track: string;
}

/**
 * H-Lynk scanner colours per scheme. Night: the lit scanner LED, Knicks
 * orange, a signage-white lens and an ink-800 track. Daylit: the H-Lynk body
 * red, one orange step darker so it holds on concrete, a signage-black lens
 * (the scanner head) and a pale ink track. The .riv carries the night values
 * as authoring defaults only; these are written at runtime, so a scheme
 * change needs no rebuild.
 */
export function riveLoaderColors(scheme: RiveLoaderScheme = 'dark'): RiveLoaderColors {
  if (scheme === 'light') {
    return {
      ringPrimary: hlynk.core.body,
      ringAccent: palette.orange[600],
      core: signage.black,
      track: palette.ink[200],
    };
  }
  return {
    ringPrimary: led.on,
    ringAccent: palette.orange[500],
    core: signage.white,
    track: palette.ink[800],
  };
}

/**
 * The OS reduce-motion setting turns `loading` into `reduced`. A host that
 * has already said `complete` or `error` keeps it: both are one-shot and
 * neither rotates.
 */
export function resolveRiveLoaderPhase(phase: RiveLoaderPhase, reduceMotion: boolean): RiveLoaderPhase {
  return reduceMotion && phase === 'loading' ? 'reduced' : phase;
}

/** Clamps host progress into the 0-1 the frame's trim path takes; NaN reads as 0. */
export function clampRiveLoaderProgress(progress: number): number {
  return Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
}
