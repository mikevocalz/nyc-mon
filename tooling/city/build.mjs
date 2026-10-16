// Bakes the cached Overpass download (tooling/city/fetch.mjs) into the dataset the game loads:
// packages/app/features/game/data/harlem-apollo.json, schema version 2, in metres on a local plane
// around the Apollo Theater (+x east, -z north).
// Run: node tooling/city/build.mjs
// Adapted from vg-demos-all scripts/osm/{fetch,build}.mjs (MIT, see LICENSE in https://github.com/vietgangzz/vg-demos-all)
// Data © OpenStreetMap contributors, ODbL. https://www.openstreetmap.org/copyright
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CACHE = join(ROOT, '.cache');
const OUT = join(ROOT, '../../packages/app/features/game/data/harlem-apollo.json');
const NAMES = ['buildings', 'roads', 'areas', 'trees', 'landmarks'];
const load = async (name) => JSON.parse(await readFile(join(CACHE, `${name}.json`), 'utf8')).elements;
const [buildingEls, roadEls, areaEls, treeEls, landmarkEls] = await Promise.all(NAMES.map(load));
const mtimes = await Promise.all(NAMES.map((n) => stat(join(CACHE, `${n}.json`)).then((s) => s.mtimeMs)));
const retrievedAt = new Date(Math.max(...mtimes)).toISOString().replace(/\.\d+Z$/, 'Z');
// Transit nodes (subway entrances, bus stops) came later (2026-10-16); a cache without them bakes empty lists.
const transitFile = join(CACHE, 'transit.json');
const transitEls = await readFile(transitFile, 'utf8').then((t) => JSON.parse(t).elements, () => null);
const transitAt = transitEls ? new Date((await stat(transitFile)).mtimeMs).toISOString().replace(/\.\d+Z$/, 'Z') : null;

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

// ---- Buildings ----
const SKIP_BUILDING = new Set(['no', 'construction', 'proposed', 'demolished', 'roof', 'destroyed']);
function skipBuilding(t) {
  if (!t.building || SKIP_BUILDING.has(t.building)) return true;
  if (t.construction || t.proposed || t['demolished:building']) return true;
  const layer = num(t.layer);
  if ((layer !== undefined && layer < 0) || t.location === 'underground') return true;
  return false;
}

function parseHeight(raw) {
  if (raw == null) return undefined;
  const s = String(raw).trim().toLowerCase();
  const feet = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in))?$/);
  if (feet) return Number(feet[1]) * 0.3048 + (feet[2] ? Number(feet[2]) * 0.0254 : 0);
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:m|metres|meters)?$/);
  return m ? Number(m[1].replace(',', '.')) : undefined;
}

const TYPE_HEIGHT = [
  [['house', 'terrace', 'detached', 'semidetached_house'], 12],
  [['residential', 'apartments'], 18],
  [['brownstone', 'townhouse'], 13],
  [['commercial', 'retail'], 10],
  [['office'], 30],
  [['hotel'], 30],
  [['church', 'cathedral', 'chapel'], 18],
  [['school', 'university', 'college'], 16],
  [['hospital'], 24],
  [['civic', 'public', 'government'], 20],
  [['garage', 'garages', 'shed', 'hut', 'kiosk'], 4],
  [['industrial', 'warehouse'], 9],
];
const typeHeight = (b) => TYPE_HEIGHT.find(([k]) => k.includes(b))?.[1] ?? 10;

const RELIGIOUS = ['church', 'cathedral', 'chapel', 'mosque', 'synagogue', 'temple', 'religious'];
const CIVIC_B = ['government', 'public', 'civic', 'school', 'university', 'college', 'hospital', 'train_station', 'fire_station'];
const CIVIC_A = ['school', 'townhall', 'courthouse', 'library', 'hospital', 'police', 'fire_station'];
const RESIDENTIALISH = ['house', 'terrace', 'residential', 'apartments', 'detached', 'semidetached_house', 'brownstone', 'townhouse'];
const COMMERCIALISH = ['commercial', 'retail', 'hotel', 'office'];
const PLAIN = ['garage', 'garages', 'shed', 'industrial', 'warehouse', 'kiosk', 'hut'];
const NYCHA = /New York City Housing Authority|NYCHA/i;
// Stable per-id hash (Knuth multiplicative, 32-bit) so reruns pick the same brownstones
const hash100 = (id) => (Math.imul(id >>> 0, 2654435761 | 0) >>> 0) % 100;

