/**
 * The hatch moment as a pure function of time, so HatchSequence3D only reads
 * it and the node tests can check it frame by frame.
 *
 * Staging follows the Pokémon Emerald egg hatch (pret/pokeemerald
 * src/egg_hatch.c, 60 fps frames) with the evolution reveal on top
 * (evolution_scene.c; Gen 2 evolution_animation.asm):
 *
 *   intro      0.50 s  the stage dims, the egg sits still
 *   shake 1    20 f    small wobble, first crack at f15, one chip pops off
 *   pause      30 f
 *   shake 2    20 f    double wobble, second crack at f15
 *   pause      30 f
 *   shake 3    38 f    double wobble, third crack at f15 and two chips, a
 *                      second crack tick at f30
 *   tension    50 f    still; light through the cracks keeps building and
 *                      sparkles spiral in, orange data rings orbit
 *   whiteout   0.35 s  one fade to white; 16 shards fly out in 4 bursts of 4
 *   reveal     8 f     the Baby appears under the white, scaling up
 *   white fade 0.43 s  the white clears; the Baby rises, still a white silhouette
 *   silhouette 1.55 s  the silhouette pulses between egg shape and Baby shape,
 *                      faster each time (shape only: its brightness never moves)
 *   resolve    0.45 s  white fades into the Baby's own colours, chime, the line
 *
 * Light rules (Alexa+ PLATFORM-DOCS §2.9, no more than 3 flashes a second):
 * every brightening ramps over at least 350 ms, the white-out is the only
 * flash, the crack pulses sit 0.83 s apart, and the silhouette pulses move
 * scale, never luminance. `lightLevel` is what the tests sample.
 *
 * Reduced motion: no shake, chips, white-out or pulses. A 0.6 s cross-fade
 * from the still egg to the Baby under one soft glow, then the chime.
 *
 * The same beats drive the Rive file (packages/assets/rive/hatch-evolve):
 * `riveCues` says which trigger fires when and `riveIntensity` what the
 * `intensity` property holds, for hosts that can run the Rive runtime.
 */

export type HatchPhase =
  | 'intro'
  | 'shake1'
  | 'shake2'
  | 'shake3'
  | 'tension'
  | 'whiteout'
  | 'reveal'
  | 'silhouette'
  | 'resolve'
  | 'crossfade'
  | 'done';

const F = 1 / 60;

/** Beat boundaries in seconds (full motion). */
export const BEATS = {
  intro: [0, 30 * F],
  shake1: [30 * F, 50 * F],
  shake2: [80 * F, 100 * F],
  shake3: [130 * F, 168 * F],
  tension: [168 * F, 218 * F],
  whiteout: [218 * F, 218 * F + 0.35],
  reveal: [218 * F + 0.35, 218 * F + 0.35 + 8 * F],
  whiteFade: [218 * F + 0.35 + 8 * F, 218 * F + 0.35 + 8 * F + 0.4333],
} as const;

/** Crack moments: f15 of each shake. */
export const CRACKS: readonly number[] = [BEATS.shake1[0] + 15 * F, BEATS.shake2[0] + 15 * F, BEATS.shake3[0] + 15 * F];
/** The extra crack tick at f30 of the third shake. */
export const CRACK_TICK = BEATS.shake3[0] + 30 * F;

/** Half-periods of the silhouette's shape pulses: 400 ms down to 140 ms. */
export const PULSE_HALVES: readonly number[] = [0.4, 0.34, 0.28, 0.22, 0.17, 0.14];
const SILHOUETTE_START = BEATS.whiteFade[1];
const SILHOUETTE_END = SILHOUETTE_START + PULSE_HALVES.reduce((a, b) => a + b, 0);
const RESOLVE_END = SILHOUETTE_END + 0.45;
export const HATCH_SECONDS = RESOLVE_END + 0.05;
export const REDUCED_SECONDS = 0.6;

