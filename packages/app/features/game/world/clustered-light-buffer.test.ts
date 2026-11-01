// ClusteredLightsNode keeps its per-cluster light lists in an `attributeArray`
// built from an Int32Array. Unpatched three@0.186.1 passed that array on as
// the storage node's bufferCount, and WGSLNodeBuilder.getUniforms coerced it
// with `bufferCount > 0`: one join of the whole array per lit shader stage
// (7.4 M entries at the iPad Pro's 2732 x 2048 buffer). patches/three@0.186.1.patch
// passes `buffer.count` instead; this pins it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import ClusteredLightsNode from 'three/examples/jsm/tsl/lighting/ClusteredLightsNode.js';
import { PHYSICAL_RIG } from './physical-look.ts';

test('attributeArray from a typed array: bufferCount is the element count, not the array', () => {
  const node = THREE.TSL.attributeArray(new Int32Array(64), 'ivec4');
  assert.equal(typeof node.bufferCount, 'number');
  assert.equal(node.bufferCount, 16);
  assert.equal(node.bufferCount, node.value.count);
});

test('the clustered light-index buffer at the iPad Pro drawing buffer has a numeric count', () => {
  const node = new ClusteredLightsNode(128, PHYSICAL_RIG.clusterTileSize, PHYSICAL_RIG.clusterZSlices, PHYSICAL_RIG.clusterMaxPerCluster);
  node.setSize(2732, 2048);
  const indexes = (node as unknown as { _lightIndexes: { bufferCount: unknown; value: { count: number; array: Int32Array } } })._lightIndexes;
  assert.equal(typeof indexes.bufferCount, 'number');
  assert.equal(indexes.bufferCount, indexes.value.count);
  assert.equal(indexes.value.array.length, indexes.value.count * 4);
});
