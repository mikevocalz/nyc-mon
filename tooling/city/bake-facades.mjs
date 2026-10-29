// Bakes Valdrada's measured 125th Street facades into
// packages/app/features/game/world/vd-facade-specs.ts for the vd lane.
//
// Source: Valdrada v0.4.0 (commit 2724c79, MIT) client/src/city/fk/specs/*.js, the AR33/AR34 building specs measured
// off rectified facade elevations, and client/src/city/w125eData.js, the Park Avenue Viaduct's four tracks from
// OpenStreetMap (ODbL 1.0, (c) OpenStreetMap contributors).
//
// Per spec building on the tile (matched as bake-storefronts.mjs does: the nyc-mon footprint under the spec's `at`):
//   l   the wall photo layer (vd-facades.ts VD_LAYER) for the spec's wall material, -1 for metal and glass cladding
//   c   the spec's wall tint as display-space RGB floats (world code may not hold hex: streetscape.test.ts)
//   fh  the upper floors' pitch from the spec's front floors (metres), when the spec lists them
//   sh  the ground-floor base height (metres), when the spec gives one
//   hero  the landmarks Valdrada builds with a custom builder: apollo, theresa, studio, sob
// and VD_VIADUCT: the four track centrelines clipped to the tile, in tile metres.
//
// Run: node tooling/city/bake-facades.mjs [path/to/valdrada]
import { readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toScene } from './valdrada/decode.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const VALDRADA = process.argv[2] ?? join(homedir(), 'src/valdrada');
const SPECS = join(VALDRADA, 'client/src/city/fk/specs');
const TILE = join(ROOT, '../../packages/app/features/game/data/harlem-apollo.json');
const OUT = join(ROOT, '../../packages/app/features/game/world/vd-facade-specs.ts');
// bid4 imports bid4_north/south itself; bid3's custom helpers import three, resolved from this repo's node_modules.
const FILES = ['bid1', 'bid2', 'bid3', 'bid4', 'east', 'west', 'hpt'];
const HEROES = { 'bid2:apollo': 'apollo', 'bid2:theresa': 'theresa', 'bid3:studio': 'studio', 'bid3:sob': 'sob' };

// Valdrada's spec helpers import three and earcut at module scope; the specs only need their layout constants. Bare
// specifiers resolve from packages/app (three is its dependency; pnpm does not hoist it), then the repo root, and a
// package neither has becomes an empty default export.
const BASES = ['../../packages/app/package.json', '../../package.json'].map((p) => pathToFileURL(join(ROOT, p)).href);
registerHooks({
  resolve(spec, ctx, next) {
    if (/^[./]|^[a-z]+:/.test(spec)) return next(spec, ctx);
    try { return next(spec, ctx); } catch { /* try the repo's packages next */ }
    for (const parentURL of BASES) { try { return next(spec, { ...ctx, parentURL }); } catch { /* next base */ } }
    return { url: 'data:text/javascript,export default function stub() {}', shortCircuit: true };
  },
});

// Valdrada wall materials -> the five CC0 wall photos (VD_WALL_LAYERS: brown brick, red brick, white brick, stone,
// plaster). Painted and glazed brick take the light brick photo so the tint carries the paint; metal and glass
// cladding take none.
const LAYER = {
  brick_brown: 0, brick_red: 1, brick_red_sooted: 1, brick_tan: 2, brick_buff: 2, brick_glazed_cream: 2, brick_painted: 2,
  terracotta_cream: 2, brownstone: 3, stone_lime: 3, granite_pink: 3, granite_black: 3, concrete_precast: 3,
  concrete_board: 4, stucco: 4, plain_cladding: 4, panel_alu: -1, panel_grey: -1, ribbed: -1, alu_clear: -1,
};
// Valdrada's named stone tints (fk/specs STONE and friends) when a spec gives a constant instead of a hex.
const NAMED_TINT = { stone_lime: '#c9bda7' };

