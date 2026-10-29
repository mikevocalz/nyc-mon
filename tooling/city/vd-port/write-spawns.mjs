// Emits the per-cell mon spawn zones: a data-driven spawn table keyed to the 128 m cell grid, built by
// crossing the encounter atlas in packages/content/mons/borough-encounters.ts (bloodline -> Manhattan tier
// + habitat vocabulary) with the habitats Valdrada's own records place inside each cell — the rings then
// read the zones for the cells they stream.
//
// Habitat mapping (content vocabulary on the left, the Valdrada record that earns it on the right):
//   street        rclass <= 2 streets incl. pedestrianised (walk-line anchors, peds.js offsets)
//   transit_set   SUBWAY_ENTRANCE furniture records (FURN 11, decode.mjs)
//   courtyard     rclass-5 footway pieces (interior walkways, off the carriageways)
//   plaza         noTraffic pedestrianised street pieces
//   rooftop       footprints 20 m or taller (roof centroid, on Valdrada's height datum)
//   community_hub landmarkId-bearing footprints and civic/church styles (STYLE 8/9, decode.mjs)
//
// Weights: a bloodline enters a cell's table when its Manhattan tier is set and its habitat list meets the
// cell's; each entry scores TIER_WEIGHT[tier] per matched habitat and the cell's table normalises to 1000
// per-mille. The tier weights are port tuning constants — the atlas carries tiers, not weights.
//
//   spawns/<cx>_<cz>.bin, VGC1 kind 4:
//     u16 habitatsMask | u32 nEntries × { u16 bloodline (string) | u8 tier | u8 matches | u8 habitatsMask | u8 pad | u16 weightPermille }
//     u32 nAnchors × { u8 habitat | u8 pad | f32 x y z }   (x,z cell-local; y absolute datum)
//
//   node tooling/city/vd-port/write-spawns.mjs [--out <dir>]
import { readFileSync } from 'node:fs';
import { rm, mkdir as mkdirP, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CACHE, OUT, PACK_KINDS, PackWriter, ROOT,
  cellKey, cellOfPoint, cellOfPolyline, cellSort, cellsForBounds, isWalkStreet, loadTiles, walkOffset, offsetPolyline,
  pointInCellOn,
} from './vd-game-cells.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));

export const HABITAT = { street: 0, transit_set: 1, courtyard: 2, plaza: 3, rooftop: 4, community_hub: 5 };
export const HABITAT_NAME = Object.fromEntries(Object.entries(HABITAT).map(([k, v]) => [v, k]));
const TIER = { C: 0, U: 1, R: 2, Q: 3, P: 4 };
const TIER_WEIGHT = { C: 100, U: 45, R: 15, Q: 4, P: 2 };
const ROOFTOP_MIN_M = 20;
const MAX_ANCHORS_PER_HABITAT = 4;

/** Reads the encounter atlas's JSON payload (the same slice trick write-cells-manifest.mjs uses on the far manifest). */
export function loadEncounterProfiles(path = join(ROOT, 'packages/content/mons/borough-encounters.ts')) {
  const ts = readFileSync(path, 'utf8');
  const marker = 'boroughEncounterProfiles';
  const start = ts.indexOf('{', ts.indexOf(marker));
  const end = ts.lastIndexOf('}');
  return JSON.parse(ts.slice(start, end + 1));
}

/** Even-odd point-in-polygon over an [x, z] ring (open or closed). */
function inRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** (mx, mz) when it lies on the footprint, else the 1 m grid point inside the ring nearest it. */
export function roofPoint(ring, mx, mz) {
  if (inRing(mx, mz, ring)) return [mx, mz];
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  let best = null, bestD = Infinity;
  for (let x = Math.floor(x0) + 0.5; x < x1; x += 1) {
    for (let z = Math.floor(z0) + 0.5; z < z1; z += 1) {
      if (!inRing(x, z, ring)) continue;
      const d = (x - mx) ** 2 + (z - mz) ** 2;
      if (d < bestD) { bestD = d; best = [x, z]; }
    }
  }
  return best ?? [mx, mz];
}

