// Ring 9 of the Valdrada expansion, the first Bronx ring: the South Bronx. Mott Haven, Port Morris, Melrose,
// Longwood and the west half of Hunts Point, then the Concourse, Highbridge, Yankee Stadium, Morrisania and
// Crotona, with the Harlem River and Bronx Kill crossings that land there.
//
// Region, Valdrada world metres (x east, z south; verified against the pinned manifest's tile index and the
// tiles/bridges.json deck alignments). It continues ring 3's and ring 4's x 4100 edge (both rects already reach
// across the Harlem River to x 4100, so Mott Haven's west blocks baked with them) and ring 3's z -5100 edge:
//   x [4100, 7680]  x z [-5100, -1792]  Mott Haven, Port Morris to the Bronx Kill (z ~-1790), Melrose, Longwood
//                                       and Hunts Point west of x 7680;
//   x [3400, 7680]  x z [-6656, -5100]  the Concourse, Highbridge, Yankee Stadium (x ~3810, z ~-5110),
//                                       Morrisania and Crotona Park; the Harlem River (x ~3300..3600) is its
//                                       west edge, so Washington Heights stays out.
// Bridges (harvest.js bridgeStructures, one structure each): the Harlem River crossings br145, madisonAv, thirdAv,
// willis and macombs, the High Bridge (highBr) and the Triborough's Bronx Kill truss (rfkBronxKill). Most of their
// decks lie in ring 3/4 ground west of x 4100, where no ring baked a bridge (bridges are not tile structures);
// RING9_BRIDGES is the selection, so each still bakes here once.
// Rings 1-8 sit west and south; the bake skips ids already in VD_BLOCKS and VD_BLOCKS_RING1..8.
//
// Tiles: the 78 pinned 512 m tiles that intersect the region (all 78 the rects touch are pinned).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/** Region rects in Valdrada world metres: [x0, z0, x1, z1]. */
export const RING9_RECTS_VD = [
  [4100, -5100, 7680, -1792],
  [3400, -6656, 7680, -5100],
];

/** The bridges lane A bakes for this ring (tiles/bridges.json keys; harvest.js bridgeStructures). */
export const RING9_BRIDGES = ['br145', 'madisonAv', 'thirdAv', 'willis', 'macombs', 'highBr', 'rfkBronxKill'];

export const RING9_TILES = (() => {
  const tiles = new Set();
  const cover = ([x0, z0, x1, z1]) => {
    for (let tx = Math.floor(x0 / 512); tx * 512 < x1; tx++)
      for (let tz = Math.floor(z0 / 512); tz * 512 < z1; tz++) tiles.add(`${tx}_${tz}`);
  };
  for (const r of RING9_RECTS_VD) cover(r);
  // The pinned manifest decides what exists.
  const manifest = JSON.parse(readFileSync(join(HERE, '..', '.cache', 'valdrada', 'manifest.json'), 'utf8'));
  return [...tiles].filter((k) => manifest.tiles[k]).sort((a, b) => {
    const [ax, az] = a.split('_').map(Number), [bx, bz] = b.split('_').map(Number);
    return az - bz || ax - bx;
  });
})();

/** A Valdrada world box ([x0, y0, z0, x1, y1, z1]) overlapping the ring region. */
export function inRing9Vd(box) {
  return RING9_RECTS_VD.some(([x0, z0, x1, z1]) => box[0] < x1 && box[3] > x0 && box[2] < z1 && box[5] > z0);
}

/** The region in scene metres (the Valdrada->scene map is affine: rects stay rects). */
export function ring9RectsScene(affine) {
  const { sx, ox, sz, oz } = affine;
  return RING9_RECTS_VD.map(([x0, z0, x1, z1]) => [Math.min(x0 * sx + ox, x1 * sx + ox), Math.min(z0 * sz + oz, z1 * sz + oz), Math.max(x0 * sx + ox, x1 * sx + ox), Math.max(z0 * sz + oz, z1 * sz + oz)]);
}

export function inRing9Scene(x, z, rects) {
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

/** The structure ids already baked: the home pack and rings 1-8 (VD_BLOCKS, VD_BLOCKS_RING1..8). */
export function bakedRing9Ids() {
  const ids = new Set();
  for (const [dir, name] of [['data', 'VD_BLOCKS'], ['data-ring1', 'VD_BLOCKS_RING1'], ['data-ring2', 'VD_BLOCKS_RING2'], ['data-ring3', 'VD_BLOCKS_RING3'], ['data-ring4', 'VD_BLOCKS_RING4'], ['data-ring5', 'VD_BLOCKS_RING5'], ['data-ring6', 'VD_BLOCKS_RING6'], ['data-ring7', 'VD_BLOCKS_RING7'], ['data-ring8', 'VD_BLOCKS_RING8']]) {
    const ts = readFileSync(join(ROOT, `packages/app/features/game/world/vd-port/blocks/${dir}/manifest.ts`), 'utf8');
    const vd = JSON.parse(ts.slice(ts.indexOf(`${name} = `) + `${name} = `.length, ts.indexOf(' as const;')));
    for (const s of vd.structures) ids.add(s.id);
  }
  return ids;
}
