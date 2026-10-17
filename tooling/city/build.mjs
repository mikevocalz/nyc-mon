// Bakes the city dataset the game loads:
// packages/app/features/game/data/harlem-apollo.json, schema version 3, in metres on a local plane
// around the Apollo Theater (+x east, -z north).
//
// v3 merge (docs/plans/harlem-v3-valdrada-prompt.md §5.1): Valdrada v0.4.0 tiles
// (tooling/city/valdrada/decode.mjs, cached by fetch.mjs there) are the source
// for buildings, roads, landmarks, transit and record-placed furniture. The
// OpenStreetMap/Overpass cache (tooling/city/fetch.mjs) stays the source for
// areas, for sidewalk/crossing/cycleway/footway classes CSCL does not carry,
// and for building ids and names where a footprint match lands (G1(b)).
// trees.fill generation is unchanged. Every estimate rule is in `notes`.
//
// Run: node tooling/city/build.mjs
// Valdrada tiles © OpenStreetMap contributors + Mehmet Kerem Turkcan, ODbL 1.0.
// OSM data © OpenStreetMap contributors, ODbL. https://www.openstreetmap.org/copyright
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BF, decodeTile, FURN, LANDMARKS, RECORD_FURN, STYLE, tileIdsForSquare } from './valdrada/decode.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CACHE = join(ROOT, '.cache');
const VD_DIR = join(CACHE, 'valdrada');
const OUT = join(ROOT, '../../packages/app/features/game/data/harlem-apollo.json');
// trees.json is fetched but no longer read: the census list replaces OSM tree nodes in v3.
const NAMES = ['buildings', 'roads', 'areas', 'landmarks'];
const load = async (name) => JSON.parse(await readFile(join(CACHE, `${name}.json`), 'utf8')).elements;
const [buildingEls, roadEls, areaEls, landmarkEls] = await Promise.all(NAMES.map(load));
const mtimes = await Promise.all(NAMES.map((n) => stat(join(CACHE, `${n}.json`)).then((s) => s.mtimeMs)));
const retrievedAt = new Date(Math.max(...mtimes)).toISOString().replace(/\.\d+Z$/, 'Z');
// Valdrada pins: tag/commit and when the tiles were fetched (fetch.mjs records retrievedAt per file).
const pins = JSON.parse(await readFile(join(ROOT, 'valdrada/pins.json'), 'utf8'));
const vdRetrievedAt = Object.values(pins.files)
  .map((f) => f.retrievedAt)
  .filter(Boolean)
  .sort()
  .at(-1)
  ?.replace(/\.\d+Z$/, 'Z') ?? retrievedAt;

// ---- Projection: must stay bit-for-bit identical to the app's formula ----
const ORIGIN = [-73.94975, 40.81005];
const R = 850;
const RADIANS = Math.PI / 180;
const EARTH = 6_371_008.8;
const [lon0, lat0] = ORIGIN;
const project = ({ lat, lon }) => [
  (lon - lon0) * RADIANS * EARTH * Math.cos(lat0 * RADIANS),
  -(lat - lat0) * RADIANS * EARTH,
];
const round = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;
const flat = (pts) => pts.flatMap(([x, z]) => [x, z]);
const inSquare = ([x, z], r = R) => Math.abs(x) <= r && Math.abs(z) <= r;

// ---- Geometry helpers (ported) ----
function simplify(pts, tolerance) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, az] = pts[a];
    const [bx, bz] = pts[b];
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    let best = -1;
    let bestD = tolerance;
    for (let i = a + 1; i < b; i++) {
      // Closed-ring case: a and b coincide, so measure plain distance to a
      const d = len === 0
        ? Math.hypot(pts[i][0] - ax, pts[i][1] - az)
        : Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / len;
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Sutherland–Hodgman against an axis-aligned rectangle */
function clipRing(ring, [minX, minZ, maxX, maxZ]) {
  const edges = [(p) => p[0] >= minX, (p) => p[0] <= maxX, (p) => p[1] >= minZ, (p) => p[1] <= maxZ];
  const cut = [
    (a, b) => [minX, a[1] + ((b[1] - a[1]) * (minX - a[0])) / (b[0] - a[0])],
    (a, b) => [maxX, a[1] + ((b[1] - a[1]) * (maxX - a[0])) / (b[0] - a[0])],
    (a, b) => [a[0] + ((b[0] - a[0]) * (minZ - a[1])) / (b[1] - a[1]), minZ],
    (a, b) => [a[0] + ((b[0] - a[0]) * (maxZ - a[1])) / (b[1] - a[1]), maxZ],
  ];
  let out = ring;
  for (let e = 0; e < 4 && out.length; e++) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const inCur = edges[e](cur);
      const inPrev = edges[e](prev);
      if (inCur) {
        if (!inPrev) out.push(cut[e](prev, cur));
        out.push(cur);
      } else if (inPrev) {
        out.push(cut[e](prev, cur));
      }
    }
  }
  return out;
}

const area = (ring) => {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[(i + 1) % ring.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
};

const inside = ([x, z], ring) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
};

const centroid = (ring) => {
  const a = area(ring);
  if (Math.abs(a) < 1e-9) {
    const n = ring.length;
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  }
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[(i + 1) % ring.length];
    const k = x1 * z2 - x2 * z1;
    cx += (x1 + x2) * k;
    cz += (z1 + z2) * k;
  }
  return [cx / (6 * a), cz / (6 * a)];
};

