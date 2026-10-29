// Bakes every storefront Valdrada builds inside the bundled tile into
// packages/app/features/game/world/vd-port/storefronts/plan.generated.ts (the plan: fronts, bays, signs, awnings in
// scene metres) and fascia-atlas.generated.ts (one R8 coverage atlas holding every real sign's lettering).
//
// Source: Valdrada @ 2724c79 (github.com/mkturkcan/valdrada, MIT), ~/src/valdrada by default:
//   1. client/src/city/fk/specs/{west,bid1,bid2,bid3,bid4,east,hpt}.js, matched to the compiled footprints exactly as
//      fk/facades.js `apply` does (SEGS order, `at` then `also` points, one spec per footprint), each face resolved with
//      fk/facadeKit.js makeB (front: the edge facing 125th Street, nearC125) and resolveEdge, framed by fk/kitGeom.js
//      edgeFrame. Bays, doors, glazing, gates, signs and awnings keep the spec's numbers and facadeKit's defaults.
//   2. client/src/city/namedShops.js NAMED_FRONTS (the Amsterdam Ave fronts at W 120th St), with the lettering each
//      FASCIA painter draws (namedShops.js L189-L226) transcribed below.
//   3. every other compiled building with the STOREFRONT flag and storeH > 2 (world/nycDress.js L529 `store`): on each
//      non-blind edge of 4 m or more, the dresser's storefront units (nycDress.js L737-L745: nU = round((len - 0.6) /
//      5.8), unit width (len - 0.4) / nU), each one src/kit.js K.storefront. Valdrada fills those signs from an invented
//      roster (shopSigns.js / fasciaAtlas.js "generic place words and trade words"); the port draws no name there and
//      closes the gate (owner rule: never a made-up brand).
// Tiles: the cached Valdrada v0.4.0 tiles (tooling/city/.cache/valdrada, valdrada/fetch.mjs), decoded by
// valdrada/decode.mjs, which applies landmarkSpec's BUILDING_OVERRIDES (namedShops' footprints drop their STOREFRONT).
// Placement: Valdrada world metres to scene metres through decode.mjs `toScene` math, unrounded (vd-port/transform.ts).
// Fonts: the spec's own sign font from client/public/fonts/ar33 (Google Fonts, OFL; licence files beside them).
//
// Run: node --import ./tooling/city/vd-port/register-hooks.mjs tooling/city/bake-vd-storefronts.mjs [path/to/valdrada]
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BF, buildingsOf, LANDMARKS, parseTile, project, tileIdsForSquare, unproject } from './valdrada/decode.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const VALDRADA = process.argv.slice(2).find((a, i) => !a.startsWith('--') && process.argv[i + 1] !== '--ring') ?? join(homedir(), 'src/valdrada');
const CITY = join(VALDRADA, 'client/src/city');
const FONTS = join(VALDRADA, 'client/public/fonts/ar33');
const SYS_FONTS = '/System/Library/Fonts/Supplemental';   // the kit atlas's CSS families (macOS)
const TILES = join(ROOT, '.cache/valdrada');
const DATASET = join(ROOT, '../../packages/app/features/game/data/harlem-apollo.json');
const OUT_DIR = join(ROOT, '../../packages/app/features/game/world/vd-port/storefronts');

const dataset = JSON.parse(readFileSync(DATASET, 'utf8'));
const HALF = dataset.extentMeters;
// --ring ring1: the plan also holds the ring district's fronts (tagged ring: 1, baked from the ring's tiles);
// --ring ring2: the union bake — ring 1's fronts are regenerated tagged 1 alongside ring 2's tagged 2.
// storefronts/index.ts draws them, the cell manifest streams nothing extra (the plan is a bundled .ts).
const RING = process.argv.includes('--ring') ? process.argv[process.argv.indexOf('--ring') + 1] : null;
if (RING && RING !== 'ring1' && RING !== 'ring2' && RING !== 'ring3' && RING !== 'ring4' && RING !== 'ring5' && RING !== 'ring6' && RING !== 'ring7') throw new Error(`unknown --ring ${RING}`);
const { RING1_TILES = [], RING1_RECTS_VD = [] } = RING ? await import('./vd-port/ring1.mjs') : {};
const { RING2_TILES = [], RING2_RECTS_VD = [] } = RING === 'ring2' || RING === 'ring3' || RING === 'ring4' || RING === 'ring5' || RING === 'ring6' || RING === 'ring7' ? await import('./vd-port/ring2.mjs') : {};
const { RING3_TILES = [], RING3_RECTS_VD = [] } = RING === 'ring3' || RING === 'ring4' || RING === 'ring5' || RING === 'ring6' || RING === 'ring7' ? await import('./vd-port/ring3.mjs') : {};
const { RING4_TILES = [], RING4_RECTS_VD = [] } = RING === 'ring4' || RING === 'ring5' || RING === 'ring6' || RING === 'ring7' ? await import('./vd-port/ring4.mjs') : {};
const { RING5_TILES = [], RING5_RECTS_VD = [] } = RING === 'ring5' || RING === 'ring6' || RING === 'ring7' ? await import('./vd-port/ring5.mjs') : {};
const { RING6_TILES = [], RING6_RECTS_VD = [] } = RING === 'ring6' || RING === 'ring7' ? await import('./vd-port/ring6.mjs') : {};
const { RING7_TILES = [], RING7_RECTS_VD = [] } = RING === 'ring7' ? await import('./vd-port/ring7.mjs') : {};
const RING_TILES = [...RING1_TILES, ...RING2_TILES, ...RING3_TILES, ...RING4_TILES, ...RING5_TILES, ...RING6_TILES, ...RING7_TILES];
// vd-port/transform.ts valdradaToSceneAffine, for the dataset origin
const R_M = 6_371_008.8, DEG = Math.PI / 180;
const LAT0 = 40.7831, LON0 = -73.9712, MLAT = 111132.0, MLON = 111320.0 * Math.cos(LAT0 * DEG);
const [lon0, lat0] = dataset.origin;
const AF = { sx: (DEG * R_M * Math.cos(lat0 * DEG)) / MLON, ox: (LON0 - lon0) * DEG * R_M * Math.cos(lat0 * DEG), sz: (DEG * R_M) / MLAT, oz: -(LAT0 - lat0) * DEG * R_M };
const toScene = (x, z) => [x * AF.sx + AF.ox, z * AF.sz + AF.oz];
const inHome = ([x, z]) => Math.abs(x) <= HALF && Math.abs(z) <= HALF;
// a point inside a ring region (scene metres; the Valdrada->scene map is affine, the rects stay rects); the ring
// number each rect set belongs to, for the fronts' `ring` tag
const sceneRects = (rects) => rects.map(([x0, z0, x1, z1]) => { const [ax, az] = toScene(x0, z0), [bx, bz] = toScene(x1, z1); return [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)]; });
const R1_SCENE = sceneRects(RING1_RECTS_VD), R2_SCENE = sceneRects(RING2_RECTS_VD), R3_SCENE = sceneRects(RING3_RECTS_VD), R4_SCENE = sceneRects(RING4_RECTS_VD), R5_SCENE = sceneRects(RING5_RECTS_VD), R6_SCENE = sceneRects(RING6_RECTS_VD), R7_SCENE = sceneRects(RING7_RECTS_VD);
const inRects = (rects) => ([x, z]) => rects.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
const inRingRect = (p) => inRects(R1_SCENE)(p) || inRects(R2_SCENE)(p) || inRects(R3_SCENE)(p) || inRects(R4_SCENE)(p) || inRects(R5_SCENE)(p) || inRects(R6_SCENE)(p) || inRects(R7_SCENE)(p);
const inBounds = (p) => inHome(p) || inRingRect(p);
void project; void unproject;

