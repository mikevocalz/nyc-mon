// The ring storefronts' lazy packages are the chunks splitByCell cuts from the resident mesh build() would make of the
// same fronts: same chunks, triangle counts, bounds, bytes and attribute arrays, element for element.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { splitByCell } from '../../cells/cell-rules.ts';
import { emitPlan, SLOTS } from './emit.ts';
import { readVdStorefrontPlanFromDisk } from './load-from-disk.test-support.ts';
import { packageRingStorefronts, storefrontLayout } from './ring-packages.ts';

const PLAN = readVdStorefrontPlanFromDisk();
const CHUNK = { paint: 256, detail: 128, glass: 256 } as const;
// a varying ground, so a front written in a chunk's batch must read the same height it reads in the whole plan
const groundY = (x: number, z: number) => ((Math.floor(x / 7) + Math.floor(z / 11)) & 1) * 0.14;

for (const ring of [1, 2] as const) {
  test(`ring ${ring}: the lazy packages equal splitByCell of the resident mesh`, () => {
    const fronts = PLAN.fronts.filter((f) => f.ring === ring);
    assert.ok(fronts.length > 100, `${fronts.length} ring ${ring} fronts`);
    const lazy = packageRingStorefronts(PLAN, fronts, groundY, CHUNK);
    const whole = emitPlan({ ...PLAN, fronts }, groundY);
    assert.equal(lazy.features.length, whole.features.length, 'every feature counted');
    for (const slot of SLOTS) {
      const B = whole.buffers[slot];
      const g = new THREE.BufferGeometry();
      for (const a of storefrontLayout(slot)) {
        const src = a.name === 'position' ? B.position : a.name === 'color' ? B.color : B.extra[a.name]!;
        if (!a.unorm8) { g.setAttribute(a.name, new THREE.BufferAttribute(src, a.itemSize)); continue; }
        const u8 = new Uint8Array(src.length);
        for (let i = 0; i < src.length; i++) u8[i] = Math.round((a.name === 'color' ? Math.min(1, Math.max(0, src[i]!)) : src[i]!) * 255);
        g.setAttribute(a.name, new THREE.BufferAttribute(u8, a.itemSize, true));
      }
      const want = B.position.length >= 9 ? splitByCell(g as never, CHUNK[slot]) : [];
      const got = lazy.packages[slot];
      assert.deepEqual(got.map((p) => p.num), want.map((p) => p.num), `${slot}: the same chunks`);
      for (let i = 0; i < want.length; i++) {
        const w = want[i]!, p = got[i]!;
        assert.equal(p.vertexCount, w.vertexCount, `${slot} ${p.cx},${p.cz} vertices`);
        assert.equal(p.bytes, w.bytes, `${slot} ${p.cx},${p.cz} bytes`);
        assert.deepEqual([...p.bounds], [...w.bounds], `${slot} ${p.cx},${p.cz} bounds`);
        for (const [name, attr] of Object.entries(w.attributes)) {
          const mine = p.attributes[name]!;
          assert.equal(mine.itemSize, attr.itemSize, name);
          assert.equal(mine.normalized, attr.normalized, name);
          assert.equal(mine.array.constructor, attr.array.constructor, name);
          assert.deepEqual(mine.array, attr.array, `${slot} ${p.cx},${p.cz} ${name}`);
        }
        // released, the next read writes the chunk again
        const first = p.attributes.position!.array;
        p.release!();
        assert.notEqual(p.attributes.position!.array, first);
        assert.deepEqual(p.attributes.position!.array, first);
      }
    }
  });
}
