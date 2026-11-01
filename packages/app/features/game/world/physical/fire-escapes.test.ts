// Fire escapes: the hand-merged proxy matches Slop's mergeGeometries of
// six PlaneGeometry pieces, the near/far split follows the focus, and both
// masks compile.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { FIRE_ESCAPE } from '../physical-materials-constants.ts';
import { createFireEscapes, floorArrays, proxyArrays, type FireEscapePlacement } from './fire-escapes.ts';
import { compileWgsl, stubRenderer } from './physical.test-support.ts';

test('the far proxy is Slop proxyGeometry: six planes, translated, rotated and placed', () => {
  const planes = [[3.4, 0, 0.55, 0], [1.1, -1.7, 0, -Math.PI / 2], [1.1, 1.7, 0, Math.PI / 2], [2.4, 0, -0.17, 0], [2.4, 0, 0.52, 0], [0.34, -1.45, 0.56, 0]];
  const expected = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], indices: [] as number[] };
  for (const [width, x, z, rotation] of planes) {
    const g = new THREE.PlaneGeometry(width, 1);
    g.translate(0, 0.5, 0);
    g.rotateY(rotation!);
    g.translate(x!, 0, z!);
    const offset = expected.positions.length / 3;
    expected.positions.push(...g.getAttribute('position').array);
    expected.normals.push(...g.getAttribute('normal').array);
    expected.uvs.push(...g.getAttribute('uv').array);
    expected.indices.push(...Array.from(g.index!.array, (i) => i + offset));
  }
  const ours = proxyArrays();
  const near = (a: number[], b: number[], label: string) => {
    assert.equal(a.length, b.length, label);
    a.forEach((v, i) => assert.ok(Math.abs(v - b[i]!) < 1e-6, `${label}[${i}] ${v} vs ${b[i]}`));
  };
  near(ours.positions, expected.positions, 'position');
  near(ours.normals, expected.normals, 'normal');
  near(ours.uvs, expected.uvs, 'uv');
  assert.deepEqual(ours.indices, expected.indices);
  assert.deepEqual([...new Set(ours.parts)], [1, 3, 4]);
});

test('the floor module has Slop parts 0–4 and 16 treads', () => {
  const a = floorArrays();
  const parts = new Set(a.parts);
  assert.deepEqual([...parts].sort(), [0, 1, 2, 3, 4]);
  // 3 decks + 3 guards + 16 treads + 2 stringers + 2 flight guards + 1 ladder = 27 quads.
  assert.equal(a.indices.length / 6, 27);
});

test('escapes near the focus draw landing by landing, the rest as one proxy each', async () => {
  const escapes = createFireEscapes(THREE);
  const placements: FireEscapePlacement[] = [
    { x: 5, z: 0, y: 3.6, facing: 0, storey: 3.5, landings: 4, h: 11.5 },
    { x: 200, z: 0, y: 3.6, facing: Math.PI, storey: 3.5, landings: 5, h: 15 },
    { x: 0, z: 400, y: 3.6, facing: Math.PI / 2, storey: 3.2, landings: 3, h: 7.4 },
  ];
  escapes.update(placements, 0, 0);
  const [near0, near1, far] = escapes.meshes;
  assert.equal(near0!.count + near1!.count, 4, 'four landings, alternating modules');
  assert.equal(near0!.count, 2);
  assert.equal(far!.count, 2);
  escapes.update(placements, 200, 0);
  assert.equal(near0!.count + near1!.count, 5);
  assert.equal(far!.count, 2);
  // Capacity holds.
  const many = Array.from({ length: FIRE_ESCAPE.maxNearFloors }, (_, i): FireEscapePlacement => ({ x: i * 0.01, z: 0, y: 3, facing: 0, storey: 3.5, landings: 3, h: 8 }));
  escapes.update(many, 0, 0);
  assert.ok(near0!.count + near1!.count <= FIRE_ESCAPE.maxNearFloors);
  assert.equal(near0!.count + near1!.count + far!.count * 3, many.length * 3);

  const renderer = await stubRenderer();
  for (const mesh of escapes.meshes) {
    const out = compileWgsl(renderer, mesh, mesh.material as THREE.Material);
    assert.match(out.vertex, /escapePart/);
  }
  escapes.dispose();
});
