import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { createSurfaceParameters } from './surface-parameters.ts';

const base = {
  materialCount: 3,
  families: [
    { id: 4, fields: [{ name: 'seed', size: 1 }] as const, materials: [{ id: 2, values: { seed: 17 } }, { id: 0, values: { seed: 39 } }] },
    { id: 8, fields: [{ name: 'color', size: 3 }] as const, materials: [{ id: 1, values: { color: [2.4, 0.3, 0.2] } }] },
  ],
  variantFields: [{ name: 'frameRow', size: 1 }] as const, variants: [{ frameRow: 0 }],
  frameFields: [{ name: 'baseY', size: 1 }] as const, frames: [{ baseY: 3.52 }],
};

test('global IDs address compact family tables without per-family descriptor duplication', () => {
  const bank = createSurfaceParameters(THREE, base);
  assert.equal(bank.bytes, 128, '3 descriptors +3 address texels +1 variant +1 frame');
  assert.ok(bank.material(4, THREE.TSL.float(2)).scalar('seed').isNode);
  assert.ok(bank.material(8, THREE.TSL.float(1)).vec3('color').isNode);
  assert.ok(bank.frame(bank.variant(THREE.TSL.float(0)).scalar('frameRow')).scalar('baseY').isNode);
  assert.throws(() => bank.material(99, THREE.TSL.float(0)), /Unbound/);
  assert.throws(() => bank.material(4, THREE.TSL.float(2)).scalar('color'), /Missing or mismatched/);
  bank.dispose(); bank.dispose();
  assert.throws(() => bank.variant(THREE.TSL.float(0)), /disposed/);
});

test('partial table construction disposes owned GPU resources and rejects missing coverage', () => {
  let disposals = 0;
  const three = { ...THREE, DataTexture: class extends THREE.DataTexture {
    constructor(...args: ConstructorParameters<typeof THREE.DataTexture>) {
      super(...args); this.addEventListener('dispose', () => disposals++);
    }
  } };
  assert.throws(() => createSurfaceParameters(three as never, { ...base, materialCount: 4 }), /cover every material/);
  assert.equal(disposals, 2, 'both allocated family tables are released when global coverage fails');
  assert.throws(() => createSurfaceParameters(THREE, { ...base, families: [...base.families, base.families[0]!] }), /family ID/);
});
