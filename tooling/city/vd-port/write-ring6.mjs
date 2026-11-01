// Writes ring 6's block packs (lane A) from bake.mjs --ring ring6's structures into
// packages/app/features/game/world/vd-port/blocks/data-ring6/: the same codec format as write.mjs's home packs —
// VDN1 near/lite cells quantized about their 128 m cell centre (cell-local frames at decode, blocks/codec.ts), VDN2
// where a supertall overflows int16 y (the FiDi rows overflow it like Midtown's), and the persistent-tier shell —
// except that only the cells overlapping the home square (ring6.mjs homeOverlapCell) ship as Metro assets; the rest
// carry `bundled: false` in the manifest and stream through the cell source (world/cell-source, keys
// 'ring6-near/<cell>' and 'ring6-lite/<cell>', registered by write-cells-manifest.mjs).
//
//   node tooling/city/vd-port/write-ring6.mjs    re-writes the packs from .cache/vd-port/structures-ring6.json
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePacks } from './write.mjs';
import { homeOverlapCell } from './ring6.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const OUT = join(ROOT, 'packages/app/features/game/world/vd-port/blocks/data-ring6');

export async function writeRing6Packs(structures, { nearErrM, heroErrM }) {
  await writePacks(structures, {
    nearErrM, heroErrM, outDir: OUT, constName: 'VD_BLOCKS_RING6', fw14: 'ref',
    label: 'ring-6 blocks and landmarks (Downtown: SoHo, Tribeca, the Financial District, Battery Park and the Statue of Liberty)',
    bundled: (cx, cz) => homeOverlapCell(cx, cz, 128),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cache = JSON.parse(await readFile(join(ROOT, 'tooling/city/.cache/vd-port/structures-ring6.json'), 'utf8'));
  await writeRing6Packs(cache.structures, { nearErrM: cache.nearErrM, heroErrM: cache.heroErrM });
}