export function buildSpawnCells(tiles, profiles) {
  const cells = new Map(); // key -> {cx,cz, habitats:Set, anchors:Map<habitat,pts[]>}
  const cell = (cx, cz) => {
    const k = cellKey(cx, cz);
    let c = cells.get(k);
    if (!c) cells.set(k, (c = { cx, cz, habitats: new Set(), anchors: new Map() }));
    return c;
  };
  const habitat = (c, h, pt) => {
    c.habitats.add(h);
    if (pt) {
      const list = c.anchors.get(h) ?? [];
      if (list.length < MAX_ANCHORS_PER_HABITAT) { list.push(pt); c.anchors.set(h, list); }
    }
  };

  for (const t of tiles) {
    for (const r of t.roads) {
      if (r.pts.length < 2) continue;
      // Road habitats register only in cells the line enters, anchored on its in-cell point nearest the
      // centre: a bounds-box cell the line misses gets neither the habitat nor an anchor outside it.
      if (r.noTraffic && r.rclass <= 2) {
        for (const [cx, cz] of cellsForBounds(...roadBounds(r))) {
          const a = pointInCellOn(r.pts, cx, cz);
          if (!a) continue;
          const c = cell(cx, cz);
          habitat(c, HABITAT.plaza, [a.x, a.y, a.z]);
          habitat(c, HABITAT.street, null);
        }
        continue;
      }
      if (isWalkStreet(r)) {
        // walk-line anchor on one band — segId parity picks the side (deterministic)
        const side = (r.segId || 0) % 2 ? 1 : -1;
        const line = offsetPolyline(r.pts, 1, side * walkOffset(r));
        for (const [cx, cz] of cellsForBounds(...roadBounds(r))) {
          const a = pointInCellOn(line, cx, cz);
          if (a) habitat(cell(cx, cz), HABITAT.street, [a.x, a.y, a.z]);
        }
        continue;
      }
      if (r.rclass === 5) {
        for (const [cx, cz] of cellsForBounds(...roadBounds(r))) {
          const a = pointInCellOn(r.pts, cx, cz);
          if (a) habitat(cell(cx, cz), HABITAT.courtyard, [a.x, a.y, a.z]);
        }
      }
    }
    for (const f of t.furniture) {
      if (f.k !== 11) continue; // FURN.SUBWAY_ENTRANCE
      const [cx, cz] = cellOfPoint(f.x, f.z);
      habitat(cell(cx, cz), HABITAT.transit_set, [f.x, f.y, f.z]);
    }
    for (const b of t.buildings) {
      let mx = 0, mz = 0;
      for (const [x, z] of b.ring) { mx += x; mz += z; }
      mx /= b.ring.length; mz /= b.ring.length;
      const top = b.baseY + b.height;
      if (b.height >= ROOFTOP_MIN_M) {
        // a concave footprint's vertex mean can fall off the roof; stand the anchor on the roof itself
        const [rx, rz] = roofPoint(b.ring, mx, mz);
        const [cx, cz] = cellOfPoint(rx, rz);
        habitat(cell(cx, cz), HABITAT.rooftop, [rx, top, rz]);
      }
      if (b.landmarkId !== 0 || b.style === 8 || b.style === 9) { // CIVIC_STONE | CHURCH (decode.mjs STYLE)
        const [cx, cz] = cellOfPoint(mx, mz);
        habitat(cell(cx, cz), HABITAT.community_hub, [mx, b.baseY, mz]);
      }
    }
  }

  // entries: bloodline x cell — the atlas's Manhattan tier where habitats meet
  const bloodlines = Object.keys(profiles).sort();
  for (const c of cells.values()) {
    c.entries = [];
    const scored = [];
    let total = 0;
    for (const bl of bloodlines) {
      const p = profiles[bl];
      const tier = p?.tierByBorough?.Manhattan;
      if (!tier || !Array.isArray(p.habitats)) continue;
      const matches = p.habitats.filter((h) => c.habitats.has(HABITAT[h]));
      if (matches.length === 0) continue;
      const score = (TIER_WEIGHT[tier] ?? 0) * matches.length;
      const mask = matches.reduce((m, h) => m | (1 << HABITAT[h]), 0);
      scored.push({ bloodlineId: bl, tier, matches: matches.length, mask, score });
      total += score;
    }
    c.entries = scored.map((s) => ({ ...s, weight: total > 0 ? Math.round((1000 * s.score) / total) : 0 }));
  }
  return cells;
}

function roadBounds(r) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const p of r.pts) {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]);
  }
  return [minX, minZ, maxX, maxZ];
}

export function packSpawnCell(c) {
  const w = new PackWriter(PACK_KINDS.spawns, c.cx, c.cz);
  w.u16([...c.habitats].reduce((m, h) => m | (1 << h), 0));
  w.u32(c.entries.length);
  for (const e of c.entries) {
    w.u16(w.s(e.bloodlineId));
    w.u8(TIER[e.tier]);
    w.u8(e.matches);
    w.u8(e.mask);
    w.u8(0);
    w.u16(e.weight);
  }
  const anchors = [];
  for (const [h, pts] of [...c.anchors.entries()].sort((a, b) => a[0] - b[0])) {
    for (const p of pts) anchors.push({ h, p });
  }
  w.u32(anchors.length);
  for (const { h, p } of anchors) {
    w.u8(h); w.u8(0);
    w.f32(p[0] - w.ox); w.f32(p[1]); w.f32(p[2] - w.oz);
  }
  return w.finish();
}

export async function writeSpawnCells({ out = OUT, tiles = null, profiles = null } = {}) {
  const all = tiles ?? loadTiles(CACHE);
  const prof = profiles ?? loadEncounterProfiles();
  const cells = buildSpawnCells(all, prof);
  const dir = join(out, 'spawns');
  // A cell that no longer emits must not survive as a stale pack the manifest would still pin.
  await rm(dir, { recursive: true, force: true });
  await mkdirP(dir, { recursive: true });
  const entries = [];
  let entriesTotal = 0, anchors = 0;
  for (const key of [...cells.keys()].sort(cellSort)) {
    const c = cells.get(key);
    if (c.habitats.size === 0) continue;
    const buf = packSpawnCell(c);
    await writeFile(join(dir, `${key}.bin`), buf);
    entries.push({ key: `spawns/${key}`, file: join(dir, `${key}.bin`) });
    entriesTotal += c.entries.length;
    anchors += [...c.anchors.values()].reduce((a, l) => a + l.length, 0);
  }
  return { entries, counts: { cells: entries.length, spawnEntries: entriesTotal, anchors } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--out');
  const out = i > 0 ? process.argv[i + 1] : OUT;
  const { counts } = await writeSpawnCells({ out });
  console.log(`spawns: ${counts.cells} cells, ${counts.spawnEntries} table entries, ${counts.anchors} anchors`);
}
