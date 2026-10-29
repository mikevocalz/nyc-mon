import assert from 'node:assert/strict';
import test from 'node:test';
import { BODY, EMITTERS, FAN, HEAD_DEPTH, INTRO, MAX_TILT, REST_YAW, STAGE, fanCorners } from './device-geometry.ts';

type V = [number, number, number];

test('the fan is centred on the emitters', () => {
  assert.equal(FAN.x, (EMITTERS.x[0] + EMITTERS.x[1]) / 2);
});

test('the fan opens from the emitters: each layer\'s mouth is no wider than the emitter span', () => {
  const span = (EMITTERS.x[1] - EMITTERS.x[0]) / 2 + EMITTERS.r;
  for (const [base, tip] of FAN.layers) {
    assert.ok(base <= span + 1e-9, `mouth half-width ${base} > emitter half-span ${span}`);
    assert.ok(tip >= base, 'a fan opens upward');
  }
});

test('in model space the fan stays inside the body width and the head depth', () => {
  for (const [x, , z] of fanCorners()) {
    assert.ok(x >= -BODY.W / 2 && x <= BODY.W / 2, `x ${x.toFixed(3)} leaves the body width`);
    // The old crossed plane reached z = ±0.38, in front of the head face (±0.135).
    assert.ok(Math.abs(z) <= HEAD_DEPTH / 2, `z ${z.toFixed(3)} hangs outside the head depth`);
  }
});

/** Model space → screen x (camera units, before the aspect) at a pose. */
function project([x, y, z]: V, yaw: number, tiltX: number, drop: number): number {
  // scale, then rotation.set(tiltX, yaw, 0) in XYZ order (Rx · Ry · v), then the drop.
  const s = STAGE.scale;
  let px = x * s;
  let py = y * s;
  let pz = z * s;
  [px, pz] = [px * Math.cos(yaw) + pz * Math.sin(yaw), -px * Math.sin(yaw) + pz * Math.cos(yaw)];
  [py, pz] = [py * Math.cos(tiltX) - pz * Math.sin(tiltX), py * Math.sin(tiltX) + pz * Math.cos(tiltX)];
  py += STAGE.baseY - drop;
  // Camera at (0, y, z) looking at (0, lookY, 0).
  const c = STAGE.camera;
  const f: V = [0, c.lookY - c.y, -c.z];
  const len = Math.hypot(...f);
  const depth = (px * f[0] + (py - c.y) * f[1] + (pz - c.z) * f[2]) / len;
  return px / depth;
}

/** Corners of the body's top edge and the scanner head: the silhouette the fan rises from. */
function silhouette(): V[] {
  const top = BODY.H / 2;
  const points: V[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      points.push([(sx * BODY.W) / 2, top, (sz * BODY.D) / 2]);
      points.push([0.03 + sx * 0.46, top - 0.02, (sz * HEAD_DEPTH) / 2]);
    }
  }
  return points;
}

test('at every intro, rest and tilt pose the fan projects inside the body\'s silhouette', () => {
  const fan = fanCorners();
  const body = silhouette();
  let poses = 0;
  for (let u = 0; u <= 1.0001; u += 0.05) {
    const yaw = REST_YAW + INTRO.yaw.turn * (1 - u);
    const drop = INTRO.settle.drop * (1 - u);
    for (const tiltY of [-MAX_TILT, 0, MAX_TILT]) {
      for (const tiltX of [-MAX_TILT, 0, MAX_TILT]) {
        poses++;
        const xs = body.map((p) => project(p, yaw + tiltY, tiltX, drop));
        const left = Math.min(...xs);
        const right = Math.max(...xs);
        for (const p of fan) {
          const x = project(p, yaw + tiltY, tiltX, drop);
          assert.ok(x >= left && x <= right, `fan corner leaves the silhouette at yaw ${(yaw + tiltY).toFixed(2)}, tilt ${tiltX.toFixed(2)}`);
        }
      }
    }
  }
  assert.ok(poses > 100);
});
