// Scene culling: a tile-wide instanced prop splits into spatial chunks that
// hide by distance; a big static caster gets position-only stand-ins on the
// shadow layer and stops casting itself; small or masked meshes stay whole.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { CULLING } from '../physical-materials-constants.ts';
import { proxyableMaterial, setupSceneCulling } from './culling.ts';

function props(count: number, spread: number, material = new THREE.MeshStandardNodeMaterial()) {
  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.1, 4, 64, 4), material, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    mesh.setMatrixAt(i, m.makeTranslation(Math.cos(a) * spread, 2, Math.sin(a) * spread));
  }
  mesh.computeBoundingSphere();
  return mesh;
}

test('tile-wide props are chunked and distance culled; instances are kept, none duplicated', () => {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const mesh = props(400, 800);
  mesh.name = 'lamps';
  root.add(mesh);
  const culling = setupSceneCulling(THREE, scene, [root]);
  const chunks = root.children.filter((c) => c.name === 'lamps') as THREE.InstancedMesh[];
  assert.ok(chunks.length > 1, `${chunks.length} chunks`);
  assert.ok(!root.children.includes(mesh), 'the source mesh is replaced');
  assert.equal(chunks.reduce((n, c) => n + c.count, 0), 400);
  assert.equal(culling.culled.length, chunks.length);
  // A 4 m × 0.2 m pole sizes as sqrt(0.2 × 4) ≈ 0.9 m, so its chunks hide past ≈ 980 m (Slop's 1100 px-per-metre rule).
  culling.update({ x: 800, y: 2, z: 0 });
  const visible = chunks.filter((c) => c.visible).length;
  assert.ok(visible > 0 && visible < chunks.length, `${visible} of ${chunks.length} visible`);
  culling.update({ x: 0, y: 5_000, z: 0 });
  assert.equal(chunks.filter((c) => c.visible).length, 0);
});

test('small meshes stay whole', () => {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const few = props(10, 800);
  const tight = props(400, 50);
  root.add(few, tight);
  setupSceneCulling(THREE, scene, [root]);
  assert.ok(root.children.includes(few) && root.children.includes(tight));
});

test('big static casters get shadow stand-ins on the cascade layer', () => {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  // 40 000 triangles over a 900 m sweep: past both proxy gates.
  const caster = props(160, 450);
  caster.castShadow = true;
  root.add(caster);
  const enabled: number[] = [];
  const cams = [0, 1].map(() => ({ layers: { enable: (l: number) => enabled.push(l) } }));
  const culling = setupSceneCulling(THREE, scene, [root], { getCamera: (i) => cams[i], getViewportCount: () => 2 }, { minChunkTriangles: Infinity });
  assert.ok(culling.proxies.length > 1, `${culling.proxies.length} stand-ins`);
  assert.equal(caster.castShadow, false, 'the original stops casting');
  for (const p of culling.proxies) {
    assert.ok(p.layers.isEnabled(CULLING.shadowProxyLayer));
    assert.equal(p.castShadow, true);
    assert.equal(p.receiveShadow, false);
  }
  assert.deepEqual(enabled, [CULLING.shadowProxyLayer, CULLING.shadowProxyLayer]);
  const instances = culling.proxies.reduce((n, p) => n + (p as THREE.InstancedMesh).count, 0);
  assert.equal(instances, 160);
});

test('masked, displaced or see-through materials never stand in as bare positions', () => {
  assert.equal(proxyableMaterial(new THREE.MeshStandardNodeMaterial()), true);
  const masked = new THREE.MeshStandardNodeMaterial();
  masked.maskNode = THREE.TSL.float(1).greaterThan(0);
  assert.equal(proxyableMaterial(masked), false);
  assert.equal(proxyableMaterial(new THREE.MeshStandardNodeMaterial({ transparent: true })), false);
  assert.equal(proxyableMaterial([new THREE.MeshStandardNodeMaterial()]), false);
});

test('chunks share the source vertex data and copy each instance once', () => {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const mesh = props(400, 800);
  mesh.name = 'lamps';
  root.add(mesh);
  const source = mesh.geometry;
  setupSceneCulling(THREE, scene, [root]);
  const chunks = root.children.filter((c) => c.name === 'lamps') as THREE.InstancedMesh[];
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    for (const name of Object.keys(source.attributes)) {
      assert.equal(chunk.geometry.getAttribute(name), source.getAttribute(name), `${name} is shared, not copied`);
    }
    assert.equal(chunk.geometry.index, source.index);
  }
  // Instance data: exactly the source's floats, split, with nothing duplicated across chunks.
  const floats = chunks.reduce((n, c) => n + c.instanceMatrix.array.length, 0);
  assert.equal(floats, 400 * 16);
  assert.ok(!root.children.includes(mesh), 'the source mesh leaves the scene');
});
