import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import type { Three } from '@acme/ui/three';
import type { CellPackage } from '../../cells/cell-rules.ts';
import { collisionPackage } from './collision-package.ts';
import { createResidentCollisionScene, residentSourceBlocked, residentCollisionRevision } from '../../../resident-collision.ts';
import { slideMove } from '../../../character/locomotion.ts';
import { createChaseCameraConstraint } from '../../../camera-collision.ts';
const T = THREE as unknown as Three;
const region = [-100, -1, -100, 100, 24, 100] as const;
function wall() {
  let released = false;
  const position = new Float32Array([0, 0, 0, 0, 3, 0, 0, 3, 1, 0, 0, 0, 0, 3, 1, 0, 0, 1]);
  const pkg: CellPackage = { cx: 0, cz: 0, num: 0, size: 128, vertexCount: 6, triangles: 2, bytes: position.byteLength,
    bounds: new Float64Array([10, 0, 20, 10, 3, 21]), positionFrame: { kind: 'cell-local', origin: [10, 0, 20] },
    attributes: { position: { array: position, itemSize: 3, normalized: false } },
    release() { released = true; },
  };
  return { pkg, position, get released() { return released; } };
}

test('cooperative proxy survives upload release, blocks the body, and leaves exactly on eviction/dispose', () => {
  const scene = createResidentCollisionScene(), input = wall(), pkg = collisionPackage(T, input.pkg, scene, region);
  let tick = 0, turns = 0;
  while (!pkg.prepare!(tick + 2, () => ++tick)) { turns++; assert.ok(turns < 50); }
  assert.ok(turns > 0, 'construction obeys a one-step deadline');
  assert.equal(residentSourceBlocked(10, 1, 20.5, 0.3), false, 'unattached data is not registered');
  pkg.release!(); assert.equal(input.released, true);
  const mesh = new THREE.Mesh(); pkg.onAttach!(mesh);
  input.position.fill(0);
  assert.equal(residentSourceBlocked(10, 1, 20.5, 0.3), true);
  const player = slideMove(9, 20.5, 3, 0, (x, z) => !residentSourceBlocked(x, 1, z, 0.3, true));
  assert.ok(player.x <= 9.7 && player.x >= 9.6, 'stepped body movement cannot cross the actual thin wall');
  assert.ok(scene.bytes > 0); pkg.releaseResources!(); pkg.releaseResources!();
  assert.equal(scene.bytes, 0); assert.equal(residentSourceBlocked(10, 1, 20.5, 0.3), false);
  scene.dispose(); scene.dispose();
});

test('cancelled preparation retains no collider; new geometry invalidates a stationary camera cache', () => {
  const scene = createResidentCollisionScene(), input = wall(), pkg = collisionPackage(T, input.pkg, scene, region);
  let tick = 0; assert.equal(pkg.prepare!(1, () => ++tick), false); pkg.releaseResources!();
  assert.equal(scene.bytes, 0);
  const constraint = createChaseCameraConstraint(residentSourceBlocked, residentCollisionRevision);
  const pose = () => ({ position: [12, 1.2, 20.5] as [number, number, number], target: [8, 1.2, 20.5] as [number, number, number], distance: 8, pitch: 0 });
  assert.deepEqual(constraint(pose()).position, [12, 1.2, 20.5]);
  while (!pkg.prepare!(Infinity, () => 0)) { /* drain */ }
  const mesh = new THREE.Mesh(); pkg.onAttach!(mesh);
  assert.notDeepEqual(constraint(pose()).position, [12, 1.2, 20.5]);
  mesh.visible = false; scene.changed();
  assert.deepEqual(constraint(pose()).position, [12, 1.2, 20.5]);
  pkg.releaseResources!(); scene.dispose();
});

test('actual stream START drains collision preparation before upload release and eviction removes its proxy', async () => {
  const { createCellStream } = await import('../../cells/cell-stream.ts');
  const { WORLD_PRESETS } = await import('../../../perf/tier-presets.ts');
  const scene = createResidentCollisionScene(), input = wall(), pkg = collisionPackage(T, input.pkg, scene, region);
  const template = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  template.name = 'collision-test';
  const root = new THREE.Group(); root.add(template);
  const stream = createCellStream(T, [], { preset: WORLD_PRESETS['ipad-a12x'], external: [{ template,
    spec: { errorM: 1, chunk: 128, fade: false }, packages: [pkg] }] });
  stream.prime({ x: 9, y: 1, z: 20.5 }, 1000, 200);
  assert.equal(stream.stats.cells, 1); assert.equal(input.released, true);
  assert.equal(residentSourceBlocked(10, 1, 20.5, 0.3), true);
  stream.dispose(); assert.equal(scene.bytes, 0);
  scene.dispose(); template.geometry.dispose(); template.material.dispose();
});
