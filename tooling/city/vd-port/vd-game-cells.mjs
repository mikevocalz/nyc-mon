// Shared plumbing for the Phase 4 game-system emitters (write-colliders / -pednet / -traffic / -spawns /
// -labels). Every emitter decodes the same pinned Valdrada tiles (tooling/city/.cache/valdrada, integrity in
// valdrada/pins.json), cuts its records onto the streamer's 128 m cell grid (world/cells/cell-rules.ts CELL),
// and packs each cell in the shared VGC1 envelope. The loaders live beside the emitted bytes under
// packages/app/features/game/world/vd-port/systems/; cell-pack.ts reads the envelope.
//
// Provenance discipline (same as decode.mjs and living-city/topology.ts): every number below comes from a
// Valdrada record or from a named Valdrada constant — the file names the source line for each rule it ports.
// Where nyc-mon's own topology already fixes a rule (the 20 m junction merge, the left-handed turn split) the
// port keeps that rule and says so; streetNYC's 4 m NODE_R stays the crosswalk attach radius.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeTile, toScene, EXTENT_METERS, tileIdsForSquare } from '../valdrada/decode.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
export const ROOT = join(HERE, '..', '..', '..');
export const CACHE = join(HERE, '..', '.cache', 'valdrada');
export const PINS = join(HERE, '..', 'valdrada', 'pins.json');
/** Where the cell .bin files and the generated assets.ts land. */
export const OUT = join(ROOT, 'packages/app/features/game/world/vd-port/systems/data');
/** The sha256-pinned manifest the cell source verifies the packs against (write-cells-manifest.mjs conventions). */
export const MANIFEST_OUT = join(ROOT, 'packages/app/features/game/world/cell-source/data/vd-systems-manifest.ts');

// --- The cell grid (cells/cell-rules.ts CELL, cellRules.js "cx_cz") --------------------------------
export const CELL = 128;
export const cellKey = (cx, cz) => `${cx}_${cz}`;
export const cellOfPoint = (x, z) => [Math.floor(x / CELL), Math.floor(z / CELL)];
/** Every cell the bounds touch, inclusive — Valdrada's addPrism registration (city/colliders.js). */
export function cellsForBounds(minX, minZ, maxX, maxZ) {
  const out = [];
  for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
    for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) out.push([cx, cz]);
  }
  return out;
}
/** The cell of a polyline's centroid — the cellRules triXZ convention carried to lines. */
export function cellOfPolyline(pts /* [[x,y,z],...] */) {
  let x = 0, z = 0;
  for (const p of pts) { x += p[0]; z += p[2]; }
  return [Math.floor(x / pts.length / CELL), Math.floor(z / pts.length / CELL)];
}
/**
 * The point of a polyline inside cell (cx, cz) nearest the cell centre, sampled every `step` metres along each
 * segment, with the heading of the segment it sits on. null when the line never enters the cell. Keeps an
 * anchor a cell stores inside that cell when the line's bounds put it in several.
 */
export function pointInCellOn(pts /* [[x,y,z],...] */, cx, cz, step = 2) {
  const [ox, oz] = cellOrigin(cx, cz);
  const x0 = cx * CELL, z0 = cz * CELL;
  let best = null, bestD = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / step));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = a[0] + dx * t, z = a[2] + dz * t;
      if (x < x0 || x >= x0 + CELL || z < z0 || z >= z0 + CELL) continue;
      const d = (x - ox) ** 2 + (z - oz) ** 2;
      if (d < bestD) { bestD = d; best = { x, y: a[1] + (b[1] - a[1]) * t, z, angle: Math.atan2(dz, dx) }; }
    }
  }
  return best;
}

/** Absolute cell centre — a pack's positionFrame; local floats sit ±64 m around it. */
export const cellOrigin = (cx, cz) => [cx * CELL + CELL / 2, cz * CELL + CELL / 2];

// --- The VGC1 envelope -----------------------------------------------------------------------------
//  0 'VGC1' | u8 version | u8 kind | i16 cx | i16 cz | u16 reserved | f64 ox | f64 oz | u16 nStrings | strings | payload
// Positions pack cell-local: absolute = frame + local. Y stays absolute (Valdrada's height datum, not a coordinate).
export const PACK_KINDS = { colliders: 1, pednet: 2, traffic: 3, spawns: 4, labels: 5 };