/** Shard bursts: one chip at crack 1, two at crack 3, then 4 bursts of 4 at the white-out. */
export const SHARD_BURSTS: readonly { readonly t: number; readonly count: number; readonly big: boolean }[] = [
  { t: CRACKS[0]!, count: 1, big: false },
  { t: CRACKS[2]!, count: 2, big: false },
  ...[0, 1, 2, 3].map((i) => ({ t: BEATS.whiteout[0] + i * 4 * F, count: 4, big: true })),
];

export type SoundCue = 'crack' | 'tick' | 'shimmer' | 'whoosh' | 'chime';
/** When each original synthesized sound starts (hatch-sound.ts). */
export function soundCues(reducedMotion: boolean): readonly { readonly t: number; readonly cue: SoundCue }[] {
  if (reducedMotion) return [{ t: REDUCED_SECONDS * 0.5, cue: 'chime' }];
  return [
    ...CRACKS.map((t) => ({ t, cue: 'crack' as const })),
    { t: CRACK_TICK, cue: 'tick' },
    { t: BEATS.tension[0], cue: 'shimmer' },
    { t: BEATS.whiteout[0], cue: 'whoosh' },
    { t: SILHOUETTE_END, cue: 'chime' },
  ];
}

export type RiveTrigger = 'stir' | 'crack' | 'burst' | 'reveal';
/** When the hatch-evolve state machine's triggers fire. */
export function riveCues(reducedMotion: boolean): readonly { readonly t: number; readonly trigger: RiveTrigger }[] {
  if (reducedMotion) return [{ t: 0, trigger: 'burst' }, { t: REDUCED_SECONDS, trigger: 'reveal' }];
  return [
    { t: 0, trigger: 'stir' },
    ...CRACKS.map((t) => ({ t, trigger: 'crack' as const })),
    { t: BEATS.whiteout[0], trigger: 'burst' },
    { t: BEATS.whiteFade[0], trigger: 'reveal' },
  ];
}

export interface HatchFrame {
  readonly phase: HatchPhase;
  /** Seconds into the egg rig's `hatch` clip, or null when the clip does not play (reduced motion). */
  readonly clipTime: number | null;
  /** Procedural wobble on the egg root, radians about the view axis. */
  readonly eggTilt: number;
  readonly eggOpacity: number;
  readonly monOpacity: number;
  /** The Baby's scale, 0..1 of its full size. */
  readonly monScale: number;
  /** Silhouette shape: 0 = the Baby, 1 = squeezed to the egg's outline. */
  readonly monShape: number;
  /** The Baby's rise, 0 = in place, 1 = one rise below (the view picks the distance). */
  readonly monDrop: number;
  /** 0 = the egg's camera framing, 1 = the Baby's. */
  readonly camera: number;
  /** Light leaking from the cracks (shell emissive), 0..1. */
  readonly crackLight: number;
  /** The glow behind the egg (Rive `intensity`), 0..1. */
  readonly glow: number;
  /** Sparkle spiral and data rings, 0..1. */
  readonly charge: number;
  /** The white-out over the stage, 0..1. */
  readonly white: number;
  /** White override on the Baby (and the egg under the white-out), 0..1. */
  readonly silhouette: number;
  /** The soft glow behind the revealed Baby, 0..1. */
  readonly settle: number;
  /** Stage dimming, 0..1. */
  readonly dim: number;
}

/** How long the whole moment runs. */
export function hatchDuration(reducedMotion: boolean): number {
  return reducedMotion ? REDUCED_SECONDS : HATCH_SECONDS;
}

const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
/** 0 before `a`, 1 after `b`, smooth between. */
export function ramp(t: number, a: number, b: number): number {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
}
/** Linear map of `t` from [a, b] to [from, to], clamped. */
function lerpAt(t: number, a: number, b: number, from: number, to: number): number {
  return from + (to - from) * clamp01((t - a) / (b - a));
}

/** Seconds of light ramps: no brightening is faster than this. */
export const MIN_RAMP = 0.35;

