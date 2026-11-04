import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { installSourceOutputHook } from './source-output.ts';

test('authored HDR hook runs before fog and premultiplication without a second output transform', () => {
  const material = new THREE.MeshStandardNodeMaterial();
  const calls: string[] = [];
  const initial = THREE.TSL.vec4(2, 1, 0.5, 0.25);
  const eased = THREE.TSL.vec4(1.5, 0.75, 0.375, 0.25);
  const fogged = THREE.TSL.vec4(1, 0.5, 0.25, 0.25);
  const final = THREE.TSL.vec4(0.25, 0.125, 0.0625, 0.25);
  material.setupFog = (_builder, output) => {
    calls.push('fog'); assert.equal(output, eased); return fogged;
  };
  material.premultipliedAlpha = true;
  material.setupPremultipliedAlpha = (_builder, output) => {
    calls.push('premultiply'); assert.equal(output, fogged); return final;
  };
  installSourceOutputHook(material, (output) => {
    calls.push('source'); assert.equal(output, initial); return eased;
  });
  assert.equal(material.setupOutput({} as never, initial), final);
  assert.deepEqual(calls, ['source', 'fog', 'premultiply']);
  assert.equal(material.outputNode, null);
  assert.throws(() => installSourceOutputHook(material, () => eased), /already installed/);
  material.dispose();
});
