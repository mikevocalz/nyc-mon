// Bakes Valdrada's measured 125th Street storefronts into
// packages/app/features/game/world/vd-storefronts.ts for the vd lane.
//
// Source: Valdrada v0.4.0 client/src/city/fk/specs/{bid1,bid2,bid3,bid4,east,west}.js
// (MIT; per the spec headers, measured off rectified facade elevations; schema
// docs/notes/ar33-spec.md). Each building lists faces; each face lists bays with
// u0/u1 in metres from the face's left end as seen from the street, the store
// height, and an optional sign (text, kind, colours, u0/u1, y, h) and awning.
//
// Placement: a face given as a Valdrada segment [x0, z0, x1, z1] is reprojected
// with valdrada/decode.mjs `toScene` (geo.js inverse, then projectToScene).
// A face given as 'front' takes the nyc-mon building under the spec's `at`
// point and its recorded front edge (`fi`), else the edge facing the nearest
// carriageway. Bays scale with the length ratio when the two footprints
// disagree by under 30 %, and are dropped past that.
//
// Colours leave as display-space RGB floats: world code may not hold hex
// (streetscape.test.ts palette rule).
//
// Run: node tooling/city/bake-storefronts.mjs [path/to/valdrada]
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toScene } from './valdrada/decode.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const VALDRADA = process.argv[2] ?? join(homedir(), 'src/valdrada');
const SPECS = join(VALDRADA, 'client/src/city/fk/specs');
const TILE = join(ROOT, '../../packages/app/features/game/data/harlem-apollo.json');
const OUT = join(ROOT, '../../packages/app/features/game/world/vd-storefronts.ts');
const FILES = ['bid1', 'bid2', 'bid3', 'bid4', 'east', 'west'];

const tile = JSON.parse(readFileSync(TILE, 'utf8'));
const buildings = tile.buildings.map((b) => {
  const ring = []; for (let i = 0; i + 1 < b.p.length; i += 2) ring.push([b.p[i], b.p[i + 1]]);
  let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; }
  return { id: b.id, ring, fi: b.fi, c: [cx / ring.length, cz / ring.length] };
});
const carriageways = tile.roads.filter((r) => !['footway', 'sidewalk', 'cycleway', 'pedestrian', 'crossing', 'path', 'steps'].includes(r.c));