function classify(t, h, id) {
  const b = t.building;
  const mat = t['building:material'] ?? '';
  const facade = t['building:facade:material'] ?? t['facade:material'] ?? '';
  if (RELIGIOUS.includes(b) || t.amenity === 'place_of_worship') return ['church', false];
  if (NYCHA.test(t.operator ?? '') || NYCHA.test(t.owner ?? '')) return ['nycha', false];
  if (CIVIC_B.includes(b) || CIVIC_A.includes(t.amenity) || t.office === 'government') return ['civic', false];
  if (mat === 'glass' || facade === 'glass') return ['glass', false];
  if (['office', 'commercial', 'hotel', 'yes'].includes(b) && h >= 45) return ['glass', false];
  if ((mat === 'stone' || mat === 'sandstone') && h <= 22) return ['brownstone', false];
  if (mat === 'brick') return ['brick', false];
  if (RESIDENTIALISH.includes(b) || (b === 'yes' && h <= 22)) {
    if (h <= 18) return [hash100(id) < 55 ? 'brownstone' : 'brick', true];
    return ['brick', true];
  }
  if (COMMERCIALISH.includes(b) && h < 45) return ['brick', true];
  if (PLAIN.includes(b)) return ['plain', true];
  return ['plain', true];
}

function buildingProps(t, id) {
  let h = parseHeight(t.height);
  let heightEstimated = false;
  if (!(h > 0)) {
    const levels = num(t['building:levels']);
    if (levels > 0) h = levels * 3.2 + 1.0;
    else {
      h = typeHeight(t.building);
      heightEstimated = true;
    }
  }
  h = Math.min(600, Math.max(2, round(h)));
  const [c, classEstimated] = classify(t, h, id);
  return { h, c, e: (heightEstimated ? 1 : 0) | (classEstimated ? 2 : 0) };
}

const prepRing = (geom, tol) => cleanRing(simplify(geom.map(project), tol));
const ringOk = (r, minArea) => r.length >= 3 && Math.abs(area(r)) >= minArea;
const withinReach = (ring) => ring.every(([x, z]) => Math.hypot(x, z) <= 1900);

const buildings = [];
const buildingRings = []; // parallel: projected ring for each output building
const keepBuilding = (id, ring, holes, t) => {
  if (!inSquare(centroid(ring)) || !withinReach(ring)) return;
  const props = buildingProps(t, Number(String(id).split(':')[2]));
  const out = { id, p: flat(ring) };
  if (holes.length) out.i = holes.map(flat);
  out.h = props.h;
  out.c = props.c;
  out.e = props.e;
  const n = nameOf(t);
  if (n) out.n = n;
  buildings.push(out);
  buildingRings.push(ring);
};

for (const el of buildingEls) {
  const t = el.tags ?? {};
  if (skipBuilding(t)) continue;
  if (el.type === 'way') {
    if (!el.geometry || !isClosed(el.geometry)) continue;
    const ring = prepRing(el.geometry.slice(0, -1), 0.3);
    if (!ringOk(ring, 4)) continue;
    keepBuilding(`osm:way:${el.id}`, ring, [], t);
  } else if (el.type === 'relation' && el.members) {
    const ofRole = (role) =>
      assembleRings(el.members.filter((m) => m.type === 'way' && (m.role || 'outer') === role && m.geometry).map((m) => m.geometry))
        .map((g) => prepRing(g.slice(0, -1), 0.3))
        .filter((r) => ringOk(r, 4));
    const outers = ofRole('outer');
    const inners = ofRole('inner');
    outers.forEach((outer, k) => {
      const holes = inners.filter((r) => inside(centroid(r), outer));
      keepBuilding(k === 0 ? `osm:relation:${el.id}` : `osm:relation:${el.id}:${k}`, outer, holes, t);
    });
  }
}

