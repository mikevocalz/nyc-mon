// Ring 3 of the Valdrada expansion: Central Park's north end, above (north of) 110th Street — Harlem Meer and the
// Conservatory Garden — east of ring 2 (ring2.mjs: City College / Hamilton Heights).
//
// Region, Valdrada world metres (x east, z south; verified against the compiled footprints in the pinned manifest,
// tooling/city/.cache/valdrada/manifest.json):
//   x [2100, 4100] x z [-5100, -3200]  the park's north end: 5th Avenue from ~W 96th St (z ~-3200) to Central Park
//                                    North (z ~-4700), plus the Harlem Meer shore and the Conservatory Garden.
//                                    West edge continues ring 2's x 2100 (St Nicholas Avenue / Central Park
//                                    West); south edge holds at ~96th so the park's middle stays a later ring.
// Ring 2 already covers x [0, 2100] x z [-5632, -4400] and x [1900, 2100] x z [-4400, -2990] beside it, ring 1
// x [0, 1900] x z [-4400, -2000] and x [-400, 1600] x z [-2400, -800]; the bake skips ids already in VD_BLOCKS,
// VD_BLOCKS_RING1 and VD_BLOCKS_RING2, so nothing is baked twice.
//
// Tiles: the 20 pinned 512 m tiles that intersect the region and exist in the cache (x 4..8, z -10..-7).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/** Region rects in Valdrada world metres: [x0, z0, x1, z1]. */
export const RING3_RECTS_VD = [
  [1900, -5100, 4100, -3200],
];

export const RING3_TILES = (() => {
  const tiles = new Set();
  const cover = ([x0, z0, x1, z1]) => {
    for (let tx = Math.floor(x0 / 512); tx * 512 < x1; tx++)
      for (let tz = Math.floor(z0 / 512); tz * 512 < z1; tz++) tiles.add(`${tx}_${tz}`);
  };
  for (const r of RING3_RECTS_VD) cover(r);
  // The pinned manifest decides what exists.
  const manifest = JSON.parse(readFileSync(join(HERE, '..', '.cache', 'valdrada', 'manifest.json'), 'utf8'));
  return [...tiles].filter((k) => manifest.tiles[k]).sort((a, b) => {
    const [ax, az] = a.split('_').map(Number), [bx, bz] = b.split('_').map(Number);
    return az - bz || ax - bx;
  });
})();

/** A Valdrada world box ([x0, y0, z0, x1, y1, z1]) overlapping the ring region. */
export function inRing3Vd(box) {
  return RING3_RECTS_VD.some(([x0, z0, x1, z1]) => box[0] < x1 && box[3] > x0 && box[2] < z1 && box[5] > z0);
}

/** The region in scene metres (the Valdrada->scene map is affine: rects stay rects). */
export function ring3RectsScene(affine) {
  const { sx, ox, sz, oz } = affine;
  return RING3_RECTS_VD.map(([x0, z0, x1, z1]) => [Math.min(x0 * sx + ox, x1 * sx + ox), Math.min(z0 * sz + oz, z1 * sz + oz), Math.max(x0 * sx + ox, x1 * sx + ox), Math.max(z0 * sz + oz, z1 * sz + oz)]);
}

export function inRing3Scene(x, z, rects) {
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

/** The structure ids already baked: the home pack and rings 1-2 (VD_BLOCKS, VD_BLOCKS_RING1, VD_BLOCKS_RING2). */
export function bakedRing3Ids() {
  const ids = new Set();
  for (const [dir, name] of [['data', 'VD_BLOCKS'], ['data-ring1', 'VD_BLOCKS_RING1'], ['data-ring2', 'VD_BLOCKS_RING2']]) {
    const ts = readFileSync(join(ROOT, `packages/app/features/game/world/vd-port/blocks/${dir}/manifest.ts`), 'utf8');
    const vd = JSON.parse(ts.slice(ts.indexOf(`${name} = `) + `${name} = `.length, ts.indexOf(' as const;')));
    for (const s of vd.structures) ids.add(s.id);
  }
  return ids;
}