// ------------------------------------------------------------------ colours: pbrLib.js L75-L140 set tints, kitMats.js L40-L55
const SET_TINT = {
  stucco: '#cfc8b8', panel_alu: '#bfc3c7', panel_grey: '#6f7377', metal_painted: '#1f3327', steel_black: '#151617',
  steel_galvanized: '#9c9fa1', alu_clear: '#c4c7ca', alu_bronze: '#4b3a2a', alu_black: '#1c1c1d', alu_white: '#e4e4df',
  stainless: '#b8babc', wood_painted: '#e0dccf', plywood: '#d1c29b', granite_grey: '#8b8a88',
};
const ALIAS = { alu_dark: 'alu_black', aluminum: 'alu_clear', aluminium: 'alu_clear', metal: 'metal_painted', steel: 'steel_black', bronze: 'alu_bronze', copper: 'alu_bronze' };
const hexRgb = (h) => (typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h) ? [1, 3, 5].map((i) => +(parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)) : null);
const numRgb = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => +(v / 255).toFixed(3));
function setRgb(m, fallback = 'alu_clear') {
  const o = m && typeof m === 'object' ? m : { mat: m };
  if (o.tint) return hexRgb(o.tint);
  let name = o.mat || fallback;
  name = ALIAS[name] ?? name;
  if (SET_TINT[name]) return hexRgb(SET_TINT[name]);
  if (/^alu|^stainless/.test(name)) return hexRgb(SET_TINT.alu_clear);
  if (/^(steel|iron)/.test(name)) return hexRgb(SET_TINT.steel_black);
  return hexRgb(SET_TINT[fallback]);
}
// facadeKit.js L800-L806 frameMat (alu_clear's own tint #8f9396; dark anodised frames as a dark paint)
function frameRgb(f, tint) {
  const o = f && typeof f === 'object' ? f : { mat: f || 'alu_clear', tint };
  const name = o.mat || 'alu_clear';
  const t = o.tint || (name === 'alu_clear' ? '#8f9396' : undefined);
  if (/^alu_(black|dark)$/.test(name)) return hexRgb(t || '#1d1e20');
  return t ? hexRgb(t) : setRgb(name);
}
// facadeKit.js L807-L808
const SHOP_TONES = { shop_clothing: [0.62, 0.6, 0.57], shop_food: [0.7, 0.68, 0.62], shop_phone: [0.72, 0.72, 0.74], bank: [0.6, 0.61, 0.64],
  restaurant: [0.46, 0.34, 0.25], fastfood: [0.62, 0.58, 0.54], pharmacy: [0.78, 0.78, 0.78], empty: [0.36, 0.35, 0.34], default: [0.6, 0.58, 0.55] };
const r3 = (v) => Math.round(v * 1000) / 1000;

// ------------------------------------------------------------------ the compiled footprints in bounds (Valdrada world metres)
const recs = [];
const tileIds = [...new Set([...tileIdsForSquare(HALF, 40), ...RING_TILES.map((k) => `t_${k}`)])];
for (const id of tileIds) {
  const f = join(TILES, `${id}.bin`);
  if (!existsSync(f)) throw new Error(`missing ${f}: run node tooling/city/valdrada/fetch.mjs`);
  const buf = readFileSync(f);
  const tile = parseTile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const [ox, oz] = tile.header.origin;
  const XZ = tile.S.bldgXZ;
  for (const b of buildingsOf(tile)) {
    const ring = [];
    for (let i = 0; i < b.len; i++) ring.push([XZ[(b.start + i) * 2] + ox, XZ[(b.start + i) * 2 + 1] + oz]);
    let cx = 0, cz = 0;
    for (const [x, z] of ring) { cx += x; cz += z; }
    cx /= ring.length; cz /= ring.length;
    if (!inBounds(toScene(cx, cz))) continue;   // the dataset keeps a building when its centroid lies inside the square
    recs.push({ b, ring, cx, cz, tile: id });
  }
}

