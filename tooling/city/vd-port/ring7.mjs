// Ring 7 of the Valdrada expansion: the Brooklyn waterfront — Greenpoint and the Williamsburg waterfront on the East
// River's east shore, DUMBO and the Navy Yard under the Manhattan and Brooklyn bridges' landings, Brooklyn Heights
// and the Bridge Park piers, Downtown Brooklyn — and the three East River crossings that sit in the pinned tile
// set: the Williamsburg, Manhattan and Brooklyn bridges (city/bridgeKit.js, tagged ring:7 alongside the district).
//
// Region, Valdrada world metres (x east, z south; verified against the compiled footprints in the pinned manifest,
// tooling/city/.cache/valdrada/manifest.json). Ring 6's east edge is the Manhattan shore of the East River; this
// ring picks up where each of its rect rows ends and follows the Brooklyn shore as it swings east then south:
//   x [-200, 2560]   x z [5632, 7800]   East River east of the Midtown/Two Bridges shore: Greenpoint
//                                       (x > +900) and the Williamsburg waterfront to Bushwick Avenue
//                                       (~x +2500); Queens (Long Island City, Hunters Point, z < 5350)
//                                       stays north of the z 5632 edge — it is not Brooklyn;
//   x [-1700, 2560]  x z [7800, 8250]   the channel east of Corlears Hook: south Williamsburg, the
//                                       Williamsburg Bridge's Brooklyn landing (x +916, z ~8100) and
//                                       Vinegar Hill;
//   x [-2000, 2048]  x z [8250, 8700]   DUMBO (x >= ~-1840, held out of ring 6) and the Navy Yard's west
//                                       reach; the Manhattan Bridge's Brooklyn anchorage;
//   x [-3000, 2048]  x z [8700, 9500]   Brooklyn Heights and the Bridge Park piers (x >= ~-2850, held out
//                                       of ring 6), DUMBO south, Fort Greene and Clinton Hill; the Navy
//                                       Yard's east edge (~x +600) and the Brooklyn Bridge's landing;
//   x [-3000, 1536]  x z [9500, 11000]  Downtown Brooklyn to Atlantic Avenue/Barclays (x ~-500, z ~10900),
//                                       the Columbia Street waterfront and Carroll Gardens; Governors
//                                       Island (x ~-3844, z ~10400) stays west of the x -3000 edge and out.
// The three bridges are one structure each built by the bake's own call (harvest.js bridgeStructures — Valdrada
// builds its bridges at boot over tiles/bridges.json, not inside a tile, so no tile ever harvests them):
// brooklyn (x -2936..-1461, z 7892..9309), manhattanBr (x -2029..-1272, z 7502..9317) and williamsburg
// (x -1233..916, z 7278..8107); each box overlaps these rects. Their Manhattan anchorages bake with ring 6's
// tiles (x <= -200/-1700/-2000/-3000 by band) and the spans hang over the river corridor between.
// No landmarkSpec.js id stands in the district (the registry ends at 78, all Manhattan and the harbour) and the
// facade kit's spec boxes (B125, BHPT) and w125* parts are Harlem and Hunters Point, so the tiles here yield no
// lane-A structure — the three `bridge:` structures are the pack.
// Rings 1-6 sit west and north; the bake skips ids already in VD_BLOCKS and VD_BLOCKS_RING1..6, so nothing is
// baked twice.
//
// Tiles: the pinned 512 m tiles that intersect the region and exist in the cache — x -1..4 at z 11..14 (x 0 at
// z 11-12 unpinned: open water), x -4..4 at z 15, x -6..4 at z 16, x -6..3 at z 17-18 and x -6..2 at z 19-21 — 89
// tiles (the manifest decides; Queens north of z 5632 is out). Tiles on ring 6's side of the river are shared with
// it; the region rects and the id dedupe keep each structure in one ring.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/** Region rects in Valdrada world metres: [x0, z0, x1, z1]. */
export const RING7_RECTS_VD = [
  [-200, 5632, 2560, 7800],
  [-1700, 7800, 2560, 8250],
  [-2000, 8250, 2048, 8700],
  [-3000, 8700, 2048, 9500],
  [-3000, 9500, 1536, 11000],
];

/** The three East River bridges lane A bakes for this ring (tiles/bridges.json keys; harvest.js bridgeStructures). */
export const RING7_BRIDGES = ['brooklyn', 'manhattanBr', 'williamsburg'];

export const RING7_TILES = (() => {
  const tiles = new Set();
  const cover = ([x0, z0, x1, z1]) => {
    for (let tx = Math.floor(x0 / 512); tx * 512 < x1; tx++)
      for (let tz = Math.floor(z0 / 512); tz * 512 < z1; tz++) tiles.add(`${tx}_${tz}`);
  };
  for (const r of RING7_RECTS_VD) cover(r);
  // The pinned manifest decides what exists.
  const manifest = JSON.parse(readFileSync(join(HERE, '..', '.cache', 'valdrada', 'manifest.json'), 'utf8'));
  return [...tiles].filter((k) => manifest.tiles[k]).sort((a, b) => {
    const [ax, az] = a.split('_').map(Number), [bx, bz] = b.split('_').map(Number);
    return az - bz || ax - bx;
  });
})();

/** A Valdrada world box ([x0, y0, z0, x1, y1, z1]) overlapping the ring region. */
export function inRing7Vd(box) {
  return RING7_RECTS_VD.some(([x0, z0, x1, z1]) => box[0] < x1 && box[3] > x0 && box[2] < z1 && box[5] > z0);
}

/** The region in scene metres (the Valdrada->scene map is affine: rects stay rects). */
export function ring7RectsScene(affine) {
  const { sx, ox, sz, oz } = affine;
  return RING7_RECTS_VD.map(([x0, z0, x1, z1]) => [Math.min(x0 * sx + ox, x1 * sx + ox), Math.min(z0 * sz + oz, z1 * sz + oz), Math.max(x0 * sx + ox, x1 * sx + ox), Math.max(z0 * sz + oz, z1 * sz + oz)]);
}

export function inRing7Scene(x, z, rects) {
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

/** The structure ids already baked: the home pack and rings 1-6 (VD_BLOCKS, VD_BLOCKS_RING1..6). */
export function bakedRing7Ids() {
  const ids = new Set();
  for (const [dir, name] of [['data', 'VD_BLOCKS'], ['data-ring1', 'VD_BLOCKS_RING1'], ['data-ring2', 'VD_BLOCKS_RING2'], ['data-ring3', 'VD_BLOCKS_RING3'], ['data-ring4', 'VD_BLOCKS_RING4'], ['data-ring5', 'VD_BLOCKS_RING5'], ['data-ring6', 'VD_BLOCKS_RING6']]) {
    const ts = readFileSync(join(ROOT, `packages/app/features/game/world/vd-port/blocks/${dir}/manifest.ts`), 'utf8');
    const vd = JSON.parse(ts.slice(ts.indexOf(`${name} = `) + `${name} = `.length, ts.indexOf(' as const;')));
    for (const s of vd.structures) ids.add(s.id);
  }
  return ids;
}
