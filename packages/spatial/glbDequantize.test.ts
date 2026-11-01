import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { decodeComponent, isQuantizedGlb, needsViroRewrite, viroReadableGlb } from './glbDequantize.ts';

type Json = Record<string, any>;

function glb(json: Json, bin: Uint8Array): Uint8Array {
  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const jsonBytes = new Uint8Array((encoded.length + 3) & ~3).fill(0x20);
  jsonBytes.set(encoded);
  const binLength = (bin.length + 3) & ~3;
  const out = new Uint8Array(20 + jsonBytes.length + 8 + binLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.length, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  view.setUint32(20 + jsonBytes.length, binLength, true);
  view.setUint32(24 + jsonBytes.length, 0x004e4942, true);
  out.set(bin, 28 + jsonBytes.length);
  return out;
}

function parse(file: Uint8Array): { json: Json; bin: DataView } {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(file.subarray(20, 20 + jsonLength)));
  const binStart = 20 + jsonLength + 8;
  return { json, bin: new DataView(file.buffer, file.byteOffset + binStart, view.getUint32(20 + jsonLength, true)) };
}

function floats(file: Uint8Array, accessorIndex: number): number[] {
  const { json, bin } = parse(file);
  const accessor = json.accessors[accessorIndex];
  const bufferView = json.bufferViews[accessor.bufferView];
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type as 'VEC3']!;
  return Array.from({ length: accessor.count * width }, (_, i) => bin.getFloat32(bufferView.byteOffset + accessor.byteOffset + i * 4, true));
}

/**
 * Two vertices of int16 normalized POSITION in an 8-byte padded stride (what
 * gltf-transform's quantize writes), uint16 indices, and a sparse int16 morph
 * target that moves vertex 1 only.
 */
function quantizedTriangle(): Uint8Array {
  const bin = new DataView(new ArrayBuffer(32));
  // positions @0, stride 8: (32767, 0, -32767) and (-32768, 16384, 0)
  [[32767, 0, -32767], [-32768, 16384, 0]].forEach((v, i) => v.forEach((c, j) => bin.setInt16(i * 8 + j * 2, c, true)));
  // indices @16: 0, 1
  bin.setUint16(16, 0, true);
  bin.setUint16(18, 1, true);
  // sparse indices @20: [1]; sparse values @24: (0, 32767, 0)
  bin.setUint16(20, 1, true);
  bin.setInt16(24, 0, true);
  bin.setInt16(26, 32767, true);
  bin.setInt16(28, 0, true);
  return glb({
    asset: { version: '2.0' },
    extensionsUsed: ['KHR_mesh_quantization', 'KHR_materials_emissive_strength'],
    extensionsRequired: ['KHR_mesh_quantization'],
    buffers: [{ byteLength: 32 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 16, byteStride: 8 },
      { buffer: 0, byteOffset: 16, byteLength: 4 },
      { buffer: 0, byteOffset: 20, byteLength: 2 },
      { buffer: 0, byteOffset: 24, byteLength: 6 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5122, normalized: true, count: 2, type: 'VEC3', min: [-32768, 0, -32767], max: [32767, 16384, 0] },
      { bufferView: 1, componentType: 5123, count: 2, type: 'SCALAR' },
      { componentType: 5122, normalized: true, count: 2, type: 'VEC3', sparse: { count: 1, indices: { bufferView: 2, componentType: 5123 }, values: { bufferView: 3 } } },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, targets: [{ POSITION: 2 }] }] }],
  }, new Uint8Array(bin.buffer));
}

describe('decodeComponent', () => {
  it('maps normalized integers the way a GPU does and leaves the rest alone', () => {
    assert.equal(decodeComponent(32767, 5122, true), 1);
    assert.equal(decodeComponent(-32768, 5122, true), -1);
    assert.equal(decodeComponent(255, 5121, true), 1);
    assert.equal(decodeComponent(-128, 5120, true), -1);
    assert.equal(decodeComponent(65535, 5123, true), 1);
    assert.equal(decodeComponent(7, 5123, false), 7);
  });
});

