// The realism pass's look parameters. Every number is a named constant so
// the handoff (docs/design/handoff/realism.md) and the tuning session
// against Mike's Apollo-block photos never argue about a bare literal.
// Values marked "Flying Roadster measured" come from the reference build's
// instrumentation and are the starting point for this city; everything else
// is marked TODO(tune). Pure apart from the palette type, so node tests can
// pin the values — the same rule as palette.ts and windows.ts. Colours are
// CITY_COLORS keys, never hex; the morning and night sky tones live in
// palette.ts with the rest of the city's material colours.
import type { CityColor } from './palette.ts';

/**
 * One sky per time of day. Field names match what the sky dome and lights
 * already consume (materials.ts, index.ts): `sunGlow` halos the key disc,
 * `sun` is the key light — the actual sun by day, the moon at night —
 * and `hemiSky`/`hemiGround` feed the hemisphere fill. Fog colour follows
 * `horizon` (index.ts reads `skyHorizon` today).
 */
export interface SkyLook {
  readonly zenith: CityColor;
  readonly mid: CityColor;
  readonly horizon: CityColor;
  readonly sunGlow: CityColor;
  readonly sun: CityColor;
  readonly hemiSky: CityColor;
  readonly hemiGround: CityColor;
}

// TODO(tune): every morning and night key below is authored from the palette
// steps, not measured; verify against Mike's photos at all three times.
export const SKY_MORNING = {
  zenith: 'morningZenith',
  mid: 'morningMid',
  horizon: 'morningHorizon',
  sunGlow: 'morningGlow',
  sun: 'morningSun',
  hemiSky: 'morningHemiSky',
  hemiGround: 'morningHemiGround',
} as const satisfies SkyLook;

/** The set the city already draws: dusty rose horizon, royal mid, brand night zenith. */
export const SKY_DUSK = {
  zenith: 'skyZenith',
  mid: 'skyMid',
  horizon: 'skyHorizon',
  sunGlow: 'sunGlow',
  sun: 'sun',
  hemiSky: 'hemiSky',
  hemiGround: 'hemiGround',
} as const satisfies SkyLook;

export const SKY_NIGHT = {
  zenith: 'nightZenith',
  mid: 'nightMid',
  horizon: 'nightHorizon',
  // No sun halo at night: `sunGlow` carries the city's sodium halo, `sun` the moon.
  sunGlow: 'nightGlow',
  sun: 'nightMoon',
  hemiSky: 'nightHemiSky',
  hemiGround: 'nightHemiGround',
} as const satisfies SkyLook;

export const SKY_BY_TIME = { morning: SKY_MORNING, dusk: SKY_DUSK, night: SKY_NIGHT } as const;
export type TimeOfDay = keyof typeof SKY_BY_TIME;

export const GRADE = {
  /** No measured value; 1 is neutral. TODO(tune) per time of day on the captures. */
  exposure: 1,
  /** Flying Roadster measured: lifts the mids just off the cel bands. */
  contrast: 1.06,
  /** Flying Roadster measured. */
  saturation: 1.04,
  /** Corner darkening, 0 none … 1 full. Flying Roadster measured. */
  vignette: 0.22,
} as const;

export const BLOOM = {
  /**
   * Flying Roadster measured: halos the lit windows, neon and lamp heads
   * without fogging the frame. TODO(tune): the repo has no bloom path yet —
   * three's output pass renders black on react-native-webgpu
   * (docs/implementation/city-world.md) — so the value lands when a working
   * post path does.
   */
  strength: 0.045,
} as const;

export const FOG = {
  /** 'exp2': exponential-squared falloff, the Flying Roadster model; the scene's linear Fog moves to it. */
  model: 'exp2',
  /** Flying Roadster measured, metres. TODO(tune) against the dusk and night captures. */
  density: 0.00028,
} as const;

export const GLASS = {
  /** Curtain-wall towers. Roughness: Flying Roadster measured. */
  curtainRoughness: 0.03,
  /** Flying Roadster measured; the env map does the mirror. */
  curtainMetalness: 0.75,
  /** Per-window roughness, seeded so neighbouring panes differ. Both ends measured. */
  windowRoughnessMin: 0.04,
  windowRoughnessMax: 0.12,
  /** TODO(tune): not measured for house windows; starts at the curtain metalness. */
  windowMetalness: 0.75,
  /**
   * Seeded per-window tilt, degrees off the wall plane, so reflections break
   * up like real sashes. TODO(tune): no measured range; ±4° is a subtle start.
   */
  tiltMinDeg: -4,
  tiltMaxDeg: 4,
} as const;

export const ROOM = {
  /**
   * Interior-map scale: interior rooms per window cell (WINDOW_GRID bay).
   * TODO(tune): not measured; 1 room per bay is the readable start.
   */
  mapScale: 1,
  /** Furniture darkening toward the back wall, 0 none … 1 black. TODO(tune): not measured. */
  furnitureDepthFalloff: 0.5,
} as const;

/** Car paint. All three Flying Roadster measured. */
export const PAINT = {
  clearcoat: 1,
  clearcoatRoughness: 0.025,
  baseRoughness: 0.38,
} as const;

export const RESOLUTION = {
  /** Render-scale step down when the frame runs long. Flying Roadster measured. */
  dropStep: 0.1,
  /** Step back up when there is headroom; slower than the drop so it does not pump. */
  riseStep: 0.05,
  /** Milliseconds between adjustments. Flying Roadster measured. */
  adjustWindowMs: 1500,
  /** Never render below half resolution. Flying Roadster measured. */
  floor: 0.5,
  /** The phone frame-rate band the governor holds, fps. Both ends measured. */
  phoneFpsTargetMin: 27,
  phoneFpsTargetMax: 38,
  /** Environment-map size, px: phones get the small one, the high tier the big one. Measured. */
  envSizePhone: 256,
  envSizeHigh: 512,
} as const;

export const AO = {
  /** Ambient-occlusion samples on the high tier. Flying Roadster measured. */
  samplesHigh: 12,
} as const;
