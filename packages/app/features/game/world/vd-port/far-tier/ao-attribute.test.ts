import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
// @ts-expect-error Three's internal backend utility has no public declaration.
import WebGPUAttributeUtils from 'three/src/renderers/webgpu/utils/WebGPUAttributeUtils.js';
import { farAoValues } from './ao-attribute.ts';

test('far AO uses a supported scalar WebGPU format with the original normalized values', () => {
  const bytes = new Uint8Array([0, 64, 128, 255]);
  const values = farAoValues(bytes, bytes.length);
  assert.equal(farAoValues(bytes, bytes.length), values, 'repeated package reads reuse the conversion');
  assert.deepEqual([...values], [...Float32Array.from(bytes, (value) => value / 255)]);
  const attribute = new THREE.BufferAttribute(values, 1);
  const utility = new WebGPUAttributeUtils({});
  assert.equal(utility._getVertexFormat(attribute), 'float32');
  assert.equal(attribute.normalized, false);
});

test('zero AO shares float storage and remains valid when a larger view is requested', () => {
  const large = farAoValues(null, 100);
  const small = farAoValues(null, 3);
  assert.equal(small.buffer, large.buffer);
  assert.equal(small.length, 3);
  assert.deepEqual([...small], [0, 0, 0]);
  farAoValues(null, 1000);
  assert.deepEqual([...small], [0, 0, 0]);
});