/** Stitch multipolygon member ways into closed rings */
function assembleRings(parts) {
  const key = (p) => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`;
  const pool = parts.filter((g) => g && g.length > 1).map((g) => [...g]);
  const rings = [];
  while (pool.length) {
    const ring = pool.pop();
    let grown = true;
    while (key(ring[0]) !== key(ring[ring.length - 1]) && grown) {
      grown = false;
      const end = key(ring[ring.length - 1]);
      for (let i = 0; i < pool.length; i++) {
        const g = pool[i];
        if (key(g[0]) === end) ring.push(...g.slice(1));
        else if (key(g[g.length - 1]) === end) ring.push(...g.slice(0, -1).reverse());
        else continue;
        pool.splice(i, 1);
        grown = true;
        break;
      }
    }
    if (ring.length > 3 && key(ring[0]) === key(ring[ring.length - 1])) rings.push(ring);
  }
  return rings;
}

const isClosed = (g) => g.length > 3 && g[0].lat === g[g.length - 1].lat && g[0].lon === g[g.length - 1].lon;

/** Rounds to 0.1 m and removes consecutive duplicates, including the wrap from last to first */
function cleanRing(pts) {
  const out = [];
  for (const [x, z] of pts) {
    const p = [round(x), round(z)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  while (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
  return out;
}

function cleanLine(pts) {
  const out = [];
  for (const [x, z] of pts) {
    const p = [round(x), round(z)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}

const lineLength = (pts) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
};

/** Liang–Barsky clip of one polyline against a square, returning the inside pieces in order */
function clipPolyline(pts, r) {
  const pieces = [];
  let cur = null;
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1];
    const [x1, z1] = pts[i];
    const dx = x1 - x0;
    const dz = z1 - z0;
    let t0 = 0;
    let t1 = 1;
    let ok = true;
    for (const [p, q] of [[-dx, x0 + r], [dx, r - x0], [-dz, z0 + r], [dz, r - z0]]) {
      if (p === 0) {
        if (q < 0) ok = false;
      } else {
        const t = q / p;
        if (p < 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
      }
    }
    if (!ok || t0 > t1) {
      if (cur) pieces.push(cur);
      cur = null;
      continue;
    }
    const a = [x0 + dx * t0, z0 + dz * t0];
    const b = [x0 + dx * t1, z0 + dz * t1];
    if (!cur || t0 > 0) {
      if (cur) pieces.push(cur);
      cur = [a];
    }
    cur.push(b);
    if (t1 < 1) {
      pieces.push(cur);
      cur = null;
    }
  }
  if (cur) pieces.push(cur);
  return pieces;
}

const segDist = ([px, pz], [ax, az], [bx, bz]) => {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
};
const ringDist = (p, ring) => {
  let d = Infinity;
  for (let i = 0; i < ring.length; i++) d = Math.min(d, segDist(p, ring[i], ring[(i + 1) % ring.length]));
  return d;
};

/** Uniform spatial hash over bounding boxes, for the fill-tree proximity tests */
class Grid {
  constructor(cell = 20) {
    this.cell = cell;
    this.map = new Map();
  }
  key(i, j) {
    return i * 100003 + j;
  }
  insert(item, minX, minZ, maxX, maxZ) {
    const c = this.cell;
    for (let i = Math.floor(minX / c); i <= Math.floor(maxX / c); i++) {
      for (let j = Math.floor(minZ / c); j <= Math.floor(maxZ / c); j++) {
        const k = this.key(i, j);
        let list = this.map.get(k);
        if (!list) this.map.set(k, (list = []));
        list.push(item);
      }
    }
  }
  near([x, z], radius) {
    const c = this.cell;
    const seen = new Set();
    for (let i = Math.floor((x - radius) / c); i <= Math.floor((x + radius) / c); i++) {
      for (let j = Math.floor((z - radius) / c); j <= Math.floor((z + radius) / c); j++) {
        for (const item of this.map.get(this.key(i, j)) ?? []) seen.add(item);
      }
    }
    return seen;
  }
}
const bboxOf = (ring) => {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const [x, z] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return [minX, minZ, maxX, maxZ];
};

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const num = (v) => {
  if (v == null) return undefined;
  const n = Number.parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};
const nameOf = (t) => (typeof t.name === 'string' && t.name.trim() ? t.name.trim().slice(0, 120) : undefined);

// ---- Valdrada decode ----------------------------------------------------------
const tileFiles = (await readdir(VD_DIR)).filter((f) => f.endsWith('.bin')).sort();
const vdTiles = [];
for (const f of tileFiles) {
  const buf = await readFile(join(VD_DIR, f));
  const tile = decodeTile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  vdTiles.push(tile);
}
const expectedTiles = new Set(tileIdsForSquare());
const missingTiles = [...expectedTiles].filter((id) => !vdTiles.some((t) => t.key === id));
if (missingTiles.length) {
  console.warn(`WARN valdrada: missing tiles ${missingTiles.join(', ')} (run tooling/city/valdrada/fetch.mjs)`);
}

const RING_MIN_AREA = 4; // same footprint floor v2 used for buildings
const withinReach = (ring) => ring.every(([x, z]) => Math.hypot(x, z) <= 1900);

const vdBuildings = []; // { tileKey, i, ring, holes:[[pt]], height, floors, style, floorH, winW, storeH, frontIdx, flags, landmarkId }
for (const t of vdTiles) {
  for (const b of t.buildings) {
    const ring = cleanRing(b.ring);
    if (ring.length < 3 || Math.abs(area(ring)) < RING_MIN_AREA) continue;
    if (!inSquare(centroid(ring)) || !withinReach(ring)) continue;
    const holes = (b.holes ?? [])
      .map((h) => cleanRing(h.ring))
      .filter((r) => r.length >= 3 && Math.abs(area(r)) >= 1);
    // frontIdx addresses the raw ring; remap it onto the cleaned vertices so
    // `fi` stays inside `p` after duplicate removal (schema cross-check).
    let frontIdx = -1;
    if (b.frontIdx >= 0 && b.ring[b.frontIdx]) {
      const fv = [round(b.ring[b.frontIdx][0]), round(b.ring[b.frontIdx][1])];
      frontIdx = ring.findIndex(([x, z]) => x === fv[0] && z === fv[1]);
    }
    vdBuildings.push({
      tileKey: t.key, index: b.i, ring, holes,
      height: b.height, floors: b.floors, style: b.style, floorH: b.floorH,
      winW: b.winW, storeH: b.storeH, frontIdx, flags: b.flags,
      landmarkId: Math.abs(b.landmarkId),
    });
  }
}

// ---- OSM building rings: the G1(b) id/name donors ----------------------------
const SKIP_BUILDING = new Set(['no', 'construction', 'proposed', 'demolished', 'roof', 'destroyed']);
function skipBuilding(t) {
  if (!t.building || SKIP_BUILDING.has(t.building)) return true;
  if (t.construction || t.proposed || t['demolished:building']) return true;
  const layer = num(t.layer);
  if ((layer !== undefined && layer < 0) || t.location === 'underground') return true;
  return false;
}

const prepRing = (geom, tol) => cleanRing(simplify(geom.map(project), tol));
const ringOk = (r, minArea) => r.length >= 3 && Math.abs(area(r)) >= minArea;

const osmBuildings = []; // { id, ring, t }
const osmKeep = (id, ring, t) => {
  if (!inSquare(centroid(ring)) || !withinReach(ring)) return;
  osmBuildings.push({ id, ring, t });
};
for (const el of buildingEls) {
  const t = el.tags ?? {};
  if (skipBuilding(t)) continue;
  if (el.type === 'way') {
    if (!el.geometry || !isClosed(el.geometry)) continue;
    const ring = prepRing(el.geometry.slice(0, -1), 0.3);
    if (!ringOk(ring, RING_MIN_AREA)) continue;
    osmKeep(`osm:way:${el.id}`, ring, t);
  } else if (el.type === 'relation' && el.members) {
    const outers = assembleRings(el.members.filter((m) => m.type === 'way' && (m.role || 'outer') === 'outer' && m.geometry).map((m) => m.geometry))
      .map((g) => prepRing(g.slice(0, -1), 0.3))
      .filter((r) => ringOk(r, RING_MIN_AREA));
    outers.forEach((outer, k) => osmKeep(k === 0 ? `osm:relation:${el.id}` : `osm:relation:${el.id}:${k}`, outer, t));
  }
}

// G1(b): match each Valdrada footprint to the v2 OSM way it most overlaps.
// Footprint sources differ (DOITT vs OSM), so the match is by sampled overlap
// on a 1 m grid over each ring, scored against the smaller ring; ≥0.5 of the
// smaller covered wins, one OSM id per Valdrada building and vice versa.
function ringCells(ring) {
  const [minX, minZ, maxX, maxZ] = bboxOf(ring);
  const cells = new Set();
  for (let gx = Math.floor(minX); gx <= Math.floor(maxX); gx++) {
    for (let gz = Math.floor(minZ); gz <= Math.floor(maxZ); gz++) {
      if (inside([gx + 0.5, gz + 0.5], ring)) cells.add((gx + 2048) * 4096 + (gz + 2048));
    }
  }
  return cells;
}
const osmCellSets = osmBuildings.map((b) => ringCells(b.ring));
const osmGrid = new Grid(30);
osmBuildings.forEach((b, i) => {
  const [a, c, d, e] = bboxOf(b.ring);
  osmGrid.insert(i, a, c, d, e);
});
const matchScores = new Map(); // vdIdx -> { osmIdx, score }
{
  const pairs = [];
  vdBuildings.forEach((vb, vi) => {
    const vc = ringCells(vb.ring);
    if (!vc.size) return;
    const [minX, minZ, maxX, maxZ] = bboxOf(vb.ring);
    const seen = new Set();
    for (const i of osmGrid.near([(minX + maxX) / 2, (minZ + maxZ) / 2], Math.hypot(maxX - minX, maxZ - minZ) / 2 + 1)) {
      if (seen.has(i)) continue;
      seen.add(i);
      const oc = osmCellSets[i];
      if (!oc.size) continue;
      let shared = 0;
      for (const cell of vc) if (oc.has(cell)) shared++;
      const score = shared / Math.min(vc.size, oc.size);
      if (score >= 0.5) pairs.push([score, vi, i]);
    }
  });
  pairs.sort((x, y) => y[0] - x[0]);
  const taken = new Set();
  for (const [score, vi, i] of pairs) {
    if (matchScores.has(vi) || taken.has(i)) continue;
    matchScores.set(vi, { osmIdx: i, score });
    taken.add(i);
  }
}

// STYLE -> class: docs/design/handoff/harlem-v3.md "STYLE → class mapping"
// (lane A1): brick 0,1,2,7,10 · glass 3,11 · civic 4,8 · brownstone 5 ·
// plain 6,13,14,15 · church 9 · nycha 12. All seven classes are existing;
// no palette tokens were added and Valdrada rgb is not imported (G3).
const STYLE_CLASS = {
  [STYLE.TENEMENT]: 'brick', [STYLE.PREWAR_APT]: 'brick', [STYLE.POSTWAR_BRICK]: 'brick',
  [STYLE.MODERN_GLASS]: 'glass', [STYLE.DECO_MASONRY]: 'civic', [STYLE.ROWHOUSE]: 'brownstone',
  [STYLE.LOFT_CASTIRON]: 'plain', [STYLE.INDUSTRIAL]: 'brick', [STYLE.CIVIC_STONE]: 'civic',
  [STYLE.CHURCH]: 'church', [STYLE.RETAIL_STRIP]: 'brick', [STYLE.GLASS_TOWER_BLUE]: 'glass',
  [STYLE.PROJECT_BRICK]: 'nycha', [STYLE.RETAIL_MODERN]: 'plain', [STYLE.FRAME_HOUSE]: 'plain',
  [STYLE.CONDO_NEW]: 'plain',
};

// BF flags -> `d` bitset in nyc-mon's order (handoff "flags → d bit order"):
// cornice, fire escape, stoop, water tower, storefront, setbacks, gable.
const detailMask = (flags) =>
  (flags & BF.CORNICE ? 1 : 0) | (flags & BF.FIRE_ESCAPE ? 2 : 0) | (flags & BF.STOOP ? 4 : 0)
  | (flags & BF.WATERTOWER ? 8 : 0) | (flags & BF.STOREFRONT ? 16 : 0) | (flags & BF.SETBACKS ? 32 : 0)
  | (flags & BF.GABLE ? 64 : 0);

// Record-or-rule on the wire `e` (v3 semantics: set = a named record supplied
// the field; E1 record-vs-rule table, docs/implementation/harlem-v3-p0-findings.md §2).
// height: DOITT height_roof unless the `4 + hash*4` fallback band [4,8) ran
// (compile.mjs L406) or the building is an OSM gap-fill whose height came from
// levels/typical rules (compile.mjs L535-540). floors: PLUTO numfloors unless
// the written value equals what classify would derive without it
// (classify.mjs L86-89). vs, class and d are always rules: bits stay clear.
const OSM_TYPICAL_HEIGHTS = new Set([11, 12, 15, 18, 20]); // compile.mjs L540 untagged gap-fill table
function heightIsRecord(vb, match) {
  const h = vb.height;
  if (h < 8) return false; // `4 + hash2(cx,cz) * 4` fallback band covers every procedural height
  if (match && match.score >= 0.85) {
    const t = osmBuildings[match.osmIdx].t;
    if (t.height != null) return true; // the OSM height tag is itself a record
    if (t['building:levels'] != null) return false; // levels * 3.4 + 1 is a rule over a record
    if (OSM_TYPICAL_HEIGHTS.has(h)) return false; // untagged gap-fill typical
  }
  return true;
}
function floorsIsRecord(vb) {
  const h = vb.height;
  const derived = new Set([
    Math.max(1, Math.round(h / 3.2)),
    Math.max(1, Math.round(h / 3.6)),
    Math.max(1, Math.round(h / 3.0)),
  ]);
  return !derived.has(vb.floors);
}

const buildings = [];
const buildingRings = []; // parallel: projected ring per output building
const vdLandmarks = new Map(); // landmarkId -> [buildingIdx]
let matchedCount = 0;
vdBuildings.forEach((vb, vi) => {
  const match = matchScores.get(vi);
  const osm = match ? osmBuildings[match.osmIdx] : null;
  const id = osm ? osm.id : `vd:${pins.tag}:${vb.tileKey}:${vb.index}`;
  if (osm) matchedCount++;
  const out = { id, p: flat(vb.ring) };
  if (vb.holes.length) out.i = vb.holes.map(flat);
  out.h = round(Math.min(600, Math.max(2, vb.height)));
  out.c = STYLE_CLASS[vb.style] ?? 'plain';
  const e = (heightIsRecord(vb, match) ? 1 : 0) | (floorsIsRecord(vb) ? 4 : 0);
  if (e) out.e = e;
  const n = osm ? nameOf(osm.t) : undefined;
  if (n) out.n = n;
  if (vb.floors > 0) out.f = vb.floors;
  if (vb.floorH > 0) out.fh = round2(vb.floorH);
  out.vs = vb.style;
  if (vb.storeH > 0) out.sh = round2(vb.storeH);
  if (vb.winW > 0) out.ww = round2(vb.winW);
  if (vb.frontIdx >= 0) out.fi = vb.frontIdx;
  const d = detailMask(vb.flags);
  if (d) out.d = d;
  buildings.push(out);
  buildingRings.push(vb.ring);
  if (vb.landmarkId) {
    const list = vdLandmarks.get(vb.landmarkId) ?? [];
    list.push(buildings.length - 1);
    vdLandmarks.set(vb.landmarkId, list);
  }
});

// ---- Roads: Valdrada (CSCL) + OSM classes CSCL does not carry --------------
const ROAD_CLASS = {
  motorway: 'motorway', trunk: 'trunk', primary: 'primary', secondary: 'secondary', tertiary: 'tertiary',
  residential: 'residential', unclassified: 'residential', living_street: 'living', service: 'service',
  pedestrian: 'pedestrian', footway: 'footway', path: 'footway', cycleway: 'cycleway', track: 'service',
};
const ROAD_WIDTH = {
  motorway: 20, trunk: 18, primary: 18, secondary: 14, tertiary: 12, residential: 9, living: 6, service: 5,
  pedestrian: 6, footway: 2.5, sidewalk: 2.5, crossing: 3, cycleway: 2,
};
const SIDEWALK = { primary: 6, trunk: 6, secondary: 5, tertiary: 4.5, residential: 4.5, living: 2, pedestrian: 3 };
const EXCLUDED_HIGHWAY = new Set(['steps', 'corridor', 'elevator', 'proposed', 'construction', 'platform', 'bus_stop', 'raceway']);

// Valdrada rclass -> class (mapping rule, recorded in notes): rclass 1 street
// -> residential; 2 wide (>=13.5 m CSCL curb-to-curb) -> primary; 3 highway
// (rw 2) -> trunk; 4 bridge (rw 9) -> primary; 5 pedPath -> footway;
// 6 alley (rw 10) -> service. pedStreet (noTraffic) -> pedestrian.
const VD_ROAD_CLASS = { 1: 'residential', 2: 'primary', 3: 'trunk', 4: 'primary', 5: 'footway', 6: 'service' };
// CSCL width rules whose outputs mark `e` (width estimated): blank streetwidth
// defaults 60/30/10 ft (compile.mjs L619), pedStreet plaza width 18.3 (L653),
// pedPath cap 3.5 (L680). After 0.1 m rounding these are the values to mark.
const RULE_WIDTHS = new Set([18.3, 9.1, 3.0, 3.5]);

const roads = [];
const roadIds = new Set();
// Stitch pieces of one CSCL segment cut at a tile boundary back together.
const vdPiecesBySeg = new Map();
for (const t of vdTiles) {
  for (const r of t.roads) {
    const pts = r.pts.map(([x, , z]) => [x, z]);
    if (pts.length < 2) continue;
    const list = vdPiecesBySeg.get(r.segId) ?? [];
    list.push({ pts, r });
    vdPiecesBySeg.set(r.segId, list);
  }
}
const END_JOIN = 0.5;
const nearPt = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= END_JOIN;
function stitch(pieces) {
  const lines = pieces.map((p) => p.pts);
  let joined = true;
  while (joined) {
    joined = false;
    outer: for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const a = lines[i], b = lines[j];
        let merged = null;
        if (nearPt(a[a.length - 1], b[0])) merged = a.concat(b.slice(1));
        else if (nearPt(a[a.length - 1], b[b.length - 1])) merged = a.concat(b.slice(0, -1).reverse());
        else if (nearPt(a[0], b[b.length - 1])) merged = b.concat(a.slice(1));
        else if (nearPt(a[0], b[0])) merged = a.slice(1).reverse().concat(b);
        if (merged) {
          lines.splice(j, 1);
          lines[i] = merged;
          joined = true;
          break outer;
        }
      }
    }
  }
  return lines;
}
for (const [segId, pieces] of vdPiecesBySeg) {
  const r = pieces[0].r;
  let k = 0;
  for (const line of stitch(pieces)) {
    for (const piece of clipPolyline(line, R + 40)) {
      const pts = cleanLine(piece);
      if (pts.length < 2 || lineLength(pts) < 2) continue;
      const c = r.noTraffic && (r.rclass === 1 || r.rclass === 2) ? 'pedestrian' : (VD_ROAD_CLASS[r.rclass] ?? 'residential');
      const w = round(r.width);
      const road = {
        id: k === 0 && !roadIds.has(`cscl:${segId}`) ? `cscl:${segId}` : `cscl:${segId}:${k}`,
        c, w, s: SIDEWALK[c] ?? 0, p: flat(pts),
      };
      roadIds.add(road.id);
      k++;
      if (RULE_WIDTHS.has(w)) road.e = 1;
      if (r.name) road.n = r.name;
      if (r.lanes > 0) road.l = r.lanes;
      if (r.oneway !== 0) road.ow = r.oneway;
      road.sp = r.speed;
      road.sid = segId;
      roads.push(road);
    }
  }
}

// OSM ways in classes CSCL has no record for. Plain footways are dropped when
// a Valdrada pedPath (rclass 5) traces the same line, so paths are not drawn twice.
const OSM_ONLY_CLASSES = new Set(['sidewalk', 'crossing', 'cycleway', 'footway']);
const vdPathSegs = []; // segments of Valdrada pedPaths for the footway dedupe
const vdPathGrid = new Grid(20);
for (const [segId, pieces] of vdPiecesBySeg) {
  if (pieces[0].r.rclass !== 5) continue;
  for (const line of stitch(pieces)) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      vdPathSegs.push([a, b]);
      vdPathGrid.insert(vdPathSegs.length - 1, Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]));
    }
  }
}
const nearVdPath = (p, r) => {
  for (const i of vdPathGrid.near(p, r)) if (segDist(p, vdPathSegs[i][0], vdPathSegs[i][1]) < r) return true;
  return false;
};
const footwayIsDuplicate = (pts) => {
  let covered = 0;
  for (const p of pts) if (nearVdPath(p, 4)) covered++;
  return pts.length > 0 && covered / pts.length >= 0.5;
};
let osmRoadsKept = 0, footwaysDropped = 0;
for (const w of roadEls) {
  const t = w.tags ?? {};
  if (w.type !== 'way' || !w.geometry || w.geometry.length < 2) continue;
  const hw = t.highway;
  if (!hw || EXCLUDED_HIGHWAY.has(hw) || t.area === 'yes' || t.indoor === 'yes') continue;
  if (t.tunnel === 'yes' || t.tunnel === 'building_passage') continue;
  const level = num(t.level);
  const layer = num(t.layer);
  if ((level !== undefined && level < 0) || (layer !== undefined && layer < 0)) continue;
  let c = ROAD_CLASS[hw.replace(/_link$/, '')];
  if (!c) continue;
  if (hw === 'footway' && t.footway === 'sidewalk') c = 'sidewalk';
  else if (hw === 'footway' && t.footway === 'crossing') c = 'crossing';
  if (!OSM_ONLY_CLASSES.has(c)) continue;

  let width = parseHeight(t.width);
  let estimated = false;
  if (!(width > 0)) {
    const lanes = num(t.lanes);
    width = lanes > 0 ? lanes * 3.3 : ROAD_WIDTH[c];
    estimated = true;
  }
  width = round(width);
  let s = SIDEWALK[c] ?? 0;
  const sw = t.sidewalk;
  const both = t['sidewalk:both'];
  if (['no', 'none', 'separate'].includes(sw) || ['separate', 'no'].includes(both)) s = 0;

  const pts = simplify(w.geometry.filter(Boolean).map(project), 0.4);
  let k = 0;
  for (const piece of clipPolyline(pts, R + 40)) {
    const line = cleanLine(piece);
    if (line.length < 2 || lineLength(line) < 2) continue;
    if (c === 'footway' && footwayIsDuplicate(line)) {
      footwaysDropped++;
      continue;
    }
    const road = { id: k === 0 ? `osm:way:${w.id}` : `osm:way:${w.id}:${k}`, c, w: width, s, p: flat(line) };
    if (estimated) road.e = 1;
    const n = nameOf(t);
    if (n) road.n = n;
    roads.push(road);
    osmRoadsKept++;
    k++;
  }
}

function parseHeight(raw) {
  if (raw == null) return undefined;
  const s = String(raw).trim().toLowerCase();
  const feet = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in))?$/);
  if (feet) return Number(feet[1]) * 0.3048 + (feet[2] ? Number(feet[2]) * 0.0254 : 0);
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:m|metres|meters)?$/);
  return m ? Number(m[1].replace(',', '.')) : undefined;
}

// ---- Areas (unchanged: OSM stays the source) --------------------------------
function areaKind(t) {
  const L = t.leisure;
  if (L === 'garden') return 'garden';
  if (['park', 'nature_reserve', 'dog_park'].includes(L)) return 'park';
  if (L === 'pitch' || L === 'track') return 'pitch';
  if (L === 'playground') return 'playground';
  if (['grass', 'village_green', 'recreation_ground', 'cemetery'].includes(t.landuse)) return 'grass';
  if (t.place === 'square' || (t.highway === 'pedestrian' && t.area === 'yes')) return 'plaza';
  if (t.amenity === 'parking') return !t.parking || t.parking === 'surface' ? 'parking' : null;
  if (t.natural === 'water' || t.waterway === 'riverbank') return 'water';
  if (t.amenity === 'school') return 'school';
  return null; // landuse=religious and anything unmatched
}

const SQUARE = [-R, -R, R, R];
const areas = [];
const areaRings = []; // parallel: { k, outer, holes }
const pushArea = (id, k, rawOuter, rawInners, t) => {
  const outer = cleanRing(clipRing(simplify(rawOuter.map(project), 1.0), SQUARE));
  if (!ringOk(outer, 10)) return false;
  const holes = rawInners
    .map((g) => cleanRing(clipRing(simplify(g.map(project), 1.0), SQUARE)))
    .filter((r) => ringOk(r, 4) && inside(centroid(r), outer));
  const out = { id, k, p: flat(outer) };
  if (holes.length) out.i = holes.map(flat);
  const n = nameOf(t);
  if (n) out.n = n;
  areas.push(out);
  areaRings.push({ k, outer, holes });
  return true;
};

for (const el of areaEls) {
  const t = el.tags ?? {};
  const k = areaKind(t);
  if (!k) continue;
  if (el.type === 'way') {
    if (!el.geometry || !isClosed(el.geometry)) continue;
    pushArea(`osm:way:${el.id}`, k, el.geometry.slice(0, -1), [], t);
  } else if (el.type === 'relation' && el.members) {
    const ofRole = (role) =>
      assembleRings(el.members.filter((m) => m.type === 'way' && (m.role || 'outer') === role && m.geometry).map((m) => m.geometry.filter(Boolean)))
        .map((g) => g.slice(0, -1));
    const inners = ofRole('inner');
    let n = 0;
    for (const outer of ofRole('outer')) {
      if (pushArea(n === 0 ? `osm:relation:${el.id}` : `osm:relation:${el.id}:${n}`, k, outer, inners, t)) n++;
    }
  }
}

// ---- Trees: census records (Valdrada FURN.TREE p2==1) + generated fill -------
const censusTrees = [];
for (const t of vdTiles) {
  for (const f of t.furniture) {
    if (f.k !== FURN.TREE || f.p2 !== 1) continue;
    const p = [round(f.x), round(f.z)];
    if (inSquare(p)) censusTrees.push(p);
  }
}

const buildingGrid = new Grid(20);
buildingRings.forEach((ring, i) => {
  const [a, b, c, d] = bboxOf(ring);
  buildingGrid.insert(i, a, b, c, d);
});
const nearBuilding = (p, margin) => {
  for (const i of buildingGrid.near(p, margin)) {
    const ring = buildingRings[i];
    if (inside(p, ring) || ringDist(p, ring) < margin) return true;
  }
  return false;
};
const treeGrid = new Grid(10);
censusTrees.forEach((p, i) => treeGrid.insert(i, p[0], p[1], p[0], p[1]));
const nearCensusTree = (p, r) => {
  for (const i of treeGrid.near(p, r)) if (Math.hypot(censusTrees[i][0] - p[0], censusTrees[i][1] - p[1]) < r) return true;
  return false;
};
const areaGrid = new Grid(40);
areaRings.forEach((a, i) => {
  const [x0, z0, x1, z1] = bboxOf(a.outer);
  areaGrid.insert(i, x0, z0, x1, z1);
});
const inAreaKind = (p, kinds) => {
  for (const i of areaGrid.near(p, 0)) {
    const a = areaRings[i];
    if (kinds.includes(a.k) && inside(p, a.outer) && !a.holes.some((h) => inside(p, h))) return true;
  }
  return false;
};
const pathGrid = new Grid(20);
const pathSegs = [];
for (const r of roads) {
  if (!['footway', 'sidewalk', 'crossing'].includes(r.c)) continue;
  for (let i = 2; i < r.p.length; i += 2) {
    const a = [r.p[i - 2], r.p[i - 1]];
    const b = [r.p[i], r.p[i + 1]];
    pathSegs.push([a, b]);
    pathGrid.insert(pathSegs.length - 1, Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]));
  }
}
const nearPath = (p, r) => {
  for (const i of pathGrid.near(p, r)) if (segDist(p, pathSegs[i][0], pathSegs[i][1]) < r) return true;
  return false;
};

const FILL_CAP = 9000;
const rng = mulberry32(0x4a9011);
const fill = [];
const fillGrid = new Grid(10);
const addFill = (p) => {
  const q = [round(p[0]), round(p[1])];
  fill.push(q);
  fillGrid.insert(fill.length - 1, q[0], q[1], q[0], q[1]);
};
const nearFill = (p, r) => {
  for (const i of fillGrid.near(p, r)) if (Math.hypot(fill[i][0] - p[0], fill[i][1] - p[1]) < r) return true;
  return false;
};

// (a) Street trees: sidewalk slots every 9 m on both sides of the bigger streets
const STREET_TREE_CLASSES = ['residential', 'tertiary', 'secondary', 'primary', 'living'];
let streetCount = 0;
for (const r of roads) {
  if (!STREET_TREE_CLASSES.includes(r.c) || fill.length >= FILL_CAP) continue;
  const pts = [];
  for (let i = 0; i < r.p.length; i += 2) pts.push([r.p[i], r.p[i + 1]]);
  const total = lineLength(pts);
  const offset = r.w / 2 + 1.2;
  for (let s = 4.5; s < total && fill.length < FILL_CAP; s += 9) {
    for (const side of [1, -1]) {
      const along = s + (rng() * 2 - 1);
      const keep = rng() < 0.7;
      if (!keep || along < 12 || along > total - 12) continue;
      // Locate the point and tangent at arc length `along`
      let acc = 0;
      let seg = 1;
      for (; seg < pts.length; seg++) {
        const l = Math.hypot(pts[seg][0] - pts[seg - 1][0], pts[seg][1] - pts[seg - 1][1]);
        if (acc + l >= along) break;
        acc += l;
      }
      if (seg >= pts.length) continue;
      const [ax, az] = pts[seg - 1];
      const [bx, bz] = pts[seg];
      const l = Math.hypot(bx - ax, bz - az) || 1;
      const u = (along - acc) / l;
      const tx = (bx - ax) / l;
      const tz = (bz - az) / l;
      const p = [ax + (bx - ax) * u - tz * offset * side, az + (bz - az) * u + tx * offset * side];
      if (!inSquare(p)) continue;
      if (nearCensusTree(p, 6) || nearFill(p, 4)) continue;
      if (nearBuilding(p, 1.5) || inAreaKind(p, ['water'])) continue;
      addFill(p);
      streetCount++;
    }
  }
}

// (b) Park trees: a jittered 13 m grid inside parks and gardens
let parkCount = 0;
const PARK_SKIP = ['pitch', 'playground', 'water', 'plaza'];
for (const a of areaRings) {
  if ((a.k !== 'park' && a.k !== 'garden') || fill.length >= FILL_CAP) continue;
  const [x0, z0, x1, z1] = bboxOf(a.outer);
  for (let x = x0 + 6.5; x < x1 && fill.length < FILL_CAP; x += 13) {
    for (let z = z0 + 6.5; z < z1 && fill.length < FILL_CAP; z += 13) {
      const p = [x + (rng() * 2 - 1) * 4.5, z + (rng() * 2 - 1) * 4.5];
      if (!inside(p, a.outer) || a.holes.some((h) => inside(p, h)) || !inSquare(p)) continue;
      if (inAreaKind(p, PARK_SKIP) || nearBuilding(p, 3) || nearPath(p, 4)) continue;
      if (nearCensusTree(p, 3) || nearFill(p, 4)) continue;
      addFill(p);
      parkCount++;
    }
  }
}

// ---- Landmarks ---------------------------------------------------------------
// Valdrada is the source (spec §5.1): landmarkSpec.js ids 8/9/10, after the
// AR32C read-time overrides the decoder applies, name the same three keys v2
// shipped. OSM stays the fallback, as v2's query did.
const LANDMARK_TARGETS = [
  { key: 'apollo-theater', landmarkId: 8, re: /Apollo Theat/i },
  { key: 'hotel-theresa', landmarkId: 9, re: /Theresa/i },
  { key: 'acp-state-office', landmarkId: 10, re: /Adam Clayton Powell.*State Office|State Office Building/i },
];
const specById = new Map(LANDMARKS.map((l) => [l.id, l]));
const landmarks = [];
const warnings = [];
for (const { key, landmarkId, re } of LANDMARK_TARGETS) {
  const spec = specById.get(landmarkId);
  const indices = vdLandmarks.get(landmarkId) ?? [];
  let found = null;
  if (indices.length && spec) {
    const at = project({ lat: spec.lat, lon: spec.lon });
    let best = Infinity;
    for (const i of indices) {
      const d = Math.hypot(...centroid(buildingRings[i]).map((v, k) => v - at[k]));
      if (d < best) {
        best = d;
        found = i;
      }
    }
  }
  if (found !== null) {
    const b = buildings[found];
    const [x, z] = centroid(buildingRings[found]);
    landmarks.push({ key, name: b.n ?? spec.name, buildingId: b.id, x: round(x), z: round(z) });
    continue;
  }
  // OSM fallback, as v2: a named building footprint first (nearest the origin
  // wins), else the landmark query's elements by containment or proximity.
  const named = buildings
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.n && re.test(b.n))
    .sort((u, v) => Math.hypot(...centroid(buildingRings[u.i])) - Math.hypot(...centroid(buildingRings[v.i])));
  if (named.length) found = { ...named[0], name: named[0].b.n };
  if (!found) {
    for (const e of landmarkEls.filter((el) => re.test(el.tags?.name ?? ''))) {
      const at = e.center ?? (e.lat != null ? { lat: e.lat, lon: e.lon } : null);
      if (!at) continue;
      const p = project(at);
      let i = buildingRings.findIndex((ring) => inside(p, ring));
      if (i < 0) {
        let best = 25;
        buildingRings.forEach((ring, j) => {
          const d = Math.hypot(...centroid(ring).map((v, k) => v - p[k]));
          if (d < best) {
            best = d;
            i = j;
          }
        });
      }
      if (i >= 0) {
        found = { b: buildings[i], i, name: e.tags.name };
        break;
      }
    }
  }
  if (!found) {
    warnings.push(`landmark ${key}: not found in Valdrada or OSM, omitted`);
    continue;
  }
  const [x, z] = centroid(buildingRings[found.i]);
  landmarks.push({ key, name: found.name, buildingId: found.b.id, x: round(x), z: round(z) });
}

// ---- Transit and record-placed furniture (Valdrada FURN kinds, G2 set) -------
const subway = [];
const shelters = [];
const hydrants = [];
const linknyc = [];
const bikeRacks = [];
for (const t of vdTiles) {
  for (const f of t.furniture) {
    if (!RECORD_FURN.includes(f.k)) continue;
    if (!inSquare([f.x, f.z])) continue;
    const x = round(f.x), z = round(f.z), rot = round2(f.rot);
    if (f.k === FURN.SUBWAY_ENTRANCE) subway.push(x, z);
    else if (f.k === FURN.BUS_SHELTER) shelters.push(x, z);
    else if (f.k === FURN.HYDRANT) hydrants.push(x, z, rot);
    else if (f.k === FURN.LINKNYC) linknyc.push(x, z, rot);
    else if (f.k === FURN.BIKE_RACK) bikeRacks.push(x, z, rot);
  }
}
// ---- Assemble -----------------------------------------------------------------
const dataset = {
  version: 3,
  id: 'harlem-apollo-20261017',
  origin: ORIGIN,
  extentMeters: R,
  sources: [
    {
      url: 'https://overpass-api.de/api/interpreter',
      attribution: '© OpenStreetMap contributors',
      license: 'ODbL-1.0',
      licenseUrl: 'https://www.openstreetmap.org/copyright',
      retrievedAt,
      query:
        'Overpass bbox 40.801327,-73.961275,40.818773,-73.938225 (origin ±970 m): building ways/relations (id and name donors); ' +
        'highway ways in sidewalk/crossing/cycleway/footway classes; leisure park|garden|playground|pitch|track|nature_reserve|dog_park, ' +
        'landuse grass|recreation_ground|village_green|cemetery|religious, natural=water, waterway=riverbank, amenity=parking|school, ' +
        'place=square, highway=pedestrian+area=yes; named landmarks Apollo Theater|Theresa|Adam Clayton Powell (fallback)',
    },
    {
      url: 'https://huggingface.co/datasets/mehmetkeremturkcan/valdrada',
      attribution: `Valdrada ${pins.tag} (commit ${pins.commit}), Mehmet Kerem Turkcan`,
      license: 'ODbL-1.0',
      licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
      retrievedAt: vdRetrievedAt,
      query:
        `Content/tiles ${tileFiles.map((f) => f.replace('.bin', '')).join(' ')} + manifest.json at tag ${pins.tag}, sha256 pinned in ` +
        'tooling/city/valdrada/pins.json. Buildings, roads, landmarks, transit and record furniture are decoded from these tiles. ' +
        'Citation: Turkcan, M.K. Valdrada: a real-data, real-time digital twin of New York City (software), 2026.',
    },
    {
      url: 'https://data.cityofnewyork.us/d/5zhs-2jue',
      attribution: 'NYC Building Footprints (DOITT), via Valdrada',
      license: 'NYC Open Data Terms of Use',
      licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
      retrievedAt: vdRetrievedAt,
      query: 'Building footprint polygons and height_roof, compiled into the Valdrada tiles',
    },
    {
      url: 'https://data.cityofnewyork.us/d/64uk-42ks',
      attribution: 'MapPLUTO (NYC Planning), via Valdrada',
      license: 'NYC Open Data Terms of Use',
      licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
      retrievedAt: vdRetrievedAt,
      query: 'numfloors and classification inputs (bldgclass, yearbuilt, histdist)',
    },
    {
      url: 'https://data.cityofnewyork.us/d/xubg-57si',
      attribution: 'DOB NOW Facades compliance filings (FISP/Local Law 11), via Valdrada',
      license: 'NYC Open Data Terms of Use',
      licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
      retrievedAt: vdRetrievedAt,
      query: 'Exterior wall material, an input to the Valdrada facade typology carried in vs',
    },
    {
      url: 'https://data.cityofnewyork.us/d/inkn-q76z',
      attribution: 'NYC Street Centerline (CSCL), via Valdrada',
      license: 'NYC Open Data Terms of Use',
      licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
      retrievedAt: vdRetrievedAt,
      query: 'Road geometry, streetwidth, travel lanes, trafdir, posted_speed, street names, physicalid',
    },
    {
      url: 'https://data.cityofnewyork.us/d/uvpi-gqnh',
      attribution: '2015 Street Tree Census (NYC Parks), via Valdrada',
      license: 'NYC Open Data Terms of Use',
      licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
      retrievedAt: vdRetrievedAt,
      query: 'trees.census positions (Valdrada TREE records with p2==1: census rows and census-derived infill)',
    },
    {
      url: 'https://data.cityofnewyork.us/d/5bgh-vtsn',
      attribution: 'NYCDEP Citywide Hydrants, via Valdrada',
      license: 'NYC Open Data Terms of Use',
      licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
      retrievedAt: vdRetrievedAt,
      query: 'furniture.hydrant positions',
    },
    {
      url: 'https://data.cityofnewyork.us/d/t4f2-8md7',
      attribution: 'NYC Bus Stop Shelters, via Valdrada',
      license: 'NYC Open Data Terms of Use',
      licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
      retrievedAt: vdRetrievedAt,
      query: 'transit.shelters positions',
    },
    {
      url: 'https://data.cityofnewyork.us/d/s4kf-3yrf',
      attribution: 'LinkNYC Kiosks, via Valdrada',
      license: 'NYC Open Data Terms of Use',
      licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
      retrievedAt: vdRetrievedAt,
      query: 'furniture.linknyc positions',
    },
    {
      url: 'https://data.cityofnewyork.us/d/592z-n7dk',
      attribution: 'NYC DOT Bicycle Parking (CityRacks), via Valdrada',
      license: 'NYC Open Data Terms of Use',
      licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
      retrievedAt: vdRetrievedAt,
      query: 'furniture.bikeRack positions',
    },
    {
      url: 'https://data.ny.gov/d/i9wp-a4ja',
      attribution: 'MTA Subway Entrances and Exits (2024), via Valdrada',
      license: 'NY Open Data Terms of Use',
      licenseUrl: 'https://data.ny.gov/',
      retrievedAt: vdRetrievedAt,
      query: 'transit.subway positions',
    },
  ],
  notes: [
    'Coordinates are metres from origin: x = east, -z = north, rounded to 0.1 m.',
    'v3: buildings, roads, landmarks, transit and record-placed furniture come from Valdrada v0.4.0 tiles (DOITT/PLUTO/CSCL/DOT/MTA records via its compile); OSM stays the source for areas, for sidewalk/crossing/cycleway/footway classes CSCL does not carry, and for building ids and names where a footprint overlap match lands (G1b).',
    'Building e bits are record flags (set = a named record supplies the field): bit 0 height (DOITT height_roof), bit 2 floors (PLUTO numfloors). Bits 1 class, 3 style and 4 detail stay clear: class is derived from vs through the design-handoff STYLE table, and vs and d are compiler rules (Valdrada classify.mjs), never records.',
    'Building h is record height where the e bit 0 is set; cleared where Valdrada fell back (the 4+hash*4 band under 8 m, compile.mjs L406) or where the footprint matches an untagged OSM gap-fill at a typical height (compile.mjs L535-540).',
    'Building f is record floors where e bit 2 is set; cleared where the count equals what classify derives from height alone (classify.mjs L86-89). fh, sh, ww and fi are compiler style rules; d remaps the compiler BF flags into nyc-mon order: cornice, fire escape, stoop, water tower, storefront, setbacks, gable.',
    'Roads: geometry, w, l (lanes), ow (oneway), sp (posted_speed, mph) and sid (CSCL physicalid) are CSCL records via Valdrada; class is a mapping rule over rclass, s an estimated sidewalk width per side by class, and e=1 marks the CSCL default widths (60/30/10 ft) and the pedStreet/pedPath widths (18.3/3.5 m).',
    'OSM ways kept only in sidewalk, crossing, cycleway and footway classes; a footway within 4 m of a CSCL path over half its length is dropped as a duplicate.',
    'trees.census are 2015 Street Tree Census positions via Valdrada (TREE records with p2==1, which also covers census-derived avenue infill). trees.fill are generated decoration with a fixed seed (street trees along sidewalks, park trees on a jittered 13 m grid), not records.',
    'transit.subway are MTA entrance records; transit.shelters are DOT shelter records; furniture.hydrant/linknyc/bikeRack are DEP/LinkNYC/DOT records with a rotation (flat [x, z, rot radians]). Procedural Valdrada furniture kinds (lamps, signage, stoops, fire escapes, water towers, etc.) are not imported (G2).',
    'landmarks come from Valdrada landmarkSpec ids 8/9/10 after its read-time footprint corrections; the OSM name and landmark query stay as fallback.',
    'Buildings are not clipped; one is kept when its footprint centroid lies inside the extent square. Roads are clipped to the extent square plus 40 m.',
  ],
  buildings,
  roads,
  areas,
  trees: { census: flat(censusTrees), fill: flat(fill) },
  landmarks,
  transit: { subway, shelters },
  furniture: { hydrant: hydrants, linknyc, bikeRack: bikeRacks },
};

// ---- Self-checks against the schema rules ----
const problems = [];
const ids = new Set(buildings.map((b) => b.id));
const checkRing = (label, f) => {
  if (f.length < 6 || f.length % 2) return problems.push(`${label}: ring too short`);
  const n = f.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (f[2 * i] === f[2 * j] && f[2 * i + 1] === f[2 * j + 1]) return problems.push(`${label}: zero-length edge`);
  }
};
for (const b of buildings) {
  checkRing(b.id, b.p);
  b.i?.forEach((h) => checkRing(`${b.id} hole`, h));
  if (!(b.h >= 2 && b.h <= 600)) problems.push(`${b.id}: height ${b.h}`);
}
for (const a of areas) checkRing(a.id, a.p);
for (const l of landmarks) if (!ids.has(l.buildingId)) problems.push(`landmark ${l.key}: missing building`);
if (ids.size !== buildings.length) problems.push('duplicate building ids');
if (new Set(roads.map((r) => r.id)).size !== roads.length) problems.push('duplicate road ids');
const text = `${JSON.stringify(dataset)}\n`;
if (/"(user|uid|changeset|timestamp|email|phone)"/.test(text)) problems.push('forbidden field in output');
if (text.length > 3 * 1024 * 1024) problems.push(`output is ${text.length} bytes, over 3 MB`);
if (problems.length) {
  console.error(problems.slice(0, 20).join('\n'));
  process.exit(1);
}

await writeFile(OUT, text);
const countBy = (list, f) => list.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
for (const w of warnings) console.warn(`WARN ${w}`);
console.log(
  `buildings ${buildings.length} ${JSON.stringify(countBy(buildings, (b) => b.c))} id-matched ${matchedCount} (${((100 * matchedCount) / buildings.length).toFixed(1)}%) ` +
    `height record ${buildings.filter((b) => b.e & 1).length} floors record ${buildings.filter((b) => b.e & 4).length}` +
    ` · roads ${roads.length} ${JSON.stringify(countBy(roads, (r) => r.c))} (osm kept ${osmRoadsKept}, footways dropped ${footwaysDropped})` +
    ` · areas ${areas.length} ${JSON.stringify(countBy(areas, (a) => a.k))}` +
    ` · trees census ${censusTrees.length} fill ${fill.length} (street ${streetCount}, park ${parkCount})` +
    ` · landmarks ${landmarks.length}/3 ${landmarks.map((l) => l.key).join(',')}` +
    ` · subway ${subway.length / 2} · shelters ${shelters.length / 2} · hydrants ${hydrants.length / 3} · linknyc ${linknyc.length / 3} · racks ${bikeRacks.length / 3}` +
    ` · ${(Buffer.byteLength(text) / 1024).toFixed(0)} KB · retrievedAt ${retrievedAt}`
);
