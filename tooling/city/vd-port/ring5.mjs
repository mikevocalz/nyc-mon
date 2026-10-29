// Ring 5 of the Valdrada expansion: Midtown — Times Square, Bryant Park and the Public Library, Grand Central and the
// Park Avenue towers, Herald Square and the Empire State Building, the Fifth Avenue retail corridor and Rockefeller
// Center — the band below (south of) ring 4's z edge (ring4.mjs: Central Park mid/south and the UWS/UES flanks), from
// ~59th Street down to ~23rd.
//
// Region, Valdrada world metres (x east, z south; verified against the compiled footprints in the pinned manifest,
// tooling/city/.cache/valdrada/manifest.json):
//   x [-3100, 1500] x z [2100, 5000]  below ring 4's south edge (z 2100 ~= 59th St) to ~23rd St (z ~5000, the
//                                     Flatiron's block): the Hudson shore and Hudson Yards at the west edge to the
//                                     East River shore (the UN, Tudor City, Sutton Place) at the east. landmarkSpec.js
//                                     ids 20, 21, 23, 24, 25, 27, 28, 32, 33, 34, 35, 36, 43, 50, 54, 55, 57, 58, 59,
//                                     75 and 77 stand in it (the Empire State, the Chrysler, 30 Rock, the Flatiron,
//                                     Grand Central, the NYPL, St Patrick's, MSG, One Times Square, 30 Hudson Yards,
//                                     the Citigroup, Seagram and Lever House towers, the MetLife, One Vanderbilt,
//                                     432 Park, 53W53, 270 Park, the Waldorf and the Bank of America Tower); Roosevelt
//                                     Island and the Queens waterfront lie east of x 1500, out of this ring.
// Ring 4 already covers x [-2560, 4100] x z [-3200, 2100] above them — a structure whose box straddles the shared z
// 2100 edge (the GM Building at 59th) baked with ring 4 — and rings 1-3 sit far north; the bake skips ids already in
// VD_BLOCKS, VD_BLOCKS_RING1..4, so nothing is baked twice.
//
// Tiles: the 57 pinned 512 m tiles that intersect the region and exist in the cache (x -7..2, z 4..9; the -7 column
// is the Hudson shore — its pinned cells start at z 6 — and 0_9, the East River at 23rd, has no tile).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/** Region rects in Valdrada world metres: [x0, z0, x1, z1]. */
export const RING5_RECTS_VD = [
  [-3100, 2100, 1500, 5000],
];

export const RING5_TILES = (() => {
  const tiles = new Set();
  const cover = ([x0, z0, x1, z1]) => {
    for (let tx = Math.floor(x0 / 512); tx * 512 < x1; tx++)
      for (let tz = Math.floor(z0 / 512); tz * 512 < z1; tz++) tiles.add(`${tx}_${tz}`);
  };
  for (const r of RING5_RECTS_VD) cover(r);
  // The pinned manifest decides what exists.
  const manifest = JSON.parse(readFileSync(join(HERE, '..', '.cache', 'valdrada', 'manifest.json'), 'utf8'));
  return [...tiles].filter((k) => manifest.tiles[k]).sort((a, b) => {
    const [ax, az] = a.split('_').map(Number), [bx, bz] = b.split('_').map(Number);
    return az - bz || ax - bx;
  });
})();

/** A Valdrada world box ([x0, y0, z0, x1, y1, z1]) overlapping the ring region. */
export function inRing5Vd(box) {
  return RING5_RECTS_VD.some(([x0, z0, x1, z1]) => box[0] < x1 && box[3] > x0 && box[2] < z1 && box[5] > z0);
}

/** The region in scene metres (the Valdrada->scene map is affine: rects stay rects). */
export function ring5RectsScene(affine) {
  const { sx, ox, sz, oz } = affine;
  return RING5_RECTS_VD.map(([x0, z0, x1, z1]) => [Math.min(x0 * sx + ox, x1 * sx + ox), Math.min(z0 * sz + oz, z1 * sz + oz), Math.max(x0 * sx + ox, x1 * sx + ox), Math.max(z0 * sz + oz, z1 * sz + oz)]);
}

export function inRing5Scene(x, z, rects) {
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

/** The structure ids already baked: the home pack and rings 1-4 (VD_BLOCKS, VD_BLOCKS_RING1..4). */
export function bakedRing5Ids() {
  const ids = new Set();
  for (const [dir, name] of [['data', 'VD_BLOCKS'], ['data-ring1', 'VD_BLOCKS_RING1'], ['data-ring2', 'VD_BLOCKS_RING2'], ['data-ring3', 'VD_BLOCKS_RING3'], ['data-ring4', 'VD_BLOCKS_RING4']]) {
    const ts = readFileSync(join(ROOT, `packages/app/features/game/world/vd-port/blocks/${dir}/manifest.ts`), 'utf8');
    const vd = JSON.parse(ts.slice(ts.indexOf(`${name} = `) + `${name} = `.length, ts.indexOf(' as const;')));
    for (const s of vd.structures) ids.add(s.id);
  }
  return ids;
}
