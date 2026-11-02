// The generated-city district's app seam (Phase 3 slice 3): flag-gated access
// to the spec core/realtime/gen-district.ts describes. The walkable hook is the
// tile's composed query (bundled-queries.ts) — flag on, it already ANDs the
// gen-prism blocked layer in, so a DistrictAuthority running this spec walls
// generated buildings exactly the way the walk camera does. Flag off, the
// world registers no district: the sim lanes and the save see nothing.
import { GEN_DISTRICT_ID, genDistrictSpec, type DistrictSpec } from '@acme/core/realtime';
import { isWalkable } from '../bundled-queries.ts';
import { EXPERIMENTAL_WORLD_GEN } from './flag.ts';

export { GEN_DISTRICT_ID };

let spec: DistrictSpec | null | undefined;

/** The district spec the world runs under, or null while the gen lane is off. */
export function worldDistrict(): DistrictSpec | null {
  if (spec === undefined) spec = EXPERIMENTAL_WORLD_GEN ? genDistrictSpec(isWalkable) : null;
  return spec;
}
