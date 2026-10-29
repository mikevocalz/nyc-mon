// Ring 6 of the Valdrada expansion: Downtown — SoHo and the cast-iron blocks, Tribeca, the Civic Center, the
// Financial District's supertall rows (the Woolworth, One WTC, 40 Wall, 70 Pine, 28 Liberty, 8 Spruce, 56 Leonard),
// Trinity Church, Federal Hall, the NYSE, Battery Park — and the harbour: Ellis Island and the Statue of Liberty
// (her pedestal and Fort Wood on Liberty Island) — everything below (south of) ring 5's z edge (ring5.mjs: Midtown,
// ~59th to ~23rd St).
//
// Region, Valdrada world metres (x east, z south; verified against the compiled footprints in the pinned manifest,
// tooling/city/.cache/valdrada/manifest.json). The East River between FiDi and Brooklyn is narrower than the
// Manhattan blocks are deep, so a single straight east edge can't hug the shore: the region stair-steps it —
//   x [-4400, -200]  x z [5000, 7800]   23rd St to ~City Hall, Hudson shore to past Alphabet City and Two Bridges
//                                     (piers to x ~-400 kept; the Brooklyn shore here is Williamsburg, x > +900);
//   x [-4400, -1700] x z [7800, 8250]   the shore swings west through Corlears Hook; the Navy Yard's west edge
//                                     (~x -1586) stays out;
//   x [-4400, -2000] x z [8250, 8700]   the Seaport/FiDi shore; DUMBO (x >= ~-1840) stays out;
//   x [-4400, -3000] x z [8700, 9500]   the Battery tip: Whitehall, South Ferry and Battery Park to the last
//                                     pinned row; Brooklyn Heights and the Bridge Park piers (x >= ~-2850) stay
//                                     out — a sliver of the Columbia Street waterfront (x -3100..-3000) may bake;
//   x [-6700, -5500] x z [8900, 11000]  the harbour's west half: Ellis Island (tile -12_17/18) and Liberty Island
//                                     (tile -13_20, Fort Wood and the statue). Liberty State Park and Governors
//                                     Island are unpinned or out of it.
// landmarkSpec.js ids 22, 26, 37, 38, 39, 40, 41, 42, 51, 52, 53, 67 and 68 stand in it (One WTC, the Woolworth,
// Trinity Church, Federal Hall, the NYSE, the Municipal Building, 56 Leonard, 8 Spruce, 40 Wall, 70 Pine, 28
// Liberty, the Statue of Liberty and the Liberty Island buildings).
// Ring 5 already covers x [-3100, 1500] x z [2100, 5000] above them — a structure whose box straddles the shared
// z 5000 edge baked with ring 5 — and rings 1-4 sit far north; the bake skips ids already in VD_BLOCKS and
// VD_BLOCKS_RING1..5, so nothing is baked twice.
//
// Tiles: the 72 pinned 512 m tiles that intersect the region and exist in the cache (x -8..-1 z 9..15, the west
// shore ragged at x -9; x -8..-4 at z 16 and -8..-6 at z 17-18 down to the Battery; then the harbour's
// -12_17, -12_18, -11_18, -13_19, -13_20 and -12_20).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/** Region rects in Valdrada world metres: [x0, z0, x1, z1]. */
export const RING6_RECTS_VD = [
  [-4400, 5000, -200, 7800],
  [-4400, 7800, -1700, 8250],
  [-4400, 8250, -2000, 8700],
  [-4400, 8700, -3000, 9500],
  [-6700, 8900, -5500, 11000],
];

export const RING6_TILES = (() => {
  const tiles = new Set();
  const cover = ([x0, z0, x1, z1]) => {
    for (let tx = Math.floor(x0 / 512); tx * 512 < x1; tx++)
      for (let tz = Math.floor(z0 / 512); tz * 512 < z1; tz++) tiles.add(`${tx}_${tz}`);
  };
  for (const r of RING6_RECTS_VD) cover(r);
  // The pinned manifest decides what exists.
  const manifest = JSON.parse(readFileSync(join(HERE, '..', '.cache', 'valdrada', 'manifest.json'), 'utf8'));
  return [...tiles].filter((k) => manifest.tiles[k]).sort((a, b) => {
    const [ax, az] = a.split('_').map(Number), [bx, bz] = b.split('_').map(Number);
    return az - bz || ax - bx;
  });
})();

/** A Valdrada world box ([x0, y0, z0, x1, y1, z1]) overlapping the ring region. */
export function inRing6Vd(box) {
  return RING6_RECTS_VD.some(([x0, z0, x1, z1]) => box[0] < x1 && box[3] > x0 && box[2] < z1 && box[5] > z0);
}

/** The region in scene metres (the Valdrada->scene map is affine: rects stay rects). */
export function ring6RectsScene(affine) {
  const { sx, ox, sz, oz } = affine;
  return RING6_RECTS_VD.map(([x0, z0, x1, z1]) => [Math.min(x0 * sx + ox, x1 * sx + ox), Math.min(z0 * sz + oz, z1 * sz + oz), Math.max(x0 * sx + ox, x1 * sx + ox), Math.max(z0 * sz + oz, z1 * sz + oz)]);
}

export function inRing6Scene(x, z, rects) {
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

/** The structure ids already baked: the home pack and rings 1-5 (VD_BLOCKS, VD_BLOCKS_RING1..5). */
export function bakedRing6Ids() {
  const ids = new Set();
  for (const [dir, name] of [['data', 'VD_BLOCKS'], ['data-ring1', 'VD_BLOCKS_RING1'], ['data-ring2', 'VD_BLOCKS_RING2'], ['data-ring3', 'VD_BLOCKS_RING3'], ['data-ring4', 'VD_BLOCKS_RING4'], ['data-ring5', 'VD_BLOCKS_RING5']]) {
    const ts = readFileSync(join(ROOT, `packages/app/features/game/world/vd-port/blocks/${dir}/manifest.ts`), 'utf8');
    const vd = JSON.parse(ts.slice(ts.indexOf(`${name} = `) + `${name} = `.length, ts.indexOf(' as const;')));
    for (const s of vd.structures) ids.add(s.id);
  }
  return ids;
}
