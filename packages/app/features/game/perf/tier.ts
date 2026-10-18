// perf/tier.ts — lane L6, the tier bundle. EXPO_PUBLIC_WORLD_TIER =
// phone | high (default 'phone') picks one row of TIER, and the row maps
// onto the option names the lower lanes already expose — it does not
// re-invent their flags:
//
//   phone (the Flying Roadster's phone set): env map 256 (envWidth 1024),
//   glass interiors 'flat', post {no AO, no bloom, FXAA}, scale band
//   27–38 fps, floor RENDER_SCALE_FLOOR (pending sign-off).
//   high: env map 512 (envWidth 2048), glass 'full', post {SSAO, bloom,
//   FXAA}, its own target band (TODO(device) — provisional, no measured
//   values yet), same provisional floor.
//
// What the tier does NOT do: enable lanes. EXPO_PUBLIC_WORLD_SKY_RIG /
// _PBR / _GLASS / _POST stay the master gates — with a lane's flag off
// there is nothing for the tier to tune, and post's master flag still
// gates the RenderPipeline mount itself. The bundle's option defaults
// apply only when the selector is set or the render-scale controller is
// on (city-scene.ts reads WORLD_TIER_SELECTED); with neither, every lane
// keeps its own defaults byte-identical to before this lane.
//
// Individual env flags still override: the post flags are force-on over
// the bundle (EXPO_PUBLIC_WORLD_POST_BLOOM=1 turns bloom on under the
// phone bundle — there is no force-off flag, the same truthy-only
// convention as every lane), and EXPO_PUBLIC_WORLD_POST_TIER keeps its
// own say over the post tier. post/pipeline.ts's tier contract stands:
// AO exists only when the effective post tier is 'high'.

import type { CityPostOptions } from '../post/pipeline.ts';
import type { GlassTier } from '../world/glass.ts';
import { SKY_RIG } from '../world/sky-rig.ts';
import { RENDER_SCALE_FLOOR, type RenderScaleBand } from './render-scale.ts';

/** The device tier: 'phone' is the default — the Duo's constraints are the baseline. */
export type WorldTier = 'phone' | 'high';

/** Only 'high' opts in; anything else (including unset) is the phone tier. */
export function parseWorldTier(value: string | undefined | null): WorldTier {
  return value?.trim().toLowerCase() === 'high' ? 'high' : 'phone';
}

/** The L6 selector — 'phone' when unset. */
export const WORLD_TIER = parseWorldTier(process.env.EXPO_PUBLIC_WORLD_TIER);

/** True only when the env var was actually set — gates the bundle so default builds stay byte-identical. */
export const WORLD_TIER_SELECTED = process.env.EXPO_PUBLIC_WORLD_TIER?.trim() !== undefined && process.env.EXPO_PUBLIC_WORLD_TIER.trim() !== '';

export interface TierBundle {
  /**
   * L1 env-size pick, as the equirect width fed to the sky rig
   * (sky-rig.ts: PMREM cube = width/4 → 1024 = the 256 phone env,
   * 2048 = the 512 high env). Only read while the sky-rig flag is on.
   */
  envWidth: number;
  /** L3 interior tier — 'flat' is the cheap path, 'full' the room boxes. */
  glassTier: GlassTier;
  /** L5a post defaults the bundle contributes — per-effect flags force-on over these. */
  post: Pick<CityPostOptions, 'bloom' | 'ao' | 'aa' | 'tier'>;
  /** L6 controller pick: target draw-rate band (fps) and scale floor. */
  scale: { band: RenderScaleBand; floor: number };
  /**
   * PR09: the Living City crowd/detail row this world tier maps to when the
   * bundle is selected (living-city/bundled-host.ts reads it through
   * resolveLivingCityTier). 'phone' trims the ambient population to the
   * medium caps; 'high' keeps the authored counts.
   */
  livingCity: LivingCityTier;
}

