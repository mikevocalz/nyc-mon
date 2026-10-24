/**
 * The hatch moment as a pure function of time, so HatchSequence3D only reads
 * it and the node tests can check it frame by frame.
 *
 * Full motion follows the Metro Egg rig's own `hatch` clip
 * (packages/assets/eggs/metro-egg/hatch.manifest.json `runtime.phaseSeconds`):
 * stir 0-1 s and pressure 1-1.8 s wobble the egg, crack 1.8-4.2 s opens three
 * cracks, burst 4.2-4.7 s throws the shell off, emerge 4.7-6.5 s. The clip's
 * own PROXY_Baby stays hidden: the real Baby fades in where the egg stood,
 * from the burst on, scaled so it ends at the size MonModel3D gives it,
 * while the camera eases from the egg's framing height to the Baby's.
 *
 * Reduced motion: no clip (no wobble, no flying shell, no goo), a 0.6 s
 * cross-fade from the still egg to the Baby.
 *
 * Light never flashes: the one brightening is a single rim-light swell over
 * the burst (one rise and one fall, about 0.9 s), far under the Alexa
 * accessibility limit of three flashes a second.
 */

export type HatchPhase = 'stir' | 'pressure' | 'crack' | 'burst' | 'emerge' | 'crossfade' | 'done';

export interface HatchFrame {
  readonly phase: HatchPhase;
  /** Seconds into the egg's `hatch` clip, or null when the clip does not play (reduced motion). */
  readonly clipTime: number | null;
  readonly eggOpacity: number;
  readonly monOpacity: number;
  /** The Baby's scale, 0..1 of its full size. */
  readonly monScale: number;
  /** 0 = the egg's camera framing, 1 = the Baby's. */
  readonly camera: number;
  /** Extra rim light, 0..1. */
  readonly glow: number;
}

export const HATCH_CLIP_SECONDS = 6.5;
const PHASES: readonly (readonly [Exclude<HatchPhase, 'crossfade' | 'done'>, number])[] = [
  ['stir', 1.0],
  ['pressure', 1.8],
  ['crack', 4.2],
  ['burst', 4.7],
  ['emerge', HATCH_CLIP_SECONDS],
];
export const REDUCED_SECONDS = 0.6;

/** How long the whole moment runs. */
export function hatchDuration(reducedMotion: boolean): number {
  return reducedMotion ? REDUCED_SECONDS : HATCH_CLIP_SECONDS;
}

const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
/** 0 before `a`, 1 after `b`, smooth between. */
function ramp(t: number, a: number, b: number): number {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
}

export function hatchFrame(t: number, reducedMotion: boolean): HatchFrame {
  if (reducedMotion) {
    const x = ramp(t, 0, REDUCED_SECONDS);
    return {
      phase: t >= REDUCED_SECONDS ? 'done' : 'crossfade',
      clipTime: null,
      eggOpacity: 1 - x,
      monOpacity: x,
      monScale: 1,
      camera: x,
      glow: 0,
    };
  }
  const phase = t >= HATCH_CLIP_SECONDS ? 'done' : (PHASES.find(([, end]) => t < end)?.[0] ?? 'emerge');
  const rise = ramp(t, 4.2, 4.5);
  const fall = ramp(t, 4.5, 5.1);
  return {
    phase,
    clipTime: Math.min(Math.max(t, 0), HATCH_CLIP_SECONDS),
    eggOpacity: 1 - ramp(t, 4.9, 6.0),
    monOpacity: ramp(t, 4.4, 5.3),
    monScale: 0.55 + 0.45 * ramp(t, 4.4, 5.7),
    camera: ramp(t, 4.6, 6.2),
    glow: rise * (1 - fall),
  };
}