// ------------------------------------------------------------------ kitGeom.js helpers (L480-L537)
const ringArea = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return a / 2; };
const normRing = (r) => (ringArea(r) < 0 ? r.slice().reverse() : r.slice());
function cleanRingMap(ring) {
  const n = ring.length;
  let idx = ring.map((_, i) => i).filter((i) => { const p = ring[i], q = ring[(i + 1) % n]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.02; });
  let changed = true;
  while (changed && idx.length > 3) {
    changed = false;
    for (let k = 0; k < idx.length; k++) {
      const a = ring[idx[(k - 1 + idx.length) % idx.length]], b = ring[idx[k]], c = ring[idx[(k + 1) % idx.length]];
      const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
      if (Math.abs(cr) / L < 0.03) { idx.splice(k, 1); changed = true; break; }
    }
  }
  const map = new Array(n).fill(0);
  for (let e = 0; e < n; e++) { let best = idx.length - 1; for (let k = 0; k < idx.length; k++) if (idx[k] <= e) best = k; map[e] = best; }
  return { ring: idx.map((i) => ring[i]), map };
}
function inRing(ring, x, z) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

// ------------------------------------------------------------------ facadeKit.js L53-L66: 125th Street's centreline
const C125 = [[852.63, -3961.22], [875.29, -3930.42], [913.82, -3874.88], [986.65, -3769.12], [1079.23, -3634.59], [1095.7, -3610.53],
  [1127, -3563.37], [1190.38, -3467.66], [1259.28, -3367.04], [1323.07, -3267.38], [1379.33, -3182.1], [1448.76, -3142.6], [1568.42, -3075.42],
  [1688.6, -3009.58], [1805.25, -2944.55], [1935.74, -2871.79], [2047.62, -2809.59], [2174.76, -2738.9], [2306.01, -2665.95], [2438.99, -2592.04],
  [2575.31, -2516.58], [2722.99, -2434.2], [2847.34, -2365.22], [2982.4, -2290.23], [3193.31, -2172.97], [3371.37, -2074.03]];
function nearC125(x, z) {
  let best = null, bd = 1e9;
  for (let i = 0; i + 1 < C125.length; i++) {
    const [ax, az] = C125[i], [bx, bz] = C125[i + 1], ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L2));
    const px = ax + ex * t, pz = az + ez * t, d = Math.hypot(x - px, z - pz);
    if (d < bd) { bd = d; best = [px, pz]; }
  }
  return [best, bd];
}

// ------------------------------------------------------------------ fk/facades.js apply: specs onto footprints
const SEGS = ['west', 'bid1', 'bid2', 'bid3', 'bid4', 'east', 'hpt'];
const SPECS = [];
for (const s of SEGS) {
  const list = (await import(pathToFileURL(join(CITY, `fk/specs/${s}.js`)).href)).default;
  for (const spec of list) {
    if (!spec || !Array.isArray(spec.at) || spec.at.length < 2 || spec.skip === true) continue;
    const pts = [[+spec.at[0], +spec.at[1]]];
    for (const p of spec.also || []) if (Array.isArray(p) && p.length >= 2) pts.push([+p[0], +p[1]]);
    SPECS.push({ spec, seg: s, pts });
  }
}
const specRecs = new Map();
const claimedByRec = new Set();
for (const r of recs) {
  let minX = 1e9, minZ = 1e9, maxX = -1e9, maxZ = -1e9;
  for (const [x, z] of r.ring) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  let claimed = false;
  for (const S of SPECS) {
    if (claimed) break;
    for (let k = 0; k < S.pts.length; k++) {
      const [px, pz] = S.pts[k];
      if (px < minX || px > maxX || pz < minZ || pz > maxZ || !inRing(r.ring, px, pz)) continue;
      let rec = specRecs.get(S);
      if (!rec) specRecs.set(S, (rec = { spec: S.spec, seg: S.seg, rings: [] }));
      rec.rings.push({ r, primary: k === 0 });
      claimedByRec.add(r);
      claimed = true;
      break;
    }
  }
}

// ------------------------------------------------------------------ sign and awning lettering (the atlas)
const signs = [];      // { text, font, fg, bg, aspect, lines? }
const slotOf = new Map();
function slot(text, font, fg, bg, aspect, sub) {
  const key = JSON.stringify([text, font, fg, bg, Math.round(aspect * 4) / 4, sub ?? '']);
  let i = slotOf.get(key);
  if (i === undefined) { i = signs.length; signs.push({ text, font, fg, bg, aspect, sub }); slotOf.set(key, i); }
  return i;
}
const signText = (sg, bay) => {
  const t = typeof sg.text === 'string' && sg.text.trim() ? sg.text : Array.isArray(sg.lines) ? sg.lines.map((l) => (typeof l === 'string' ? l : l && l.text) || '').join(' ') : '';
  return (t || (bay && typeof bay.name === 'string' ? bay.name : '')).trim();
};

