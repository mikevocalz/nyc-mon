// Ring 1 of the Valdrada expansion: Columbia / Morningside Heights / Grant's Tomb / Riverside Church, the district
// around (never inside) the bundled tile's playable square.
//
// Region, Valdrada world metres (x east, z south; verified against the compiled footprints in the pinned manifest,
// tooling/city/.cache/valdrada/manifest.json — every tile below holds buildings inside it):
//   A  x [0, 1900] x z [-4400, -2000]   the campus and the landmark row: the w125w part's own box is
//                                     [600, -4400, 1900, -2800] (city/areas.js DEFS); Low and Butler Libraries,
//                                     St Paul's Chapel, St John the Divine, Riverside Church and Grant's Tomb
//                                     (shared/landmarkSpec.js ids 1-6) stand in it
//   B  x [-400, 1600] x z [-2400, -800] the Morningside Heights strip south of campus to ~W 100th St
//
// Tiles: the 34 pinned 512 m tiles that intersect the region and exist in the cache (0_-8 and 0_-9 have no tile:
// the Hudson). The twelve home tiles (x 1..3 x z -8..-5) are in it too — the bundled bake dropped their structures
// outside the 850 m square (Grant's Tomb in 1_-7, the campus blocks in 1_-6), and the ring picks them back up; the
// bake skips ids already in VD_BLOCKS, so nothing is baked twice.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/** Region rects in Valdrada world metres: [x0, z0, x1, z1]. */
export const RING1_RECTS_VD = [
  [0, -4400, 1900, -2000],
  [-400, -2400, 1600, -800],
];

export const RING1_TILES = (() => {
  const tiles = new Set();
  const cover = ([x0, z0, x1, z1]) => {
    for (let tx = Math.floor(x0 / 512); tx * 512 < x1; tx++)
      for (let tz = Math.floor(z0 / 512); tz * 512 < z1; tz++) tiles.add(`${tx}_${tz}`);
  };
  for (const r of RING1_RECTS_VD) cover(r);
  // The pinned manifest decides what exists; 0_-8 and 0_-9 are not in it (the Hudson).
  const manifest = JSON.parse(readFileSync(join(HERE, '..', '.cache', 'valdrada', 'manifest.json'), 'utf8'));
  return [...tiles].filter((k) => manifest.tiles[k]).sort((a, b) => {
    const [ax, az] = a.split('_').map(Number), [bx, bz] = b.split('_').map(Number);
    return az - bz || ax - bx;
  });
})();

/** A Valdrada world box ([x0, y0, z0, x1, y1, z1]) overlapping the ring region. */
export function inRing1Vd(box) {
  return RING1_RECTS_VD.some(([x0, z0, x1, z1]) => box[0] < x1 && box[3] > x0 && box[2] < z1 && box[5] > z0);
}

/** The region in scene metres (the Valdrada->scene map is affine: rects stay rects). */
export function ring1RectsScene(affine) {
  const { sx, ox, sz, oz } = affine;
  return RING1_RECTS_VD.map(([x0, z0, x1, z1]) => [Math.min(x0 * sx + ox, x1 * sx + ox), Math.min(z0 * sz + oz, z1 * sz + oz), Math.max(x0 * sx + ox, x1 * sx + ox), Math.max(z0 * sz + oz, z1 * sz + oz)]);
}

export function inRing1Scene(x, z, rects) {
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

/** The structure ids lane A already baked (VD_BLOCKS), so the ring bake keeps no structure twice. */
export function bakedBlockIds() {
  const ts = readFileSync(join(ROOT, 'packages/app/features/game/world/vd-port/blocks/data/manifest.ts'), 'utf8');
  const vd = JSON.parse(ts.slice(ts.indexOf('VD_BLOCKS = ') + 'VD_BLOCKS = '.length, ts.indexOf(' as const;')));
  return new Set(vd.structures.map((s) => s.id));
}
