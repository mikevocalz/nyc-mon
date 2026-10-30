// Writes ring 1's block packs (lane A) from bake.mjs --ring ring1's structures into
// packages/app/features/game/world/vd-port/blocks/data-ring1/: the same codec format as write.mjs's home packs —
// VDN1 near/lite cells quantized about their 128 m cell centre (cell-local frames at decode, blocks/codec.ts) and the
// persistent-tier shell — except that only the cells overlapping the home square (ring1.mjs homeOverlapCell) ship as
// Metro assets; the rest carry `bundled: false` in the manifest and stream through the cell source
// (world/cell-source, 'near-ring1/<cell>' and 'lite-ring1/<cell>', registered by write-cells-manifest.mjs).
//
//   node tooling/city/vd-port/write-ring1.mjs    re-writes the packs from .cache/vd-port/structures-ring1.json
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePacks } from './write.mjs';
import { homeOverlapCell } from './ring1.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const OUT = join(ROOT, 'packages/app/features/game/world/vd-port/blocks/data-ring1');

export async function writeRing1Packs(structures, { nearErrM, heroErrM }) {
  await writePacks(structures, {
    nearErrM, heroErrM, outDir: OUT, constName: 'VD_BLOCKS_RING1', fw14: 'ref',
    label: "ring-1 blocks and landmarks (Columbia, Morningside Heights, Grant's Tomb, Riverside Church)",
    bundled: (cx, cz) => homeOverlapCell(cx, cz, 128),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cache = JSON.parse(await readFile(join(ROOT, 'tooling/city/.cache/vd-port/structures-ring1.json'), 'utf8'));
  await writeRing1Packs(cache.structures, { nearErrM: cache.nearErrM, heroErrM: cache.heroErrM });
}
