// Ring 4 of the Valdrada expansion: Central Park's middle and south end — the Met, the Guggenheim, the AMNH, the
// Central Park South towers and Columbus Circle — plus the residential flanks west (Upper West Side) and east
// (Upper East Side) of the park, everything south of ring 3's z edge (ring3.mjs: the park's north end) down to
// ~59th Street.
//
// Region, Valdrada world metres (x east, z south; verified against the compiled footprints in the pinned manifest,
// tooling/city/.cache/valdrada/manifest.json):
//   x [-2560, 4100] x z [-3200, 2100]  the band below ring 3's south edge (z -3200 ~= W 117th) to the park's south
//                                     edge (~Central Park South, z ~2100): the park itself (x ~-826..1870), the
//                                     UWS strip to the Hudson shore at the south rows, and the UES strip to ring
//                                     3's east edge x 4100 (~1st Avenue). landmarkSpec.js ids 29-31, 44-49, 56,
//                                     60-66, 70-74, 76 and 78 stand in it; the w125* part boxes (areas.js B125,
//                                     x [600, 3750] x z [-4400, -1450]) still reach its north rows, so any of
//                                     their structures not already baked lands here too.
// Ring 1 already covers x [0, 1900] x z [-4400, -2000] and x [-400, 1600] x z [-2400, -800], ring 3
// x [1900, 4100] x z [-5100, -3200] and the bundled square x [~960, ~2660] x z [-3847, -2147]; the bake skips ids
// already in VD_BLOCKS, VD_BLOCKS_RING1, VD_BLOCKS_RING2 and VD_BLOCKS_RING3, so nothing is baked twice.
//
// Tiles: the 143 pinned 512 m tiles that intersect the region and exist in the cache (x -5..8, z -7..4; the west
// edge is ragged — the Hudson shore — and the north rows start at x 0..-3 where the grid has no tile).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/** Region rects in Valdrada world metres: [x0, z0, x1, z1]. */
export const RING4_RECTS_VD = [
  [-2560, -3200, 4100, 2100],
];

export const RING4_TILES = (() => {
  const tiles = new Set();
  const cover = ([x0, z0, x1, z1]) => {
    for (let tx = Math.floor(x0 / 512); tx * 512 < x1; tx++)
      for (let tz = Math.floor(z0 / 512); tz * 512 < z1; tz++) tiles.add(`${tx}_${tz}`);
  };
  for (const r of RING4_RECTS_VD) cover(r);
  // The pinned manifest decides what exists.
  const manifest = JSON.parse(readFileSync(join(HERE, '..', '.cache', 'valdrada', 'manifest.json'), 'utf8'));
  return [...tiles].filter((k) => manifest.tiles[k]).sort((a, b) => {
    const [ax, az] = a.split('_').map(Number), [bx, bz] = b.split('_').map(Number);
    return az - bz || ax - bx;
  });
})();

/** A Valdrada world box ([x0, y0, z0, x1, y1, z1]) overlapping the ring region. */
export function inRing4Vd(box) {
  return RING4_RECTS_VD.some(([x0, z0, x1, z1]) => box[0] < x1 && box[3] > x0 && box[2] < z1 && box[5] > z0);
}

/** The region in scene metres (the Valdrada->scene map is affine: rects stay rects). */
export function ring4RectsScene(affine) {
  const { sx, ox, sz, oz } = affine;
  return RING4_RECTS_VD.map(([x0, z0, x1, z1]) => [Math.min(x0 * sx + ox, x1 * sx + ox), Math.min(z0 * sz + oz, z1 * sz + oz), Math.max(x0 * sx + ox, x1 * sx + ox), Math.max(z0 * sz + oz, z1 * sz + oz)]);
}

export function inRing4Scene(x, z, rects) {
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

/** The structure ids already baked: the home pack and rings 1-3 (VD_BLOCKS, VD_BLOCKS_RING1..3). */
export function bakedRing4Ids() {
  const ids = new Set();
  for (const [dir, name] of [['data', 'VD_BLOCKS'], ['data-ring1', 'VD_BLOCKS_RING1'], ['data-ring2', 'VD_BLOCKS_RING2'], ['data-ring3', 'VD_BLOCKS_RING3']]) {
    const ts = readFileSync(join(ROOT, `packages/app/features/game/world/vd-port/blocks/${dir}/manifest.ts`), 'utf8');
    const vd = JSON.parse(ts.slice(ts.indexOf(`${name} = `) + `${name} = `.length, ts.indexOf(' as const;')));
    for (const s of vd.structures) ids.add(s.id);
  }
  return ids;
}
