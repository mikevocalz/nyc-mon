// Ring 10 of the Valdrada expansion, the first Staten Island ring: the North Shore and the Narrows. St. George
// and the ferry terminal, Tompkinsville, Stapleton, Clifton, Rosebank and Fort Wadsworth, New Brighton west to
// Snug Harbor, and the Verrazzano-Narrows Bridge.
//
// Region, Valdrada world metres (x east, z south; verified against the pinned manifest's tile index):
//   x [-11264, -6656] x z [14848, 20480]  St. George (x ~-8630, z ~15490), Stapleton, Rosebank, Fort Wadsworth
//                                         and the Verrazzano's Staten Island anchorage (x ~-7300, z ~20090).
// No ring touches it, and none can: the pinned tile index has no tile west of x -4096 between z 10752 and z 14848
// (tile rows 21..28, the Upper Bay, the Kill van Kull and Bayonne), so ring 6's harbour rect (Liberty Island,
// z <= 11000) and this ring's north edge (tile row 29, z 14848) sit 3.8 km apart over untiled water. The rect's
// east half is the Narrows; Bay Ridge (Brooklyn, x > -5200) stays out.
// Bridge (harvest.js bridgeStructures): verrazzano (x -7298..-5192, z 19194..20088), its Brooklyn tower over the
// Narrows outside the rect; RING10_BRIDGES is the selection. The Bayonne and Goethals bridges (x < -13900) and Port
// Richmond stay west of x -11264.
// Rings 1-9 sit far north; the bake skips ids already in VD_BLOCKS and VD_BLOCKS_RING1..9.
//
// Tiles: the 78 pinned 512 m tiles that intersect the rect (99 touched; 21 are unpinned Narrows and Upper Bay water).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/** Region rects in Valdrada world metres: [x0, z0, x1, z1]. */
export const RING10_RECTS_VD = [
  [-11264, 14848, -6656, 20480],
];

/** The bridges lane A bakes for this ring (tiles/bridges.json keys; harvest.js bridgeStructures). */
export const RING10_BRIDGES = ['verrazzano'];

export const RING10_TILES = (() => {
  const tiles = new Set();
  const cover = ([x0, z0, x1, z1]) => {
    for (let tx = Math.floor(x0 / 512); tx * 512 < x1; tx++)
      for (let tz = Math.floor(z0 / 512); tz * 512 < z1; tz++) tiles.add(`${tx}_${tz}`);
  };
  for (const r of RING10_RECTS_VD) cover(r);
  // The pinned manifest decides what exists.
  const manifest = JSON.parse(readFileSync(join(HERE, '..', '.cache', 'valdrada', 'manifest.json'), 'utf8'));
  return [...tiles].filter((k) => manifest.tiles[k]).sort((a, b) => {
    const [ax, az] = a.split('_').map(Number), [bx, bz] = b.split('_').map(Number);
    return az - bz || ax - bx;
  });
})();

/** A Valdrada world box ([x0, y0, z0, x1, y1, z1]) overlapping the ring region. */
export function inRing10Vd(box) {
  return RING10_RECTS_VD.some(([x0, z0, x1, z1]) => box[0] < x1 && box[3] > x0 && box[2] < z1 && box[5] > z0);
}

/** The region in scene metres (the Valdrada->scene map is affine: rects stay rects). */
export function ring10RectsScene(affine) {
  const { sx, ox, sz, oz } = affine;
  return RING10_RECTS_VD.map(([x0, z0, x1, z1]) => [Math.min(x0 * sx + ox, x1 * sx + ox), Math.min(z0 * sz + oz, z1 * sz + oz), Math.max(x0 * sx + ox, x1 * sx + ox), Math.max(z0 * sz + oz, z1 * sz + oz)]);
}

export function inRing10Scene(x, z, rects) {
  return rects.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
}

/** The bundled tile's playable square, scene metres (harlem-apollo.json extentMeters). */
export const HOME_EXTENT = 850;
export const inHomeSquare = (x, z) => Math.abs(x) <= HOME_EXTENT && Math.abs(z) <= HOME_EXTENT;

/**
 * A streamer cell (edge `size`, scene metres) overlapping the home square: the ring's home-overlap cells ride the
 * bundle so the square's edge never waits on the host; the rest stream through the cell source.
 */
export function homeOverlapCell(cx, cz, size) {
  const x0 = cx * size, z0 = cz * size;
  return x0 < HOME_EXTENT && x0 + size > -HOME_EXTENT && z0 < HOME_EXTENT && z0 + size > -HOME_EXTENT;
}

/** The structure ids already baked: the home pack and rings 1-9 (VD_BLOCKS, VD_BLOCKS_RING1..9). */
export function bakedRing10Ids() {
  const ids = new Set();
  for (const [dir, name] of [['data', 'VD_BLOCKS'], ['data-ring1', 'VD_BLOCKS_RING1'], ['data-ring2', 'VD_BLOCKS_RING2'], ['data-ring3', 'VD_BLOCKS_RING3'], ['data-ring4', 'VD_BLOCKS_RING4'], ['data-ring5', 'VD_BLOCKS_RING5'], ['data-ring6', 'VD_BLOCKS_RING6'], ['data-ring7', 'VD_BLOCKS_RING7'], ['data-ring8', 'VD_BLOCKS_RING8'], ['data-ring9', 'VD_BLOCKS_RING9']]) {
    const ts = readFileSync(join(ROOT, `packages/app/features/game/world/vd-port/blocks/${dir}/manifest.ts`), 'utf8');
    const vd = JSON.parse(ts.slice(ts.indexOf(`${name} = `) + `${name} = `.length, ts.indexOf(' as const;')));
    for (const s of vd.structures) ids.add(s.id);
  }
  return ids;
}
