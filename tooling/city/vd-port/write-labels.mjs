// Emits the per-cell street-name label package: the compiled tiles' name table (Content/tiles header
// `names`, the CSCL records' own names — no invented text) placed onto the 128 m cell grid. Every named
// road piece registers in each cell its centreline enters, anchored at its in-cell point nearest the cell
// centre with the local heading, so a cell's labels all sit inside the cell it streams with.
//
//   labels/<cx>_<cz>.bin, VGC1 kind 5:
//     u32 nLabels × { u16 name (string) | u32 segId | u8 rclass | u8 pad | f32 x z | f32 y | f32 angle | f32 length }
//
//   node tooling/city/vd-port/write-labels.mjs [--out <dir>]
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CACHE, OUT, PACK_KINDS, PackWriter,
  cellKey, cellOrigin, cellSort, cellsForBounds, loadTiles, pointInCellOn,
} from './vd-game-cells.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));

export function buildLabelCells(tiles) {
  const cells = new Map(); // key -> {cx,cz, labels:[]}
  const cell = (cx, cz) => {
    const k = cellKey(cx, cz);
    let c = cells.get(k);
    if (!c) cells.set(k, (c = { cx, cz, labels: [] }));
    return c;
  };
  for (const t of tiles) {
    for (const r of t.roads) {
      if (!r.name || r.pts.length < 2) continue;
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, length = 0;
      for (let i = 0; i < r.pts.length; i++) {
        const p = r.pts[i];
        minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
        minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]);
        if (i) length += Math.hypot(p[0] - r.pts[i - 1][0], p[2] - r.pts[i - 1][2]);
      }
      for (const [cx, cz] of cellsForBounds(minX, minZ, maxX, maxZ)) {
        // the bounds box is only the candidate: the centreline must enter the cell, and the label sits on
        // its in-cell point nearest the centre, so every label a cell stores lies inside that cell
        const a = pointInCellOn(r.pts, cx, cz);
        if (!a) continue;
        const [ox, oz] = cellOrigin(cx, cz);
        const dist = Math.hypot(a.x - ox, a.z - oz);
        cell(cx, cz).labels.push({
          name: r.name, segId: r.segId, rclass: r.rclass, x: a.x, y: a.y, z: a.z, angle: a.angle, length, dist,
        });
      }
    }
  }
  return cells;
}

export function packLabelCell(c) {
  const w = new PackWriter(PACK_KINDS.labels, c.cx, c.cz);
  const labels = [...c.labels].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.segId - b.segId));
  w.u32(labels.length);
  for (const l of labels) {
    w.u16(w.s(l.name));
    w.u32(l.segId >>> 0);
    w.u8(l.rclass);
    w.u8(0);
    w.f32(l.x - w.ox); w.f32(l.z - w.oz);
    w.f32(l.y);
    w.f32(l.angle);
    w.f32(l.length);
  }
  return w.finish();
}

export async function writeLabelCells({ out = OUT, tiles = null } = {}) {
  const all = tiles ?? loadTiles(CACHE);
  const cells = buildLabelCells(all);
  const dir = join(out, 'labels');
  // A cell that no longer emits must not survive as a stale pack the manifest would still pin.
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const entries = [];
  let labels = 0;
  for (const key of [...cells.keys()].sort(cellSort)) {
    const c = cells.get(key);
    if (c.labels.length === 0) continue;
    const buf = packLabelCell(c);
    await writeFile(join(dir, `${key}.bin`), buf);
    entries.push({ key: `labels/${key}`, file: join(dir, `${key}.bin`) });
    labels += c.labels.length;
  }
  return { entries, counts: { cells: entries.length, labels } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--out');
  const out = i > 0 ? process.argv[i + 1] : OUT;
  const { counts } = await writeLabelCells({ out });
  console.log(`labels: ${counts.cells} cells, ${counts.labels} name anchors`);
}
