// Authored facade-kit solid footprints in the same transformed scene metres as
// the rendered packs. Unlike OSM placeholders, these persist across near LOD eviction.
import { createCameraBlocker } from '../../../camera-collision.ts';
import { VD_LANE } from '../../curb.ts';
import { vdBlockBytes } from './load.ts';
import { VD_BLOCKS } from './data/manifest.ts';
import { VD_BLOCKS_RING1 } from './data-ring1/manifest.ts';
import { VD_BLOCKS_RING2 } from './data-ring2/manifest.ts';
import { VD_BLOCKS_RING3 } from './data-ring3/manifest.ts';
import { VD_BLOCKS_RING4 } from './data-ring4/manifest.ts';
import { VD_BLOCKS_RING5 } from './data-ring5/manifest.ts';
import { VD_BLOCKS_RING6 } from './data-ring6/manifest.ts';
import { VD_BLOCKS_RING7 } from './data-ring7/manifest.ts';
import { VD_BLOCKS_RING8 } from './data-ring8/manifest.ts';
import { VD_BLOCKS_RING9 } from './data-ring9/manifest.ts';
import { VD_BLOCKS_RING10 } from './data-ring10/manifest.ts';

export interface AuthoredBuildingVolume {
  readonly owned: readonly (readonly (readonly number[])[])[];
  readonly box: readonly number[];
}

/** No bounding-box solid is invented for landmarks/parts without an authored footprint. */
export function createAuthoredBuildingBlocker(structures: readonly AuthoredBuildingVolume[]) {
  const volumes = structures.flatMap((structure) => structure.owned.map((ring) => ({
    ring: ring.flatMap((point) => [point[0]!, point[1]!]), holes: [],
    baseMeters: structure.box[1]!, heightMeters: structure.box[4]!,
  })));
  return createCameraBlocker(volumes);
}

let blocker: ReturnType<typeof createAuthoredBuildingBlocker> | undefined;
let indexedRings = -1;
const rings: readonly (readonly AuthoredBuildingVolume[])[] = [
  VD_BLOCKS.structures,
  VD_BLOCKS_RING1.structures,
  VD_BLOCKS_RING2.structures,
  VD_BLOCKS_RING3.structures,
  VD_BLOCKS_RING4.structures,
  VD_BLOCKS_RING5.structures,
  VD_BLOCKS_RING6.structures,
  VD_BLOCKS_RING7.structures,
  VD_BLOCKS_RING8.structures,
  VD_BLOCKS_RING9.structures,
  VD_BLOCKS_RING10.structures,
];
/** The pack loader must have succeeded; unloaded source geometry cannot block the player. */
export function authoredBuildingBlocked(x: number, y: number, z: number, radius: number): boolean {
  const packs = vdBlockBytes();
  if (!VD_LANE || !packs) return false;
  const mask = 1 | (packs.ring1 ? 2 : 0) | (packs.ring2 ? 4 : 0) | (packs.ring3 ? 8 : 0) | (packs.ring4 ? 16 : 0) | (packs.ring5 ? 32 : 0) | (packs.ring6 ? 64 : 0) | (packs.ring7 ? 128 : 0) | (packs.ring8 ? 256 : 0) | (packs.ring9 ? 512 : 0) | (packs.ring10 ? 1024 : 0);
  if (mask !== indexedRings) {
    const loaded = [true, packs.ring1, packs.ring2, packs.ring3, packs.ring4, packs.ring5,
      packs.ring6, packs.ring7, packs.ring8, packs.ring9, packs.ring10];
    blocker = createAuthoredBuildingBlocker(rings.flatMap((structures, i) => loaded[i] ? structures : []));
    indexedRings = mask;
  }
  return blocker!(x, y, z, radius);
}