export const TIER: Record<WorldTier, TierBundle> = {
  phone: {
    envWidth: SKY_RIG.envWidth, // 1024 equirect → 256px PMREM cube, the phone env.
    glassTier: 'flat',
    post: { bloom: false, ao: false, aa: true, tier: 'phone' },
    scale: { band: { low: 27, high: 38 }, floor: RENDER_SCALE_FLOOR },
    livingCity: 'medium',
  },
  high: {
    envWidth: SKY_RIG.envWidth * 2, // 2048 equirect → 512px PMREM cube.
    glassTier: 'full',
    post: { bloom: true, ao: true, aa: true, tier: 'high' },
    // TODO(device): provisional band — no Flying Roadster measurement for
    // the high tier; a flagship panel targets its ~60 Hz refresh.
    scale: { band: { low: 45, high: 60 }, floor: RENDER_SCALE_FLOOR },
    livingCity: 'high',
  },
} as const;

/** The bundle for a tier — the option defaults city-scene applies when the bundle is active. */
export function tierBundle(tier: WorldTier): TierBundle {
  return TIER[tier];
}

// --- PR09: Living City actor/LOD caps ------------------------------------------------
//
// The living-city lane (PR05–07) runs four actor factories on top of the
// world: the vehicle fleet, the ped crowd, the signal heads/ped displays
// and the streetlamp glow layer. Its cost is three things — the 24 Hz JS
// sim tick (scales with live vehicle/ped counts), the instanced draws
// (one per actor layer, fixed) and the near-field instance sets (nearest-N
// within a focus radius). This table is the spec's low/medium/high rung
// for those counts:
//
//   - 'high' is byte-identical to the authored PR05–07 defaults
//     (12 ambient vehicles, 16 ambient peds, lamps on, the 320/320
//     signal near-field caps) — it exists so the DEFAULT stays the
//     current behaviour.
//   - 'medium' roughly halves the ambient population and the near-field
//     sets; scripted slice spawns (the two-car + six-ped ACP scenario)
//     are never capped — they are the scenario, not ambience.
//   - 'low' drops the crowd to a token presence and unmounts the lamp
//     glow/pool actor (the only purely cosmetic layer). Signal heads and
//     ped displays stay at every tier — the functional read of the
//     controller is the spec's non-negotiable, they just render fewer
//     near-field instances.
//
// Resolution order (resolveLivingCityTier): an explicit
// EXPO_PUBLIC_LIVING_CITY_TIER = low|medium|high wins; otherwise the
// selected world tier's bundle row applies (phone → medium, high →
// high); with neither set the answer is 'high' = current behaviour.
// Population caps can also move at runtime — the render-scale controller
// steps the ambient targets down through bundled-host's adaptive hook —
// while the mount-time caps (signal instance caps, the lamp actor's
// presence) are fixed for the scene's lifetime.

export type LivingCityTier = 'low' | 'medium' | 'high' | 'xr';

export interface LivingCityCaps {
  /** Ambient vehicle population target — total fleet cap including scripted spawns (VehicleSim.targetVehicles). */
  readonly vehicles: number;
  /** Ambient ped population target — total crowd cap including scripted spawns (PedSim.targetPeds). */
  readonly peds: number;
  /** Mount the streetlamp glow/pool actor. Off removes two instanced draws and the placement pass. */
  readonly lampGlow: boolean;
  /** Signal-head near-field instance cap (signal-viz.ts headCap). */
  readonly signalHeadCap: number;
  /** Ped-display near-field instance cap (signal-viz.ts pedCap). */
  readonly pedBoxCap: number;
}