// ------------------------------------------------------------------ 1. the spec'd fronts
const fronts = [];
const stats = { unitGates: [0, 0, 0], specBuildings: 0, specFaces: 0, stores: 0, entrances: 0, doors: 0, gates: 0, signs: 0, awnings: 0, named: 0, units: 0, unitBuildings: 0 };
function frameOf(p0v, p1v) {
  // edgeFrame: p0 = the left end as seen from the street; U along, N = (-Uz, Ux) outward (the compiled winding)
  const p0 = toScene(p0v[0], p0v[1]), p1 = toScene(p1v[0], p1v[1]);
  const Lv = Math.hypot(p1v[0] - p0v[0], p1v[1] - p0v[1]);
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const ux = (p1[0] - p0[0]) / L, uz = (p1[1] - p0[1]) / L;
  // vp0 / vu: the same frame in Valdrada world metres, kept so the tests can check placement against transform.ts
  return { p0: [r3(p0[0]), r3(p0[1])], u: [+ux.toFixed(6), +uz.toFixed(6)], n: [+(-uz).toFixed(6), +ux.toFixed(6)], len: r3(L), k: L / Lv,
    vp0: [r3(p0v[0]), r3(p0v[1])], vu: [+((p1v[0] - p0v[0]) / Lv).toFixed(7), +((p1v[1] - p0v[1]) / Lv).toFixed(7)] };
}
for (const rec of specRecs.values()) {
  const spec = rec.spec;
  const prim = (rec.rings.find((x) => x.primary) || rec.rings[0]).r;
  // makeB (facadeKit.js L103-L155)
  let ring0 = spec.ring && spec.ring.length >= 3 ? normRing(spec.ring.map((p) => [+p[0], +p[1]])) : prim.ring.slice();
  if (ring0.length > 3 && Math.hypot(ring0[0][0] - ring0[ring0.length - 1][0], ring0[0][1] - ring0[ring0.length - 1][1]) < 0.01) ring0.pop();
  const cm = cleanRingMap(ring0);
  const ring = cm.ring, emap = cm.map, n = ring.length;
  let blind = 0;
  if (!spec.ring) {
    const bm = prim.b.blind >>> 0, all = new Array(n).fill(true);
    for (let e = 0; e < ring0.length; e++) if (!(e < 32 && ((bm >>> e) & 1))) all[emap[e]] = false;
    all.forEach((v, i) => { if (v && i < 32) blind |= 1 << i; });
  }
  let cx = 0, cz = 0;
  for (const [x, z] of ring) { cx += x; cz += z; }
  cx /= n; cz /= n;
  let front = -1;
  const [, dC] = nearC125(cx, cz);
  if (dC < 90) {
    let bd = 1e9;
    for (let i = 0; i < n; i++) {
      const a = ring[i], c = ring[(i + 1) % n], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (L < 2) continue;
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L;
      const [p, d] = nearC125(mx, mz);
      if (((p[0] - mx) * nx + (p[1] - mz) * nz) / Math.max(d, 1e-3) < 0.6) continue;
      if (d < bd) { bd = d; front = i; }
    }
  }
  if (front < 0 && !spec.ring && prim.b.frontIdx >= 0 && prim.b.frontIdx < ring0.length) front = emap[prim.b.frontIdx];
  if (front < 0) { let bl = 0; for (let i = 0; i < n; i++) { const a = ring[i], c = ring[(i + 1) % n], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L > bl) { bl = L; front = i; } } }
  const edgeLen = (i) => { const a = ring[i], c = ring[(i + 1) % n]; return Math.hypot(c[0] - a[0], c[1] - a[1]); };
  const nrm = (i) => { const a = ring[i], c = ring[(i + 1) % n], L = edgeLen(i) || 1; return [(c[1] - a[1]) / L, -(c[0] - a[0]) / L]; };
  // partyWall (facadeKit.js L292-L313): two of three points 1.5 m out inside another compiled footprint
  const partyWall = (i) => {
    const a = ring[i], c = ring[(i + 1) % n], [nx, nz] = nrm(i);
    let hits = 0;
    for (const t of [0.25, 0.5, 0.75]) {
      const x = a[0] + (c[0] - a[0]) * t + nx * 1.5, z = a[1] + (c[1] - a[1]) * t + nz * 1.5;
      if (recs.some((o) => o !== prim && Math.abs(o.cx - x) < 200 && Math.abs(o.cz - z) < 200 && inRing(o.ring, x, z))) hits++;
    }
    return hits >= 2;
  };
  const resolveEdge = (e) => {
    if (e === undefined || e === null || e === 'front') return front;
    if (typeof e === 'number') { const k = ((e % emap.length) + emap.length) % emap.length; return emap[k]; }
    const fN = nrm(front);
    if (e === 'corner' || e === 'side') {
      let best = -1, bl = 0, best0 = -1, bl0 = 0;
      for (let i = 0; i < n; i++) {
        if (i === front || ((blind >> i) & 1)) continue;
        const [nx, nz] = nrm(i), d = nx * fN[0] + nz * fN[1], L = edgeLen(i);
        if (Math.abs(d) >= 0.5) continue;
        if (L > bl0) { bl0 = L; best0 = i; }
        if (L > bl && !partyWall(i)) { bl = L; best = i; }
      }
      return best >= 0 ? best : best0;
    }
    if (e === 'rear') {
      let best = -1, bs = 1e9;
      for (let i = 0; i < n; i++) { const [nx, nz] = nrm(i), d = nx * fN[0] + nz * fN[1]; const s = d - edgeLen(i) * 0.001; if (d < -0.5 && s < bs) { bs = s; best = i; } }
      return best;
    }
    if (Array.isArray(e) && e.length >= 4) {
      const mx = (e[0] + e[2]) / 2, mz = (e[1] + e[3]) / 2;
      let best = -1, bd = 1e9;
      for (let i = 0; i < n; i++) { const a = ring[i], c = ring[(i + 1) % n], d = Math.hypot((a[0] + c[0]) / 2 - mx, (a[1] + c[1]) / 2 - mz); if (d < bd) { bd = d; best = i; } }
      return best;
    }
    return -1;
  };
  let any = false, faceNo = -1;
  for (const fs of spec.faces || []) {
    faceNo++;
    const base = fs && fs.base;
    if (!base || !Array.isArray(base.bays)) continue;
    const ei = resolveEdge(fs.edge);
    if (ei < 0) continue;
    const F = frameOf(ring[(ei + 1) % n], ring[ei]);
    const baseH = +(base.h ?? 4.2);
    const fasc = base.fascia || null;
    const out = { src: 0, id: `${spec.id ?? prim.tile + ':' + prim.b.i}#${faceNo}`, addr: spec.addr ?? '', ...F, bays: [], signs: [], awnings: [] };
    const proud = [];   // gate boxes (B.proud): a sign over one stands proud of it
    for (const bay of base.bays) {
      if (!(bay.u1 > bay.u0) || bay.kind === 'wall') continue;
      const H = +(bay.h ?? baseH);
      if (bay.kind === 'entrance') {
        // entranceGeom (facadeKit.js L1124-L1132)
        const D = { kind: 'solid', w: 1.1, recess: 0.35, ...(bay.door || {}) };
        out.bays.push({ t: 'e', u0: +bay.u0, u1: +bay.u1, h: H, door: { kind: D.kind, w: +D.w, recess: +D.recess, h: D.h ?? 2.4, transom: D.transom ?? 0.5, du: D.du || 0,
          frame: setRgb(D.frame || 'alu_bronze'), leaf: D.kind === 'glass' ? setRgb(D.mat || 'alu_bronze') : hexRgb(D.tint || '#3b3430') } });
        stats.entrances++; stats.doors++;
      } else {
        // storeBay (facadeKit.js L809-L947), STORE_DEF L794
        const g = { bulkhead: 0.45, transom: 0.6, mullions: 2, frame: 'alu_clear', ...(bay.glazing || {}) };
        const hasDoor = bay.door !== null && bay.door !== false && bay.kind !== 'window';
        const D = { u: 0.5, w: 1.0, kind: 'glass', recess: 1.2, ...(bay.door || {}) };
        const IO = typeof bay.interior === 'object' && bay.interior ? bay.interior : { kind: bay.interior };
        const gt = bay.gate || {};
        const gated = gt.kind !== 'none' && gt.box !== false;   // o.gates is true for a spec'd base
        out.bays.push({
          t: 's', u0: +bay.u0, u1: +bay.u1, h: H, setback: bay.setback ?? 0.22,
          glazing: { bulkhead: +(g.bulkhead ?? 0.45), transom: +(g.transom ?? 0.6), mullions: +(g.mullions ?? 2), frameW: Math.max(0.03, Math.min(0.12, +(g.frameW ?? 0.05))),
            frame: frameRgb(g.frame, g.frameTint), kick: setRgb(g.kick || 'alu_clear'), frosted: g.frosted === true || g.glass === 'glass_frosted' },
          door: hasDoor ? { u: D.u ?? 0.5, w: +D.w, double: D.kind === 'double', solid: D.kind === 'solid', recess: Math.max(0, +(D.recess ?? 1.2)) } : null,
          tone: IO.tone ? hexRgb(IO.tone) : SHOP_TONES[IO.kind || 'default'] || SHOP_TONES.default,
          lit: Math.max(0, Math.min(1.5, Math.round((IO.lit ?? bay.lit ?? 1) * 4) / 4)), empty: IO.kind === 'empty',
          gate: gated ? { down: Math.max(0, Math.min(1, +(gt.down || 0))), color: hexRgb(gt.color || '#8e9396') } : null,
        });
        stats.stores++;
        if (hasDoor) stats.doors++;
        if (gated) { stats.gates++; proud.push({ u0: bay.u0 - 0.04, u1: bay.u1 + 0.04, y0: H - 0.34, y1: H + 0.02, w: 0.34 }); }
      }
    }
    // bayExtras (facadeKit.js L1993-L2002) after every bay, so the gate boxes are known
    for (const bay of base.bays) {
      if (!(bay.u1 > bay.u0) || bay.kind === 'wall') continue;
      const H = +(bay.h ?? baseH);
      const sg = bay.sign;
      const text = sg ? signText(sg, bay) : '';
      if (sg && text) {
        const u0 = +(sg.u0 ?? bay.u0), u1 = +(sg.u1 ?? bay.u1), y = +(sg.y ?? (fasc ? baseH + 0.1 : H + 0.1)), h = +(sg.h ?? 0.8);
        if (u1 > u0) {
          let z = 0.005;
          for (const r of proud) if (r.u0 < u1 && r.u1 > u0 && r.y0 < y + h && r.y1 > y) z = Math.max(z, r.w + 0.006);
          const kind = sg.kind || 'panel';
          const fg = hexRgb(sg.fg) ?? [1, 1, 1], bg = kind === 'channel' || kind === 'painted' ? null : hexRgb(sg.bg);
          const sub = typeof sg.sub === 'string' ? sg.sub : sg.sub && sg.sub.text ? String(sg.sub.text) : undefined;
          out.signs.push({ u0, u1, y, h, z: r3(z), kind, lit: sg.lit ? 1 : 0, fg, bg, text, slot: slot(text, sg.font || 'Oswald-600', fg, bg, (u1 - u0) / h, sub) });
          stats.signs++;
        }
      }
      if (bay.awning && bay.awning.kind !== 'none') {
        // awning (facadeKit.js L2050-L2093)
        const A = bay.awning;
        const proj = +(A.proj ?? 1.1), drop = +(A.drop ?? 0.35), a = +bay.u0 + 0.05, c = +bay.u1 - 0.05;
        const top = A.top !== undefined ? +A.top : fasc ? baseH - 0.02 : H + 0.35, low = top - Math.max(0.5, proj * 0.55);
        const aw = { a, c, top, low, proj, drop, kind: A.kind || 'fixed', color: hexRgb(A.color || '#8a1c1c'), slot: -1, fg: null };
        if (typeof A.text === 'string' && A.text.trim()) {
          aw.fg = hexRgb(A.fg || '#ffffff');
          aw.slot = slot(A.text.trim(), A.font || 'Oswald-600', aw.fg, null, (c - a - 0.2) / (drop * 0.9));
        }
        out.awnings.push(aw);
        stats.awnings++;
      }
    }
    if (out.bays.length || out.signs.length || out.awnings.length) { fronts.push(out); stats.specFaces++; any = true; }
  }
  if (any) stats.specBuildings++;
}

