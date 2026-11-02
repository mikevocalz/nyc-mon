// Lane C's per-cell package table: for each cell, the (level, material slot) pairs it holds and their vertex and index
// counts, flat as [level, slot, cast, vertices, indices, ...]. The cell streamer (world/cells/cell-stream.ts) needs a package's
// size and layer before its bytes are fetched; this is that, from the placements and the prototypes' sizes. `cast` is 1
// when any of the batch's pieces casts a shadow (poseCell's castShadow).
//
// bake-structures.mjs calls slotTable() for each cell row. Run directly, it adds the table to the committed manifest
// (packages/app/.../furniture/data/structures.ts) from the committed cell files, without a rebake.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** list: [{ proto, lod }], protoMeta: [{ slot, castShadow, vertices, indices } | null]. */
export function slotTable(list, protoMeta) {
  const acc = new Map();
  for (const x of list) {
    const p = protoMeta[x.proto];
    const k = `${x.lod}:${p.slot}`;
    const e = acc.get(k) ?? [x.lod, p.slot, 0, 0, 0];
    if (p.castShadow) e[2] = 1;
    e[3] += p.vertices; e[4] += p.indices;
    acc.set(k, e);
  }
  return [...acc.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]).flat();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const FURN = join(dirname(fileURLToPath(import.meta.url)), '../../../packages/app/features/game/world/vd-port/furniture');
  const file = join(FURN, 'data/structures.ts');
  const src = readFileSync(file, 'utf8');
  const m = /JSON\.parse\(("(?:[^"\\]|\\.)*")\)/.exec(src);
  if (!m) throw new Error('no manifest literal');
  const manifest = JSON.parse(JSON.parse(m[1]));
  for (const c of manifest.cells) {
    const b = readFileSync(join(FURN, 'cells', `${c.key}.bin`));
    const list = [];
    for (let i = 0; i < c.placements; i++) {
      const o = c.placementsOffset + i * manifest.placementBytes;
      list.push({ proto: b.readUInt32LE(o), lod: b.readUInt32LE(o + 4) });
    }
    c.slots = slotTable(list, manifest.protos);
  }
  writeFileSync(file, src.replace(m[0], `JSON.parse(${JSON.stringify(JSON.stringify(manifest))})`));
  console.log(`slot tables for ${manifest.cells.length} cells, ${manifest.cells.reduce((a, c) => a + c.slots.length / 5, 0)} packages`);
}
