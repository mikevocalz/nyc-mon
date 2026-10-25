import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three';
import { JITTER_ZIGZAG, smoothJitter, zigzagRate } from './clip-smoothing.ts';

/** A quaternion track: a slow sway about Y, plus `shake` radians of alternating tremble. */
function track(shake: number) {
  const n = 66;
  const times = Float32Array.from({ length: n }, (_, k) => k / 30);
  const q = new THREE.Quaternion();
  const values = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.3 * Math.sin((k / n) * Math.PI * 2) + (k % 2 ? shake : -shake));
    values.set([q.x, q.y, q.z, q.w], k * 4);
  }
  return new THREE.QuaternionKeyframeTrack('shin_R.quaternion', times, values);
}

test('a trembling rotation track is smoothed; a clean one is left exactly as authored', () => {
  const shaky = track(0.04);
  const clean = track(0);
  const before = Float32Array.from(clean.values);
  assert.ok(zigzagRate(shaky.values, 4) > JITTER_ZIGZAG);
  const clip = new THREE.AnimationClip('emote_tired', 2.2, [shaky, clean]);
  assert.deepEqual(smoothJitter(clip, true), ['shin_R.quaternion']);
  assert.ok(zigzagRate(shaky.values, 4) < 0.05, `after: ${zigzagRate(shaky.values, 4)}`);
  assert.deepEqual(Array.from(clean.values), Array.from(before));
  // Still unit quaternions.
  for (let k = 0; k < shaky.values.length; k += 4) assert.ok(Math.abs(Math.hypot(...shaky.values.subarray(k, k + 4)) - 1) < 1e-5);
});

test("Lil' Ratti's emote_tired shins and ears stop trembling", () => {
  const glb = readFileSync(new URL('../../../../apps/web/public/mons/lil-ratti.glb', import.meta.url));
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8')) as {
    animations: { name: string; channels: { sampler: number; target: { node: number; path: string } }[]; samplers: { input: number; output: number }[] }[];
    accessors: { bufferView: number; byteOffset?: number; count: number; type: string }[];
    bufferViews: { byteOffset?: number }[];
    nodes: { name?: string }[];
  };
  const bin = glb.subarray(20 + jsonLen + 8);
  const read = (i: number) => {
    const a = json.accessors[i]!;
    const n = a.type === 'VEC4' ? 4 : a.type === 'VEC3' ? 3 : 1;
    const off = (json.bufferViews[a.bufferView]!.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return new Float32Array(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * n * 4));
  };
  const anim = json.animations.find((a) => a.name === 'emote_tired')!;
  const tracks = anim.channels
    .filter((c) => c.target.path === 'rotation')
    .map((c) => new THREE.QuaternionKeyframeTrack(`${json.nodes[c.target.node]!.name}.quaternion`, read(anim.samplers[c.sampler]!.input), read(anim.samplers[c.sampler]!.output)));
  const clip = new THREE.AnimationClip('emote_tired', -1, tracks);
  const fixed = smoothJitter(clip, true).sort();
  assert.deepEqual(fixed, ['ear_L.quaternion', 'ear_R.quaternion', 'shin_L.quaternion', 'shin_R.quaternion']);
  for (const t of clip.tracks) assert.ok(zigzagRate(t.values, 4) <= JITTER_ZIGZAG, t.name);
});

test("a walk's legs are real motion and are left as authored", () => {
  const n = 60;
  const times = Float32Array.from({ length: n }, (_, k) => k / 30);
  const q = new THREE.Quaternion();
  const values = new Float32Array(n * 4);
  // A 2 Hz stride swing, as up_walk's thighs.
  for (let k = 0; k < n; k++) {
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5 * Math.sin((k / 30) * Math.PI * 4));
    values.set([q.x, q.y, q.z, q.w], k * 4);
  }
  const thigh = new THREE.QuaternionKeyframeTrack('thigh_L.quaternion', times, values);
  const before = Array.from(thigh.values);
  assert.deepEqual(smoothJitter(new THREE.AnimationClip('up_walk', 2, [thigh]), true), []);
  assert.deepEqual(Array.from(thigh.values), before);
});