// ------------------------------------------------------------------ 2. namedShops.js NAMED_FRONTS
// The source imports three.js for its builders; the data block (L26-L104) is plain, so it is read as text and evaluated.
const named = (() => {
  const src = readFileSync(join(CITY, 'namedShops.js'), 'utf8');
  const a = src.indexOf('export const NAMED_FRONTS = ['), b = src.indexOf('\n];', a);
  if (a < 0 || b < 0) throw new Error('namedShops.js: NAMED_FRONTS block not found');
  return new Function(`return ${src.slice(a + 'export const NAMED_FRONTS = '.length, b + 2)}`)();
})();
// FASCIA painters (namedShops.js L189-L226): the lines each one letters and their colours
const FASCIA_TEXT = {
  hartleyChemist: { text: 'HARTLEY CHEMIST', fg: '#e3261d', font: 'Oswald-700' },
  pharmacy: { text: 'PHARMACY', fg: '#e3261d', font: 'Oswald-700' },
  sliced: { text: 'SLICED', fg: '#d8b45a', font: 'PlayfairDisplay-700' },
  suzi: { text: 'SUZI CONFECTIONS', fg: '#f1efe8', font: 'PlayfairDisplay-400' },
  appletreeDeli: { text: 'APPLETREE DELI', fg: '#d8b45a', font: 'PlayfairDisplay-700' },
  cateringAtm: { text: 'DELI ➚ CATERING ➚ ATM', fg: '#d8b45a', font: 'PlayfairDisplay-700' },
  appletreeMarket: { text: 'APPLETREE MARKET', sub: 'EST. 1973', fg: '#d8b45a', font: 'PlayfairDisplay-700' },
  grocery: { text: 'GROCERY', sub: 'FRESH PRODUCE • FLOWERS • HOT FOOD', fg: '#d8b45a', font: 'PlayfairDisplay-700' },
  dunkin: { text: "DUNKIN'", fg: '#f26a21', font: 'ArchivoBlack-400' },
};
const dirOf = (c) => [Math.sin(c * DEG), -Math.cos(c * DEG)];   // namedShops.js L22
for (const NF of named) {
  if (!NF.shops || !NF.shops.length) continue;
  const al = dirOf(NF.along);
  const o = NF.origin, e = [o[0] + al[0] * NF.length, o[1] + al[1] * NF.length];
  // u runs along `along` from the origin; the shop faces `faces`. Seen from the street the run may go right to left
  // (namedShops' sgn), so the frame keeps the origin as p0 and carries the facing normal explicitly.
  const p0 = toScene(o[0], o[1]), p1 = toScene(e[0], e[1]);
  if (!inBounds(p0) && !inBounds(p1)) continue;
  const fa = dirOf(NF.faces);
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const sys = NF.system || {};
  const out = {
    src: 1, id: NF.key, addr: NF.name, vp0: [o[0], o[1]], vu: [+al[0].toFixed(7), +al[1].toFixed(7)], p0: [r3(p0[0]), r3(p0[1])], u: [+((p1[0] - p0[0]) / L).toFixed(6), +((p1[1] - p0[1]) / L).toFixed(6)],
    n: [+fa[0].toFixed(6), +fa[1].toFixed(6)], len: r3(L), k: L / NF.length,
    system: { color: numRgb(sys.color ?? 0x474d55), height: sys.height ?? 4.62, head: sys.head ?? 3.08, fascia: sys.fascia ?? [3.3, (sys.height ?? 4.62) - 0.28], bulk: sys.bulk ?? 0.72, cornice: numRgb(sys.cornice ?? sys.color ?? 0x474d55) },
    shops: [], signs: [], awnings: [], bays: [],
  };
  for (const S of NF.shops) {
    const fx = S.fascia && FASCIA_TEXT[S.fascia.draw];
    const shop = { key: S.key, from: S.from, to: S.to, bays: S.bays || ['win'], frame: S.frame !== undefined ? numRgb(S.frame) : null, fasciaBg: hexRgb(S.fascia?.bg) ?? out.system.color, slot: -1 };
    if (fx) {
      const fw = S.to - S.from - 0.72, fh = out.system.fascia[1] - out.system.fascia[0];
      shop.slot = slot(fx.text, fx.font, hexRgb(fx.fg), shop.fasciaBg, fw / fh, fx.sub);
      out.signs.push({ text: fx.text, u0: S.from + 0.36, u1: S.to - 0.36, y: out.system.fascia[0] + 0.02, h: fh - 0.04, z: 0.222, kind: 'panel', lit: 1, fg: hexRgb(fx.fg), bg: shop.fasciaBg, slot: shop.slot });
      stats.signs++;
    }
    if (S.awning) {
      // buildAwning (namedShops.js L547-L585): the slope from the fascia's foot, a valance, side flaps; a barrel over a span
      const A = S.awning, t = typeof A.text === 'string' ? A.text.trim() : '';
      const xa = S.from + 0.36, xb = S.to - 0.36, w = xb - xa;
      const proj = A.small ? 0.8 : 1.1, drop = A.small ? 0.22 : 0.3, top = out.system.fascia[0] - 0.02;
      const low = top - (A.barrel ? 0.9 : A.small ? 0.62 : 0.86);
      const a = A.span ? xa + A.span[0] * w : xa + 0.05, c = A.span ? xa + A.span[1] * w : xb - 0.05;
      const aw = { a, c, top, low, proj, drop, kind: A.barrel ? 'barrel' : 'named', color: hexRgb(A.color), slot: -1, fg: null };
      // awningArt letters the valance in white (the Spa & Salon one: its address line, its script name, its phones)
      const txt = [t, A.script, A.phone].filter((v) => typeof v === 'string' && v.trim()).join('   ');
      if (txt && !A.barrel) { aw.fg = [1, 1, 1]; aw.slot = slot(txt, 'Oswald-600', aw.fg, null, (c - a) / drop); }
      out.awnings.push(aw);
      stats.awnings++;
    }
    // interiorArt's wall colour per kind (namedShops.js L301); the painted interior canvas itself is not ported
    shop.tone = hexRgb({ pharmacy: '#b9b4aa', deli: '#a9a296', grocery: '#9c9584', pizza: '#b3a07f', candy: '#bda9ad', donut: '#bfae98', salon: '#b8b0a8', lobby: '#8f887c' }[S.interior] || '#aaaaaa');
    out.shops.push(shop);
    stats.stores++;
    stats.doors += shop.bays.filter((k) => k === 'door').length;
  }
  fronts.push(out);
  stats.named++;
}