export class PackWriter {
  constructor(kind, cx, cz) {
    this.kind = kind;
    this.cx = cx;
    this.cz = cz;
    [this.ox, this.oz] = cellOrigin(cx, cz);
    this.parts = [];
    this.strings = [];
    this.stringIdx = new Map();
  }
  /** Index into the cell's string table; null/undefined -> 0xffff. */
  s(v) {
    if (v === null || v === undefined) return 0xffff;
    const k = String(v);
    let i = this.stringIdx.get(k);
    if (i === undefined) {
      if (this.strings.length >= 0xffff) throw new Error('string table overflow');
      i = this.strings.length;
      this.stringIdx.set(k, i);
      this.strings.push(k);
    }
    return i;
  }
  buf(n) { const b = Buffer.alloc(n); this.parts.push(b); return b; }
  // Every field is range-checked: a value that does not fit throws instead of wrapping into a valid-looking
  // pack (a 70k-point ring masked to u16, a NaN coordinate, an undefined count written as 0).
  int(v, lo, hi, what) {
    if (!Number.isInteger(v) || v < lo || v > hi) throw new RangeError(`PackWriter: ${what} ${v} outside [${lo}, ${hi}] (${this.kind}:${this.cx}_${this.cz})`);
    return v;
  }
  real(v, what) {
    if (!Number.isFinite(v)) throw new RangeError(`PackWriter: ${what} ${v} is not finite (${this.kind}:${this.cx}_${this.cz})`);
    return v;
  }
  u8(v) { this.buf(1).writeUInt8(this.int(v, 0, 0xff, 'u8')); }
  i8(v) { this.buf(1).writeInt8(this.int(v, -0x80, 0x7f, 'i8')); }
  u16(v) { this.buf(2).writeUInt16LE(this.int(v, 0, 0xffff, 'u16')); }
  i16(v) { this.buf(2).writeInt16LE(this.int(v, -0x8000, 0x7fff, 'i16')); }
  u32(v) { this.buf(4).writeUInt32LE(this.int(v, 0, 0xffffffff, 'u32')); }
  f32(v) { this.buf(4).writeFloatLE(this.real(v, 'f32')); }
  f64(v) { this.buf(8).writeDoubleLE(this.real(v, 'f64')); }
  /** x,z cell-local; y stays absolute (see header comment). */
  xz(x, z) { this.f32(x - this.ox); this.f32(z - this.oz); }
  finish() {
    const head = Buffer.alloc(30);
    head.write('VGC1', 0, 'latin1');
    head.writeUInt8(1, 4);
    head.writeUInt8(this.kind, 5);
    head.writeInt16LE(this.cx, 6);
    head.writeInt16LE(this.cz, 8);
    head.writeUInt16LE(0, 10);
    head.writeDoubleLE(this.ox, 12);
    head.writeDoubleLE(this.oz, 20);
    head.writeUInt16LE(this.strings.length, 28);
    const strs = this.strings.map((s) => {
      const b = Buffer.from(s, 'utf8');
      const len = Buffer.alloc(2);
      len.writeUInt16LE(b.length);
      return Buffer.concat([len, b]);
    });
    return Buffer.concat([head, ...strs, ...this.parts]);
  }
}

// --- Tile loading ------------------------------------------------------------------------------------
/**
 * Decodes the baked square's tiles once: tileIdsForSquare(), the set fetch.mjs downloads and build.mjs bakes.
 * pins.json also lists the far tier's city-wide tiles (fetch.mjs --far), so the pin list is not the tile set.
 * Each tile is re-hashed against its pin and a missing or drifted tile throws. Order = sorted tile ids, so
 * every downstream pass is deterministic.
 */
export function loadTiles(cacheDir = CACHE, pinsPath = PINS) {
  const pins = JSON.parse(readFileSync(pinsPath, 'utf8'));
  return tileIdsForSquare().sort().map((id) => {
    const pin = pins.files?.[`Content/tiles/${id}.bin`];
    if (!pin) throw new Error(`vd-game-cells: ${id} is in the baked square but has no pin in ${pinsPath}`);
    let buf;
    try {
      buf = readFileSync(join(cacheDir, `${id}.bin`));
    } catch {
      throw new Error(`vd-game-cells: ${id}.bin missing from ${cacheDir}; run node tooling/city/valdrada/fetch.mjs`);
    }
    const got = createHash('sha256').update(buf).digest('hex');
    if (got !== pin.sha256 || buf.length !== pin.bytes) {
      throw new Error(`vd-game-cells: ${id} sha256 ${got.slice(0, 12)}/${buf.length} drifts from pin ${pin.sha256.slice(0, 12)}/${pin.bytes}`);
    }
    return decodeTile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  });
}

