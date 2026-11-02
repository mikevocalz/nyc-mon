// Writes ring 5's block packs (lane A) from bake.mjs --ring ring5's structures into
// packages/app/features/game/world/vd-port/blocks/data-ring5/: the same codec format as write.mjs's home packs —
// VDN1 near/lite cells quantized about their 128 m cell centre (cell-local frames at decode, blocks/codec.ts), VDN2
// where a supertall overflows int16 y, and the persistent-tier shell — except that only the cells overlapping the
// home square (ring5.mjs homeOverlapCell) ship as Metro assets; the rest carry `bundled: false` in the manifest and
// stream through the cell source (world/cell-source, keys 'ring5-near/<cell>' and 'ring5-lite/<cell>', registered by
// write-cells-manifest.mjs).
//
//   node tooling/city/vd-port/write-ring5.mjs    re-writes the packs from .cache/vd-port/structures-ring5.json
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePacks } from './write.mjs';
import { homeOverlapCell } from './ring5.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const OUT = join(ROOT, 'packages/app/features/game/world/vd-port/blocks/data-ring5');

export async function writeRing5Packs(structures, { nearErrM, heroErrM }) {
  await writePacks(structures, {
    nearErrM, heroErrM, outDir: OUT, constName: 'VD_BLOCKS_RING5', fw14: 'ref',
    label: 'ring-5 blocks and landmarks (Midtown: Times Square, Grand Central, Herald Square, the Fifth Avenue corridor)',
    bundled: (cx, cz) => homeOverlapCell(cx, cz, 128),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cache = JSON.parse(await readFile(join(ROOT, 'tooling/city/.cache/vd-port/structures-ring5.json'), 'utf8'));
  await writeRing5Packs(cache.structures, { nearErrM: cache.nearErrM, heroErrM: cache.heroErrM });
}