/**
 * One skinned vertex: float POSITION, and JOINTS_0 / WEIGHTS_0 as uint8
 * interleaved in a 12-byte stride, the way glTF-Transform writes skinned Mons.
 */
function skinnedVertex(quantized: boolean): Uint8Array {
  const bin = new DataView(new ArrayBuffer(24));
  [0.5, 1, -0.25].forEach((v, i) => bin.setFloat32(i * 4, v, true));
  [3, 86, 0, 1].forEach((v, i) => bin.setUint8(12 + i, v));
  [255, 0, 0, 0].forEach((v, i) => bin.setUint8(16 + i, v));
  return glb({
    asset: { version: '2.0' },
    ...(quantized ? { extensionsUsed: ['KHR_mesh_quantization'], extensionsRequired: ['KHR_mesh_quantization'] } : {}),
    buffers: [{ byteLength: 24 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 12 },
      { buffer: 0, byteOffset: 12, byteLength: 8, byteStride: 4 },
    ],
    accessors: [
      { bufferView: 0, byteOffset: 0, componentType: 5126, count: 1, type: 'VEC3', min: [0.5, 1, -0.25], max: [0.5, 1, -0.25] },
      { bufferView: 1, byteOffset: 0, componentType: 5121, count: 1, type: 'VEC4' },
      { bufferView: 1, byteOffset: 4, componentType: 5121, normalized: true, count: 1, type: 'VEC4' },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }],
  }, new Uint8Array(bin.buffer));
}

function uints(file: Uint8Array, accessorIndex: number): number[] {
  const { json, bin } = parse(file);
  const accessor = json.accessors[accessorIndex];
  const bufferView = json.bufferViews[accessor.bufferView];
  return Array.from({ length: accessor.count * 4 }, (_, i) => bin.getUint32(bufferView.byteOffset + (accessor.byteOffset ?? 0) + i * 4, true));
}