// --- Valdrada road rules (client/tools/pipeline/compile.mjs + client/src/sim) --------------------------
/** Carriageways peds walk beside and cars drive on: rclass 1 local (<13.5 m), 2 wide avenue (>=13.5 m),
 *  3 CSCL rw 2, 4 rw 9; 5 = ped path, 6 = rw 10 (compile.mjs L685). */
export const isCarriageway = (r) => r.rclass <= 2 && !r.noTraffic;
/** peds.js L243: walkers' streets are rclass <= 2 with no level, pedestrianised included (they get busy 5). */
export const isWalkStreet = (r) => r.rclass <= 2 && r.level === 0;
/** peds.js L254: narrow local streets carry stoops — the free walk is 1.25 m off the kerb, not 1.9. */
export const isNarrowStreet = (r) => r.rclass <= 1 && !r.noTraffic && r.width < 11;
/** Walk-line centre offset from the road centreline (peds.js L256). */
export const walkOffset = (r) => r.width / 2 + (isNarrowStreet(r) ? 1.25 : 1.9);
/** Sidewalk band width by class (compile.mjs L1353: rclass 2 -> 4.6, path -> 0.8, else 3.6). */
export const sidewalkWidth = (r) => (r.rclass === 2 ? 4.6 : r.rclass === 5 ? 0.8 : 3.6);
/** Footfall weight per edge (peds.js L249: pedestrianised 5, avenues 4, locals 1; path runs L305 get 0.6). */
export const edgeBusy = (r) => (r.noTraffic ? 5 : r.rclass === 2 ? 4 : 1);
/** Crosswalk bar width along the street (streetNYC.js L12 / compile.mjs L2276: NYC DOT 25 ft / 15 ft). */
export const xwDepth = (rclass, width) => (rclass === 2 && width >= 16.5 ? 7.62 : 4.57);
/** Crosswalk centre past the junction mouth along the stub (streetNYC.js L13). */
export const rampIn = (rclass, width) => 0.35 + xwDepth(rclass, width) / 2;
/** A road end sits at a node when it lands this close (streetNYC.js NODE_R). */
export const NODE_R = 4.0;
/** Crowd density targets (peds.js PED_TARGET, traffic.js CAR_TARGET) the per-cell budgets share out. */
export const PED_TARGET = 520;
export const CAR_TARGET = 620;

/**
 * Lane centreline lateral offset, Valdrada's own rule (traffic.js _laneOffsetAt): lanes share the usable
 * carriageway after parking; lane 0 rides the right kerb of its travel direction. `dir` +1 is along the stored
 * polyline, -1 against it. Signed offset is + to the LEFT of travel — lane offsets apply at
 * x - dirz*dir*off, z + dirx*dir*off upstream; we store `lateral` and the travel-direction points, the same
 * convention topology.ts LaneEdge uses (lateral > 0 = left of travel).
 */
export function laneLateral(r, dir, laneIndex, lanesDir) {
  const usable = Math.max(3, r.width - (r.park >= 2 ? 4.6 : r.park ? 2.3 : 0) - 0.6);
  const laneW = Math.min(3.4, usable / Math.max(1, r.lanes || 1));
  // Upstream measures the offset to the RIGHT of travel (US keep-right); the LaneEdge contract in
  // topology.ts stores `lateral` + = LEFT of travel, so the emitted value negates upstream's.
  const right = r.oneway !== 0 ? (laneIndex - (lanesDir - 1) / 2) * laneW : (0.5 + laneIndex) * laneW;
  let off = right;
  if ((r.park | 0) === 1) {
    const side = ((r.segId || 0) % 2) ? 1 : -1; // parked curb side, upstream's segId parity
    off -= side * (r.oneway !== 0 ? r.oneway : dir) * 1.15;
  }
  return { lateral: -off, laneW };
}
/** Lanes travelling one direction (traffic.js: oneway -> all lanes; two-way -> floor split, min 1). */
export const lanesInDir = (r) => (r.oneway !== 0 ? r.lanes || 1 : Math.max(1, Math.floor((r.lanes || 2) / 2)));

/**
 * Offset polyline in travel direction. `lat` > 0 moves LEFT of travel in scene space (x east, z south:
 * the left normal is (dz, -dx), same as world/geometry.ts ribbon()'s left side).
 */
