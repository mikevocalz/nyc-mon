import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { weldShellSeamNormals } from './shell-seams.ts';

const EGGS = new URL('../../../assets/eggs/', import.meta.url);
const EGG_IDS = ['metro-egg', 'corner-egg', 'prism-egg'] as const;

interface Manifest {
  runtime: { shellPieceNames: string[] };
}

/** Parses a shipped hatch GLB in Node: images are skipped (no decoder here), geometry is real. */
async function loadEgg(eggId: string): Promise<{ gltf: GLTF; manifest: Manifest }> {
  const bytes = readFileSync(new URL(`${eggId}/${eggId}-hatch.glb`, EGGS));
  const loader = new GLTFLoader().register(() => ({
    name: 'TEST_NO_IMAGES',
    loadTexture: () => Promise.resolve(new THREE.Texture()),
  }));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '');
  const manifest = JSON.parse(readFileSync(new URL(`${eggId}/hatch.manifest.json`, EGGS), 'utf8')) as Manifest;
  return { gltf, manifest };
}

interface Corner {
  readonly piece: string;
  readonly position: THREE.Vector3;
  readonly normal: THREE.Vector3;
}

/** Every outer-shell vertex in rest-pose world space, tagged with its hatch piece. */
function outerCorners(root: THREE.Object3D, pieceNames: readonly string[]): Corner[] {
  root.updateMatrixWorld(true);
  const corners: Corner[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || /_Shell(Inner|Edge)$/.test((mesh.material as THREE.Material).name)) return;
    let piece: THREE.Object3D | null = mesh;
    while (piece && !pieceNames.includes(piece.name)) piece = piece.parent;
    if (!piece) return;
    const position = mesh.geometry.getAttribute('position');
    const normal = mesh.geometry.getAttribute('normal');
    const toWorld = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    for (let i = 0; i < position.count; i++) {
      corners.push({
        piece: piece.name,
        position: new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld),
        normal: new THREE.Vector3().fromBufferAttribute(normal, i).applyMatrix3(toWorld).normalize(),
      });
    }
  });
  return corners;
}

/** The widest angle, in degrees, between the normals two different pieces give one point on a cut. */
function widestSeamAngle(corners: readonly Corner[]): { degrees: number; seamPoints: number } {
  const cell = 2e-5;
  const groups = new Map<string, Corner[]>();
  for (const c of corners) {
    const key = `${Math.round(c.position.x / cell)},${Math.round(c.position.y / cell)},${Math.round(c.position.z / cell)}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  let degrees = 0;
  let seamPoints = 0;
  for (const group of groups.values()) {
    if (new Set(group.map((c) => c.piece)).size < 2) continue;
    seamPoints += 1;
    for (const a of group) {
      for (const b of group) {
        if (a.piece !== b.piece) degrees = Math.max(degrees, THREE.MathUtils.radToDeg(a.normal.angleTo(b.normal)));
      }
    }
  }
  return { degrees, seamPoints };
}

/** Snapshot of every inner and rim normal, which the weld must not touch. */
function brokenEdgeNormals(root: THREE.Object3D): Float32Array[] {
  const out: Float32Array[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && /_Shell(Inner|Edge)$/.test((mesh.material as THREE.Material).name)) {
      const normal = mesh.geometry.getAttribute('normal');
      out.push(Float32Array.from({ length: normal.count * 3 }, (_, k) => normal.getComponent(Math.floor(k / 3), k % 3)));
    }
  });
  return out;
}

for (const eggId of EGG_IDS) {
  test(`${eggId}: the resting egg shades as one unbroken shell`, async () => {
    const { gltf, manifest } = await loadEgg(eggId);
    const pieces = manifest.runtime.shellPieceNames;

    const before = widestSeamAngle(outerCorners(gltf.scene, pieces));
    // The bug: each piece's boundary normals lean into its own rim, so two pieces
    // meeting at a cut point well over 90 degrees apart and every cut reads as a crack.
    assert.ok(before.seamPoints > 100, `${eggId}: expected the shell to be cut into pieces, found ${before.seamPoints} seam points`);
    assert.ok(before.degrees > 90, `${eggId}: shipped seam normals disagree by ${before.degrees.toFixed(1)} deg`);

    const edges = brokenEdgeNormals(gltf.scene);
    const changed = weldShellSeamNormals(gltf.scene, pieces);
    assert.ok(changed >= before.seamPoints * 2, `${eggId}: welded ${changed} vertices over ${before.seamPoints} seam points`);

    const after = widestSeamAngle(outerCorners(gltf.scene, pieces));
    assert.equal(after.seamPoints, before.seamPoints);
    // Left over is only the normal attribute's 8/16-bit quantization.
    assert.ok(after.degrees < 2, `${eggId}: seam normals still disagree by ${after.degrees.toFixed(2)} deg`);

    // A shard's broken edge and inside keep their own shading for the hatch.
    assert.deepEqual(brokenEdgeNormals(gltf.scene), edges);
  });
}

test('only cuts between two pieces are welded: one piece alone is left as authored', async () => {
  const { gltf, manifest } = await loadEgg('metro-egg');
  const before = outerCorners(gltf.scene, manifest.runtime.shellPieceNames);
  assert.equal(weldShellSeamNormals(gltf.scene, ['Shell_Cup']), 0);
  const after = outerCorners(gltf.scene, manifest.runtime.shellPieceNames);
  after.forEach((c, i) => assert.ok(c.normal.equals(before[i]!.normal)));
});
