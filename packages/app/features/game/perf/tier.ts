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
}

export const TIER: Record<WorldTier, TierBundle> = {
  phone: {
    envWidth: SKY_RIG.envWidth, // 1024 equirect → 256px PMREM cube, the phone env.
    glassTier: 'flat',
    post: { bloom: false, ao: false, aa: true, tier: 'phone' },
    scale: { band: { low: 27, high: 38 }, floor: RENDER_SCALE_FLOOR },
  },
  high: {
    envWidth: SKY_RIG.envWidth * 2, // 2048 equirect → 512px PMREM cube.
    glassTier: 'full',
    post: { bloom: true, ao: true, aa: true, tier: 'high' },
    // TODO(device): provisional band — no Flying Roadster measurement for
    // the high tier; a flagship panel targets its ~60 Hz refresh.
    scale: { band: { low: 45, high: 60 }, floor: RENDER_SCALE_FLOOR },
  },
} as const;

/** The bundle for a tier — the option defaults city-scene applies when the bundle is active. */
export function tierBundle(tier: WorldTier): TierBundle {
  return TIER[tier];
}
