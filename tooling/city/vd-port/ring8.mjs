// Ring 8 of the Valdrada expansion, the first Queens ring: western Queens. Long Island City, Hunters Point,
// Queensbridge and Ravenswood on the East River's east shore, Sunnyside, Astoria and Ditmars-Steinway to the Hell
// Gate shore, Blissville and the Newtown Creek corridor, with the crossings that land there: the Queensboro, Roosevelt
// Island, Pulaski and Kosciuszko bridges, the Triborough's Queens leg (rfk) and the Hell Gate rail arch.
//
// Region, Valdrada world metres (x east, z south; verified against the pinned manifest's tile index and the
// tiles/bridges.json deck alignments). It continues the earlier rings' outer edges: ring 4's x 4100 edge
// (z <= 2100, which already holds Astoria's waterfront west of x 4100), ring 5's x 1500 edge (z 2100..5000),
// ring 5's z 5000 edge and ring 7's z 5632 edge:
//   x [-200, 1500]  x z [5000, 5632]    the strip ring 5 (z <= 5000), ring 6 (x <= -200) and ring 7 (z >= 5632)
//                                       leave between them: Hunters Point South and the Newtown Creek mouth;
//   x [1500, 4100]  x z [2100, 5632]    Queensbridge, Ravenswood, Dutch Kills, Long Island City and the Pulaski
//                                       Bridge's Queens landing (x ~1600, z ~4440);
//   x [4100, 6656]  x z [-512, 5632]    Astoria, Ditmars-Steinway and the Hell Gate viaduct, Sunnyside and
//                                       west Woodside; the Bronx (Port Morris, z < -1790) and Rikers Island
//                                       (x ~7180) stay out;
//   x [2560, 4100]  x z [5632, 6656]    the Newtown Creek corridor east of ring 7's x 2560 edge: Blissville and
//                                       the Kosciuszko Bridge (x 3154..3893, z 5684..6442), with the creek's
//                                       Greenpoint bank.
// Bridges (harvest.js bridgeStructures, one structure each): queensboro (x 661..2561, z 2497..3570), rooseveltBr
// (x 2065..2421, z 2133..2345), pulaski (x 1529..1667, z 4440..5302), kosciuszko, rfk (the Queens leg, x 3459..4325,
// z -359..1207) and hellgate (x 3841..5373, z -2461..1762). Their Manhattan and Randall's Island ends lie in ring
// 4/5 ground; RING8_BRIDGES is the selection, so a span reaching over an earlier ring's rect still bakes here once.
// Rings 1-7 sit west and south; the bake skips ids already in VD_BLOCKS and VD_BLOCKS_RING1..7.
//
// Tiles: the pinned 512 m tiles that intersect the region and exist in the cache: 114 of the 116 the rects touch
// (the manifest decides; the two unpinned are open East River water).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/** Region rects in Valdrada world metres: [x0, z0, x1, z1]. */
export const RING8_RECTS_VD = [
  [-200, 5000, 1500, 5632],
  [1500, 2100, 4100, 5632],
  [4100, -512, 6656, 5632],
  [2560, 5632, 4100, 6656],
];

/** The bridges lane A bakes for this ring (tiles/bridges.json keys; harvest.js bridgeStructures). */
export const RING8_BRIDGES = ['queensboro', 'rooseveltBr', 'pulaski', 'kosciuszko', 'rfk', 'hellgate'];

export const RING8_TILES = (() => {
  const tiles = new Set();
  const cover = ([x0, z0, x1, z1]) => {
    for (let tx = Math.floor(x0 / 512); tx * 512 < x1; tx++)
      for (let tz = Math.floor(z0 / 512); tz * 512 < z1; tz++) tiles.add(`${tx}_${tz}`);
  };
  for (const r of RING8_RECTS_VD) cover(r);
  // The pinned manifest decides what exists.
  const manifest = JSON.parse(readFileSync(join(HERE, '..', '.cache', 'valdrada', 'manifest.json'), 'utf8'));
  return [...tiles].filter((k) => manifest.tiles[k]).sort((a, b) => {
    const [ax, az] = a.split('_').map(Number), [bx, bz] = b.split('_').map(Number);
    return az - bz || ax - bx;
  });
})();

/** A Valdrada world box ([x0, y0, z0, x1, y1, z1]) overlapping the ring region. */
export function inRing8Vd(box) {
  return RING8_RECTS_VD.some(([x0, z0, x1, z1]) => box[0] < x1 && box[3] > x0 && box[2] < z1 && box[5] > z0);
}

/** The region in scene metres (the Valdrada->scene map is affine: rects stay rects). */
export function ring8RectsScene(affine) {
  const { sx, ox, sz, oz } = affine;
  return RING8_RECTS_VD.map(([x0, z0, x1, z1]) => [Math.min(x0 * sx + ox, x1 * sx + ox), Math.min(z0 * sz + oz, z1 * sz + oz), Math.max(x0 * sx + ox, x1 * sx + ox), Math.max(z0 * sz + oz, z1 * sz + oz)]);
}

export function inRing8Scene(x, z, rects) {
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

/** The structure ids already baked: the home pack and rings 1-7 (VD_BLOCKS, VD_BLOCKS_RING1..7). */
export function bakedRing8Ids() {
  const ids = new Set();
  for (const [dir, name] of [['data', 'VD_BLOCKS'], ['data-ring1', 'VD_BLOCKS_RING1'], ['data-ring2', 'VD_BLOCKS_RING2'], ['data-ring3', 'VD_BLOCKS_RING3'], ['data-ring4', 'VD_BLOCKS_RING4'], ['data-ring5', 'VD_BLOCKS_RING5'], ['data-ring6', 'VD_BLOCKS_RING6'], ['data-ring7', 'VD_BLOCKS_RING7']]) {
    const ts = readFileSync(join(ROOT, `packages/app/features/game/world/vd-port/blocks/${dir}/manifest.ts`), 'utf8');
    const vd = JSON.parse(ts.slice(ts.indexOf(`${name} = `) + `${name} = `.length, ts.indexOf(' as const;')));
    for (const s of vd.structures) ids.add(s.id);
  }
  return ids;
}