// ---- Roads ----
const ROAD_CLASS = {
  motorway: 'motorway', trunk: 'trunk', primary: 'primary', secondary: 'secondary', tertiary: 'tertiary',
  residential: 'residential', unclassified: 'residential', living_street: 'living', service: 'service',
  pedestrian: 'pedestrian', footway: 'footway', path: 'footway', cycleway: 'cycleway', track: 'service',
};
const ROAD_WIDTH = {
  motorway: 20, trunk: 18, primary: 18, secondary: 14, tertiary: 12, residential: 9, living: 6, service: 5,
  pedestrian: 6, footway: 2.5, sidewalk: 2.5, crossing: 3, cycleway: 2,
};
const SIDEWALK = { primary: 6, trunk: 6, secondary: 5, tertiary: 4.5, residential: 4.5, living: 2 };
const EXCLUDED_HIGHWAY = new Set(['steps', 'corridor', 'elevator', 'proposed', 'construction', 'platform', 'bus_stop', 'raceway']);

const roads = [];
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
    const road = { id: k === 0 ? `osm:way:${w.id}` : `osm:way:${w.id}:${k}`, c, w: width, s, p: flat(line) };
    if (estimated) road.e = 1;
    const n = nameOf(t);
    if (n) road.n = n;
    roads.push(road);
    k++;
  }
}

// ---- Areas ----
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

// ---- Trees ----
const osmTrees = [];
for (const n of treeEls) {
  if (n.type !== 'node') continue;
  const [x, z] = project(n);
  const p = [round(x), round(z)];
  if (inSquare(p)) osmTrees.push(p);
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
osmTrees.forEach((p, i) => treeGrid.insert(i, p[0], p[1], p[0], p[1]));
const nearOsmTree = (p, r) => {
  for (const i of treeGrid.near(p, r)) if (Math.hypot(osmTrees[i][0] - p[0], osmTrees[i][1] - p[1]) < r) return true;
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
      if (nearOsmTree(p, 6) || nearFill(p, 4)) continue;
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
      if (nearOsmTree(p, 3) || nearFill(p, 4)) continue;
      addFill(p);
      parkCount++;
    }
  }
}

// ---- Landmarks ----
const LANDMARKS = [
  { key: 'apollo-theater', re: /Apollo Theat/i },
  { key: 'hotel-theresa', re: /Theresa/i },
  { key: 'acp-state-office', re: /Adam Clayton Powell.*State Office|State Office Building/i },
];
const landmarks = [];
const warnings = [];
for (const { key, re } of LANDMARKS) {
  const candidates = landmarkEls.filter((e) => re.test(e.tags?.name ?? ''));
  let found = null;
  // Prefer a named building footprint; when several match, the one nearest the origin wins
  const named = buildings
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.n && re.test(b.n))
    .sort((u, v) => Math.hypot(...centroid(buildingRings[u.i])) - Math.hypot(...centroid(buildingRings[v.i])));
  if (named.length) found = { ...named[0], name: named[0].b.n };
  if (!found) {
    for (const e of candidates) {
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
    warnings.push(`landmark ${key}: not found in buildings or landmark query, omitted`);
    continue;
  }
  const [x, z] = centroid(buildingRings[found.i]);
  landmarks.push({ key, name: found.name, buildingId: found.b.id, x: round(x), z: round(z) });
}

