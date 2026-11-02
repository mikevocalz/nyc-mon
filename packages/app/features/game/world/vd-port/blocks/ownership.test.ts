import assert from 'node:assert/strict';
import { test } from 'node:test';
import { vdBlocksOwn } from './index.ts';
import { setVdBlockBytes } from './load.ts';
import { readVdStorefrontPlanFromDisk } from '../storefronts/load-from-disk.test-support.ts';
import { VD_BLOCKS } from './data/manifest.ts';
import { VD_BLOCKS_RING1 } from './data-ring1/manifest.ts';
import { VD_BLOCKS_RING2 } from './data-ring2/manifest.ts';
import { VD_BLOCKS_RING3 } from './data-ring3/manifest.ts';
import { VD_BLOCKS_RING4 } from './data-ring4/manifest.ts';
import { VD_BLOCKS_RING5 } from './data-ring5/manifest.ts';
import { VD_BLOCKS_RING6 } from './data-ring6/manifest.ts';
import { VD_BLOCKS_RING7 } from './data-ring7/manifest.ts';
import { VD_BLOCKS_RING8 } from './data-ring8/manifest.ts';
import { VD_BLOCKS_RING9 } from './data-ring9/manifest.ts';
import { VD_BLOCKS_RING10 } from './data-ring10/manifest.ts';

const structures = [VD_BLOCKS.structures,VD_BLOCKS_RING1.structures,VD_BLOCKS_RING2.structures,VD_BLOCKS_RING3.structures,VD_BLOCKS_RING4.structures,VD_BLOCKS_RING5.structures,VD_BLOCKS_RING6.structures,VD_BLOCKS_RING7.structures,VD_BLOCKS_RING8.structures,VD_BLOCKS_RING9.structures,VD_BLOCKS_RING10.structures].flat();
const rings = structures.flatMap(s => s.owned as readonly (readonly (readonly number[])[])[]);
const specs = new Set(structures.filter(s => s.kind === 'fk').map(s => s.id.slice(3)));
// Independent original exhaustive raycast, including its edge comparison rules.
function reference(id: string | null, x: number, z: number): boolean {
  if (id && specs.has(id.split('#')[0]!)) return true;
  for (const ring of rings) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i]!, b = ring[j]!;
      if ((a[1]! > z) !== (b[1]! > z) && x < (b[0]! - a[0]!) * (z - a[1]!) / (b[1]! - a[1]!) + a[0]!) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

test('ownership grid preserves all authored fronts and polygon boundary semantics', () => {
  setVdBlockBytes({ shell: new Uint8Array(), near: new Map(), level: 'near' });
  try {
    const fronts = readVdStorefrontPlanFromDisk().fronts;
    const queries: [string | null, number, number][] = fronts.map(f => [f.src === 0 ? f.id : null, f.p0[0]! + f.u[0]! * f.len / 2 - f.n[0]! * 0.5, f.p0[1]! + f.u[1]! * f.len / 2 - f.n[1]! * 0.5]);
    assert.equal(queries.length, 75691);
    const start = performance.now();
    const expected = queries.map(q => reference(...q));
    const referenceMs = performance.now() - start;
    const indexedStart = performance.now();
    const actual = queries.map(q => vdBlocksOwn(...q));
    const indexedMs = performance.now() - indexedStart;
    assert.deepEqual(actual, expected);
    for (const ring of rings) for (let i = 0; i < ring.length; i++) {
      const point = ring[i]!, next = ring[(i + 1) % ring.length]!;
      for (const [x, z] of [[point[0]!, point[1]!], [(point[0]! + next[0]!) / 2, (point[1]! + next[1]!) / 2]]) {
        for (const offset of [0, -1e-7, 1e-7]) assert.equal(vdBlocksOwn(null, x! + offset, z! + offset), reference(null, x! + offset, z! + offset));
      }
    }
    console.info('[ownership benchmark]', { fronts: queries.length, referenceMs, indexedMs });
  } finally { setVdBlockBytes(null); }
  assert.equal(vdBlocksOwn('fk-anything', 0, 0), false, 'unloaded packs own no fronts');
});
