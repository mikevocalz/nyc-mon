import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { createMaterialTable, packParameterRows } from './material-table.ts';

test('explicit parameter layouts preserve source fields and reject missing semantics', () => {
  const fields = [{ name: 'seed', size: 1 }, { name: 'color', size: 3 }] as const;
  const packed = packParameterRows('test:rows', fields, [{ seed: 93, color: [2.4465523, -0.5, 0.2] }, { seed: 14, color: [1, 2, 3] }]);
  assert.equal(packed.columns, 2);
  assert.equal(packed.rows, 2);
  assert.deepEqual(Array.from(packed.values), Array.from(new Float32Array([93, 0, 0, 0, 2.4465523, -0.5, 0.2, 0, 14, 0, 0, 0, 1, 2, 3, 0])));
  assert.throws(() => packParameterRows('test:rows', fields, [{ seed: 1 }]), /color.*missing/);
  assert.throws(() => packParameterRows('test:rows', fields, [{ seed: 1, color: [1, 2] }]), /malformed/);
  assert.throws(() => packParameterRows('test:rows', fields, [{ seed: 1e100, color: [1, 2, 3] }]), /exceeds Float32/);
  assert.throws(() => packParameterRows('test:rows', [...fields, fields[0]], []), /empty/);
  assert.throws(() => packParameterRows('test:rows', [...fields, fields[0]], [{ seed: 1, color: [1, 2, 3] }]), /invalid parameter/);
});

test('descriptor tables retain authored HDR values without filtering or color conversion', () => {
  const values = new Float32Array([2.4465523, 1.335714, -10000, 16777215, 0, 1, 2, 3]);
  const table = createMaterialTable(THREE, { name: 'test:descriptor', columns: 1, rows: 2, values });
  assert.equal(table.texture.image.data, values);
  assert.equal(table.bytes, 32);
  assert.equal(table.texture.type, THREE.FloatType);
  assert.equal(table.texture.minFilter, THREE.NearestFilter);
  assert.equal(table.texture.magFilter, THREE.NearestFilter);
  assert.equal(table.texture.colorSpace, THREE.NoColorSpace);
  assert.equal(table.texture.generateMipmaps, false);
  assert.equal(table.texture.flipY, false);
  assert.ok(table.texel(THREE.TSL.float(1), 0).isNode);
  let disposed = 0;
  table.texture.addEventListener('dispose', () => disposed++);
  table.dispose(); table.dispose();
  assert.equal(disposed, 1);
  assert.throws(() => table.texel(THREE.TSL.float(0), 0), /disposed/);
});

test('malformed tables and out-of-range columns fail before shader creation', () => {
  const data = { name: 'test:descriptor', columns: 1, rows: 1, values: new Float32Array(4) };
  for (const dimensions of [{ columns: 0 }, { rows: 0 }, { rows: 16777217 }, { columns: 1.5 }]) {
    assert.throws(() => createMaterialTable(THREE, { ...data, ...dimensions }), /dimensions/);
  }
  assert.throws(() => createMaterialTable(THREE, { ...data, values: new Float32Array(3) }), /length/);
  assert.throws(() => createMaterialTable(THREE, { ...data, values: new Float32Array([NaN, 0, 0, 0]) }), /non-finite/);
  const table = createMaterialTable(THREE, data);
  for (const column of [-1, 1, 0.5]) assert.throws(() => table.texel(THREE.TSL.float(0), column), /column/);
  table.dispose();
});