export function offsetPolyline(pts /* [[x,y,z],...] */, dir, lat) {
  const travel = dir > 0 ? pts : [...pts].reverse();
  const out = [];
  for (let i = 0; i < travel.length; i++) {
    const [x, y, z] = travel[i];
    // left normal of the averaged adjacent direction
    let dx = 0, dz = 0;
    if (i === 0) { dx = travel[1][0] - x; dz = travel[1][2] - z; }
    else if (i === travel.length - 1) { dx = x - travel[i - 1][0]; dz = z - travel[i - 1][2]; }
    else { dx = travel[i + 1][0] - travel[i - 1][0]; dz = travel[i + 1][2] - travel[i - 1][2]; }
    const l = Math.hypot(dx, dz) || 1;
    out.push([x + (dz / l) * lat, y, z - (dx / l) * lat]);
  }
  return out;
}

/** Trim `len` metres off each end of a polyline (peds.js _clip: centreline back to the junction mouths). */
export function trimPolyline(pts, trimA, trimB) {
  if (pts.length < 2 || (trimA <= 0 && trimB <= 0)) return pts;
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]));
  const total = lens[lens.length - 1];
  const a = Math.min(trimA, total), b = Math.max(a, total - trimB);
  if (b <= a) return [];
  const at = (s) => {
    let i = 1;
    while (i < lens.length - 1 && lens[i] < s) i++;
    const t = lens[i] === lens[i - 1] ? 0 : (s - lens[i - 1]) / (lens[i] - lens[i - 1]);
    const p = pts[i - 1], q = pts[i];
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  };
  const out = [at(a)];
  for (let i = 1; i < pts.length - 1; i++) if (lens[i] > a && lens[i] < b) out.push(pts[i]);
  out.push(at(b));
  return out;
}

export function polylineLength(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
  return l;
}

/** Junction nodes: tile header `nodes` [x,z,signal] are tile-local; merged across tiles by decimetre key so a
 *  junction on a tile seam keeps one id. Id is `n:<x*10>_<z*10>` on absolute scene metres — position-stable,
 *  identical whichever tile or cell produced it. */
export function nodeId(x, z) {
  return `n:${Math.round(x * 10)}_${Math.round(z * 10)}`;
}

/**
 * Graph node merge radius: road ends this close are arms of one junction (living-city/topology.ts
 * NODE_MERGE_METRES, "20 m joins every real junction"; upstream traffic.js canonicalises ends at 12 m and
 * merges junction arms at 15-22 m). NODE_R stays the crosswalk/curb attach radius (streetNYC.js); used
 * alone for the graph it left 221 junction arms as dead ends 4-30 m from their junction.
 */
export const NODE_MERGE_METRES = 20;

/**
 * The junction graph over the decoded tiles.
 *
 * `sites` are streetNYC's attach: header nodes plus the road ends inside NODE_R of them, and synthetic sites
 * at the quantized end position where no header node is near. Crosswalks and curb dressing hang off sites.
 *
 * `nodes` are the graph nodes the pednet/traffic packs reference: sites whose road ends lie within
 * NODE_MERGE_METRES of each other merge (single link, topology.ts clusterEndpoints). A merged node sits on
 * the header site nearest the arms' centroid, else on the centroid; a site that merges with nothing keeps
 * its own id and position. Kinds use topology.ts's vocabulary ('junction' / 'link' / 'deadEnd' / 'boundary').
 * `endNode` maps 'tile:roadIdx:end' to the graph node.
 */
