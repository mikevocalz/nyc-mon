// Valdrada's ground and the vd-port transform for the lane C bakes, shared by bake-furniture.mjs and bake-structures.mjs.
import { ORIGIN, EXTENT_METERS, parseTile, tileIdsForSquare, unproject } from '../valdrada/decode.mjs';
import { tileBytes } from './valdrada-runtime.mjs';

export const EXTENT = EXTENT_METERS;
// vd-port/transform.ts valdradaToSceneAffine, for the dataset origin
const DEG = Math.PI / 180, R_M = 6_371_008.8;
const LAT0 = 40.7831, LON0 = -73.9712, M_LAT = 111132.0, M_LON = 111320.0 * Math.cos((LAT0 * Math.PI) / 180);
const kx = DEG * R_M * Math.cos(ORIGIN.latitude * DEG), kz = DEG * R_M;
export const AFF = { sx: kx / M_LON, ox: (LON0 - ORIGIN.longitude) * kx, sz: kz / M_LAT, oz: -(LAT0 - ORIGIN.latitude) * kz };
export const toSceneExact = (x, z) => [x * AFF.sx + AFF.ox, z * AFF.sz + AFF.oz];
{ // the affine agrees with decode.mjs's unproject + projectToScene
  const [lon, lat] = unproject(1500, -3000);
  const ex = (lon - ORIGIN.longitude) * kx, ez = -(lat - ORIGIN.latitude) * kz;
  const [ax, az] = toSceneExact(1500, -3000);
  if (Math.hypot(ax - ex, az - ez) > 1e-6) throw new Error('affine transform drifted from decode.mjs');
}

// The ground under a point, in Valdrada's datum: world/assemble.js L1707-1805 (surfHash, sectionY, surfY, padYAt,
// padYNear) over the tile's own compiled sections, as that file asks it. Most of the square is Valdrada's flat stack
// (pavement 3.520, roadway 3.385); Morningside and the Manhattan Valley slope are not, so every piece is measured.
const TILES = new Map(tileIdsForSquare().map((id) => { const t = parseTile(tileBytes(id)); return [`${t.header.tx}_${t.header.tz}`, t]; }));
const SURF = new Map(), surfCell = 4;
function surfHash(t, name) {
  const key = `${t.header.tx}_${t.header.tz}:${name}`;
  if (SURF.has(key)) return SURF.get(key);
  const a = t.S[name], [ox, oz] = t.header.origin;
  let rec = null;
  if (a && a.length >= 9) {
    const H = new Map();
    for (let tr = 0, n = Math.floor(a.length / 9); tr < n; tr++) {
      const o = tr * 9;
      const x0 = a[o] + ox, z0 = a[o + 2] + oz, x1 = a[o + 3] + ox, z1 = a[o + 5] + oz, x2 = a[o + 6] + ox, z2 = a[o + 8] + oz;
      const i0 = Math.floor(Math.min(x0, x1, x2) / surfCell), i1 = Math.floor(Math.max(x0, x1, x2) / surfCell);
      const j0 = Math.floor(Math.min(z0, z1, z2) / surfCell), j1 = Math.floor(Math.max(z0, z1, z2) / surfCell);
      if ((i1 - i0) > 64 || (j1 - j0) > 64) continue;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = i + '_' + j; let arr = H.get(k); if (!arr) H.set(k, (arr = [])); arr.push(tr); }
    }
    rec = { a, H, ox, oz };
  }
  SURF.set(key, rec);
  return rec;
}
function sectionY0(t, name, x, z, tol) {
  const rec = surfHash(t, name);
  if (!rec) return null;
  const { a, H, ox, oz } = rec;
  const list = H.get(Math.floor(x / surfCell) + '_' + Math.floor(z / surfCell));
  if (!list) return null;
  let bestY = null, bestD = 1e9;
  for (const tr of list) {
    const o = tr * 9;
    const x0 = a[o] + ox, y0 = a[o + 1], z0 = a[o + 2] + oz, x1 = a[o + 3] + ox, y1 = a[o + 4], z1 = a[o + 5] + oz, x2 = a[o + 6] + ox, y2 = a[o + 7], z2 = a[o + 8] + oz;
    const d = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2);
    if (Math.abs(d) < 1e-9) continue;
    const l0 = ((z1 - z2) * (x - x2) + (x2 - x1) * (z - z2)) / d, l1 = ((z2 - z0) * (x - x2) + (x0 - x2) * (z - z2)) / d, l2 = 1 - l0 - l1;
    let out = 0;
    if (l0 < 0) out = Math.max(out, -l0 * Math.abs(d) / Math.hypot(x1 - x2, z1 - z2));
    if (l1 < 0) out = Math.max(out, -l1 * Math.abs(d) / Math.hypot(x2 - x0, z2 - z0));
    if (l2 < 0) out = Math.max(out, -l2 * Math.abs(d) / Math.hypot(x0 - x1, z0 - z1));
    if (out < bestD) {
      bestD = out; bestY = l0 * y0 + l1 * y1 + l2 * y2;
      if (out > 0) bestY = Math.min(Math.max(y0, y1, y2), Math.max(Math.min(y0, y1, y2), bestY));
    }
    if (bestD === 0) break;
  }
  return bestD <= tol ? bestY : null;
}
const sectionY = (t, name, x, z, tol) => { const y = sectionY0(t, name, x, z, tol); return y === null && name === 'grass' ? sectionY0(t, 'grassU', x, z, tol) : y; };
const WALK_KINDS = ['sidewalk', 'path', 'brick', 'plaza', 'gravel'], ROAD_KINDS = ['gutter', 'busred', 'asphalt'];
const surfY = (t, x, z, kinds, tol) => { for (const k of kinds) { const y = sectionY(t, k, x, z, tol); if (y !== null) return y; } return null; };
const padYAt = (t, x, z, tol = 0.35) => surfY(t, x, z, WALK_KINDS, tol) ?? sectionY(t, 'grass', x, z, tol) ?? surfY(t, x, z, ROAD_KINDS, tol);
const RING8 = [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2], [0.85, 0.85], [-0.85, 0.85], [0.85, -0.85], [-0.85, -0.85]];
function sampleT(t, x, z) {
  const res = t.header.res, n = res + 1, G = t.S.terrain, [ox, oz] = t.header.origin;
  const fx = Math.min(res - 0.001, Math.max(0, ((x - ox) / 512) * res)), fz = Math.min(res - 0.001, Math.max(0, ((z - oz) / 512) * res));
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  return G[j * n + i] * (1 - u) * (1 - v) + G[j * n + i + 1] * u * (1 - v) + G[(j + 1) * n + i] * (1 - u) * v + G[(j + 1) * n + i + 1] * u * v;
}
/** padYNear (assemble.js L1797) in the tile that holds (x, z), Valdrada world metres. */
export function valdradaGround(x, z) {
  const t = TILES.get(`${Math.floor(x / 512)}_${Math.floor(z / 512)}`);
  if (!t) return null;
  const at = padYAt(t, x, z); if (at !== null) return at;
  let best = null;
  for (const [dx, dz] of RING8) { const y = padYAt(t, x + dx, z + dz); if (y !== null && (best === null || y > best)) best = y; }
  return best !== null ? best : sampleT(t, x, z) + 0.28;
}

