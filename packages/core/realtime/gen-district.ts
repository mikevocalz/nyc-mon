/**
 * The generated-city district spec (Phase 3 slice 3): a `DistrictSpec` for the
 * procedural overlay the world/gen lane adds to the bundled tile. Same tile,
 * same movement contract — the spec spreads `DEFAULT_DISTRICT_SPEC` and changes
 * only what makes it a different district: its id and its wall query.
 *
 * The `walkable` hook is injected, never read from a global: core stays
 * env-free, so the app seam (world/gen/district.ts) decides when
 * EXPO_PUBLIC_WORLD_GEN is on and hands the composed gen-aware query in. With
 * no walkable the authority still bounds to the tile square — the optional
 * hook is what walls generated buildings off, like the record walls it
 * mirrors.
 *
 * This id names the world district only. The per-form `districtId` the dex
 * documents stays null — dex-model.ts records it as unauthored canon, and the
 * generated city invents no Mon homes.
 */
import { DEFAULT_DISTRICT_SPEC, type DistrictSpec } from './district-authority.ts';

/** The district id the generated city registers: the Harlem-Apollo tile plus the world/gen overlay. */
export const GEN_DISTRICT_ID = 'harlem-apollo-gen';

/**
 * The gen district's spec: the default district's shape under its own id, with the caller's
 * walkable query as the wall test. Tick (50 ms), speeds and bounds carry over verbatim — the
 * generated city plays by the record district's rules.
 */
export function genDistrictSpec(walkable: (x: number, z: number) => boolean): DistrictSpec {
  return { ...DEFAULT_DISTRICT_SPEC, districtId: GEN_DISTRICT_ID, walkable };
}