describe('viroReadableGlb', () => {
  it('widens 8-bit joints to uint32 so WebGL 2 accepts them for Viro\'s ivec4 bone_indices', () => {
    for (const quantized of [true, false]) {
      const source = skinnedVertex(quantized);
      assert.equal(needsViroRewrite(source), true);
      const out = viroReadableGlb(source);
      const { json } = parse(out);
      assert.equal(json.accessors[1].componentType, 5125);
      assert.deepEqual(uints(out, 1), [3, 86, 0, 1]);
      assert.equal(needsViroRewrite(out), false);
      // Positions and the joint count are untouched; weights become float only when quantized.
      assert.deepEqual(floats(out, 0), [0.5, 1, -0.25]);
      assert.equal(json.accessors[2].componentType, quantized ? 5126 : 5121);
      if (quantized) assert.deepEqual(floats(out, 2), [1, 0, 0, 0]);
    }
  });

  it('rewrites quantized vertex and sparse morph accessors as float32', () => {
    const source = quantizedTriangle();
    assert.equal(isQuantizedGlb(source), true);
    const out = viroReadableGlb(source);
    const { json } = parse(out);

    assert.deepEqual(json.extensionsUsed, ['KHR_materials_emissive_strength']);
    assert.equal(json.extensionsRequired, undefined);
    assert.equal(isQuantizedGlb(out), false);
    assert.equal(new DataView(out.buffer).getUint32(8, true), out.byteLength);

    const position = json.accessors[0];
    assert.equal(position.componentType, 5126);
    assert.equal(position.normalized, undefined);
    assert.deepEqual(position.min, [-1, 0, -1]);
    assert.deepEqual(position.max, [1, 16384 / 32767, 0]);
    const p = floats(out, 0);
    assert.deepEqual(p.slice(0, 3), [1, 0, -1]);
    assert.equal(p[3], -1);
    assert.ok(Math.abs(p[4]! - 16384 / 32767) < 1e-6);

    const morph = json.accessors[2];
    assert.equal(morph.sparse, undefined);
    assert.deepEqual(floats(out, 2), [0, 0, 0, 0, 1, 0]);

    // Indices stay integers.
    assert.equal(json.accessors[1].componentType, 5123);
  });

  it('returns a file that is not quantized unchanged', () => {
    const plain = glb({ asset: { version: '2.0' }, buffers: [{ byteLength: 4 }] }, new Uint8Array(4));
    assert.equal(viroReadableGlb(plain), plain);
    assert.equal(needsViroRewrite(plain), false);
    assert.equal(isQuantizedGlb(new Uint8Array([1, 2, 3])), false);
    assert.equal(needsViroRewrite(new Uint8Array([1, 2, 3])), false);
  });

  it('refuses accessors that point outside the file instead of allocating for them', () => {
    const hostile = (patch: (json: Json) => void) => {
      const { json } = parse(quantizedTriangle());
      patch(json);
      return glb(json, new Uint8Array(32));
    };
    assert.throws(() => viroReadableGlb(hostile((j) => { j.accessors[0].count = 2 ** 28; })), /past its own data/);
    assert.throws(() => viroReadableGlb(hostile((j) => { j.bufferViews[0].byteStride = 1; })), /cannot read/);
    assert.throws(() => viroReadableGlb(hostile((j) => { j.accessors[0].byteOffset = '4'; })), /cannot read/);
    assert.throws(() => viroReadableGlb(hostile((j) => { j.accessors[0].bufferView = 9; })), /cannot read/);
    assert.throws(() => viroReadableGlb(hostile((j) => { j.accessors[2].sparse.count = 5; })), /cannot read/);
  });

  it('accepts every model the repo ships', () => {
    for (const path of ['../assets/eggs/corner-egg/corner-egg-hatch.glb', '../assets/eggs/prism-egg/prism-egg-hatch.glb', '../assets/eggs/signal-egg/signal-egg-hatch.glb', '../../apps/web/public/mons/squeaklet.glb', '../../apps/web/public/mons/lil-ratti.glb']) {
      const out = viroReadableGlb(new Uint8Array(readFileSync(new URL(path, import.meta.url))));
      assert.equal(isQuantizedGlb(out), false, path);
      assert.equal(needsViroRewrite(out), false, path);
    }
  });

  it('keeps every joint index of the shipped skinned Mons and stores them as uint32', () => {
    for (const path of ['../../apps/web/public/mons/squeaklet.glb', '../../apps/web/public/mons/lil-ratti.glb']) {
      const source = new Uint8Array(readFileSync(new URL(path, import.meta.url)));
      const before = parse(source);
      const out = viroReadableGlb(source);
      const after = parse(out);
      for (const primitive of after.json.meshes[0].primitives) {
        const index = primitive.attributes.JOINTS_0;
        assert.equal(after.json.accessors[index].componentType, 5125, path);
        const accessor = before.json.accessors[index];
        const view = before.json.bufferViews[accessor.bufferView];
        const stride = view.byteStride || 4;
        const expected = Array.from({ length: accessor.count * 4 }, (_, i) => before.bin.getUint8(view.byteOffset + (accessor.byteOffset ?? 0) + Math.floor(i / 4) * stride + (i % 4)));
        assert.deepEqual(uints(out, index), expected, path);
        assert.ok(expected.every((joint) => joint < before.json.skins[0].joints.length), path);
      }
    }
  });

  it('turns the shipped Metro egg into a float file with the same bounds', () => {
    const source = new Uint8Array(readFileSync(new URL('../assets/eggs/metro-egg/metro-egg-hatch.glb', import.meta.url)));
    const before = parse(source).json;
    const out = viroReadableGlb(source);
    const { json } = parse(out);
    assert.equal(json.extensionsUsed, undefined);
    for (const mesh of json.meshes) {
      for (const primitive of mesh.primitives) {
        const accessor = json.accessors[primitive.attributes.POSITION];
        assert.equal(accessor.componentType, 5126);
        const original = before.accessors[primitive.attributes.POSITION];
        const values = floats(out, primitive.attributes.POSITION);
        for (let axis = 0; axis < 3; axis++) {
          const column = values.filter((_, i) => i % 3 === axis);
          assert.ok(Math.abs(Math.min(...column) - Math.max(original.min[axis] / 32767, -1)) < 1e-6);
          assert.ok(Math.abs(Math.max(...column) - original.max[axis] / 32767) < 1e-6);
        }
      }
    }
  });
});