/** Where the egg clip sits: crack poses on the crack beats, the burst under the white-out. */
function clipTimeAt(t: number): number {
  // The rig's own crack beats (hatch.manifest.json crackBeatSeconds 2.4, 3.13, 3.83).
  const segs: readonly (readonly [number, number, number, number])[] = [
    [CRACKS[0]! - 0.04, CRACKS[0]! + 0.12, 2.4, 2.62],
    [CRACKS[1]! - 0.04, CRACKS[1]! + 0.12, 3.1, 3.32],
    [CRACKS[2]! - 0.04, CRACKS[2]! + 0.12, 3.8, 3.95],
    [BEATS.whiteout[0], BEATS.reveal[1], 3.95, 4.7],
  ];
  let clip = 0;
  for (const [a, b, from, to] of segs) if (t >= a) clip = lerpAt(t, a, b, from, to);
  return clip;
}

function shakeAt(t: number): number {
  const shakes: readonly (readonly [readonly [number, number], number])[] = [
    [BEATS.shake1, 0.05],
    [BEATS.shake2, 0.1],
    [BEATS.shake3, 0.1],
  ];
  for (const [[a, b], amp] of shakes) {
    if (t < a || t >= b) continue;
    const u = (t - a) / (b - a);
    // About 4.5 wobbles a second, eased in and out so each shake starts and stops still.
    return amp * Math.sin(u * Math.PI) * Math.sin((t - a) * 2 * Math.PI * 4.5);
  }
  return 0;
}

/** The crack light: three steps that each ramp in over MIN_RAMP, then a climb through the tension. */
function crackLightAt(t: number): number {
  const steps = CRACKS.reduce((sum, c) => sum + 0.22 * ramp(t, c, c + MIN_RAMP), 0);
  const climb = 0.34 * ramp(t, BEATS.tension[0], BEATS.tension[1]);
  return Math.min(1, steps + climb);
}

/** Silhouette shape pulses: Baby → egg → Baby…, each half shorter than the last. */
function shapeAt(t: number): number {
  if (t < SILHOUETTE_START || t >= SILHOUETTE_END) return 0;
  let start = SILHOUETTE_START;
  for (let i = 0; i < PULSE_HALVES.length; i++) {
    const end = start + PULSE_HALVES[i]!;
    if (t < end) {
      const x = ramp(t, start, end);
      return i % 2 === 0 ? x : 1 - x;
    }
    start = end;
  }
  return 0;
}

function phaseAt(t: number): HatchPhase {
  if (t >= HATCH_SECONDS) return 'done';
  if (t >= SILHOUETTE_END) return 'resolve';
  if (t >= BEATS.whiteFade[0]) return 'silhouette';
  if (t >= BEATS.reveal[0]) return 'reveal';
  if (t >= BEATS.whiteout[0]) return 'whiteout';
  if (t >= BEATS.tension[0]) return 'tension';
  if (t >= BEATS.shake3[0]) return 'shake3';
  if (t >= BEATS.shake2[0]) return 'shake2';
  if (t >= BEATS.shake1[0]) return 'shake1';
  return 'intro';
}

/** What the Rive `intensity` property holds: a step per crack, full through the tension, out at the burst. */
export function riveIntensity(t: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const steps = CRACKS.reduce((sum, c) => sum + 0.25 * ramp(t, c, c + MIN_RAMP), 0);
  const up = steps + 0.25 * ramp(t, BEATS.tension[0], BEATS.tension[1]);
  return up * (1 - ramp(t, BEATS.whiteout[0], BEATS.whiteout[1]));
}