// ------------------------------------------------------------------ 3. the dresser's storefront units (nycDress.js L529, L592-L796)
// Each unit is kit.js K.storefront with the dresser's FAC8 draw (nycDress.js L781-L796): its sign is one of the kit's
// SIGN_TEXTS (src/textures.js L646-L664, the storefront sign atlas K.storefront reads through extra.signUvFor), about
// 45 % carry an awning in one of AWNING_STYLES (textures.js L703-L708), 14 % a partial gate over the entry and 10 % a
// full one. The strings and colours are read from textures.js itself.
const KIT_TEXTURES = readFileSync(join(VALDRADA, 'src/textures.js'), 'utf8');
const literal = (name) => {
  const a = KIT_TEXTURES.indexOf(`export const ${name} = [`), b = KIT_TEXTURES.indexOf('\n];', a);
  if (a < 0 || b < 0) throw new Error(`textures.js: ${name} not found`);
  return new Function(`return ${KIT_TEXTURES.slice(a + `export const ${name} = `.length, b + 2)}`)();
};
const SIGN_TEXTS = literal('SIGN_TEXTS');
const AWNING_STYLES = literal('AWNING_STYLES');
// signAtlas's four faces by cell (textures.js L675: '900 62px Arial Black', '800 60px Arial', 'bold 62px Georgia',
// '900 58px Verdana'), the macOS files of those families
const KIT_FONTS = ['sys:Arial Black.ttf', 'sys:Arial Bold.ttf', 'sys:Georgia Bold.ttf', 'sys:Verdana Bold.ttf'];
// the cell is 512 x 128 (4:1), stretched over the sign quad whatever the unit's width (kit.js L835-L837)
const kitSlot = SIGN_TEXTS.map(([text, fg, bg], i) => slot(text, KIT_FONTS[i % 4], hexRgb(fg), hexRgb(bg), 4));
const fract = (v) => v - Math.floor(v);
const hash1 = (a, b = 0, c = 0) => fract(Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453);   // nycDress.js L269
const replaceIds = new Set(LANDMARKS.filter((l) => l.mode === 'replace').map((l) => l.id));
for (const r of recs) {
  if (claimedByRec.has(r)) continue;
  const b = r.b;
  if (!((b.flags & BF.STOREFRONT) && b.storeH > 2)) continue;
  if (b.landmarkId > 0 && replaceIds.has(b.landmarkId)) continue;
  const ring = r.ring, n = ring.length;
  let units = 0;
  for (let i = 0; i < n; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.3) continue;
    const blind = (i < 32 && ((b.blind >> i) & 1)) || len < 2.2;
    if (blind || len < 4) continue;
    // the wall-local u runs from a to b with +z outward (dz, -dx); the units sit at 0.2 + (j + 0.5) * uw
    const F = frameOf([ax, az], [bx, bz]);
    F.n = [F.u[1], +(-F.u[0]).toFixed(6)];
    const nU = Math.max(1, Math.round((len - 0.6) / 5.8));
    const uw = (len - 0.4) / nU;
    const out = { src: 2, id: `${r.tile}:${b.i}:${i}`, addr: '', ...F, units: [], signs: [], awnings: [], bays: [] };
    const cv = b.colorVar;
    for (let j = 0; j < nU; j++) {
      const u = 0.2 + (j + 0.5) * uw, x = len / 2 - u;   // op.x = lx(u)
      const sfR = hash1(cv * 311, i, x * 3.1);
      const sign = Math.floor(hash1(cv * 211, i, x) * 64) % SIGN_TEXTS.length;
      const awning = sfR < 0.45 ? Math.floor(hash1(cv * 407, i, x * 1.7) * 64) % AWNING_STYLES.length : -1;
      out.units.push({
        u: r3(u), w: r3(uw), gate: sfR > 0.9 ? 2 : sfR > 0.76 ? 1 : 0, side: hash1(cv * 5, i) < 0.5 ? 1 : -1,
        slot: kitSlot[sign], fg: hexRgb(SIGN_TEXTS[sign][1]), bg: hexRgb(SIGN_TEXTS[sign][2]),
        awning: awning >= 0 ? hexRgb(AWNING_STYLES[awning].base) : null,
      });
      stats.unitGates[sfR > 0.9 ? 2 : sfR > 0.76 ? 1 : 0]++;
    }
    units += nU;
    fronts.push(out);
  }
  if (units) { stats.units += units; stats.unitBuildings++; }
}