// ---- Transit: subway entrances and sheltered bus stops ----
const subway = [];
const shelters = [];
for (const e of transitEls ?? []) {
  if (e.type !== 'node' || !Number.isFinite(e.lat) || !Number.isFinite(e.lon)) continue;
  const [x, z] = project(e);
  if (Math.abs(x) > R || Math.abs(z) > R) continue;
  if (e.tags?.railway === 'subway_entrance') subway.push(round(x), round(z));
  else if (e.tags?.highway === 'bus_stop' && e.tags?.shelter === 'yes') shelters.push(round(x), round(z));
}
if (!transitEls) warnings.push('transit: no .cache/transit.json (run fetch.mjs); subway and shelter lists are empty');

// ---- Assemble ----
const dataset = {
  version: 2,
  id: 'harlem-apollo-20261014',
  origin: ORIGIN,
  extentMeters: R,
  source: {
    url: 'https://overpass-api.de/api/interpreter',
    attribution: '© OpenStreetMap contributors',
    license: 'ODbL-1.0',
    retrievedAt,
    query:
      'Overpass bbox 40.801327,-73.961275,40.818773,-73.938225 (origin ±970 m): building ways/relations; highway ways; ' +
      'leisure park|garden|playground|pitch|track|nature_reserve|dog_park, landuse grass|recreation_ground|village_green|cemetery|religious, ' +
      'natural=water, waterway=riverbank, amenity=parking|school, place=square, highway=pedestrian+area=yes; natural=tree nodes; ' +
      'named landmarks Apollo Theater|Theresa|Adam Clayton Powell' +
      (transitAt ? `; railway=subway_entrance and highway=bus_stop nodes (retrieved ${transitAt})` : ''),
  },
  notes: [
    'Coordinates are metres from origin: x = east, -z = north, rounded to 0.1 m.',
    'Building h: OSM height tag (feet converted); else building:levels x 3.2 m + 1.0 m roof allowance; else a building-type estimate (e bit 1).',
    'Building c: church, nycha, civic, glass and material-based classes come from tags; residential and other untagged classes are estimated (e bit 2), with about 55% of low residential buildings drawn as brownstone by a stable id hash.',
    'A building is nycha only when its operator or owner tag names the New York City Housing Authority; appearance or name never marks public housing.',
    'Buildings are not clipped; one is kept when its footprint centroid lies inside the extent square.',
    'Road w: OSM width tag; else lanes x 3.3 m; else a road-class estimate (e = 1). Road s is an estimated sidewalk width per side by class, 0 when the sidewalk is tagged no, none or separate on both sides.',
    'Sidewalks are modelled as symmetric; a sidewalk tagged on one side only keeps the class width on both sides.',
    'Roads are clipped to the extent square plus 40 m; tunnels, steps, indoor and underground ways are dropped; bridges are drawn flat.',
    'Areas are clipped to the extent square; underground and multi-storey parking and landuse=religious are excluded.',
    'transit.subway are railway=subway_entrance nodes; transit.shelters are highway=bus_stop nodes tagged shelter=yes. Both from OSM, positions only.',
    'trees.osm are natural=tree nodes from OSM. trees.fill are generated decoration with a fixed seed (street trees along sidewalks, park trees on a jittered 13 m grid), not OSM features.',
  ],
  buildings,
  roads,
  areas,
  trees: { osm: flat(osmTrees), fill: flat(fill) },
  landmarks,
  transit: { subway, shelters },
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
  `buildings ${buildings.length} ${JSON.stringify(countBy(buildings, (b) => b.c))} heightEstimated ${buildings.filter((b) => b.e & 1).length}` +
    ` · roads ${roads.length} ${JSON.stringify(countBy(roads, (r) => r.c))}` +
    ` · areas ${areas.length} ${JSON.stringify(countBy(areas, (a) => a.k))}` +
    ` · trees osm ${osmTrees.length} fill ${fill.length} (street ${streetCount}, park ${parkCount})` +
    ` · landmarks ${landmarks.length}/3 ${landmarks.map((l) => l.key).join(',')}` +
    ` · subway entrances ${subway.length / 2} · bus shelters ${shelters.length / 2}` +
    ` · ${(Buffer.byteLength(text) / 1024).toFixed(0)} KB · retrievedAt ${retrievedAt}`
);