export function hatchFrame(t: number, reducedMotion: boolean): HatchFrame {
  if (reducedMotion) {
    const x = ramp(t, 0, REDUCED_SECONDS);
    // One soft glow: up over the first half, down over the second.
    const glow = 0.5 * ramp(t, 0, REDUCED_SECONDS / 2) * (1 - ramp(t, REDUCED_SECONDS / 2, REDUCED_SECONDS * 1.5));
    return {
      phase: t >= REDUCED_SECONDS ? 'done' : 'crossfade',
      clipTime: null,
      eggTilt: 0,
      eggOpacity: 1 - x,
      monOpacity: x,
      monScale: 1,
      monShape: 0,
      monDrop: 0,
      camera: x,
      crackLight: 0,
      glow: 0,
      charge: 0,
      white: 0,
      silhouette: 0,
      settle: glow,
      dim: 0,
    };
  }
  const [w0, w1] = BEATS.whiteout;
  const [f0, f1] = BEATS.whiteFade;
  const shown = t >= w1 ? 1 : 0;
  const white = ramp(t, w0, w1) * (1 - ramp(t, f0, f1));
  return {
    phase: phaseAt(t),
    clipTime: clipTimeAt(t),
    eggTilt: shakeAt(t),
    // Under full white the egg goes and the Baby arrives: the swap never shows.
    eggOpacity: 1 - shown,
    monOpacity: shown,
    monScale: shown * (0.55 + 0.45 * ramp(t, w1, f0 + 0.15)),
    monShape: shapeAt(t),
    monDrop: 1 - ramp(t, f0, f0 + 10 * F),
    camera: ramp(t, w1, BEATS.reveal[1]),
    crackLight: crackLightAt(t) * (1 - shown),
    glow: riveIntensity(t, false),
    charge: ramp(t, BEATS.tension[0], BEATS.tension[0] + MIN_RAMP) * (1 - ramp(t, w0, w1)),
    white,
    // The egg whitens with the stage; the Baby stays white until the resolve.
    silhouette: t < w1 ? ramp(t, w0, w1) : 1 - ramp(t, SILHOUETTE_END, RESOLVE_END),
    settle: ramp(t, f0, f1 + 0.2),
    dim: ramp(t, 0, BEATS.intro[1]) * (1 - ramp(t, SILHOUETTE_END, RESOLVE_END)),
  };
}

/**
 * Relative stage brightness, 0..1, for the flash-rate check: the brightest of
 * the white-out, the glow, the crack light and the white silhouette, each
 * weighted by about how much of the stage it covers.
 */
export function lightLevel(f: HatchFrame): number {
  return Math.min(1, Math.max(f.white, 0.55 * f.glow, 0.25 * f.crackLight, 0.3 * f.silhouette * f.monOpacity, 0.35 * f.settle) + 0.1 * f.charge);
}

/** A tiny seeded random, so the shards fly the same way every time. */
function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export interface ShardState {
  /** Position in egg-height units from the egg's centre: x right, y up, z toward the viewer. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly spin: number;
  readonly size: number;
  readonly opacity: number;
}

/** Every chip and shard that is in the air at `t` (empty under reduced motion). */
export function shardStates(t: number, reducedMotion: boolean): readonly ShardState[] {
  if (reducedMotion) return [];
  const out: ShardState[] = [];
  let seed = 1;
  for (const burst of SHARD_BURSTS) {
    for (let i = 0; i < burst.count; i++, seed++) {
      const age = t - burst.t;
      const life = burst.big ? 0.95 : 1.4;
      if (age < 0 || age > life) continue;
      const a = rand(seed) * Math.PI * 2;
      const speed = burst.big ? 1.6 + 1.0 * rand(seed + 50) : 0.45 + 0.2 * rand(seed + 50);
      const up = burst.big ? 0.9 + 0.8 * rand(seed + 90) : 0.7;
      const g = 2.6;
      out.push({
        x: Math.cos(a) * speed * age,
        y: 0.25 + up * age - 0.5 * g * age * age,
        z: Math.abs(Math.sin(a)) * speed * age * 0.6,
        spin: (rand(seed + 7) - 0.5) * 18 * age,
        size: burst.big ? 0.07 + 0.05 * rand(seed + 3) : 0.06,
        opacity: 1 - ramp(age, life - 0.35, life),
      });
    }
  }
  return out;
}