const tile = JSON.parse(readFileSync(TILE, 'utf8'));
const buildings = tile.buildings.map((b) => {
  const ring = []; for (let i = 0; i + 1 < b.p.length; i += 2) ring.push([b.p[i], b.p[i + 1]]);
  let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; }
  return { id: b.id, ring, c: [cx / ring.length, cz / ring.length], cls: b.c };
});
const inRing = (ring, x, z) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i]; const [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};
const buildingAt = (x, z) => {
  const hit = buildings.find((b) => inRing(b.ring, x, z));
  if (hit) return hit;
  let best = null, bestD = 15;
  for (const b of buildings) { const d = Math.hypot(b.c[0] - x, b.c[1] - z); if (d < bestD) { bestD = d; best = b; } }
  return best;
};
const rgb = (hex) => {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255].map((c) => Number(c.toFixed(3)));
};
const r2 = (v) => Math.round(v * 100) / 100;

/** Upper-floor pitch: the floors over the base, weighted by their count. */
function floorPitch(spec) {
  for (const face of spec.faces ?? []) {
    const floors = (face.floors ?? []).filter((f) => Number.isFinite(f.h) && f.h > 2);
    if (!floors.length) continue;
    const n = floors.reduce((s, f) => s + (f.n ?? 1), 0);
    const h = floors.reduce((s, f) => s + (f.n ?? 1) * f.h, 0);
    if (n > 0) return r2(h / n);
  }
  return undefined;
}
function baseHeight(spec) {
  for (const face of spec.faces ?? []) if (Number.isFinite(face.base?.h)) return r2(face.base.h);
  return undefined;
}

const facades = {};
const counts = { specs: 0, matched: 0, tinted: 0, heroes: 0, collisions: 0, skippedGlass: 0 };
for (const f of FILES) {
  const list = (await import(pathToFileURL(join(SPECS, `${f}.js`)).href)).default;
  for (const spec of list) {
    counts.specs++;
    if (!Array.isArray(spec.at)) continue;
    const [sx, sz] = toScene(spec.at[0], spec.at[1]);
    const ours = buildingAt(sx, sz);
    if (!ours) continue;
    counts.matched++;
    const customFn = typeof spec.custom === 'string' ? spec.custom : spec.custom?.fn;
    const hero = HEROES[customFn];
    const mat = spec.wall?.mat;
    const layer = LAYER[mat];
    const color = rgb(spec.wall?.tint) ?? rgb(NAMED_TINT[mat]);
    if (layer === undefined || !color) continue;
    // Two specs on one nyc-mon footprint (our footprint merges two lots): the first, west-to-east, keeps it.
    if (facades[ours.id]) { counts.collisions++; continue; }
    const entry = { s: spec.id, l: layer, c: color };
    const fh = floorPitch(spec); if (fh !== undefined && fh >= 2.4 && fh <= 6) entry.fh = fh;
    const sh = baseHeight(spec); if (sh !== undefined && sh >= 2.4 && sh <= 8) entry.sh = sh;
    if (hero) { entry.hero = hero; counts.heroes++; }
    facades[ours.id] = entry;
    counts.tinted++;
  }
}