export const LIVING_CITY_CAPS: Record<LivingCityTier, LivingCityCaps> = {
  low: { vehicles: 4, peds: 4, lampGlow: false, signalHeadCap: 160, pedBoxCap: 160 },
  medium: { vehicles: 8, peds: 8, lampGlow: true, signalHeadCap: 224, pedBoxCap: 224 },
  // 'high' must equal the PR05–07 authored defaults — the living-city
  // tests pin it against LIVING_CITY_AMBIENT / _PED_AMBIENT /
  // SIGNAL_HEAD_CAP / PED_BOX_CAP so a drift here fails loudly.
  high: { vehicles: 12, peds: 16, lampGlow: true, signalHeadCap: 320, pedBoxCap: 320 },
  // 'xr' is the headset-class rung the spec names: it intentionally
  // carries the authored ceiling today. There is no measured headset
  // budget to raise counts into — inflating numbers without a device to
  // validate them on would be dishonest; the rung exists so the selector
  // accepts the name and a future XR measurement can raise only this row.
  xr: { vehicles: 12, peds: 16, lampGlow: true, signalHeadCap: 320, pedBoxCap: 320 },
} as const;

/**
 * Parse the explicit Living City tier selector — returns null for unset or
 * anything outside the four rungs, so invalid values fall through to the
 * world-tier mapping rather than silently clamping.
 */
export function parseLivingCityTier(value: string | undefined | null): LivingCityTier | null {
  const v = value?.trim().toLowerCase();
  return v === 'low' || v === 'medium' || v === 'high' || v === 'xr' ? v : null;
}

/** The explicit PR09 selector — null when unset (the common case). */
export const LIVING_CITY_TIER_SELECTED = parseLivingCityTier(process.env.EXPO_PUBLIC_LIVING_CITY_TIER);

/**
 * The Living City tier for this build/run: explicit env override, else the
 * selected world tier's bundle row, else 'high' (current behaviour — with
 * no selector set anywhere the living city looks exactly like PR07).
 */
export function resolveLivingCityTier(): LivingCityTier {
  return LIVING_CITY_TIER_SELECTED ?? (WORLD_TIER_SELECTED ? tierBundle(WORLD_TIER).livingCity : 'high');
}

/** The actor caps for a living-city tier — pure lookup, exported for the host and tests. */
export function livingCityCapsFor(tier: LivingCityTier): LivingCityCaps {
  return LIVING_CITY_CAPS[tier];
}

// --- PR09 adaptive step-down ---------------------------------------------------------

/**
 * The render-scale surrender mark: the first time the controller's scale
 * falls to this, the crowd steps down one tier (high → medium). Each
 * further step needs the scale to fall another quarter — with the
 * provisional 0.5 floor both steps are reachable (0.9^5 ≈ 0.59 ≤ 0.5625).
 */
export const LIVING_CITY_ADAPTIVE_SCALE = 0.75;
const LIVING_CITY_ADAPTIVE_FACTOR = 0.75;
const LIVING_CITY_TIER_ORDER: readonly LivingCityTier[] = ['low', 'medium', 'high', 'xr'];

export interface LivingCityAdaptive {
  /**
   * Feed the render-scale controller's current scale and the tier the
   * host is running; returns the tier to apply on a step-down, else null.
   * Pure over its inputs + the internal mark — no host/env knowledge, so
   * node tests drive it directly. One-way: nothing ever steps back up.
   */
  frame(scale: number, current: LivingCityTier): LivingCityTier | null;
}

/** The adaptive stepper — bundled-host.ts owns the instance and applies the result. */
export function createLivingCityAdaptive(mark: number = LIVING_CITY_ADAPTIVE_SCALE): LivingCityAdaptive {
  let m = mark;
  return {
    frame(scale: number, current: LivingCityTier): LivingCityTier | null {
      if (m < 0 || !Number.isFinite(scale) || scale > m) return null;
      const idx = LIVING_CITY_TIER_ORDER.indexOf(current);
      if (idx <= 0) {
        m = -1; // already at 'low' — stop evaluating
        return null;
      }
      const next = LIVING_CITY_TIER_ORDER[idx - 1]!;
      m = next === 'low' ? -1 : m * LIVING_CITY_ADAPTIVE_FACTOR;
      return next;
    },
  };
}