export function buildNodeMap(tiles) {
  const sites = buildSiteMap(tiles);
  const list = [...sites.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const index = new Map(list.map((s, i) => [s, i]));
  const parent = list.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  const ends = list.flatMap((s) => s.ends.map((e) => ({ e, i: index.get(s) })));
  const G = NODE_MERGE_METRES;
  const grid = new Map();
  for (const it of ends) {
    const k = `${Math.floor(it.e.x / G)}_${Math.floor(it.e.z / G)}`;
    (grid.get(k) ?? grid.set(k, []).get(k)).push(it);
  }
  for (const a of ends) {
    const gx = Math.floor(a.e.x / G), gz = Math.floor(a.e.z / G);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (const b of grid.get(`${gx + dx}_${gz + dz}`) ?? []) {
        if (Math.hypot(a.e.x - b.e.x, a.e.z - b.e.z) > G) continue;
        const ra = find(a.i), rb = find(b.i);
        if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
      }
    }
  }
  const groups = new Map();
  list.forEach((s, i) => { const r = find(i); (groups.get(r) ?? groups.set(r, []).get(r)).push(s); });

  const nodes = new Map();
  const endNode = new Map();
  for (const members of groups.values()) {
    const arms = members.flatMap((s) => s.ends);
    const signal = Math.max(0, ...members.map((s) => s.signal));
    const headers = members.filter((s) => s.header);
    let node;
    if (members.length === 1) {
      const s = members[0];
      node = { id: s.id, x: s.x, z: s.z, signal, header: !!s.header, ends: arms, sites: members };
    } else {
      const cx = arms.reduce((t, e) => t + e.x, 0) / arms.length;
      const cz = arms.reduce((t, e) => t + e.z, 0) / arms.length;
      const host = headers
        .map((s) => ({ s, d: Math.hypot(s.x - cx, s.z - cz) }))
        .sort((a, b) => a.d - b.d || (a.s.id < b.s.id ? -1 : 1))[0]?.s;
      const [x, z] = host ? [host.x, host.z] : [cx, cz];
      node = { id: host ? host.id : nodeId(x, z), x, z, signal, header: !!host, ends: arms, sites: members };
    }
    if (node.ends.length >= 3 || node.signal) node.kind = 'junction';
    else if (node.ends.length === 2) node.kind = 'link';
    else if (!node.header && Math.hypot(node.x, node.z) > EXTENT_METERS) node.kind = 'boundary';
    else node.kind = 'deadEnd';
    if (nodes.has(node.id)) throw new Error(`buildNodeMap: graph node id collision ${node.id}`);
    nodes.set(node.id, node);
    for (const s of members) {
      s.node = node;
      for (const e of s.ends) endNode.set(`${e.tile}:${e.ri}:${e.end}`, node);
    }
  }
  return { nodes, endNode, sites: list };
}

/** streetNYC's attach: header nodes plus every rclass <= 4 road end snapped inside NODE_R, else its own site. */
function buildSiteMap(tiles) {
  const nodes = new Map(); // id -> {id,x,z,signal,kind,ends:[]}
  const ensure = (x, z) => {
    const id = nodeId(x, z);
    let n = nodes.get(id);
    if (!n) nodes.set(id, (n = { id, x, z, signal: 0, kind: null, ends: [] }));
    return n;
  };
  for (const t of tiles) {
    const [ox, oz] = t.origin;
    for (const [nx, nz, sig] of t.tile.header.nodes ?? []) {
      const [x, z] = toScene(nx + ox, nz + oz);
      const n = ensure(x, z);
      n.x = x; n.z = z; // the node record's own position wins over a quantized end's
      n.signal = Math.max(n.signal, sig | 0);
      n.header = true;
    }
  }
  // Attach every carriageway end (traffic.js drives rclass <= 4 minus pedestrianised; pednet's crosswalk
  // stubs filter down to the rclass <= 2 streets streetNYC dresses). Nearest header node inside NODE_R
  // wins, otherwise the quantized end position.
  const headers = [...nodes.values()].filter((n) => n.header);
  for (const t of tiles) {
    t.roads.forEach((r, ri) => {
      if (r.rclass > 4 || r.pts.length < 2) return; // compile.mjs's junction map takes rclass <= 4, ped streets included
      for (const end of [0, 1]) {
        const p = end === 0 ? r.pts[0] : r.pts[r.pts.length - 1];
        const q = end === 0 ? r.pts[1] : r.pts[r.pts.length - 2];
        let best = null, bestD = NODE_R;
        for (const n of headers) {
          const d = Math.hypot(n.x - p[0], n.z - p[2]);
          if (d < bestD) { bestD = d; best = n; }
        }
        const n = best ?? ensure(p[0], p[2]);
        const L = Math.hypot(q[0] - p[0], q[2] - p[2]) || 1;
        n.ends.push({
          road: r, tile: t.key, ri, end,
          dirx: (q[0] - p[0]) / L, dirz: (q[2] - p[2]) / L,
          mouth: (end === 0 ? r.mouthA : r.mouthB) || 0,
          x: p[0], z: p[2],
        });
      }
    });
  }
  return nodes;
}

/** Deterministic emission order: cell keys sort numerically (not lexically) so -7 precedes -1. */
export const cellSort = (a, b) => {
  const [ax, az] = a.split('_').map(Number);
  const [bx, bz] = b.split('_').map(Number);
  return ax - bx || az - bz;
};
