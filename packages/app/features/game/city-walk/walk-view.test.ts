import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_CITY_CAMERA } from '../city-camera.ts';
import {
  cameraBasis,
  groundPointForScreen,
  isTap,
  projectToScreen,
  startTravel,
  stepTravel,
  TAP_MAX_MS,
  TAP_MAX_MOVE_PX,
} from './walk-view.ts';

const camera = { ...INITIAL_CITY_CAMERA }; // yaw π/2, distance 220: the look-at is on the ground (lookY 0)
const vp = { width: 800, height: 600 };

test('the look-at point projects to the centre of the canvas', () => {
  const basis = cameraBasis(camera)!;
  const p = projectToScreen(basis, camera.x, 0, camera.z, vp)!;
  assert.ok(Math.abs(p.x - 400) < 0.5, `x ${p.x}`);
  assert.ok(Math.abs(p.y - 300) < 0.5, `y ${p.y}`);
  assert.ok(p.depth > 0);
});

test('the pixel at canvas centre lands back on the look-at point', () => {
  const basis = cameraBasis(camera)!;
  const hit = groundPointForScreen(basis, 400, 300, vp)!;
  assert.ok(Math.abs(hit.x - camera.x) < 0.5, `x ${hit.x}`);
  assert.ok(Math.abs(hit.z - camera.z) < 0.5, `z ${hit.z}`);
});

test('a tap below centre walks forward along the view, one above is sky and rejected', () => {
  const basis = cameraBasis(camera)!;
  const low = groundPointForScreen(basis, 400, 450, vp)!;
  // yaw π/2 looks along -x: below centre is nearer than the look-at, between it and the camera's nadir (x 192).
  assert.ok(low.x > camera.x && low.x < 192, `tap low went to ${low.x}`);
  // Close in (chase pitch ~20 deg) the top of the canvas is above the horizon.
  const lowBasis = cameraBasis({ ...camera, distance: 40 })!;
  const above = groundPointForScreen(lowBasis, 400, 30, vp);
  assert.equal(above, null, 'a ray into the sky has no ground point');
});

test('a point behind the camera does not project', () => {
  const basis = cameraBasis(camera)!;
  // behind = toward +x of the look-at (camera looks along -x).
  assert.equal(projectToScreen(basis, camera.x + 5000, 0, camera.z, vp), null);
});

test('a tap is a short, still press; a drag or a long press is not', () => {
  const down = { x: 100, y: 100, at: 0 };
  assert.equal(isTap(down, { x: 103, y: 99, at: 200 }), true);
  assert.equal(isTap(down, { x: 100 + TAP_MAX_MOVE_PX + 1, y: 100, at: 200 }), false);
  assert.equal(isTap(down, { x: 100, y: 100, at: TAP_MAX_MS + 1 }), false);
});

test('a travel glides from the camera to the point and lands; reduced motion lands at once', () => {
  const t = startTravel(camera, camera.x + 100, camera.z, false)!;
  assert.ok(t && t.duration > 0);
  let s = stepTravel(t, 0.01);
  assert.ok(s.x > camera.x && s.x < camera.x + 100 && !s.done, 'mid-glide');
  for (let i = 0; i < 200 && !s.done; i++) s = stepTravel(t, 1 / 60);
  assert.ok(s.done);
  assert.ok(Math.abs(s.x - (camera.x + 100)) < 1e-6 && Math.abs(s.z - camera.z) < 1e-6);
  const snap = startTravel(camera, camera.x + 100, camera.z, true)!;
  const landed = stepTravel(snap, 0);
  assert.equal(landed.done, true);
  assert.equal(landed.x, camera.x + 100);
});

test('a tap on the doorstep is not worth a glide', () => {
  assert.equal(startTravel(camera, camera.x + 1, camera.z, false), null);
  assert.equal(startTravel(camera, Number.NaN, camera.z, false), null);
});