// ------------------------------------------------------------------ the fascia atlas: the lettering of every real sign
// One R8 coverage atlas of 256 x 32 cells (fasciaAtlas.js's 8:1 fascia cell at half its 512 x 64, so ~190 real signs
// fit 2048 x 1024: 2 MB, 2.7 MB with mips), 8 columns; the colours stay per vertex. The text is set at 2x on a canvas of
// the sign's own aspect and box-filtered into the cell, so the UVs stretch it back undistorted.
const CW = 256, CH = 32, COLS = 8, RH = CH * 2;
// (+1: the last cell is solid, the coverage the shop rooms sample in the shared lit material)
const rows = Math.max(1, Math.ceil((signs.length + 1) / COLS));
const AH = 1 << Math.ceil(Math.log2(rows * CH)), AW = CW * COLS;
const pnpm = join(ROOT, '../../node_modules/.pnpm');
const ckDir = readdirSync(pnpm).filter((d) => d.startsWith('canvaskit-wasm@')).sort().pop();
if (!ckDir) throw new Error('canvaskit-wasm is not installed (node_modules/.pnpm)');
const ckBin = join(pnpm, ckDir, 'node_modules/canvaskit-wasm/bin');
const CK = await createRequire(import.meta.url)(join(ckBin, 'canvaskit.js'))({ locateFile: (f) => join(ckBin, f) });
const fontFiles = readdirSync(FONTS).filter((f) => f.endsWith('.ttf'));
const faces = new Map();
function typeface(spec) {
  const [key, w] = String(spec || 'Oswald-600').split('-');
  const weight = parseInt(w, 10) || 400;
  const pick = (k) => {
    const c = fontFiles.filter((f) => f.toLowerCase().startsWith(k.toLowerCase()) && !/italic/i.test(f));
    if (!c.length) return null;
    const named = { 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' }[weight];
    return c.find((f) => f.includes(`-${named}.`)) || c.find((f) => /wght|Regular/.test(f)) || c[0];
  };
  const sys = String(spec).startsWith('sys:') ? String(spec).slice(4) : null;
  const file = sys ?? (pick(key) || pick('Oswald'));
  let tf = faces.get(file);
  if (!tf) { tf = CK.Typeface.MakeTypefaceFromData(readFileSync(sys ? join(SYS_FONTS, sys) : join(FONTS, file)).buffer.slice(0)); faces.set(file, tf); }
  return { tf, file };
}
const atlas = new Uint8Array(AW * AH);
const fontsUsed = new Set();
const surface = CK.MakeSurface(8192, RH);
const paint = new CK.Paint(); paint.setColor(CK.WHITE); paint.setAntiAlias(true);
signs.forEach((s, i) => {
  // the text is laid out on a canvas of the sign's own aspect at the cell's height, then resampled into the cell
  const vw = Math.min(8192, Math.max(RH, Math.round(RH * Math.max(1, s.aspect))));
  const cv = surface.getCanvas();
  cv.clear(CK.BLACK);
  const { tf, file } = typeface(s.font);
  fontsUsed.add(file);
  const lines = s.sub ? [[s.text, 0.5], [s.sub, 0.24]] : [[s.text, 0.62]];
  let y = s.sub ? RH * 0.58 : RH * 0.5;
  for (const [t, share] of lines) {
    let size = RH * share;
    const font = new CK.Font(tf, size);
    const width = () => { const ids = font.getGlyphIDs(t); const ws = font.getGlyphWidths(ids); return ws.reduce((a, v) => a + v, 0); };
    let tw = width();
    if (tw > vw * 0.9) { size *= (vw * 0.9) / tw; font.setSize(size); tw = width(); }
    const m = font.getMetrics();
    cv.drawText(t, (vw - tw) / 2, y + (-m.ascent - m.descent) / 2, paint, font);
    y = RH * 0.88;
    font.delete();
  }
  const px = cv.readPixels(0, 0, { width: vw, height: RH, colorType: CK.ColorType.RGBA_8888, alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB });
  const cx = (i % COLS) * CW, cy = Math.floor(i / COLS) * CH;
  for (let yy = 0; yy < CH; yy++) for (let xx = 0; xx < CW; xx++) {
    // box filter over the source columns this cell column covers
    const s0 = (xx * vw) / CW, s1 = ((xx + 1) * vw) / CW;
    let acc = 0, wsum = 0;
    for (const sy of [yy * 2, yy * 2 + 1]) for (let sx = Math.floor(s0); sx < Math.ceil(s1); sx++) { const w = Math.min(s1, sx + 1) - Math.max(s0, sx); acc += px[(sy * vw + sx) * 4] * w; wsum += w; }
    atlas[(cy + yy) * AW + cx + xx] = Math.round(acc / Math.max(1e-6, wsum));
  }
});

// the solid last cell (emit.ts Writer.solidUv)
{
  const n = (AW / CW) * (AH / CH) - 1, cx = (n % COLS) * CW, cy = Math.floor(n / COLS) * CH;
  for (let yy = 0; yy < CH; yy++) atlas.fill(255, (cy + yy) * AW + cx, (cy + yy) * AW + cx + CW);
}

// ------------------------------------------------------------------ write
// a ring's fronts carry ring: N (plan-types.ts): outside the home square, lane B still emits them under its own
// inBounds (the plan's own rect, not the tile's). The tag is the ring the front's ends lie in; a front straddling
// a ring edge keeps the lower ring, as the ring-1 bake tagged every out-of-home front 1.
if (RING) for (const f of fronts) {
  const end = [f.p0[0] + f.u[0] * f.len, f.p0[1] + f.u[1] * f.len];
  f.ring = inHome(f.p0) && inHome(end) ? undefined : inRects(R6_SCENE)(f.p0) || inRects(R6_SCENE)(end) ? 6 : inRects(R7_SCENE)(f.p0) || inRects(R7_SCENE)(end) ? 7 : inRects(R5_SCENE)(f.p0) || inRects(R5_SCENE)(end) ? 5 : inRects(R4_SCENE)(f.p0) || inRects(R4_SCENE)(end) ? 4 : inRects(R3_SCENE)(f.p0) || inRects(R3_SCENE)(end) ? 3 : inRects(R2_SCENE)(f.p0) || inRects(R2_SCENE)(end) ? 2 : 1;
  if (f.ring === undefined) delete f.ring;
}
const header = [
  '// Generated by tooling/city/bake-vd-storefronts.mjs. Do not edit.',
  '// Valdrada @ 2724c79 (github.com/mkturkcan/valdrada, MIT): fk/specs (the measured fronts), namedShops.js NAMED_FRONTS',
  '// and world/nycDress.js storefront units, placed on the bundled tile in scene metres.',
];
const plan = { fronts, atlas: { width: AW, height: AH, cellW: CW, cellH: CH, cols: COLS, count: signs.length }, slots: signs.map((s) => s.text) };
// a JSON string parsed once at load: the plan's union is far past what the type checker can represent
writeFileSync(join(OUT_DIR, 'plan.generated.ts'), `${header.join('\n')}\nimport type { StorefrontPlan } from './plan-types.ts';\n\nexport const VD_STOREFRONT_PLAN: StorefrontPlan = JSON.parse(${JSON.stringify(JSON.stringify(plan))}) as StorefrontPlan;\n`);
writeFileSync(join(OUT_DIR, 'fascia-atlas.generated.ts'), [
  '// Generated by tooling/city/bake-vd-storefronts.mjs. Do not edit.',
  `// One R8 coverage atlas (${AW} x ${AH}, ${CW} x ${CH} cells) of the real sign lettering, set in Valdrada's sign fonts`,
  `// (client/public/fonts/ar33, SIL OFL 1.1): ${[...fontsUsed].sort().join(', ')}.`,
  `export const FASCIA_ATLAS_WIDTH = ${AW};`,
  `export const FASCIA_ATLAS_HEIGHT = ${AH};`,
  `export const FASCIA_ATLAS_R8 = '${Buffer.from(atlas).toString('base64')}';`,
  '',
].join('\n'));
console.log(JSON.stringify({ ...stats, fronts: fronts.length, slots: signs.length, atlas: `${AW}x${AH}`, fonts: [...fontsUsed] }));
