import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import type { Three } from '@acme/ui/three';
import { shadowSafe } from './shadow-safe.ts';

const T = THREE as unknown as Three;

test('an opaque material keeps its colour out of colorNode, and its key still tells it from a twin with another colour', () => {
  const a = new THREE.MeshStandardNodeMaterial(); a.colorNode = THREE.TSL.vec4(THREE.TSL.vec3(1, 0, 0), 1);
  const b = new THREE.MeshStandardNodeMaterial(); b.colorNode = THREE.TSL.vec4(THREE.TSL.texture(new THREE.Texture()).rgb, 1);
  shadowSafe(T, a); shadowSafe(T, b);
  assert.equal(a.colorNode, null);
  assert.equal(b.colorNode, null);
  assert.notEqual(a.customProgramCacheKey(), b.customProgramCacheKey(), 'two graphs, two builder states');
});

test('transparent and alpha-tested materials keep their colorNode: their shadow cut-out reads it', () => {
  const t = new THREE.MeshStandardNodeMaterial({ transparent: true }); t.colorNode = THREE.TSL.vec4(1);
  const c = new THREE.MeshStandardNodeMaterial({ alphaTest: 0.5 }); c.colorNode = THREE.TSL.vec4(1);
  shadowSafe(T, t); shadowSafe(T, c);
  assert.ok(t.colorNode && c.colorNode);
});
