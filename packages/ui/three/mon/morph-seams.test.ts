import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { weldMorphSeams, weldSceneMorphSeams } from './morph-seams.ts';

const MONS = new URL('../../../../apps/web/public/mons/', import.meta.url);

/** Parses a bundled Mon in Node: images are skipped (no decoder here), geometry and morphs are real. */
async function loadMon(file: string): Promise<GLTF> {
  const bytes = readFileSync(new URL(file, MONS));
  const loader = new GLTFLoader().register(() => ({
    name: 'TEST_NO_IMAGES',
    loadTexture: () => Promise.resolve(new THREE.Texture()),
  }));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '');
}

/** The widest gap a morph target opens between vertices that share a bind position, at full weight. */
function widestSeamGap(geometry: THREE.BufferGeometry, target: number): number {
  const pos = geometry.getAttribute('position');
  const morph = geometry.morphAttributes.position![target]!;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i)},${pos.getY(i)},${pos.getZ(i)}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  let widest = 0;
  for (const group of groups.values()) {
    for (const i of group.slice(1)) {
      const a = group[0]!;
      widest = Math.max(widest, Math.hypot(morph.getX(a) - morph.getX(i), morph.getY(a) - morph.getY(i), morph.getZ(a) - morph.getZ(i)));
    }
  }
  return widest;
}

function bodyMesh(gltf: GLTF): THREE.Mesh {
  let body: THREE.Mesh | null = null;
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.morphTargetDictionary && (!body || m.geometry.getAttribute('position').count > body.geometry.getAttribute('position').count)) body = m;
  });
  assert.ok(body, 'a morphed mesh');
  return body;
}

test('a shape key that moves one copy of a split vertex moves both after the weld, by the larger delta', () => {
  const geometry = new THREE.BufferGeometry();
  // Vertices 0 and 1 share a position (a UV seam); 2 stands alone.
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 1, 0, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0.5, 0.5, 1, 1], 2));
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute([0, 0, 0, 0, 0.01, 0, 0, 0.02, 0], 3)];
  geometry.morphTargetsRelative = true;
  assert.equal(weldMorphSeams(geometry), 1);
  const morph = geometry.morphAttributes.position[0]!;
  assert.deepEqual([morph.getY(0), morph.getY(1), morph.getY(2)].map((v) => +v.toFixed(5)), [0.01, 0.01, 0.02]);
  assert.equal(weldMorphSeams(geometry), 0, 'idempotent');
});

test('split vertices with different skins are left apart', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0.5, 0.5], 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 1, 0, 0, 0], 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0], 4));
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute([0, 0, 0, 0, 0.01, 0], 3)];
  geometry.morphTargetsRelative = true;
  assert.equal(weldMorphSeams(geometry), 0);
});

test('coincident vertices that share a UV are separate surfaces and stay apart (the eyelids)', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0.25, 0.25, 0.25, 0.25], 2));
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.01, 0], 3)];
  geometry.morphTargetsRelative = true;
  assert.equal(weldMorphSeams(geometry), 0);
});

test("Squeaklet's mouthClose no longer tears its UV seams; the shape key still shuts the mouth", async () => {
  const gltf = await loadMon('squeaklet.glb');
  const body = bodyMesh(gltf);
  const close = body.morphTargetDictionary!.mouthClose!;
  const geometry = body.geometry;
  const morph = geometry.morphAttributes.position![close]!;
  const reach = () => {
    let m = 0;
    for (let i = 0; i < morph.count; i++) m = Math.max(m, Math.hypot(morph.getX(i), morph.getY(i), morph.getZ(i)));
    return m;
  };
  const reachBefore = reach();
  // The asset as shipped: at the rest pose (mouthClose 1) seams beside the mouth gape up to 11.6 mm.
  assert.ok(widestSeamGap(geometry, close) > 0.008, `gap before: ${widestSeamGap(geometry, close)}`);
  // Only the 15 torn seam vertices change: not the body's other seams, not the eyelids.
  assert.equal(weldSceneMorphSeams(gltf.scene), 15);
  for (let t = 0; t < geometry.morphAttributes.position!.length; t++) assert.equal(widestSeamGap(geometry, t), 0, `target ${t}`);
  assert.equal(reach(), reachBefore, 'the mouth still closes as far');
  assert.equal(weldSceneMorphSeams(gltf.scene), 0, 'idempotent');
});

test("Lil' Ratti has no torn seams, and the weld leaves it exactly as authored", async () => {
  const gltf = await loadMon('lil-ratti.glb');
  assert.equal(weldSceneMorphSeams(gltf.scene), 0);
});