// Each hero's 125th Street frontage in tile metres, its u = 0 end first: the west end on the north side of the street,
// the east end on the south side (the specs' convention: u from the left end as seen from the street).
//   apollo  w125cData.js APOLLO.w / .e, the lobby front (north side)
//   sob     the spec ring's south face, SW to SE (north side)
//   studio  the spec ring's north face, east end first (south side)
//   theresa our footprint's edge nearest W 125th St, east end first (south side; TH.front's u runs from the boulevard)
const w125c = await import(pathToFileURL(join(VALDRADA, 'client/src/city/w125cData.js')).href);
const specById = new Map();
for (const f of FILES) for (const s of (await import(pathToFileURL(join(SPECS, `${f}.js`)).href)).default) specById.set(s.id, s);
const seg = (a, b) => [...toScene(a[0], a[1]), ...toScene(b[0], b[1])].map(r2);
const heroIds = Object.fromEntries(Object.entries(facades).filter(([, v]) => v.hero).map(([k, v]) => [v.hero, k]));
const sobRing = specById.get('w125-163').ring;      // NW, NE, SE, SW
const studioRing = specById.get('w125-144').ring;   // the north face is the edge between the two most northern (most -z) corners
const studioNorth = [...studioRing].sort((p, q) => p[1] - q[1]).slice(0, 2).sort((p, q) => q[0] - p[0]);
const w125 = tile.roads.filter((r) => r.n === 'W 125 ST');
const theresa = buildings.find((b) => b.id === heroIds.theresa);
const theresaFront = (() => {
  let best = null, bestD = Infinity;
  for (let i = 0; i < theresa.ring.length; i++) {
    const a = theresa.ring[i], b = theresa.ring[(i + 1) % theresa.ring.length];
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    let d = Infinity;
    for (const r of w125) for (let k = 2; k < r.p.length; k += 2) d = Math.min(d, Math.hypot(mx - (r.p[k - 2] + r.p[k]) / 2, mz - (r.p[k - 1] + r.p[k + 1]) / 2));
    if (d < bestD) { bestD = d; best = a[0] > b[0] ? [a, b] : [b, a]; }
  }
  return best.flat().map(r2);
})();
const frontage = {
  apollo: seg(w125c.APOLLO.w, w125c.APOLLO.e),
  sob: seg(sobRing[3], sobRing[2]),
  studio: seg(studioNorth[0], studioNorth[1]),
  theresa: theresaFront,
};
for (const [hero, f] of Object.entries(frontage)) facades[heroIds[hero]].f = f;

// The Park Avenue Viaduct: track centrelines in tile metres, clipped to the tile's square.
const w125e = await import(pathToFileURL(join(VALDRADA, 'client/src/city/w125eData.js')).href);
const E = tile.extentMeters;
const inTile = ([x, z]) => Math.abs(x) <= E + 40 && Math.abs(z) <= E + 40;
const tracks = w125e.TRACKS.map((t) => {
  const pts = t.map(([x, z]) => toScene(x, z));
  // Keep the run from the first in-tile point to the last, plus one point beyond each end so the span reaches the edge.
  const first = pts.findIndex(inTile);
  if (first < 0) return [];
  let last = first; while (last + 1 < pts.length && inTile(pts[last + 1])) last++;
  return pts.slice(Math.max(0, first - 1), Math.min(pts.length, last + 2)).flatMap(([x, z]) => [r2(x), r2(z)]);
}).filter((t) => t.length >= 4);

const text = [
  '// Generated by tooling/city/bake-facades.mjs. Do not edit.',
  '// 125th Street wall materials, tints, floor pitch and base heights measured by Valdrada v0.4.0',
  '// (client/src/city/fk/specs, MIT), keyed by the nyc-mon building under each spec. VD_VIADUCT is the Park Avenue',
  '// Viaduct\'s four Metro-North tracks (client/src/city/w125eData.js, OpenStreetMap, ODbL 1.0) in tile metres.',
  `export const VD_FACADE_SPECS: Readonly<Record<string, { s: string; l: number; c: readonly [number, number, number]; fh?: number; sh?: number; hero?: 'apollo' | 'theresa' | 'studio' | 'sob'; f?: readonly number[] }>> = ${JSON.stringify(facades)};`,
  `export const VD_VIADUCT: readonly (readonly number[])[] = ${JSON.stringify(tracks)};`,
  '',
].join('\n');
writeFileSync(OUT, text);
console.log(`specs ${counts.specs}, on the tile ${counts.matched}, facades ${counts.tinted} (heroes ${counts.heroes}), shared footprints ${counts.collisions}; viaduct tracks ${tracks.length} (${tracks.map((t) => t.length / 2).join('/')} points); ${(text.length / 1024).toFixed(1)} KB`);
console.log('heroes', Object.entries(facades).filter(([, v]) => v.hero).map(([k, v]) => `${v.hero}=${k}`).join(' '));
