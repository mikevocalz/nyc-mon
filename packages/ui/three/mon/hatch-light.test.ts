import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createHatchLight } from './hatch-light.ts';
import { BEATS, CRACKS, hatchFrame, REDUCED_SECONDS } from './hatch-timeline.ts';

const parts = (light: ReturnType<typeof createHatchLight>) => {
  const sparks = light.group.children.find((o): o is THREE.Points => (o as THREE.Points).isPoints)!;
  const back = light.group.children.find((o) => (o as THREE.Mesh).isMesh && ((o as THREE.Mesh).material as THREE.ShaderMaterial).uniforms?.uRingAge)! as THREE.Mesh;
  const shards = light.group.children.filter((o) => (o as THREE.Mesh).isMesh && ((o as THREE.Mesh).material as THREE.Material).type === 'MeshStandardMaterial');
  return { sparks, back, shards, alpha: () => [...(sparks.geometry.getAttribute('aAlpha').array as Float32Array)] };
};

test('reduced motion: no sparkles, rings or shards at any moment, only the soft glow', () => {
  const light = createHatchLight(1);
  const p = parts(light);
  for (let t = 0; t <= REDUCED_SECONDS + 0.5; t += 1 / 60) {
    light.update(hatchFrame(t, true), t, 1000);
    assert.ok(p.alpha().every((a) => a === 0), `sparkle at ${t}`);
    assert.ok(p.shards.every((s) => !s.visible), `shard at ${t}`);
    const ring = ((p.back.material as THREE.ShaderMaterial).uniforms.uRingAge!.value as THREE.Vector3).toArray();
    assert.deepEqual(ring, [-1, -1, -1]);
  }
  light.dispose();
});

test('full motion: sparkles spiral in through the tension and shards fly at the cracks and the white-out', () => {
  const light = createHatchLight(1);
  const p = parts(light);
  const mid = (BEATS.tension[0] + BEATS.tension[1]) / 2;
  light.update(hatchFrame(mid, false), mid, 1000);
  assert.ok(p.alpha().some((a) => a > 0.2));
  light.update(hatchFrame(CRACKS[0]! + 0.1, false), CRACKS[0]! + 0.1, 1000);
  assert.equal(p.shards.filter((s) => s.visible).length, 1);
  const burst = BEATS.whiteout[0] + 0.2;
  light.update(hatchFrame(burst, false), burst, 1000);
  assert.ok(p.shards.filter((s) => s.visible).length >= 16);
  light.dispose();
});
