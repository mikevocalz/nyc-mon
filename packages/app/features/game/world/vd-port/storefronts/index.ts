// Lane B: Valdrada's storefronts on the bundled tile. Stub until lane B lands.
//
// Ownership (integrator decision, 2026-10-28): Valdrada's facade kit (client/src/city/fk, specs in fk/specs/*.js) builds
// each spec'd building whole, storefront bays, roll gates, signs and awnings included, and lane A bakes those buildings
// from the kit's own output (vd-port/blocks). Lane B covers the storefronts of buildings WITHOUT a facade-kit spec, so
// no bay is drawn twice. The spec'd buildings' ids are in vd-port/blocks (VD_BLOCK_SPECS once the bake lands); skip a
// storefront whose building is one of them.
import { EMPTY_PART, type VdPortCtx, type VdPortPart } from '../types.ts';

export function build(_ctx: VdPortCtx): VdPortPart {
  return EMPTY_PART;
}
