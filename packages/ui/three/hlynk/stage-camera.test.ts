import assert from 'node:assert/strict';
import test from 'node:test';
import { BODY, FRAME_ASPECT, INTRO, MAX_TILT, REST_YAW, STAGE, stageCameraZ } from './device-geometry.ts';

/** The pre-change formula, kept here to prove phones see the same framing. */
const legacyZ = (aspect: number) => (aspect < 0.75 ? 5.4 / Math.max(aspect / 0.75, 0.6) : 5.4);

test('every aspect a phone stage reaches keeps the old camera distance', () => {
  for (let a = 0.45; a <= 2.5; a += 0.01) {
    assert.ok(Math.abs(stageCameraZ(a) - legacyZ(a)) < 1e-9, `aspect ${a.toFixed(2)} moved`);
  }
});

test('wide panes are height-bound: the device fills the pane height at the authored distance', () => {
  for (const a of [FRAME_ASPECT, 1, 1.33, 1.6, 2.2]) assert.equal(stageCameraZ(a), STAGE.camera.z);
});

test('narrow panes back off continuously, with no floor that crops the sides', () => {
  let prev = Infinity;
  for (let a = 0.2; a < FRAME_ASPECT; a += 0.02) {
    const z = stageCameraZ(a);
    assert.ok(z < prev, `distance must fall as the pane widens (aspect ${a.toFixed(2)})`);
    prev = z;
  }
  assert.ok(stageCameraZ(0.3) > legacyZ(0.3), 'below aspect 0.45 the old floor cropped; the new fit backs off further');
});

test('the body stays inside the horizontal frustum at every pose and aspect', () => {
  const half = (STAGE.camera.fov * Math.PI) / 360;
  const s = STAGE.scale;
  for (let a = 0.25; a <= 2.5; a += 0.05) {
    const z = stageCameraZ(a);
    const halfWidth = Math.tan(half) * a;
    for (let u = 0; u <= 1.0001; u += 0.1) {
      for (const tilt of [-MAX_TILT, 0, MAX_TILT]) {
        const yaw = REST_YAW + INTRO.yaw.turn * (1 - u) + tilt;
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const x = (sx * BODY.W) / 2 * s;
            const d = (sz * BODY.D) / 2 * s;
            const px = x * Math.cos(yaw) + d * Math.sin(yaw);
            const pz = -x * Math.sin(yaw) + d * Math.cos(yaw);
            const ratio = Math.abs(px) / (z - pz);
            assert.ok(ratio <= halfWidth, `aspect ${a.toFixed(2)} crops the body at yaw ${yaw.toFixed(2)}`);
          }
        }
      }
    }
  }
});

test('bad input falls back to the authored frame', () => {
  for (const a of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(stageCameraZ(a), STAGE.camera.z);
});
