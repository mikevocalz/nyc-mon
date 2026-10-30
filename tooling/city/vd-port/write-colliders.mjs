// Emits the per-cell collider packages: Valdrada's building footprints extruded to prisms, its street
// network pieces, and its street furniture, registered into every 128 m cell their bounds touch — the same
// overlap registration Valdrada's own collider grid uses (client/src/city/colliders.js addPrism/addBox,
// which exists for exactly this: collision queries against footprints, independent of render LoD).
//
//   colliders/<cx>_<cz>.bin, VGC1 kind 1:
//     u32 nPrisms  × { u32 srcId | u16 ringLen | u8 nHoles | u8 style | i16 landmarkId | u8 flags |
//                      f32 y0 y1 minX minZ maxX maxZ | ringLen × f32 x,z | nHoles × (u16 len + len × f32 x,z) }
//     u32 nRoads   × { u16 id (string) | u32 segId | u16 nameIdx | u8 rclass|noTraffic<<7 | i8 oneway | u8 lanes park level speed |
//                      f32 width mouthA mouthB | u16 npts | npts × f32 x,y,z }
//     u32 nFurn    × { u8 k p0 p1 p2 | f32 x z | f32 y | f32 rot }
//
// A record lands in EVERY cell its bounds touch (a footprint that straddles a seam resolves in both cells),
// each carrying srcId = (tile, building index) so a loader may dedupe across cells. Positions are
// cell-local f32 about the cell centre; the package's positionFrame restores absolute scene metres.
//
//   node tooling/city/vd-port/write-colliders.mjs [--out <dir>]
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CACHE, OUT, PACK_KINDS, PackWriter,
  cellKey, cellsForBounds, cellSort, loadTiles,
} from './vd-game-cells.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));

export function buildColliderCells(tiles) {
  const cells = new Map(); // key -> {cx,cz,prisms:Map(srcId->p),roads:Map,furn:[]}
  const cell = (cx, cz) => {
    const k = cellKey(cx, cz);
    let c = cells.get(k);
    if (!c) cells.set(k, (c = { cx, cz, prisms: new Map(), roads: new Map(), furn: new Map() }));
    return c;
  };
  for (const t of tiles) {
    const [tx, tz] = t.key.slice(2).split('_').map(Number);
    // srcId packs (tile, building) into a u32; past these bounds two buildings would share an id and one
    // would vanish from the dedupe Map
    if (t.buildings.length > 4096 || tx < -64 || tx > 63 || tz < -64 || tz > 63) {
      throw new Error(`write-colliders: ${t.key} (${t.buildings.length} buildings) overflows the srcId packing`);
    }
    t.buildings.forEach((b, bi) => {
      const srcId = (((tx + 64) * 128 + (tz + 64)) * 4096 + bi) >>> 0;
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
      for (const [x, z] of b.ring) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      }
      const prism = {
        srcId, ring: b.ring, holes: b.holes.map((h) => h.ring),
        y0: b.baseY, y1: b.baseY + b.height,
        style: b.style, landmarkId: b.landmarkId, flags: b.flags,
        minX, minZ, maxX, maxZ,
      };
      for (const [cx, cz] of cellsForBounds(minX, minZ, maxX, maxZ)) cell(cx, cz).prisms.set(srcId, prism);
    });
    t.roads.forEach((r, ri) => {
      const id = `${t.key}:${ri}`;
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
      for (const p of r.pts) {
        minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
        minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]);
      }
      const pad = r.width / 2; // a road's carriageway reaches its half width either side of the centreline
      for (const [cx, cz] of cellsForBounds(minX - pad, minZ - pad, maxX + pad, maxZ + pad)) cell(cx, cz).roads.set(id, { ...r, id });
    });
    t.furniture.forEach((f, fi) => {
      const id = ((tx + 64) * 128 + (tz + 64)) * 65536 + fi;
      const [cx, cz] = [Math.floor(f.x / 128), Math.floor(f.z / 128)];
      cell(cx, cz).furn.set(id, f);
    });
  }
  return cells;
}

export function packColliderCell(cell) {
  const w = new PackWriter(PACK_KINDS.colliders, cell.cx, cell.cz);
  const prisms = [...cell.prisms.values()].sort((a, b) => a.srcId - b.srcId);
  w.u32(prisms.length);
  for (const p of prisms) {
    w.u32(p.srcId);
    w.u16(p.ring.length);
    w.u8(p.holes.length);
    w.u8(p.style);
    w.i16(p.landmarkId);
    w.u8(p.flags);
    w.f32(p.y0); w.f32(p.y1);
    w.f32(p.minX - w.ox); w.f32(p.minZ - w.oz); w.f32(p.maxX - w.ox); w.f32(p.maxZ - w.oz);
    for (const [x, z] of p.ring) w.xz(x, z);
    for (const hole of p.holes) {
      w.u16(hole.length);
      for (const [x, z] of hole) w.xz(x, z);
    }
  }
  const roads = [...cell.roads.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  w.u32(roads.length);
  for (const r of roads) {
    w.u16(w.s(r.id));
    w.u32(r.segId >>> 0);
    w.u16(w.s(r.name || null));
    w.u8((r.rclass & 0x7f) | (r.noTraffic ? 0x80 : 0));
    w.i8(r.oneway);
    w.u8(r.lanes); w.u8(r.park); w.u8(r.level); w.u8(r.speed);
    w.f32(r.width); w.f32(r.mouthA); w.f32(r.mouthB);
    w.u16(r.pts.length);
    for (const p of r.pts) { w.f32(p[0] - w.ox); w.f32(p[1]); w.f32(p[2] - w.oz); }
  }
  const furn = [...cell.furn.values()];
  w.u32(furn.length);
  for (const f of furn) {
    w.u8(f.k); w.u8(f.p0); w.u8(f.p1); w.u8(f.p2);
    w.f32(f.x - w.ox); w.f32(f.z - w.oz);
    w.f32(f.y); w.f32(f.rot);
  }
  return w.finish();
}

export async function writeColliderCells({ out = OUT, tiles = null } = {}) {
  const all = tiles ?? loadTiles(CACHE);
  const cells = buildColliderCells(all);
  const dir = join(out, 'colliders');
  // A cell that no longer emits must not survive as a stale pack the manifest would still pin.
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const entries = [];
  let prisms = 0, roads = 0, furn = 0;
  for (const key of [...cells.keys()].sort(cellSort)) {
    const c = cells.get(key);
    const buf = packColliderCell(c);
    await writeFile(join(dir, `${key}.bin`), buf);
    entries.push({ key: `colliders/${key}`, file: join(dir, `${key}.bin`) });
    prisms += c.prisms.size; roads += c.roads.size; furn += c.furn.size;
  }
  return { entries, counts: { cells: entries.length, prisms, roads, furn } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--out');
  const out = i > 0 ? process.argv[i + 1] : OUT;
  const { counts } = await writeColliderCells({ out });
  console.log(`colliders: ${counts.cells} cells, ${counts.prisms} prism registrations, ${counts.roads} road registrations, ${counts.furn} furniture`);
}
