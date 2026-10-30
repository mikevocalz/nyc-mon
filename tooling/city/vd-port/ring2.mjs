// Ring 2 of the Valdrada expansion: City College / Hamilton Heights, ~W 125th-155th St west of St. Nicholas
// Avenue and Audubon Terrace — the next ring outward from the bundled tile, north of ring 1 (ring1.mjs: Columbia /
// Morningside Heights).
//
// Region, Valdrada world metres (x east, z south; verified against the compiled footprints in the pinned manifest,
// tooling/city/.cache/valdrada/manifest.json — every tile below holds buildings inside it, 2_-11's Riverbank State
// Park pier deck excepted):
//   A  x [0, 2100] x z [-5632, -4400]  Hamilton Heights proper, north of ring 1's edge (z -4400 ~= W 143rd): the
//                                      Hudson shore to St. Nicholas Avenue, Riverbank to Audubon Terrace (x ~1812)
//                                      at ~W 155th (z ~-5620). Hamilton Grange (shared/landmarkSpec.js id 11,
//                                      x ~2031 z ~-4256, tile 3_-9) stands in it.
//   B  x [1900, 2100] x z [-4400, -2990] the City College strip east of ring 1's x edge and north of the bundled
//                                      square's edge (z -3847), down to ~W 125th (z -2990): the CCNY campus blocks
//                                      east of x 1900 and the ~W 125th-140th frontage west of St. Nicholas Park.
// Ring 1 already covers x [0, 1900] x z [-4400, -2000] beside them, the home square covers x [~930, ~2640] x
// z [-3847, -2147]; the bake skips ids already in VD_BLOCKS and VD_BLOCKS_RING1, so nothing is baked twice.
//
// Tiles: the 16 pinned 512 m tiles that intersect the region and exist in the cache (the 0/1 columns north of
// z -4096 — 0_-9..0_-11, 1_-10, 1_-11 — have no tile: the Hudson shore). East of x 2100 and north of z -5632
// (Central Harlem, Washington Heights) is out of this ring.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/** Region rects in Valdrada world metres: [x0, z0, x1, z1]. */
export const RING2_RECTS_VD = [
  [0, -5632, 2100, -4400],
  [1900, -4400, 2100, -2990],
];

export const RING2_TILES = (() => {
  const tiles = new Set();
  const cover = ([x0, z0, x1, z1]) => {
    for (let tx = Math.floor(x0 / 512); tx * 512 < x1; tx++)
      for (let tz = Math.floor(z0 / 512); tz * 512 < z1; tz++) tiles.add(`${tx}_${tz}`);
  };
  for (const r of RING2_RECTS_VD) cover(r);
  // The pinned manifest decides what exists; the Hudson-shore tiles are not in it.
  const manifest = JSON.parse(readFileSync(join(HERE, '..', '.cache', 'valdrada', 'manifest.json'), 'utf8'));
  return [...tiles].filter((k) => manifest.tiles[k]).sort((a, b) => {
    const [ax, az] = a.split('_').map(Number), [bx, bz] = b.split('_').map(Number);
    return az - bz || ax - bx;
  });
})();

/** A Valdrada world box ([x0, y0, z0, x1, y1, z1]) overlapping the ring region. */
export function inRing2Vd(box) {
  return RING2_RECTS_VD.some(([x0, z0, x1, z1]) => box[0] < x1 && box[3] > x0 && box[2] < z1 && box[5] > z0);
}

/** The region in scene metres (the Valdrada->scene map is affine: rects stay rects). */
export function ring2RectsScene(affine) {
  const { sx, ox, sz, oz } = affine;
  return RING2_RECTS_VD.map(([x0, z0, x1, z1]) => [Math.min(x0 * sx + ox, x1 * sx + ox), Math.min(z0 * sz + oz, z1 * sz + oz), Math.max(x0 * sx + ox, x1 * sx + ox), Math.max(z0 * sz + oz, z1 * sz + oz)]);
}

export function inRing2Scene(x, z, rects) {
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

/** The structure ids already baked: lane A's home pack (VD_BLOCKS) and ring 1's (VD_BLOCKS_RING1). */
export function bakedRing2Ids() {
  const ids = new Set();
  for (const [dir, name] of [['data', 'VD_BLOCKS'], ['data-ring1', 'VD_BLOCKS_RING1']]) {
    const ts = readFileSync(join(ROOT, `packages/app/features/game/world/vd-port/blocks/${dir}/manifest.ts`), 'utf8');
    const vd = JSON.parse(ts.slice(ts.indexOf(`${name} = `) + `${name} = `.length, ts.indexOf(' as const;')));
    for (const s of vd.structures) ids.add(s.id);
  }
  return ids;
}
