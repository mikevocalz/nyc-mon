// Adapted from mrdoob/slop-newyork @ be65d0a, js/vehicle-lights.js HEADLIGHTS and js/traffic.js
// updateTrafficLights / the highway flare pass (MIT, © 2026 Mr.doob).
//
// Physical constants for the lofted traffic and its lights, with units. "Slop measured" means the value is Slop's
// own, tuned there against its renderer at be65d0a. TODO(tune) marks a value this port had to choose; each one is a
// device check on iPhone 17 and iPad Pro (§5.7), not a measurement. Colours live in @acme/theme
// `physicalVehicles`; nothing here is a colour.
//
// Pure data: no imports, so the worklet render runtime and node tests read it as is.

/**
 * Low-beam spot lights (Slop `HEADLIGHTS`). Slop measured. Intensities are candela (three's SpotLight with
 * physically based falloff, decay 2); Slop's note: "calibrated for inverse-square decay".
 */
export const HEADLIGHTS = {
  /** Car low beam, cd. */
  intensity: 700,
  /** Bus low beam, cd. */
  busIntensity: 900,
  /** Cut-off range, m. */
  distance: 36,
  /** Cone half-angle, rad. */
  angle: 0.14,
  /** Soft edge, 0..1. */
  penumbra: 0.85,
  /** Inverse-square falloff exponent. */
  decay: 2,
  /** Downward aim below the chassis horizon, rad. */
  pitch: 0.145,
  /** Outward aim, metres sideways per metre forward. */
  toeOut: 0.005,
  /** Spot origin ahead of the nose, m. */
  noseOffset: 0.08,
} as const;

/** Distance along the beam to the aim target, m (Slop `placeVehicleHeadlight` `aim`). Slop measured. */
export const HEADLIGHT_AIM_METRES = 10;

/**
 * Vehicles that get a pair of real SpotLights, nearest first (§5.7 start values: iPhone 17 `phone` 8, iPad Pro
 * `high` 24). Every other vehicle keeps its emissive lamps, which bloom without lighting the street. TODO(tune).
 */
export const HEADLIGHT_SPOT_VEHICLES = { phone: 8, high: 24 } as const;

/** Beyond this effective distance a vehicle never gets a spot, m (Slop city traffic `MAX_LIGHT_DIST`). Slop measured. */
export const HEADLIGHT_MAX_DISTANCE = 115;
/**
 * Effective-distance penalty for vehicles behind the camera: `d + max(0, behindSlack - forwardDot) * behindWeight`
 * (Slop `renderCar` / `renderBus`). Slop measured. behindSlack in m, behindWeight dimensionless.
 */
export const HEADLIGHT_BEHIND_SLACK = 5.0;
export const HEADLIGHT_BEHIND_WEIGHT = 3.2;
/** Spots fade from this fraction of the cut-off to the cut-off (Slop `smoothDistFade(eff, cutoff * 0.62, cutoff)`). */
export const HEADLIGHT_FADE_START = 0.62;

/**
 * Slop drives every night-dependent term from `cityUniforms.uInteriorGlow`: midday 0.24, golden hour 0.48, dusk 1.25,
 * night 1.55 (comment in Slop `updateTrafficLights`). nyc-mon's clock packs `lampLevel` 0..1 instead
 * (living-city/clock.ts). This maps one onto the other linearly from midday to night so Slop's thresholds keep
 * their meaning. TODO(tune): the live preset value replaces this once the light rig's presets land.
 */
export const SLOP_GLOW_DAY = 0.24;
export const SLOP_GLOW_NIGHT = 1.55;
export function slopGlowFromLampLevel(lampLevel: number): number {
  const t = Math.max(0, Math.min(1, lampLevel));
  return SLOP_GLOW_DAY + (SLOP_GLOW_NIGHT - SLOP_GLOW_DAY) * t;
}

/** Spot intensity scale from the glow: off by day, full by dusk (Slop `beamScale`). Slop measured. */
export function headlightBeamScale(glow: number): number {
  return Math.max(0, Math.min(1.28, (glow - 0.6) * 1.45));
}

/** Material emissive thresholds on the glow (Slop `nightHeadlamp` smoothstep edges). Slop measured. */
export const NIGHT_HEADLAMP_GLOW = [0.6, 1.15] as const;
/** Lamp emissive multipliers in the car material (Slop createLoftedCarMaterial emissive graph). Slop measured. */
export const CAR_LAMP_LEVEL = {
  headLens: 2.2,
  drl: 0.65,
  brake: 2.1,
  nightTail: 0.4,
  chmsl: 2.1,
  turn: 2.2,
  taxiSign: 1.65,
} as const;
/** Bus lamp emissive multipliers (Slop createLoftedBusMaterial). Slop measured. */
export const BUS_LAMP_LEVEL = {
  pod: 0.45,
  head: 1.35,
  turn: 2.0,
  brake: 1.5,
  tailBase: 0.75,
} as const;

/** Night flares: lit above this glow (Slop `flaresOn`). Slop measured. */
export const FLARE_GLOW_ON = 0.65;
/** The flare material's night ramp on the glow (Slop createCarFlareMaterial). Slop measured. */
export const FLARE_NIGHT_GLOW = [0.35, 1.3] as const;
/** Flares start at this distance and reach full weight this far beyond it, m. Slop measured. */
export const FLARE_NEAR_METRES = 40;
export const FLARE_RAMP_METRES = 80;
/** Haze term: weight divided by 1 + (d / hazeMetres)^2. Slop measured. */
export const FLARE_HAZE_METRES = 2000;
/** Sprite size floor, m, and the pixels-wide target at distance. Slop measured. */
export const FLARE_MIN_SIZE = 0.6;
export const FLARE_PIXELS = 3;
/** Sprites sit this far off the nose and tail, m. Slop measured. */
export const FLARE_LAMP_OFFSET = 0.3;
/** Flare tint, linear radiance multipliers (Slop addFlare calls). Slop measured. */
export const FLARE_FRONT_RGB = [4.4, 4.1, 3.6] as const;
export const FLARE_REAR_RGB = [3.4, 0.16, 0.1] as const;
/**
 * Vertical field of view and viewport height the flare size assumes when the actor is not told the camera's.
 * Slop reads `camera.fov || 55` and `window.innerHeight` (min 360). TODO(tune): the render runtime knows both.
 */
export const FLARE_DEFAULT_FOV_DEG = 55;
export const FLARE_DEFAULT_VIEWPORT_PX = 800;

/**
 * Detail levels: the nearest vehicles draw the full lofted model (~4.1–4.3 k triangles), the rest the coarse proxy
 * (~0.5 k). Slop does the same with three LOD meshes per body. Start values sized for the dynamic-actor budget of
 * about 50 k triangles at 64 vehicles (living-city/vehicle-actor.ts header). TODO(tune).
 */
export const LOFTED_NEAR_VEHICLES = { phone: 6, high: 12 } as const;
