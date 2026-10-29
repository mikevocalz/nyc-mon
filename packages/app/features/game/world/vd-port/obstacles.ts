// Sidewalk obstacles for the living city's pedestrians from lane C's pools (vd-port/furniture: Valdrada's own furniture
// placements over the square), so walkers step round what is drawn. Flat [x, z, ...] pairs, scene metres.
import { decodeBase64 } from '../foliage-decode.ts';
import { INSTANCE_BYTES } from './furniture/pool-data.ts';
import { VD_POOLS } from './furniture/data/instances.ts';

/** The pools a walker cannot pass through (city/furnitureKit.js kinds with a footprint on the sidewalk). */
export const VD_OBSTACLE_POOLS = ['hydrant', 'linknyc', 'bikeRack', 'subway', 'busShelter', 'litter', 'mailbox', 'newsbox', 'bench'] as const;

export function vdPoolObstacles(): number[] {
  const out: number[] = [];
  const want = new Set<string>(VD_OBSTACLE_POOLS);
  for (const pool of VD_POOLS) {
    if (!want.has(pool.name)) continue;
    const bytes = decodeBase64(pool.data);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < pool.count; i++) out.push(view.getFloat32(i * INSTANCE_BYTES, true), view.getFloat32(i * INSTANCE_BYTES + 8, true));
  }
  return out;
}