const inRing = (ring, x, z) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i]; const [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};
const segDist = (x, z, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
};
const roadGap = (x, z) => {
  let best = Infinity;
  for (const r of carriageways) for (let i = 2; i < r.p.length; i += 2) {
    best = Math.min(best, segDist(x, z, r.p[i - 2], r.p[i - 1], r.p[i], r.p[i + 1]) - r.w / 2);
  }
  return best;
};
const buildingAt = (x, z) => {
  const hit = buildings.find((b) => inRing(b.ring, x, z));
  if (hit) return hit;
  let best = null, bestD = 15;
  for (const b of buildings) { const d = Math.hypot(b.c[0] - x, b.c[1] - z); if (d < bestD) { bestD = d; best = b; } }
  return best;
};
// Orient a wall segment: outward normal away from the building centre, and
// start at the left end as a viewer on the street sees it (left of a viewer
// facing -n is (fz, -fx) with f = -n).
function orient(a, b, centre) {
  let dx = b[0] - a[0], dz = b[1] - a[1]; const len = Math.hypot(dx, dz); dx /= len; dz /= len;
  let nx = dz, nz = -dx;
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
  if ((mx + nx - centre[0]) ** 2 + (mz + nz - centre[1]) ** 2 < (mx - centre[0]) ** 2 + (mz - centre[1]) ** 2) { nx = -nx; nz = -nz; }
  const lx = -nz, lz = nx;
  const [s, e] = a[0] * lx + a[1] * lz >= b[0] * lx + b[1] * lz ? [a, b] : [b, a];
  const ux = (e[0] - s[0]) / len, uz = (e[1] - s[1]) / len;
  return { ax: s[0], az: s[1], dx: ux, dz: uz, nx, nz, len };
}
function frontEdge(b) {
  const n = b.ring.length;
  if (b.fi !== undefined && b.fi >= 0 && b.fi < n) return [b.ring[b.fi], b.ring[(b.fi + 1) % n]];
  let best = null, bestScore = Infinity;
  for (let i = 0; i < n; i++) {
    const a = b.ring[i], c = b.ring[(i + 1) % n]; const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (len < 3) continue;
    const score = roadGap((a[0] + c[0]) / 2, (a[1] + c[1]) / 2) - len * 0.05;
    if (score < bestScore) { bestScore = score; best = [a, c]; }
  }
  return best;
}
const rgb = (hex) => {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255].map((c) => Number(c.toFixed(3)));
};
// The game's pixel font draws A-Z 0-9 . - & ' / only; fold accents, drop the rest.
const latin = (s) => (typeof s === 'string' ? s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 .\-&'/]/g, ' ').replace(/\s+/g, ' ').trim() : '');
const r2 = (v) => Math.round(v * 100) / 100;

const fronts = [];
let specBuildings = 0, matched = 0, bays = 0, signs = 0, awnings = 0, dropped = 0;
for (const f of FILES) {
  const list = (await import(pathToFileURL(join(SPECS, `${f}.js`)).href)).default;
  for (const spec of list) {
    specBuildings++;
    if (!Array.isArray(spec.at)) continue;
    const [sx, sz] = toScene(spec.at[0], spec.at[1]);
    const ours = buildingAt(sx, sz);
    if (!ours) continue;
    matched++;
    for (const face of spec.faces ?? []) {
      const specBays = face.base?.bays ?? [];
      if (!specBays.some((b) => b.kind === 'store' || b.sign || b.awning)) continue;
      let seg;
      if (Array.isArray(face.edge)) {
        seg = [toScene(face.edge[0], face.edge[1]), toScene(face.edge[2], face.edge[3])];
      } else {
        seg = frontEdge(ours);
      }
      if (!seg) continue;
      const o = orient(seg[0], seg[1], ours.c);
      const specLen = Math.max(...specBays.map((b) => b.u1 ?? 0), ...specBays.map((b) => b.sign?.u1 ?? 0));
      const k = specLen > o.len ? o.len / specLen : 1;
      if (k < 0.7) { dropped++; continue; }
      const out = [];
      for (const b of specBays) {
        if (b.kind !== 'store' && !b.sign && !b.awning) continue;
        const bay = { u0: r2(b.u0 * k), u1: r2(b.u1 * k), h: r2(b.h ?? 3.6) };
        const gate = b.gate?.kind ?? 'none';
        bay.gate = gate === 'none' ? 0 : r2(Math.max(0, Math.min(1, b.gate?.down ?? 0)));
        const s = b.sign;
        const text = s ? latin(s.text) || latin(b.name) : '';
        if (s && text) {
          bay.sign = {
            t: text, k: s.kind ?? 'panel',
            u0: r2((s.u0 ?? b.u0) * k), u1: r2((s.u1 ?? b.u1) * k), y: r2(s.y ?? bay.h + 0.1), h: r2(s.h ?? 0.8),
            fg: rgb(s.fg) ?? [1, 1, 1], bg: rgb(s.bg), lit: s.lit ? 1 : 0,
          };
          signs++;
        }
        if (b.awning) {
          bay.aw = { c: rgb(b.awning.color) ?? [0.2, 0.2, 0.2], top: r2(b.awning.top ?? bay.h), proj: r2(b.awning.proj ?? 1.1) };
          awnings++;
        }
        out.push(bay);
        bays++;
      }
      if (out.length) fronts.push({ b: ours.id, ax: r2(o.ax), az: r2(o.az), dx: Number(o.dx.toFixed(4)), dz: Number(o.dz.toFixed(4)), nx: Number(o.nx.toFixed(4)), nz: Number(o.nz.toFixed(4)), len: r2(o.len), bays: out });
    }
  }
}

const text = [
  '// Generated by tooling/city/bake-storefronts.mjs. Do not edit.',
  "// 125th Street storefronts measured by Valdrada v0.4.0 (client/src/city/fk/specs, MIT),",
  '// placed on the nyc-mon tile. Shop names are the signs as Valdrada recorded them.',
  `export const VD_STOREFRONTS = ${JSON.stringify(fronts)} as const;`,
  '',
].join('\n');
writeFileSync(OUT, text);
console.log(`specs ${specBuildings}, on the tile ${matched}, fronts ${fronts.length}, bays ${bays}, signs ${signs}, awnings ${awnings}, faces dropped ${dropped}; ${(text.length / 1024).toFixed(0)} KB`);
