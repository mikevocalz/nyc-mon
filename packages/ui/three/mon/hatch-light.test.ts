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

/** Hue in degrees and HSL saturation of a three.js colour. */
const hsl = (c: THREE.Color) => {
  const o = { h: 0, s: 0, l: 0 };
  c.getHSL(o, THREE.SRGBColorSpace);
  return { hue: o.h * 360, sat: o.s, light: o.l };
};
const paints = (light: ReturnType<typeof createHatchLight>) =>
  light.group.children
    .filter((o) => (o as THREE.Mesh | THREE.Points).material instanceof THREE.ShaderMaterial)
    .flatMap((o) => Object.entries(((o as THREE.Mesh).material as THREE.ShaderMaterial).uniforms))
    .filter(([, u]) => u.value instanceof THREE.Color)
    .map(([name, u]) => ({ name, ...hsl(u.value as THREE.Color) }));

test('light theme: every light colour is a saturated orange-gold, never a pale cream that greys out on the daylit card', () => {
  const light = createHatchLight(1, { theme: 'light' });
  const all = paints(light);
  assert.ok(all.length >= 4);
  for (const p of all) {
    assert.ok(p.hue >= 18 && p.hue <= 45, `${p.name} hue ${p.hue.toFixed(0)}`);
    assert.ok(p.sat >= 0.85, `${p.name} saturation ${p.sat.toFixed(2)}`);
    assert.ok(p.light <= 0.62, `${p.name} lightness ${p.light.toFixed(2)}`);
  }
  light.dispose();
});

test('dark theme keeps the night palette: the cream heart stays near white', () => {
  const light = createHatchLight(1);
  const cream = paints(light).find((p) => p.name === 'uCream')!;
  assert.ok(cream.light > 0.9);
  light.dispose();
});
