import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import type { Three } from '@acme/ui/three';
import { createTriangleCollision, prepareTriangleCollision } from './triangle-collision.ts';
import { constrainChaseCameraPose } from './camera-collision.ts';
import { VD_BLOCKS } from './world/vd-port/blocks/data/manifest.ts';
import { decodeNearCell } from './world/vd-port/blocks/codec.ts';

const T = THREE as unknown as Three;
test('actual resident Apollo triangle blocks the native failure sightline omitted by its footprint', () => {
  const info = VD_BLOCKS.lite.find(c => c.key === '-1_0')!;
  const decoded = decodeNearCell(new Uint8Array(readFileSync(new URL('./world/vd-port/blocks/data/lite/-1_0.bin', import.meta.url))), info.cx, info.cz);
  const start = [-44.102964690734815, 1.2, 10.244732987682424] as [number, number, number];
  const end = [-39.087077759471605, 3.2968473343214173, 13.044430502711991] as [number, number, number];
  const progress = { phase: 'scan', completed: 0, total: 0, fraction: 0 };
  const steps = prepareTriangleCollision(T, { position: decoded.position, index: decoded.index, region: [-1100, -1, -1100, 1100, 24, 1100], progress });
  let next = steps.next(), previous = -1; const phases = new Set<string>();
  while (!next.done) {
    assert.ok(next.value >= previous && next.value <= 1, 'actual inner work progress is monotonic');
    assert.equal(next.value, progress.fraction); previous = next.value; phases.add(progress.phase);
    next = steps.next();
  }
  const proxy = next.value;
  assert.ok(phases.has('scan') && phases.has('copy') && phases.has('bounds') && phases.has('partition'));
  assert.equal(progress.fraction, 1);
  const hit = proxy.firstHit(start, end); assert.ok(hit);
  assert.equal(hit.triangle, 40232); assert.ok(Math.abs(hit.distance - 5.774445748977873) < 0.0001);
  const pose = { position: [...end] as typeof end, target: start, distance: 8, pitch: 0.35 };
  constrainChaseCameraPose(pose, proxy.blocked);
  assert.equal(proxy.firstHit(start, pose.position), null, 'corrected eye has a genuinely clear source-triangle sightline');
  assert.equal(proxy.blocked(...pose.position, 0.25), false);
  assert.ok(Math.hypot(...pose.position.map((v, i) => v - start[i]!)) >= 3);
  const savedBytes = proxy.bytes;
  decoded.position.fill(0); decoded.index.fill(0);
  assert.equal(proxy.firstHit(start, end)?.triangle, 40232, 'proxy owns compact coordinates independently of CPU upload release');
  assert.equal(proxy.bytes, savedBytes);
  console.info('[collision-proxy] Apollo cell', { triangles: proxy.triangles, bytes: proxy.bytes });
});

test('indexed/local geometry supports thin walls and holes without solid bounding boxes', () => {
  const positions = new Float32Array([0, 0, 0, 0, 3, 0, 0, 3, 1, 0, 0, 1]);
  const proxy = createTriangleCollision(T, { position: positions, index: new Uint16Array([0, 1, 2, 0, 2, 3]), origin: [10, 0, 20] });
  assert.equal(proxy.blocked(10.1, 1, 20.5, 0.2), true);
  assert.equal(proxy.blocked(10.1, 1, 22, 0.2), false, 'space beside the actual finite wall remains open');
  assert.equal(proxy.blocked(10.1, 4, 20.5, 0.2), false);
  assert.ok(proxy.firstHit([9, 1, 20.5], [11, 1, 20.5]));
  assert.equal(proxy.firstHit([9, 1, 22], [11, 1, 22]), null);
});
